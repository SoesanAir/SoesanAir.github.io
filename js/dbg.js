/* ============================================================
   DBG — design/telemetry log, ported in spirit from the Unity
   DebugLog + TribalDebugLog pair.

   Same house style as the C# side: every line is "[Subsystem] detail",
   numbers are formatted to 2dp, deltas are signed, and mutations report a
   RUNNING TOTAL so a value's history can be read straight down the log.
   Decision points additionally record which gate fired and why, so a result
   that "feels wrong" can be explained from the log alone rather than guessed at.

   Read it from:
     - Menu -> Design log        (view / copy / download; works on a phone)
     - DBG.text()                (console, or over CDP in tools/)
     - localStorage 'castaway_dbg'
   ============================================================ */
const DBG = (() => {
  /* Two caps, not one, and this matters.

     There used to be a single ring buffer of 4000 entries, commented "~1-2 full
     seasons". That was wrong by more than an order of magnitude — a season logs
     every relationship tick for eighteen castaways and runs to tens of thousands
     of lines — so in practice the START of every season was thrown away before it
     could ever be read, silently. Reported as "the saving of the log is still
     strange", and it was: the log was quietly a tail.

     Memory is not the scarce resource here; localStorage is (about 5MB, and a
     serialised entry is ~150 bytes, so ~4000 is genuinely all that fits alongside
     the save). So the two are now separate: keep a whole season in memory for
     reading and exporting, persist only the recent tail for crash recovery.

     And when the memory cap IS hit, say so — see droppedCount. A truncated log
     that does not admit it is worse than no log. */
  const MEM_MAX = 120000;              // whole season, in memory, for reading/export
  const SAVE_MAX = 3000;               // recent tail only, for surviving a reload
  const KEY = 'castaway_dbg';
  let entries = [];
  let seq = 0;
  let dropped = 0;                     // lost to the memory cap; surfaced, never silent
  let enabled = true;

  /* Subsystem switches, mirroring GameConfig.debugVoting etc. */
  const flags = {
    action: true, rel: true, vote: true, alliance: true,
    lying: true, system: true, sim: true
  };

  const f2 = v => (typeof v === 'number' ? v.toFixed(2) : String(v));
  const sd = v => (v >= 0 ? '+' : '') + v.toFixed(3);   // signed delta

  function stamp() {
    try {
      if (typeof GAME === 'undefined' || !GAME.day) return 'D?/?';
      return `D${GAME.day}/${(GAME.phase || '?').slice(0, 3)}/${(GAME.hoursRemaining ?? 0).toFixed(1)}h`;
    } catch { return 'D?/?'; }
  }

  function push(tag, msg, data) {
    if (!enabled || !flags[tag]) return;
    entries.push({ n: ++seq, at: stamp(), tag, msg, data });
    if (entries.length > MEM_MAX) {
      const lose = entries.length - MEM_MAX;
      entries.splice(0, lose);
      dropped += lose;
    }
    save();
  }

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(entries.slice(-SAVE_MAX))); } catch { /* quota */ }
    }, 400);
  }

  function line(e) {
    let s = `${String(e.n).padStart(5, '0')} ${e.at.padEnd(18)} [${e.tag}] ${e.msg}`;
    if (e.data !== undefined && e.data !== null) s += '  ' + JSON.stringify(e.data);
    return s;
  }

  return {
    flags,
    setEnabled(on) { enabled = !!on; },

    /* --- generic --- */
    log(tag, msg, data) { push(tag, msg, data); },

    /* --- what the PLAYER did: the spine of the log --- */
    action(what, npc, detail) {
      push('action', `${what}${npc ? ' -> ' + npc : ''}${detail ? ' | ' + detail : ''}`);
    },

    /* --- relationship mutations, with running totals (CastawayData.cs style) --- */
    rel(owner, target, field, delta, total, source) {
      push('rel', `${owner} ${field} of ${target} ${sd(delta)} via ${source || 'n/a'} (now ${f2(total)})`);
    },
    vw(owner, target, delta, total, source) {
      push('vote', `[VoteWeight] ${owner} -> ${target} ${sd(delta)} via ${source || 'n/a'} (running total: ${f2(total)})`);
    },

    /* --- decisions: record the inputs, the threshold and the gate that fired,
           so the outcome is reproducible from the log --- */
    decision(system, outcome, detail) {
      push('alliance', `[${system}] ${outcome}`, detail);
    },
    gate(system, gateName, fired, detail) {
      push('alliance', `[${system}] gate ${gateName} ${fired ? 'FIRED' : 'passed'}`, detail);
    },

    system(msg, data) { push('system', msg, data); },
    sim(msg, data) { push('sim', msg, data); },
    lying(msg, data) { push('lying', msg, data); },

    /* --- output --- */
    count() { return entries.length; },
    /* What is actually in here, so the reader is never guessing whether they are
       looking at the whole season or the end of it. */
    stats() {
      return {
        kept: entries.length, dropped, total: seq,
        persisted: Math.min(entries.length, SAVE_MAX),
        whole: dropped === 0
      };
    },
    text(filterTag) {
      const rows = filterTag ? entries.filter(e => e.tag === filterTag) : entries;
      const head = [
        '=== CASTAWAY DESIGN LOG ===',
        `generated: entry ${seq}, ${rows.length} lines`,
        dropped
          ? `TRUNCATED: the first ${dropped} lines of this season were dropped at the ${MEM_MAX} memory cap`
          : 'complete: this is the whole season from day 1',
        `seed: ${(typeof GAME !== 'undefined' && GAME.seasonSeed) || 'n/a'}`,
        `player: ${(typeof GAME !== 'undefined' && GAME.player) ? GAME.player.name + ' (' + GAME.player.gender + ', ' + GAME.player.cluster + ')' : 'n/a'}`,
        '---'
      ].join('\n');
      return head + '\n' + rows.map(line).join('\n');
    },
    dump(filterTag) { console.log(this.text(filterTag)); },
    load() { try { entries = JSON.parse(localStorage.getItem(KEY)) || []; seq = entries.length ? entries[entries.length - 1].n : 0; } catch { entries = []; } },
    clear() { entries = []; seq = 0; dropped = 0; try { localStorage.removeItem(KEY); } catch { } },

    /* Snapshot of the full relationship matrix — the context a bug report needs. */
    snapshot(reason) {
      try {
        if (typeof GAME === 'undefined' || !GAME.cast) return;
        const p = GAME.player.name;
        const rows = GAME.cast.filter(c => !c.eliminated).map(c => ({
          name: c.name, cl: c.cluster, tribe: c.tribeName,
          moral: +c.morale.toFixed(2), ga: +c.stats.gameAwareness.toFixed(2),
          relP: +c.getRel(p).toFixed(2), trustP: +c.getTrust(p).toFixed(2)
        }));
        push('system', `SNAPSHOT (${reason}) alive=${rows.length}`, rows);
      } catch (e) { push('system', 'snapshot failed: ' + e.message); }
    }
  };
})();
