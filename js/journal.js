/* ============================================================
   JOURNAL — the player's playthrough, recorded well enough to argue with.

   The design log already said what the SIMULATION did. This records what the
   PLAYER did, what they were offered and did not take, what they were shown, and
   why every ballot came out the way it did — the categories the Unity build kept
   (PlayerAction, VoteWeight, VoteTalk, Lying, ActionWheel) plus the ones it did
   not, and then it does arithmetic on all of it.

   Three questions it exists to answer:

   1. IS THERE AN EASY PATH TO VICTORY?
      Every action is counted and priced. An action that is both used constantly
      and pays better per hour than the alternatives is a dominant strategy, and
      the report names it. An option offered thirty times and never taken is a
      dead one, and the report names that too. Neither is visible from inside a
      playthrough — the player just does what works.

   2. WHAT DID THE PLAYER ACTUALLY SEE?
      Every line, toast, feed entry and screen. Which makes repetition measurable
      instead of a feeling, and shows how much of the writing a real playthrough
      ever reaches.

   3. WAS IT INTERESTING?
      Interest is not a vibe, it is a set of measurable proxies: how close the
      votes were, how often the player was wrong about who was going, how much
      the numbers moved day to day, how many days they were genuinely at risk,
      and whether anything they did changed an outcome. Reported per component,
      not as one opaque score, so a flat season says WHICH part was flat.

   Implementation note: this file WRAPS the existing functions rather than
   editing forty call sites. Missing one would silently bias every number here,
   and a wrapper cannot miss one.
   ============================================================ */

'use strict';

const Journal = {
  /* ---------- state ---------- */
  actions: [],        // { day, hour, name, target, cost }
  offers: new Map(),  // label -> { offered, taken, disabled }
  seen: [],           // { day, kind, who, text }
  ballots: [],        // per tribal: full per-voter reasoning
  events: [],         // { day, kind, detail }
  vwReasons: new Map(),   // "voter|target" -> [{ src, d }]
  screens: [],        // { day, id }
  perDay: new Map(),  // day -> { actions, relDelta, vwDelta, seen }
  pendingCost: 0,     // hours of the choice currently being executed (set by dlgChoice)
  MAX: 1400,

  reset() {
    this.actions = []; this.offers = new Map(); this.seen = [];
    this.ballots = []; this.events = []; this.vwReasons = new Map();
    this.screens = []; this.perDay = new Map(); this.challenges = [];
    this.pendingCost = 0;
  },

  day() { return (GAME && GAME.day) || 0; },
  bucket() {
    const d = this.day();
    if (!this.perDay.has(d)) this.perDay.set(d, { actions: 0, relDelta: 0, vwDelta: 0, seen: 0, hours: 0 });
    return this.perDay.get(d);
  },
  cap(arr) { while (arr.length > this.MAX) arr.shift(); },

  /* ---------- what the player did ---------- */
  act(name, target, cost) {
    /* The do* wrapper cannot see the choice's price — it lives on the dlgChoice
       button. dlgChoice stashes it in pendingCost right before the action runs,
       so an action gets its real hours here rather than the flat 0 it used to. */
    const c = cost || this.pendingCost || 0;
    this.actions.push({ day: this.day(), hour: +(CONFIG.hoursPerDay - (GAME.hoursRemaining || 0)).toFixed(1),
                        name, target: target || '', cost: c });
    this.cap(this.actions);
    /* Day-total hours are added by the dlgChoice click handler, not here, or the
       two would double-count. */
    const b = this.bucket(); b.actions++; b.hours += cost || 0;
    DBG.log('action', `PLAYER ${name}${target ? ' -> ' + target : ''}`);
  },

  /* ---------- what the player was OFFERED (the Unity "action wheel") ----------
     The offered-and-never-taken list is the dead-option report, and it is the
     only way to find out that a whole branch of the game is invisible. */
  offer(label, disabled) {
    const key = String(label).replace(/\s*·.*$/, '').trim();
    let e = this.offers.get(key);
    if (!e) { e = { offered: 0, taken: 0, disabled: 0 }; this.offers.set(key, e); }
    e.offered++;
    if (disabled) e.disabled++;
    return key;
  },
  take(label) {
    const key = String(label).replace(/\s*·.*$/, '').trim();
    const e = this.offers.get(key);
    if (e) e.taken++;
  },

  /* ---------- what the player saw ---------- */
  show(kind, text, who) {
    if (!text) return;
    this.seen.push({ day: this.day(), kind, who: who || '', text: String(text).slice(0, 160) });
    this.cap(this.seen);
    this.bucket().seen++;
  },
  screen(id) {
    const last = this.screens[this.screens.length - 1];
    if (last && last.id === id) return;
    this.screens.push({ day: this.day(), id });
    this.cap(this.screens);
  },
  event(kind, detail) {
    this.events.push({ day: this.day(), kind, detail: String(detail || '').slice(0, 140) });
    this.cap(this.events);
  },

  /* ---------- why every vote came out the way it did ---------- */
  noteVW(voter, target, d, src) {
    const k = voter + '|' + target;
    let a = this.vwReasons.get(k);
    if (!a) { a = []; this.vwReasons.set(k, a); }
    /* Merge repeats of the same cause so the ballot reads as reasons, not a log. */
    const hit = a.find(x => x.src === src);
    if (hit) hit.d += d; else a.push({ src: src || 'unexplained', d });
  },
  reasonsFor(voter, target) {
    const a = this.vwReasons.get(voter + '|' + target) || [];
    return a.slice().sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 4);
  },
  /* Called once per council, after the votes are in. */
  ballot(day, votes, eliminated, pool) {
    const rows = [];
    for (const voter of pool) {
      const target = votes[voter.name];
      if (!target) continue;
      const shortlist = pool.filter(c => c !== voter && !c.eliminated)
        .map(c => ({ name: c.displayName, vw: +voter.getVW(c.name).toFixed(2) }))
        .sort((a, b) => b.vw - a.vw).slice(0, 4);
      rows.push({
        voter: voter.displayName,
        isPlayer: !!voter.isPlayer,
        target: dnOf(target),
        top: shortlist,
        why: this.reasonsFor(voter.name, target).map(r => `${r.src} ${r.d > 0 ? '+' : ''}${r.d.toFixed(2)}`)
      });
    }
    const counts = {};
    for (const k of Object.keys(votes)) counts[dnOf(votes[k])] = (counts[dnOf(votes[k])] || 0) + 1;
    const tally = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    this.ballots.push({
      day, eliminated: dnOf(eliminated) || 'nobody', rows, tally,
      margin: tally.length > 1 ? tally[0][1] - tally[1][1] : tally.length ? tally[0][1] : 0,
      againstPlayer: GAME.player ? Object.values(votes).filter(v => v === GAME.player.name).length : 0
    });
    /* Clear the reason ledger for the next council's fresh seeding. */
    this.vwReasons = new Map();
  },

  /* ---------- challenges ----------
     What the challenge was, which minigame it actually ran, how the player played
     it, where that put them in the field, and who won. This is the record for
     tuning difficulty: "I win everything" and "I never win" are both answerable
     from it, and so is "the briefing said one thing and the game did another". */
  challenges: [],
  challenge(rec) {
    this.challenges.push(Object.assign({ day: this.day() }, rec));
    this.cap(this.challenges);
    DBG.decision('Challenge', 'result', rec);
  },
  challengeStats() {
    const rows = this.challenges;
    if (!rows.length) return null;
    const ind = rows.filter(r => r.kind === 'individual');
    const team = rows.filter(r => r.kind === 'tribal');
    const num = a => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
    const perfs = rows.filter(r => typeof r.perf === 'number').map(r => r.perf);
    return {
      total: rows.length,
      individual: ind.length,
      individualWins: ind.filter(r => r.playerWon).length,
      tribal: team.length,
      tribalWins: team.filter(r => r.playerWon).length,
      meanPerf: perfs.length ? num(perfs) : null,
      /* Perfect scores being routine is the signature of a minigame that is too
         easy — the score stops carrying information. */
      flawless: perfs.filter(p => p >= 0.97).length,
      fumbled: perfs.filter(p => p <= 0.1).length,
      meanRank: ind.length ? num(ind.filter(r => r.rank).map(r => r.rank)) : null,
      byGame: (() => {
        const m = new Map();
        for (const r of rows) {
          if (!r.game) continue;
          let e = m.get(r.game);
          if (!e) { e = { n: 0, perf: 0, won: 0 }; m.set(r.game, e); }
          e.n++; e.perf += (r.perf || 0); e.won += r.playerWon ? 1 : 0;
        }
        return [...m.entries()].map(([g, e]) =>
          ({ game: g, n: e.n, meanPerf: +(e.perf / e.n).toFixed(2), won: e.won }))
          .sort((a, b) => b.n - a.n);
      })()
    };
  },
  challengeSection() {
    const st = this.challengeStats();
    if (!st) return '';
    const L = [];
    L.push('================ CHALLENGES ================');
    L.push(`${st.total} played · individual ${st.individualWins}/${st.individual} won`
      + ` · tribal ${st.tribalWins}/${st.tribal} won`
      + (st.meanPerf !== null ? ` · your mean minigame score ${st.meanPerf.toFixed(2)}` : '')
      + (st.meanRank !== null ? ` · mean finish ${st.meanRank.toFixed(1)}` : ''));
    L.push(`flawless rounds ${st.flawless} · fumbled rounds ${st.fumbled}`
      + (st.flawless > st.total * 0.5 ? '   <-- perfect scores are routine; the games are too easy' : ''));
    L.push('');
    L.push('day  challenge                 minigame      you   rank/field  won by');
    for (const r of this.challenges) {
      L.push('  ' + String(r.day).padEnd(4)
        + String(r.chal || '').slice(0, 25).padEnd(26)
        + String(r.game || '').padEnd(14)
        + (typeof r.perf === 'number' ? r.perf.toFixed(2) : ' -  ').padEnd(6)
        + (r.rank ? (r.rank + '/' + r.field) : (r.kind === 'tribal' ? 'tribe' : '-')).padEnd(12)
        + (r.playerWon ? 'YOU' : (r.winner || '')));
    }
    if (st.byGame.length) {
      L.push('');
      L.push('per minigame: ' + st.byGame.map(g =>
        `${g.game} x${g.n} avg ${g.meanPerf}${g.won ? ' won' + g.won : ''}`).join(' · '));
    }
    return L.join('\n');
  },

  /* ================= ANALYSIS ================= */

  /* Action histogram with what each one actually bought. Dominance is high share
     AND high yield — one without the other is just a favourite or a treat. */
  actionStats() {
    const by = new Map();
    for (const a of this.actions) {
      let e = by.get(a.name);
      if (!e) { e = { n: 0, hours: 0 }; by.set(a.name, e); }
      e.n++; e.hours += a.cost;
    }
    const total = this.actions.length || 1;
    return [...by.entries()]
      .map(([name, e]) => ({ name, n: e.n, share: e.n / total, hours: +e.hours.toFixed(1) }))
      .sort((a, b) => b.n - a.n);
  },

  /* Options the game keeps showing that nobody ever picks.
     Note that `offered` counts APPEARANCES, not menu openings — a dialogue menu
     re-renders after every line, so a single conversation can offer the same
     option five times. The bar is set high enough to account for that. */
  deadOptions(minOffers) {
    const out = [];
    for (const [label, e] of this.offers) {
      if (e.offered >= (minOffers || 20) && e.taken === 0) out.push({ label, offered: e.offered, disabled: e.disabled });
    }
    return out.sort((a, b) => b.offered - a.offered);
  },

  /* Did the player just work one person, or play the tribe? */
  targetSpread() {
    const by = new Map();
    for (const a of this.actions) if (a.target) by.set(a.target, (by.get(a.target) || 0) + 1);
    const list = [...by.entries()].sort((a, b) => b[1] - a[1]);
    const total = list.reduce((s, x) => s + x[1], 0) || 1;
    return { list, distinct: list.length, topShare: list.length ? list[0][1] / total : 0 };
  },

  /* The interest profile. Every component 0..1, every one measurable, and named
     separately so a boring season says which axis went flat. */
  interest() {
    const P = GAME.player;
    const parts = {};
    const days = Math.max(1, this.day());

    /* VARIETY — how much of the game the player actually used. */
    const acts = this.actionStats();
    parts.variety = clamp01(acts.length / 14);
    /* CONCENTRATION (inverted) — spamming one action is the opposite of interesting. */
    parts.spread = acts.length ? clamp01(1 - (acts[0].share - 1 / Math.max(1, acts.length)) * 1.6) : 0;
    /* SOCIAL REACH — how many people they actually dealt with. */
    const ts = this.targetSpread();
    parts.reach = clamp01(ts.distinct / 9);

    /* TENSION — how close the councils were. A 5-4 is a story; 8-1 is a formality. */
    if (this.ballots.length) {
      const close = this.ballots.map(b => {
        const votes = b.tally.reduce((s, t) => s + t[1], 0) || 1;
        return 1 - clamp01(b.margin / votes);
      });
      parts.tension = close.reduce((s, v) => s + v, 0) / close.length;
      /* RISK — how often the player was genuinely on the block. */
      parts.risk = clamp01(this.ballots.filter(b => b.againstPlayer > 0).length / this.ballots.length * 1.6);
    } else { parts.tension = 0; parts.risk = 0; }

    /* SURPRISE — how often the player's read of the room was wrong. */
    const guesses = this.events.filter(e => e.kind === 'expectation');
    if (guesses.length) {
      parts.surprise = clamp01(guesses.filter(e => /wrong/.test(e.detail)).length / guesses.length * 1.8);
    } else parts.surprise = 0.5;   // unmeasured rather than zero

    /* MOVEMENT — do the numbers actually move, or is every day the same? */
    const swings = [...this.perDay.values()].map(b => Math.abs(b.relDelta) + Math.abs(b.vwDelta));
    if (swings.length) {
      const mean = swings.reduce((s, v) => s + v, 0) / swings.length;
      parts.movement = clamp01(mean / 3.5);
    } else parts.movement = 0;

    /* FRESHNESS — how much of the writing a real playthrough reaches. */
    parts.freshness = typeof LineCensus !== 'undefined' && LineCensus.total()
      ? clamp01(LineCensus.distinct() / LineCensus.total() * 1.15) : 0;

    /* PRESSURE — the survival layer having any say at all. */
    if (P) {
      const rough = [...this.perDay.keys()].length;
      parts.pressure = clamp01((P.hunger + P.fatigue + (1 - P.morale)) / 1.8);
    } else parts.pressure = 0;

    const keys = Object.keys(parts);
    const score = keys.reduce((s, k) => s + parts[k], 0) / keys.length;
    return { score, parts, weakest: keys.slice().sort((a, b) => parts[a] - parts[b]).slice(0, 3) };
  },

  /* The dominance read: which single option, if any, looks like the easy path. */
  dominance() {
    const acts = this.actionStats();
    if (acts.length < 3) return null;
    const top = acts[0];
    const expected = 1 / acts.length;
    /* Two ways to be the easy path, because a ratio alone breaks at both ends.
       With four options a "3x fair share" bar sits at 75%, which something can
       fall under while still being three quarters of the entire playthrough; with
       twenty options the ratio is the only thing that catches it. */
    const bigAbsolute = top.share > 0.40 && top.n >= 12;
    const bigRelative = top.share > expected * 2.5 && top.n >= 20;
    if (bigAbsolute || bigRelative) {
      return { name: top.name, n: top.n, share: top.share, expected,
               verdict: `"${top.name}" is ${(top.share * 100).toFixed(0)}% of everything the player did` };
    }
    return null;
  },

  /* ---------- rendering ---------- */
  section() {
    const L = [];
    const acts = this.actionStats();
    L.push('================ WHAT THE PLAYER DID ================');
    L.push(`${this.actions.length} actions over ${this.day()} days`);
    L.push('action                        used   share  hours');
    for (const a of acts) {
      L.push('  ' + a.name.padEnd(28) + String(a.n).padStart(4)
        + (100 * a.share).toFixed(0).padStart(7) + '%' + String(a.hours).padStart(7));
    }
    const dom = this.dominance();
    L.push('');
    L.push(dom ? 'EASY PATH? ' + dom.verdict + ' — that is ' +
      (dom.share / dom.expected).toFixed(1) + 'x its fair share'
      : 'EASY PATH? no single action dominates');

    const ts = this.targetSpread();
    L.push(`SPREAD     ${ts.distinct} different people worked`
      + (ts.list.length ? `, most-worked ${ts.list[0][0]} (${(ts.topShare * 100).toFixed(0)}% of targeted actions)` : ''));

    const dead = this.deadOptions(20);
    L.push('');
    if (dead.length) {
      L.push('DEAD OPTIONS (offered often, never taken)');
      dead.slice(0, 12).forEach(d => L.push(`  ${String(d.offered).padStart(4)}x  ${d.label}`
        + (d.disabled ? `  (${d.disabled} of those greyed out)` : '')));
    } else L.push('DEAD OPTIONS none — every option offered 8+ times got used at least once');

    /* Interest profile. */
    const it = this.interest();
    L.push('');
    L.push('================ WAS IT INTERESTING? ================');
    L.push(`overall ${(it.score * 100).toFixed(0)}/100 · weakest: ${it.weakest.join(', ')}`);
    for (const k of Object.keys(it.parts)) {
      const v = it.parts[k];
      const bar = '#'.repeat(Math.round(v * 20)).padEnd(20, '.');
      L.push(`  ${k.padEnd(11)} ${bar} ${(v * 100).toFixed(0)}`);
    }

    /* Ballots, with the reasoning. */
    if (this.ballots.length) {
      L.push('');
      L.push('================ HOW THEY VOTED ================');
      for (const b of this.ballots) {
        L.push(`day ${b.day} — out: ${b.eliminated} · tally ${b.tally.map(t => t[0] + ' ' + t[1]).join(', ')}`
          + ` · margin ${b.margin}${b.againstPlayer ? ` · ${b.againstPlayer} against the player` : ''}`);
        for (const r of b.rows) {
          L.push(`  ${(r.isPlayer ? '>> ' : '   ') + r.voter.padEnd(13)} -> ${r.target.padEnd(13)}`
            + (r.why.length ? 'because: ' + r.why.join(', ') : '')
            + (r.top.length ? '   [weights ' + r.top.map(t => t.name + ' ' + t.vw).join(' ') + ']' : ''));
        }
      }
    }

    /* Events the island threw at them. */
    if (this.events.length) {
      L.push('');
      L.push('================ WHAT HAPPENED TO THEM ================');
      const by = new Map();
      for (const e of this.events) by.set(e.kind, (by.get(e.kind) || 0) + 1);
      L.push('counts: ' + [...by.entries()].map(([k, v]) => k + ' ' + v).join(' · '));
      this.events.slice(-40).forEach(e => L.push(`  d${String(e.day).padStart(2)} [${e.kind}] ${e.detail}`));
    }

    /* What they were shown. */
    if (this.seen.length) {
      L.push('');
      L.push('================ WHAT THE PLAYER SAW (last 60) ================');
      this.seen.slice(-60).forEach(s =>
        L.push(`  d${String(s.day).padStart(2)} [${s.kind}]${s.who ? ' ' + s.who + ':' : ''} ${s.text}`));
    }
    return L.join('\n');
  },

  /* The two lines the brief needs. */
  briefLines() {
    const L = [];
    const dom = this.dominance();
    const it = this.interest();
    const dead = this.deadOptions(20);
    const acts = this.actionStats();
    L.push(`PLAYED  ${this.actions.length} actions, ${acts.length} distinct`
      + (acts.length ? ` · most used "${acts[0].name}" ${acts[0].n}x (${(acts[0].share * 100).toFixed(0)}%)` : ''));
    L.push(`INTEREST ${(it.score * 100).toFixed(0)}/100 · weakest ${it.weakest.join(', ')}`);
    if (dom) L.push(`EASY PATH ${dom.verdict}`);
    if (dead.length) L.push(`DEAD OPTS ${dead.length} never taken: ${dead.slice(0, 3).map(d => d.label).join(', ')}`);
    if (this.ballots.length) {
      const m = (this.ballots.reduce((s, b) => s + b.margin, 0) / this.ballots.length).toFixed(1);
      L.push(`VOTES   ${this.ballots.length} councils, mean margin ${m}`
        + `, on the block ${this.ballots.filter(b => b.againstPlayer > 0).length}x`);
    }
    return L;
  }
};

/* ============================================================
   WIRING — wrap, do not edit.
   Forty call sites would mean forty chances to forget one, and a missing hook
   biases every number above without ever announcing itself.
   ============================================================ */
(function wireJournal() {
  /* ---- every player action, by wrapping the do* family ---- */
  const ACTIONS = [
    'doBond', 'doFamily', 'doSmallTalk', 'doOpenUp', 'doJoke', 'doOfferHelp', 'doSpendTime',
    'doSayHungry', 'doSayTired', 'doAskCamp',
    'doPushVote', 'doPlantSeed', 'doDefend', 'doRumor', 'doTellVote', 'doReadRoom',
    'doUndermine', 'doAttack', 'doAskHearing', 'doAskThinking', 'doAskThinkOf', 'doAskLastVote',
    'doShareMyVote', 'doAlign', 'doPromise', 'doLock', 'doBackMeUp', 'doBreakAlliance',
    'doCelebrateVote', 'doCircle', 'doShareSecret', 'doWarnName', 'doConfront',
    'doAskWhyMe', 'doConfrontVote', 'doAbsolveVoter', 'doMarkVoter', 'doDemandProtection',
    'doWander', 'doCampJob', 'doCallOut'
  ];
  const label = n => n.replace(/^do/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
  for (const name of ACTIONS) {
    const fn = window[name];
    if (typeof fn !== 'function') continue;
    window[name] = function (...args) {
      try {
        /* First argument is usually the npc; second is often the target. */
        const a0 = args[0], a1 = args[1];
        const who = a0 && a0.displayName ? a0.displayName
          : (a0 && a0.id ? a0.id : (typeof a0 === 'string' ? a0 : ''));
        const tgt = a1 && a1.displayName ? ' about ' + a1.displayName : '';
        Journal.act(label(name), who + tgt, 0);
      } catch { /* never break an action to log it */ }
      return fn.apply(this, args);
    };
  }

  /* ---- the action wheel: what was on offer, and what got taken ---- */
  if (typeof dlgChoice === 'function') {
    const realChoice = dlgChoice;
    window.dlgChoice = function (labelText, fn, cost) {
      /* Wrap the handler so the choice's price is live while the action runs —
         that is how Journal.act prices the action it records. */
      const wrapped = (typeof fn === 'function') ? function (...a) {
        Journal.pendingCost = cost || 0;
        try { return fn.apply(this, a); } finally { Journal.pendingCost = 0; }
      } : fn;
      const b = realChoice.call(this, labelText, wrapped, cost);
      try {
        const key = Journal.offer(labelText, b.disabled);
        b.addEventListener('click', () => { Journal.take(key); Journal.bucket().hours += cost || 0; });
      } catch { /* ignore */ }
      return b;
    };
  }

  /* ---- everything the player is shown ---- */
  if (typeof typeText === 'function') {
    const realType = typeText;
    window.typeText = function (el, text, ...rest) {
      try {
        Journal.show('line', text, DLG && DLG.npc ? DLG.npc.displayName : '');
      } catch { /* ignore */ }
      return realType.call(this, el, text, ...rest);
    };
  }
  if (typeof Feed === 'object' && Feed.post) {
    const realPost = Feed.post.bind(Feed);
    Feed.post = function (text, kind, day) {
      try { Journal.show('feed' + (kind ? ':' + kind : ''), text); } catch { }
      return realPost(text, kind, day);
    };
  }
  if (typeof toast === 'function') {
    const realToast = toast;
    window.toast = function (text, ...rest) {
      try { Journal.show('toast', text); } catch { }
      return realToast.call(this, text, ...rest);
    };
  }
  if (typeof Modal === 'object' && Modal.open) {
    const realOpen = Modal.open.bind(Modal);
    Modal.open = function (title, body) {
      try { Journal.show('modal', title); } catch { }
      return realOpen(title, body);
    };
  }
  if (typeof Screens === 'object' && Screens.push) {
    for (const m of ['push', 'replace']) {
      if (typeof Screens[m] !== 'function') continue;
      const real = Screens[m].bind(Screens);
      Screens[m] = function (id, ...rest) {
        try { Journal.screen(id); } catch { }
        return real(id, ...rest);
      };
    }
  }

  /* ---- vote weight, with the reason attached (the Unity VoteWeight log) ---- */
  if (typeof Castaway === 'function' && Castaway.prototype.addVW) {
    const realVW = Castaway.prototype.addVW;
    Castaway.prototype.addVW = function (name, d, src) {
      try {
        if (d) {
          Journal.noteVW(this.name, name, d, src);
          if (GAME.player && name === GAME.player.name) Journal.bucket().vwDelta += Math.abs(d);
        }
      } catch { }
      return realVW.call(this, name, d, src);
    };
  }
  /* ---- and relationship movement, so "did anything change today" is answerable ---- */
  if (typeof Castaway === 'function' && Castaway.prototype.addRel) {
    const realRel = Castaway.prototype.addRel;
    Castaway.prototype.addRel = function (name, d, src) {
      try {
        if (d && GAME.player && name === GAME.player.name) Journal.bucket().relDelta += Math.abs(d);
      } catch { }
      return realRel.call(this, name, d, src);
    };
  }

  /* ---- the island acting on the player ---- */
  if (typeof Dilemmas === 'object' && Dilemmas.maybeFire) {
    const real = Dilemmas.maybeFire.bind(Dilemmas);
    Dilemmas.maybeFire = function (...a) {
      const r = real(...a);
      try { if (r) Journal.event('dilemma', 'a dilemma came to the player'); } catch { }
      return r;
    };
  }
  if (typeof showApproachPrompt === 'function') {
    const real = showApproachPrompt;
    window.showApproachPrompt = function (npc, ...rest) {
      try { Journal.event('approach', (npc && npc.displayName) || ''); } catch { }
      return real.call(this, npc, ...rest);
    };
  }
  /* ---- the ballot, with every voter's reasoning (the Unity TribalDebugLog) ----
     Hooked at finishTribal because that is the one place every council — the
     player's and the other tribe's — actually lands. */
  if (typeof finishTribal === 'function') {
    const real = finishTribal;
    window.finishTribal = function (votes, elim, pool, interactive) {
      try {
        /* votes is a Map of castaway -> castaway; flatten to names. */
        const byName = {};
        for (const [v, t] of votes.entries()) byName[v.name] = t.name;
        Journal.ballot(GAME.day, byName, elim && elim.name, pool);
        /* Surprise, measured rather than guessed: the player wrote a name because
           they believed it was going. Were they right? */
        const P = GAME.player;
        if (P && byName[P.name]) {
          const right = elim && byName[P.name] === elim.name;
          Journal.event('expectation', right
            ? `read the room right — ${dnOf(byName[P.name])} went`
            : `read the room wrong — wrote ${dnOf(byName[P.name])}, ${elim ? elim.displayName : 'nobody'} went`);
        }
      } catch (e) { DBG.log('system', 'ballot log failed: ' + (e.message || e)); }
      return real.call(this, votes, elim, pool, interactive);
    };
  }
  /* ---- nights and exits, so the report can say what the island did ---- */
  if (typeof reportNight === 'function') {
    const real = reportNight;
    window.reportNight = function (...a) {
      try { if (GAME.nightEvent) Journal.event('night', (GAME.nightEvent.bad ? 'rough: ' : 'good: ') + GAME.nightEvent.tag); } catch { }
      return real.apply(this, a);
    };
  }
  /* ---- structural transitions, medical exits and the weather, so the event log
     is more than dilemmas and nights ---- */
  for (const [name, tag, msg] of [['doMerge', 'merge', 'the tribes merged'],
                                  ['doTribeSwap', 'swap', 'a tribe swap hit']]) {
    const fn = window[name];
    if (typeof fn !== 'function') continue;
    window[name] = function (...a) {
      try { Journal.event(tag, msg); } catch { }
      return fn.apply(this, a);
    };
  }
  if (typeof checkDailyEvent === 'function') {
    const real = checkDailyEvent;
    window.checkDailyEvent = function (...a) {
      const ev = real.apply(this, a);
      try {
        if (ev && ev.who) Journal.event(ev.type === 'Medivac' ? 'evac' : 'quit',
          `${ev.who.displayName} left — ${ev.cause || ev.type}`);
      } catch { }
      return ev;
    };
  }
  if (typeof Weather === 'object' && typeof Weather.roll === 'function') {
    const realRoll = Weather.roll.bind(Weather);
    Weather.roll = function (...a) {
      const r = realRoll(...a);
      /* Only the days that bite — a Sunny log entry every day is noise. */
      try { if (Weather.today && Weather.today !== 'Sunny') Journal.event('weather', Weather.today + ' day'); } catch { }
      return r;
    };
  }

  DBG.log('system', 'Journal wired: ' + ACTIONS.filter(n => typeof window[n] === 'function').length
    + ' player actions, offers, lines, ballots and vote reasons');
})();
