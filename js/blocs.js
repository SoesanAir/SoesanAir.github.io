/* ============================================================
   NPC VOTING BLOCS — the pact, but for everybody else.

   The player could build a multi-person alliance and nobody else could. That is
   the wrong asymmetry: on the show the player is usually NOT in the dominant
   alliance, and the thing you spend most of your time doing is trying to work out
   whose it is. Without NPC blocs there was nothing to work out.

   So NPCs form their own. Three or more of them who are mutually warm and not
   already spoken for drift together, shield each other, and converge on a name.

   Two design points that matter more than the formation rules:

   1. A BLOC IS A THING THE PLAYER CAN BE WRONG ABOUT.
      `readBy` returns what a given castaway BELIEVES about the groupings, graded
      by how observant they are. A dim castaway confidently names three people who
      have nothing to do with each other; a sharp one names the real one. The
      player cannot tell which they are getting from the phrasing — only by
      checking it against somebody else, or against what they have watched. That
      is the actual game of Survivor and it is entirely absent if the information
      is reliable.

   2. A BLOC IS VISIBLE THROUGH BEHAVIOUR, NOT THROUGH A LIST.
      Nothing here tells the player anything directly. It surfaces only when
      somebody mentions it, and whoever mentions it may be guessing, protecting
      their own, or lying.
   ============================================================ */
'use strict';

const NpcBlocs = {
  list: [],
  reset() { this.list = []; },

  warmth(a, b) { return a.getTrust(b.name) * 0.65 + a.getRel(b.name) * 0.35; },

  active(name) { return this.list.find(b => !b.broken && b.members.includes(name)); },
  membersOf(b, cast) {
    return b.members.map(n => cast.find(c => c.name === n)).filter(c => c && !c.eliminated);
  },

  /* ---------- formation ----------
     A bloc starts as a mutually warm TRIANGLE, because two people is already
     modelled by NpcAlliances and does not need a second system. Grows by adding
     anyone warm to everybody already in. */
  dailyUpdate(cast, merged) {
    /* Clean up first. */
    for (const b of this.list) {
      if (b.broken) continue;
      b.members = b.members.filter(n => {
        const m = cast.find(c => c.name === n);
        return m && !m.eliminated;
      });
      if (b.members.length < 3) { b.broken = true; b.breakReason = 'too_few'; continue; }
      /* Pre-merge a bloc cannot span two beaches. The swap breaks them, which is
         exactly what a swap is for. */
      if (!merged) {
        const tribes = new Set(this.membersOf(b, cast).map(m => m.tribeName));
        if (tribes.size > 1) { b.broken = true; b.breakReason = 'swapped_apart'; continue; }
      }
      const ms = this.membersOf(b, cast);
      let cold = false;
      for (let i = 0; i < ms.length && !cold; i++) {
        for (let j = i + 1; j < ms.length; j++) {
          if (Math.min(this.warmth(ms[i], ms[j]), this.warmth(ms[j], ms[i])) < CONFIG.blocBreakBelow) {
            cold = true; break;
          }
        }
      }
      if (cold) {
        b.strain = (b.strain || 0) + 1;
        if (b.strain >= 2) { b.broken = true; b.breakReason = 'went_cold'; }
      } else b.strain = 0;
    }

    if (GAME.day < CONFIG.blocFormMinDay) return;

    /* Growth before formation: an existing bloc absorbing a fourth is more likely
       than a brand-new one appearing, which is how these actually snowball. */
    for (const b of this.list) {
      if (b.broken || b.members.length >= CONFIG.blocMax) continue;
      const ms = this.membersOf(b, cast);
      const pool = cast.filter(c => !c.eliminated && !c.isPlayer && !this.active(c.name)
        && (GAME.merged || (ms[0] && c.tribeName === ms[0].tribeName)));
      for (const cand of pool) {
        const fitsAll = ms.every(m =>
          Math.min(this.warmth(m, cand), this.warmth(cand, m)) > CONFIG.blocJoinAbove);
        if (fitsAll && chance(CONFIG.blocGrowChance)) {
          b.members.push(cand.name);
          DBG.decision('Bloc', 'grew', { members: b.members.map(dnOf), added: cand.displayName });
          break;
        }
      }
    }

    /* A new triangle. One attempt a day so blocs appear at a believable rate
       rather than the whole tribe pairing off on day five. */
    if (!chance(CONFIG.blocFormChance)) return;
    const free = cast.filter(c => !c.eliminated && !c.isPlayer && !this.active(c.name));
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        const a = free[i], b2 = free[j];
        if (!GAME.merged && a.tribeName !== b2.tribeName) continue;
        if (Math.min(this.warmth(a, b2), this.warmth(b2, a)) < CONFIG.blocFormAbove) continue;
        for (let k = j + 1; k < free.length; k++) {
          const c3 = free[k];
          if (!GAME.merged && c3.tribeName !== a.tribeName) continue;
          const ok = [a, b2].every(m =>
            Math.min(this.warmth(m, c3), this.warmth(c3, m)) > CONFIG.blocFormAbove);
          if (!ok) continue;
          this.list.push({
            members: [a.name, b2.name, c3.name], dayFormed: GAME.day, broken: false, breakReason: ''
          });
          DBG.decision('Bloc', 'FORMED', { members: [a, b2, c3].map(x => x.displayName), day: GAME.day });
          return;
        }
      }
    }
  },

  /* ---------- what a bloc DOES ----------
     The same two things the player's pact does: shield each other, converge on a
     name. Weaker than an agreed pact plan, because nobody held a meeting. */
  seedEffects(cast, merged) {
    for (const b of this.list) {
      if (b.broken) continue;
      const ms = this.membersOf(b, cast);
      if (ms.length < 3) continue;
      for (const m of ms) {
        for (const o of ms) {
          if (o === m) continue;
          m.addVW(o.name, -CONFIG.blocShield, 'in their bloc');
        }
      }
      const outs = cast.filter(x => !x.eliminated && !b.members.includes(x.name)
        && (merged || x.tribeName === ms[0].tribeName));
      let best = null, bw = -Infinity;
      for (const t of outs) {
        let w = 0;
        for (const m of ms) w += m.getVW(t.name);
        if (w > bw) { bw = w; best = t; }
      }
      if (best && bw > 0) {
        for (const m of ms) m.addVW(best.name, CONFIG.blocConverge, 'their bloc is on that name');
      }
    }
  },

  /* ---------- what somebody THINKS they have seen ----------
     Returns { kind, group, target } where kind is one of:
       'sure3' | 'sure2' | 'sure4' | 'vague' | 'wrong' | 'mine' | 'nothing'
     `group` is an array of castaways. A 'wrong' read is a real, confidently held
     grouping that does not exist.

     Graded by game awareness, because the whole value of this information is that
     it is only as good as the person giving it. */
  readBy(observer, cast, merged) {
    const pool = cast.filter(c => !c.eliminated && c !== observer
      && (merged || c.tribeName === observer.tribeName));
    if (pool.length < 3) return { kind: 'nothing', group: [] };

    const mine = this.active(observer.name);
    /* Somebody in a bloc mostly talks about their own, evasively. */
    if (mine && chance(0.45)) {
      return { kind: 'mine', group: this.membersOf(mine, cast).filter(m => m !== observer) };
    }

    const sharp = clamp01(observer.stats.gameAwareness);
    /* Real blocs they are not part of, on their beach. */
    const real = this.list.filter(b => !b.broken && !b.members.includes(observer.name))
      .map(b => this.membersOf(b, cast).filter(m => pool.indexOf(m) >= 0))
      .filter(ms => ms.length >= 3);

    /* The player's own pact is also a bloc other people can spot, and its
       visibility is exactly the number the pact meeting has been raising. */
    const pact = typeof Coalitions !== 'undefined' ? Coalitions.active(GAME.player.name) : null;
    if (pact && !pact.broken && (pact.visibility || 0) > CONFIG.circleNoticedAbove) {
      const ms = pact.members.map(n => cast.find(c => c.name === n))
        .filter(m => m && !m.eliminated && !m.isPlayer && pool.indexOf(m) >= 0);
      if (ms.length >= 2 && chance(clamp01((pact.visibility - CONFIG.circleNoticedAbove) * sharp * 2))) {
        real.push(ms);
      }
    }

    /* Do they spot a real one? Observation, not omniscience. */
    if (real.length && chance(0.25 + sharp * 0.6)) {
      const g = pick(real);
      const kind = g.length >= 4 ? 'sure4' : g.length === 3 ? 'sure3' : 'sure2';
      return { kind, group: g };
    }
    /* Or do they invent one? A dim castaway is much more likely to. Deliberately
       confident: a hedged wrong read carries no risk and is not interesting. */
    if (chance(CONFIG.blocWrongBase * (1.4 - sharp))) {
      const g = shuffle([...pool]).slice(0, 3);
      return { kind: 'wrong', group: g };
    }
    if (chance(0.35)) return { kind: 'vague', group: [] };
    return { kind: 'nothing', group: [] };
  },

  /* Turn a read into a line, via the pool file. */
  lineFor(read, observer) {
    const g = read.group || [];
    const subs = {
      n1: g[0] ? g[0].displayName : '',
      n2: g[1] ? g[1].displayName : '',
      n3: g[2] ? g[2].displayName : '',
      rest: g.length > 3 ? (g.length === 4 ? 'and ' + g[3].displayName : 'and ' + (g.length - 3) + ' others') : '',
      me: GAME.player ? GAME.player.displayName : 'you',
      tn: ''
    };
    const key = read.kind === 'sure4' ? 'blocSure4'
      : read.kind === 'sure3' ? 'blocSure3'
        : read.kind === 'sure2' ? 'blocSure2'
          : read.kind === 'wrong' ? 'blocWrong'
            : read.kind === 'mine' ? 'blocMine'
              : read.kind === 'vague' ? 'blocVague'
                : 'blocNothing';
    return BlocTalk.say(key, subs);
  }
};
