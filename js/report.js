/* ============================================================
   REPORT — a season, condensed into something worth reading.

   The raw design log is ~300KB of prose. That is the right thing when you already
   know what you are looking for and the wrong thing when somebody asks "what
   happened in my season". This builds two artefacts from the same data:

     brief()  under ~3.5KB. Outcome, the shape of the season, the balance flags,
              and anything that looks wrong. Small enough to publish anywhere or
              paste into a chat.
     full()   the brief plus the cast table, the day-by-day timeline, the dialogue
              usage counts and the tail of the raw log.

   The interesting part is FLAGS. The game now watches itself while you play and
   records the things a player cannot see: a dialogue line that came up nine
   times, a need that sat at zero for a fortnight, a castaway nobody ever voted
   for. Those are the bug reports, and they write themselves.
   ============================================================ */

'use strict';

/* ---------- line-usage census ----------
   Every line the game speaks gets counted. Repetition has been the single most
   common complaint about this project ("I keep hearing the hilarious and unhinged
   line"), and it is invisible from the inside — you cannot tell a 1-in-10 roll
   that came up twice from a pool with one entry in it. Now the log can. */
const LineCensus = {
  seen: new Map(),      // line -> { n, pools:Set }
  pools: new Map(),     // pool key -> count
  note(pool, line) {
    if (!line) return;
    this.pools.set(pool, (this.pools.get(pool) || 0) + 1);
    const key = String(line).slice(0, 90);
    let e = this.seen.get(key);
    if (!e) { e = { n: 0, pool }; this.seen.set(key, e); }
    e.n++;
  },
  reset() { this.seen.clear(); this.pools.clear(); },
  /* Lines that came up often enough that the player would notice. */
  repeats(min) {
    const out = [];
    for (const [line, e] of this.seen) if (e.n >= (min || 4)) out.push({ line, n: e.n, pool: e.pool });
    return out.sort((a, b) => b.n - a.n);
  },
  total() { let t = 0; for (const [, e] of this.seen) t += e.n; return t; },
  distinct() { return this.seen.size; }
};

/* ---------- day-by-day trace ----------
   One row a day, appended as it happens, so the timeline is a record rather than
   a reconstruction. */
const Trace = {
  days: [],
  reset() { this.days = []; },
  today() {
    let d = this.days.find(x => x.day === GAME.day);
    if (!d) {
      d = { day: GAME.day, wx: Weather.today, needs: {}, jobs: 0, playerJobs: [], night: null,
            chal: null, tribal: null, left: null, morale: null, hunger: null, rep: null };
      this.days.push(d);
      while (this.days.length > 40) this.days.shift();
    }
    return d;
  },
  /* Called at nightfall, once the day is finished and its numbers are final. */
  close() {
    if (!GAME.player) return;
    const d = this.today();
    d.wx = Weather.today;
    for (const n of CAMP_NEEDS) d.needs[n.short] = +CampNeeds.get(n.id).toFixed(2);
    d.fire = +(GAME.campFire || 0).toFixed(2);
    d.morale = +GAME.player.morale.toFixed(2);
    d.hunger = +GAME.player.hunger.toFixed(2);
    d.fatigue = +GAME.player.fatigue.toFixed(2);
    d.rep = +Ledger.rep(GAME.player).toFixed(2);
    d.alive = alive().length;
    let heat = 0;
    for (const c of alive()) if (c !== GAME.player) heat += Math.max(0, c.getVW(GAME.player.name));
    d.heat = +heat.toFixed(2);
  },
  mark(field, value) { try { this.today()[field] = value; } catch { /* pre-season */ } }
};

const Report = {
  /* ---------- the flags: what looks wrong ---------- */
  flags() {
    const out = [];
    const P = GAME.player;
    if (!P) return out;
    const days = Trace.days.filter(d => d.needs && Object.keys(d.needs).length);

    /* Dialogue repetition, the recurring complaint. */
    for (const r of LineCensus.repeats(5).slice(0, 8)) {
      out.push(`LINE REPEAT x${r.n}: "${r.line}"  [pool: ${r.pool}]`);
    }
    /* A need parked at empty is either a balance problem or a broken faucet. */
    if (days.length >= 4) {
      for (const n of CAMP_NEEDS) {
        const zero = days.filter(d => (d.needs[n.short] ?? 1) < 0.05).length;
        if (zero >= Math.max(3, days.length * 0.4)) {
          out.push(`NEED PINNED: ${n.label} was empty on ${zero} of ${days.length} days`);
        }
      }
      const meanN = days.reduce((s, d) =>
        s + CAMP_NEEDS.reduce((t, n) => t + (d.needs[n.short] ?? 0), 0) / CAMP_NEEDS.length, 0) / days.length;
      if (meanN > 0.80) out.push(`CAMP TOO EASY: needs averaged ${meanN.toFixed(2)} — the layer may not be biting`);
    }
    /* Nights. */
    const nights = days.filter(d => d.night);
    const bad = nights.filter(d => d.night.bad).length;
    if (days.length >= 8 && nights.length === 0) out.push('NO NIGHT EVENTS at all this season');
    if (bad >= days.length * 0.6) out.push(`NIGHTS TOO HARSH: ${bad} rough nights in ${days.length} days`);
    /* Exits, against the real-show rate. */
    const evacs = days.filter(d => d.left && d.left.kind === 'Medivac').length;
    if (evacs >= 2) out.push(`EVACUATIONS: ${evacs} this season (real show: 10% of seasons see two, 2% see three)`);
    /* Social: is anything happening? */
    const pool = alive().filter(c => c !== P);
    if (pool.length) {
      const warm = pool.filter(c => c.getRel(P.name) > 0.55).length;
      const cold = pool.filter(c => c.getRel(P.name) < 0.25).length;
      if (!warm && GAME.day > 6) out.push('NO WARM RELATIONSHIPS after ' + GAME.day + ' days');
      if (cold === pool.length) out.push('EVERYONE COLD on the player');
    }
    /* Did the vote ever actually move? */
    const named = (GAME.intel || []).filter(i => i.target).length;
    if (GAME.day > 8 && named === 0) out.push('NO VOTE INTEL gathered all season — nobody ever named a target');
    /* Challenges: sweeping them is the balance bug the player reported. */
    if (typeof Journal !== 'undefined') {
      const cs = Journal.challengeStats();
      if (cs) {
        if (cs.individual >= 3 && cs.individualWins === cs.individual)
          out.push(`CHALLENGES TOO EASY: won every individual immunity (${cs.individualWins}/${cs.individual})`);
        else if (cs.individual >= 4 && cs.individualWins / cs.individual > 0.6)
          out.push(`CHALLENGES EASY: won ${cs.individualWins} of ${cs.individual} individual immunities`);
        if (cs.total >= 4 && cs.flawless > cs.total * 0.6)
          out.push(`MINIGAMES TOO EASY: ${cs.flawless} of ${cs.total} rounds scored 0.97+ — the score carries no information`);
        if (cs.total >= 4 && cs.meanPerf !== null && cs.meanPerf < 0.15)
          out.push(`MINIGAMES TOO HARD: mean score ${cs.meanPerf.toFixed(2)} across ${cs.total} rounds`);
      }
    }
    /* And whatever the playthrough analysis turned up. */
    for (const f of this.playFlags()) out.push(f);
    /* Contribution. */
    if (days.length >= 6) {
      const maxRep = Math.max(...days.map(d => d.rep ?? 0));
      if (maxRep < 0.12) out.push(`PLAYER NEVER WORKED: contribution rep peaked at ${maxRep.toFixed(2)}`);
    }
    return out;
  },

  /* ---------- outcome ---------- */
  outcome() {
    if (GAME.winner) return GAME.winner === GAME.player ? 'WON the season' : `lost — ${GAME.winner.displayName} won`;
    if (GAME.playerEliminated) return `eliminated day ${GAME.day}`;
    if (!GAME.seasonActive) return 'season over';
    return `in progress, day ${GAME.day} of ${CONFIG.totalDays}`;
  },

  /* ---------- brief: small enough to publish anywhere ---------- */
  brief() {
    const P = GAME.player;
    const L = [];
    const pad = (s, n) => String(s).padEnd(n);
    L.push('CASTAWAY SEASON REPORT');
    L.push(`build ${GAME.buildTag || 'dev'} · seed ${GAME.seasonSeed} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);
    if (!P) { L.push('no season in progress'); return L.join('\n'); }
    L.push('');
    L.push(`PLAYER  ${P.displayName} (${P.cluster}, ${P.occupation}) · tribe ${P.tribeName}${GAME.merged ? ' (merged)' : ''}`);
    L.push(`OUTCOME ${this.outcome()} · ${alive().length} left · day ${GAME.day}`);
    L.push(`STATS   ` + STAT_KEYS.map(k => `${k.slice(0, 4)} ${P.stats[k].toFixed(2)}`).join(' '));
    L.push(`STATE   fed ${(1 - P.hunger).toFixed(2)} rest ${(1 - P.fatigue).toFixed(2)} morale ${P.morale.toFixed(2)} (${Morale.label(P.morale)})`);
    L.push(`CAMP    ` + CAMP_NEEDS.map(n => `${n.short} ${CampNeeds.get(n.id).toFixed(2)}`).join(' ')
      + ` fire ${(GAME.campFire || 0).toFixed(2)}`);
    L.push(`EFFORT  your contribution rep ${Ledger.rep(P).toFixed(2)} — the tribe reckons you ${Ledger.describe(P)}`);
    L.push(`        fire skill ${(P.fireSkill || 0).toFixed(2)} from ${P.firesMade || 0} fires`);

    /* Season shape. */
    const days = Trace.days.filter(d => d.needs && Object.keys(d.needs).length);
    if (days.length) {
      const mean = k => (days.reduce((s, d) => s + (d[k] ?? 0), 0) / days.length).toFixed(2);
      const nights = days.filter(d => d.night);
      L.push('');
      L.push(`SEASON  ${days.length} days traced · mean morale ${mean('morale')} · mean heat on you ${mean('heat')}`);
      L.push(`NIGHTS  ${nights.filter(d => d.night.bad).length} rough, ${nights.filter(d => !d.night.bad).length} good, ${days.length - nights.length} quiet`);
      const ev = days.filter(d => d.left);
      if (ev.length) L.push('EXITS   ' + ev.map(d => `d${d.day} ${d.left.who} (${d.left.cause || d.left.kind})`).join(' · '));
    }

    /* Tribal record. */
    if ((GAME.voteHistory || []).length) {
      L.push('');
      L.push('TRIBALS');
      for (const t of GAME.voteHistory.slice(-8)) {
        /* t.votes is an array of [voter, target] pairs (Map.entries()), not an
           object keyed by voter. Reading it as a map made "you wrote" always "-"
           and "votes against you" always 0. */
        const mine = t.votes && (t.votes.find(([v]) => v === P.name) || [])[1];
        const against = t.votes ? t.votes.filter(([, tgt]) => tgt === P.name).length : 0;
        L.push(`  d${pad(t.day, 3)} out: ${pad(dnOf(t.eliminated) || '?', 12)} you wrote ${pad(mine ? dnOf(mine) : '-', 12)} votes against you ${against}`);
      }
    }

    /* Who is where socially. */
    const pool = alive().filter(c => c !== P).sort((a, b) => b.getRel(P.name) - a.getRel(P.name));
    if (pool.length) {
      L.push('');
      L.push('BONDS   ' + pool.slice(0, 6).map(c =>
        `${c.displayName} ${c.getRel(P.name).toFixed(2)}/${c.getTrust(P.name).toFixed(2)}`).join(' · '));
      const heat = pool.filter(c => c.getVW(P.name) > 0.3)
        .sort((a, b) => b.getVW(P.name) - a.getVW(P.name));
      if (heat.length) L.push('HEAT    ' + heat.slice(0, 5).map(c => `${c.displayName} ${c.getVW(P.name).toFixed(2)}`).join(' · '));
    }

    /* Dialogue health. */
    L.push('');
    L.push(`VOICE   ${LineCensus.total()} lines spoken, ${LineCensus.distinct()} distinct`
      + ` (${LineCensus.total() ? (100 * LineCensus.distinct() / LineCensus.total()).toFixed(0) : 0}% fresh)`);
    /* How the playthrough itself is shaping up: what got used, whether one option
       is running away with it, and whether any of it was interesting. */
    if (typeof Journal !== 'undefined') Journal.briefLines().forEach(l => L.push(l));
    /* Challenges, because "I won all of them" is a balance bug you cannot see
       from inside a single round. */
    if (typeof Journal !== 'undefined') {
      const cst = Journal.challengeStats();
      if (cst) {
        L.push(`CHALS   ${cst.total} played · individual ${cst.individualWins}/${cst.individual}`
          + ` · tribal ${cst.tribalWins}/${cst.tribal}`
          + (cst.meanPerf !== null ? ` · mean minigame ${cst.meanPerf.toFixed(2)}` : '')
          + (cst.meanRank !== null ? ` · mean finish ${cst.meanRank.toFixed(1)}` : ''));
      }
    }

    /* The bit that matters. */
    const f = this.flags();
    L.push('');
    if (!f.length) L.push('FLAGS   nothing looks wrong');
    else { L.push(`FLAGS   ${f.length}`); f.forEach(x => L.push('  ! ' + x)); }
    return L.join('\n');
  },

  /* ---------- full: the brief plus everything else ---------- */
  full() {
    const P = GAME.player;
    const L = [this.brief()];
    if (!P) return L.join('\n');

    L.push('');
    L.push('================ DAY BY DAY ================');
    L.push('day wx     ' + CAMP_NEEDS.map(n => n.short.padEnd(5)).join('') + 'fire  mor  hun  fat  rep  heat alive  night / event');
    for (const d of Trace.days) {
      if (!d.needs || !Object.keys(d.needs).length) continue;
      let row = String(d.day).padEnd(4) + String(d.wx || '').padEnd(7)
        + CAMP_NEEDS.map(n => String(d.needs[n.short] ?? '-').padEnd(5)).join('')
        + String(d.fire ?? '-').padEnd(6) + String(d.morale ?? '-').padEnd(5)
        + String(d.hunger ?? '-').padEnd(5) + String(d.fatigue ?? '-').padEnd(5)
        + String(d.rep ?? '-').padEnd(5) + String(d.heat ?? '-').padEnd(5)
        + String(d.alive ?? '-').padEnd(7);
      const bits = [];
      if (d.night) bits.push((d.night.bad ? '[rough] ' : '[good] ') + d.night.tag);
      if (d.chal) bits.push('challenge: ' + d.chal);
      if (d.tribal) bits.push('tribal: ' + d.tribal);
      if (d.left) bits.push('LEFT: ' + d.left.who + ' (' + (d.left.cause || d.left.kind) + ')');
      if (d.playerJobs && d.playerJobs.length) bits.push('you: ' + d.playerJobs.join(','));
      if (d.jobs) bits.push(d.jobs + ' tribe jobs');
      row += bits.join(' · ');
      L.push(row);
    }

    L.push('');
    L.push('================ CAST ================');
    L.push('name          cluster            tribe  ethic rep  rel  trust vw    hun  fat  mor  fire  apt         state');
    /* Each castaway's strongest challenge format — the aptitude field is mean-zero
       per category, so the biggest-magnitude entry is what they are known for. */
    const aptOf = c => {
      if (!c.aptitude) return '-';
      const e = Object.entries(c.aptitude).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
      return e ? `${e[0].slice(0, 5)}${e[1] >= 0 ? '+' : ''}${e[1].toFixed(2)}` : '-';
    };
    for (const c of GAME.cast) {
      L.push(String(c.displayName).padEnd(14) + String(c.cluster).padEnd(19)
        + String(c.tribeName).slice(0, 6).padEnd(7)
        + (typeof ethicOf === 'function' ? ethicOf(c).toFixed(2) : '-').padEnd(6)
        + Ledger.rep(c).toFixed(2).padEnd(5)
        + (c === P ? '-' : c.getRel(P.name).toFixed(2)).padEnd(5)
        + (c === P ? '-' : c.getTrust(P.name).toFixed(2)).padEnd(6)
        + (c === P ? '-' : c.getVW(P.name).toFixed(2)).padEnd(6)
        + c.hunger.toFixed(2).padEnd(5) + c.fatigue.toFixed(2).padEnd(5)
        + c.morale.toFixed(2).padEnd(5) + (c.fireSkill || 0).toFixed(2).padEnd(6)
        + aptOf(c).padEnd(12)
        + (c.eliminated ? 'out' : 'in'));
    }

    /* NPC-to-NPC bonds. The CAST columns only show each castaway toward the
       PLAYER; this is the rest of the graph — who was tight with whom — read as
       the mean of the two directions so a one-sided crush does not top the list. */
    const npcs = GAME.cast.filter(c => c !== P);
    const pairs = [];
    for (let i = 0; i < npcs.length; i++) {
      for (let j = i + 1; j < npcs.length; j++) {
        const a = npcs[i], b = npcs[j];
        pairs.push({ a: a.displayName, b: b.displayName, r: (a.getRel(b.name) + b.getRel(a.name)) / 2 });
      }
    }
    pairs.sort((x, y) => y.r - x.r);
    if (pairs.length) {
      L.push('');
      L.push('TIGHTEST NPC PAIRS  ' + pairs.slice(0, 8)
        .map(p => `${p.a}-${p.b} ${p.r.toFixed(2)}`).join(' · '));
    }

    L.push('');
    L.push('================ DIALOGUE POOLS USED ================');
    const pools = [...LineCensus.pools.entries()].sort((a, b) => b[1] - a[1]);
    L.push(pools.map(([k, v]) => `${k} ${v}`).join(' · ') || '(none)');
    const rep = LineCensus.repeats(3);
    if (rep.length) {
      L.push('');
      L.push('lines heard 3+ times:');
      rep.slice(0, 40).forEach(r => L.push(`  x${String(r.n).padStart(3)} [${r.pool}] ${r.line}`));
    }

    /* The playthrough itself — actions, dead options, ballots with reasons,
       the interest profile, and what the player was actually shown. */
    if (typeof Journal !== 'undefined') { L.push(''); L.push(Journal.section()); }
    if (typeof Journal !== 'undefined') {
      const cs = Journal.challengeSection();
      if (cs) { L.push(''); L.push(cs); }
    }

    L.push('');
    L.push('================ RAW LOG (tail) ================');
    const raw = DBG.text();
    L.push(raw.length > 90000 ? raw.slice(-90000) : raw);
    return L.join('\n');
  },

  reset() { LineCensus.reset(); Trace.reset(); if (typeof Journal !== 'undefined') Journal.reset(); },

  /* The flags the journal contributes — dominance and dead options are balance
     bugs, and a flat interest axis is a design bug. */
  playFlags() {
    if (typeof Journal === 'undefined') return [];
    const out = [];
    const dom = Journal.dominance();
    if (dom) out.push('EASY PATH: ' + dom.verdict);
    const dead = Journal.deadOptions(25);
    if (dead.length >= 3) out.push(`DEAD OPTIONS: ${dead.length} offered 25+ times and never taken (${dead.slice(0, 3).map(d => d.label).join(', ')})`);
    const it = Journal.interest();
    if (Journal.actions.length > 25) {
      for (const k of it.weakest) {
        if (it.parts[k] < 0.18) out.push(`FLAT: ${k} is ${(it.parts[k] * 100).toFixed(0)}/100 — that axis is not doing anything`);
      }
    }
    const ts = Journal.targetSpread();
    if (Journal.actions.length > 25 && ts.topShare > 0.55)
      out.push(`ONE-PERSON GAME: ${(ts.topShare * 100).toFixed(0)}% of targeted actions went at ${ts.list[0][0]}`);
    return out;
  }
};
