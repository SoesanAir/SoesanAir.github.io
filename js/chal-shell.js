/* ============================================================
   CHALLENGE SHELL — the frame all 20 minigames run inside.

   A minigame only supplies:
     { id, name, verb, tags:['physicality'...], how:'one line of rules',
       start(ctx) -> Promise<0..1> }

   The shell owns everything else: the arena, the countdown, the clock (which it
   can freeze for hit-stop), the tolerance band derived from the player's stats,
   the NPC field, and the result read-out.

   STAT WEIGHTING IS FELT AS EASE, NOT AS BONUS POINTS.
   ctx.ease is 0..1 built from the castaway's relevant stats, and every minigame
   spends it on making itself KINDER — a wider window, a slower timer, a longer
   look at the pattern. Nothing is ever silently added to the score, so a weak
   castaway who plays well genuinely beats a strong one who plays badly.
   ============================================================ */
/* A rail chip is about eight characters wide. "COURTNEY-ANNE" has to become
   something a human still recognises, and truncation to "COURTNE…" does not — so
   prefer a first name and only then cut.

   `taken` is the set of first names that occur more than once in the field.
   displayName is already disambiguated by computeDisplayNames, so for those we
   keep it: two different castaways both rendering as "Carol" on opposite rails is
   worse than one of them reading "Carol B." — spotted in a screenshot where
   exactly that happened. */
function railName(s, taken) {
  const n = String(s || '').trim();
  const first = n.split(/[\s-]/)[0];
  const clash = taken && taken.has(first.toLowerCase());
  const base = (first.length >= 3 && !clash) ? first : n;
  return base.length > 9 ? base.slice(0, 8) + '.' : base;
}

/* How much of each end of a rail is kept clear of chips. */
const RAIL_INSET = 0.035;

const Challenge = {
  active: null,

  /* 0..1 from the stats this challenge actually cares about. */
  easeFor(castaway, tags) {
    if (!castaway) return 0.5;
    const ks = (tags && tags.length) ? tags : ['physicality'];
    let s = 0;
    for (const k of ks) s += castaway.stats[k] !== undefined ? castaway.stats[k] : 0.5;
    return clamp01(s / ks.length);
  },

  /* Every challenge in the library, pinned to the minigame that matches what its
     description actually promises.

     This used to fall through to pick() over a category bucket, which meant nine
     of the thirty challenges drew a RANDOM minigame — so the screen said "Spear
     Throw: hit targets at distance" and then handed you a memory grid. A challenge
     and its minigame must never disagree, so the fallback is now deterministic and
     the shown name comes from the game that is actually about to be played. */
  MAP: {
    'Spear Throw': 'sling',
    'Fire Making': 'matches',
    'Final Four Fire': 'matches',
    'Coconut Slingshot': 'sling',
    'Auction Strategy': 'auction',
    'Negotiation': 'nerve',
    /* These two were pinned to 'trustfall' and 'sequence' before the challenges
       they actually describe had minigames. Fallen Comrades IS a quiz about the
       people who have left — which out here is the jury — and Touchy Subjects IS
       "how well do you know your tribemates". MAP wins over forChallenges, so
       leaving the old pins in place would have kept the right games unreachable. */
    'Jury Reads': 'comrades',
    'Tribal Trivia': 'touchy',
    'Island Survival Build': 'stack',

    /* The classics, each pinned to the game built from it. */
    'Chimney Sweep': 'brace',
    'Wrist Assured': 'bucket',
    'Uncomfortably Numb': 'perch',
    'Last Gasp': 'tide',
    'Island Delicacies': 'gross',
    'Simmotion': 'simmo',
    'Roller Ball': 'rollerball',
    'The Ball Drop': 'balldrop',
    'A Bit Tipsy': 'tipsy',
    'Balancing Point': 'coins',
    'Blue Plate Special': 'sling',
    'Smash and Grab': 'smash',
    'Dragged Through Mud': 'tug',
    'Sumo at Sea': 'sumo',
    'Table Maze': 'maze',
    'Know Your Ropes': 'knots',
    'Tower Shuffle': 'hanoi',
    'Tribal Tiles': 'latin',
    'Fallen Comrades': 'comrades'
  },

  gameFor(chal) {
    const named = this.MAP[chal.name];
    if (named) {
      const g = MINIGAMES.find(x => x.id === named);
      if (g) return g;
    }
    const byId = MINIGAMES.find(g => g.forChallenges && g.forChallenges.includes(chal.name));
    if (byId) return byId;
    /* Nothing claimed it. Pick from the right bucket, but pick DETERMINISTICALLY
       from the challenge name so the same challenge always plays the same game and
       the description can never contradict it. */
    const cat = (chal.cat || '').toLowerCase();
    const bucket = cat.indexOf('puzzle') >= 0 || cat.indexOf('mental') >= 0 ? 'mental'
      : cat.indexOf('endur') >= 0 || cat.indexOf('social') >= 0 ? 'nerve' : 'physical';
    const pool = MINIGAMES.filter(g => g.bucket === bucket);
    const list = pool.length ? pool : MINIGAMES;
    let hash = 0;
    for (let i = 0; i < chal.name.length; i++) hash = (hash * 31 + chal.name.charCodeAt(i)) & 0x7fffffff;
    const chosen = list[hash % list.length];
    DBG.log('system', `Challenge "${chal.name}" has no mapped minigame — fell back to ${chosen.id}`);
    return chosen;
  },

  /* ---- the tribe rails ----
     On the show you always know who is winning a challenge and who is losing it
     for their tribe, because the camera keeps cutting to them and Peff keeps
     saying so. The game had none of that: you played a minigame in a box and were
     told a tribe name at the end. Everything the sim knew about who carried it
     was thrown away.

     So both tribes stand down the sides of the arena and MOVE as the challenge
     runs — top of the rail is leading, bottom is dead weight. The positions come
     from real pre-rolled scores (Challenges.prescore), not from decoration, and
     the player's own chip climbs off their live minigame score. It is the same
     information the vote will use an hour later, which is the point: "he lost it
     for us" should be something you watched, not something you were told. */
  roster: null,
  onScore: null,
  setRoster(r) { this.roster = r; },

  buildRails(layer, chal) {
    const r = this.roster;
    if (!r || !r.sides || !r.sides.length) return null;
    layer.classList.add('railed');
    const rails = [];
    const chips = [];
    /* Which first names are ambiguous across the whole field, so railName knows
       when it may not shorten. */
    const seenFirst = new Map();
    for (const side of r.sides) {
      for (const c of side.members) {
        const f = String(c.displayName || c.name).trim().split(/[\s-]/)[0].toLowerCase();
        seenFirst.set(f, (seenFirst.get(f) || 0) + 1);
      }
    }
    const clashes = new Set([...seenFirst.entries()].filter(([, n]) => n > 1).map(([f]) => f));
    r.sides.forEach((side, si) => {
      const rail = h('div', 'cg-rail ' + (si === 0 ? 'left' : 'right'));
      const tag = h('div', 'cg-rail-tag', side.label || '');
      if (side.tribe && typeof Tribes !== 'undefined') Tribes.mark(tag, side.tribe);
      rail.appendChild(tag);
      const track = h('div', 'cg-rail-track');
      rail.appendChild(track);
      for (const c of side.members) {
        const chip = h('div', 'cg-chip' + (c.isPlayer ? ' me' : ''));
        chip.appendChild(h('span', 'cg-chip-name', railName(c.displayName || c.name, clashes)));
        if (side.tribe && typeof Tribes !== 'undefined') Tribes.mark(chip, side.tribe);
        track.appendChild(chip);
        chips.push({ c, el: chip, pos: 0.5, target: 0.5, shown: 0.5, side: si, track });
      }
      rails.push(rail);
      /* Both rails are appended here and the frame arrives after them; CSS `order`
         puts the frame between the two rather than relying on insertion order. */
      layer.appendChild(rail);
    });
    return { rails, chips };
  },

  /* Move the chips. Targets are normalised scores; positions ease toward them
     with a jitter that decays to nothing, so the order churns early like a real
     contest and has settled honestly by the finish. */
  driveRails(state, chal) {
    if (!state) return () => {};
    let alive = true, t = 0;
    const norm = () => {
      const vals = state.chips.map(x => x.c.lastChallengeScore || 0);
      const lo = Math.min(...vals), hi = Math.max(...vals);
      const span = Math.max(0.12, hi - lo);
      for (const x of state.chips) {
        x.target = clamp01(((x.c.lastChallengeScore || 0) - lo) / span);
      }
    };
    const step = () => {
      if (!alive) return;
      t += 1 / 60;
      norm();
      /* Early churn, late calm: a contest already decided at second one is not
         worth watching, and one still thrashing at the end is a lie about the
         result. Exponential rather than linear, because the linear version
         (0.16 - t*0.011) did not reach zero until fourteen seconds — longer than
         most of these minigames run, so the rails were still jostling when the
         score was read and the order on screen disagreed with the outcome.
         Measured by tools/chal-rails-test.js: 4 of 18 positions correct at four
         seconds. This settles to a twentieth of its opening jitter by six. */
      const churn = 0.16 * Math.exp(-t / 2.2);
      for (let i = 0; i < state.chips.length; i++) {
        const x = state.chips[i];
        const j = Math.sin(t * (1.3 + i * 0.37) + i) * churn;
        x.pos += ((clamp01(x.target + j)) - x.pos) * 0.06;
        x.shown = x.pos;
      }
      /* Push overlapping chips apart, per rail.
         Nine castaways on one rail with similar scores land on top of each other
         and become unreadable — caught in a screenshot, where two pairs were
         completely illegible. Position still carries the standing; this only
         guarantees a chip's worth of gap between neighbours, and it preserves
         order because it works along the sorted list in both directions. */
      for (const side of [0, 1]) {
        const col = state.chips.filter(x => x.side === side);
        if (col.length < 2) continue;
        const trackH = col[0].track.clientHeight || 1;
        const chipH = col[0].el.offsetHeight || 16;
        const gap = Math.min(0.9 / (col.length - 1), (chipH + 2) / trackH);
        col.sort((a, b) => a.shown - b.shown);
        for (let i = 1; i < col.length; i++) {
          if (col[i].shown - col[i - 1].shown < gap) col[i].shown = col[i - 1].shown + gap;
        }
        /* That can push the top one off the end, so settle back down again. */
        if (col[col.length - 1].shown > 1) {
          col[col.length - 1].shown = 1;
          for (let i = col.length - 2; i >= 0; i--) {
            if (col[i + 1].shown - col[i].shown < gap) col[i].shown = col[i + 1].shown - gap;
          }
        }
      }
      for (const x of state.chips) {
        /* Inset the usable range. A chip is centred on its position by a negative
           margin, so a chip at the very top hangs half of itself out of the track
           and over the tribe banner — which is what it was doing. */
        const p = RAIL_INSET + clamp01(x.shown) * (1 - RAIL_INSET * 2);
        x.el.style.top = ((1 - p) * 100).toFixed(2) + '%';
        x.el.classList.toggle('lead', x.pos > 0.86);
        x.el.classList.toggle('trail', x.pos < 0.14);
      }
      requestAnimationFrame(step);
    };
    step();
    return () => { alive = false; };
  },

  /* Run one minigame for one castaway. Resolves 0..1. */
  play(chal, castaway) {
    const game = this.gameFor(chal);
    DBG.action('Challenge minigame', game.name, `challenge=${chal.name} ease=${this.easeFor(castaway, game.tags).toFixed(2)}`);
    return new Promise(resolve => {
      const layer = $('chal-game');
      layer.innerHTML = '';
      layer.classList.remove('railed');
      layer.classList.add('open');
      const railState = this.buildRails(layer, chal);
      const stopRails = this.driveRails(railState, chal);
      const frame = h('div', 'cg-frame');
      const head = h('div', 'cg-head');
      head.appendChild(h('span', 'cg-name', game.name));
      const timer = h('div', 'cg-timer'); timer.appendChild(h('i'));
      head.appendChild(timer);
      const score = h('span', 'cg-score', '0');
      head.appendChild(score);
      const arena = h('div', 'cg-arena');
      const howto = h('div', 'cg-how', game.how);
      frame.appendChild(head); frame.appendChild(arena); frame.appendChild(howto);
      layer.appendChild(frame);
      Juice.attach(frame);

      const ctx = this.makeCtx({
        arena, frame, score, timer, game, howto,
        ease: this.easeFor(castaway, game.tags),
        onDone: v => {
          /* Let the rails settle on the truth for a beat before the arena closes —
             the last thing you see should be the final order. */
          this.onScore = null;
          setTimeout(() => {
            stopRails();
            this.roster = null;
            layer.classList.remove('open', 'railed');
            Juice.detach();
            layer.innerHTML = '';
            resolve(v);
          }, 950);
        }
      });

      /* 3-2-1 so nobody is caught out by an instant start. */
      const cd = h('div', 'cg-countdown');
      frame.appendChild(cd);
      let n = 3;
      const tick = () => {
        if (GAME.fastChallenge) { cd.remove(); game.start(ctx); return; }
        cd.textContent = n > 0 ? String(n) : 'GO';
        Juice.pop(cd, 0.8);
        if (n < 0) { cd.remove(); game.start(ctx); return; }
        n--;
        setTimeout(tick, 520);
      };
      /* Show how the thing works BEFORE the countdown, not during it.

         The one-line `game.how` under the arena was competing with a 3-2-1 ticking
         over the top of it, which is the worst possible moment to ask someone to
         read: they know something is about to start and they are watching the
         number. So the diagram gets its own beat with nothing else moving, and the
         countdown only begins once the player has dismissed it. Telegraph first,
         then demand input.

         Hosted on the LAYER rather than the frame — at this point the arena is
         empty, so the frame is about sixty pixels tall with overflow hidden and
         would clip the card. Never rejects, and resolves immediately in
         fastChallenge, so the forty headless harnesses are unaffected. */
      if (typeof Howto !== 'undefined' && Howto.show) {
        Howto.show(game, layer).then(tick, tick);
      } else {
        tick();
      }
    });
  },

  /* The one place a minigame context is built. Test harnesses call this too —
     they used to hand-roll their own ctx, which is how they ended up without the
     difficulty helpers and reported fifteen games as broken when only the
     duplication was. */
  /* What word a spelling game spells. The shell owns it, not the game: a reward
     challenge must not put "IMMUNITY" on screen, and A Bit Tipsy had it hardcoded,
     which is why the reward system was excluding that game outright. Set
     Challenge.word before play() to override. */
  word: null,

  makeCtx(parts) {
    const { arena, frame, score, timer, game, howto, ease, onDone } = parts;
    const ctx = {
        arena, frame, score, timer, game,
        word: Challenge.word || null,
        ease: (ease === undefined ? 0.5 : ease),
        /* ---------- difficulty ----------
           One lever for all twenty games. The player was winning every individual
           immunity, and half the reason was that the minigames themselves were too
           forgiving: perfect scores were routine, so "how well did you play" carried
           no information.

           Every game routes its numbers through these three, so difficulty is a
           single tunable rather than sixty scattered constants:

             tol(base, easeBonus)  a window, a tolerance, a safe zone. Bigger is
                                   easier, so hard DIVIDES it.
             rate(base, easeCut)   a speed, a drift, a decay. Bigger is harder, so
                                   hard MULTIPLIES it — and pace SLOWS it.
             span(ms, easeBonus)   a duration you are given. Bigger is easier, so
                                   hard DIVIDES it — and pace LENGTHENS it.

           ease still buys kindness — a stronger castaway gets a wider window — it
           just buys less of it than it used to.

           WHY THERE ARE NOW TWO LEVERS. There used to be one, and it conflated two
           different things: how tight the target is, and how fast the game runs at
           you. Raising it to 1.7 therefore made every game 41% SHORTER as well as
           tighter, which is why the report back was "most challenges are way too
           hard — even the tap-the-box one is way too fast". Those are two complaints
           and they needed two knobs.

             chalDifficulty  how tight   -> tol, rate, more
             chalPace        how quick   -> rate, span

           So a game can now be generous and unhurried, generous and frantic, or
           anything else, rather than the two being welded together. */
        hard: CONFIG.chalDifficulty,
        pace: CONFIG.chalPace,
        tol(base, easeBonus) {
          return (base + (easeBonus || 0) * this.ease * CONFIG.chalEaseWeight) / this.hard;
        },
        rate(base, easeCut) {
          return Math.max(0.02, (base - (easeCut || 0) * this.ease * CONFIG.chalEaseWeight)
            * this.hard / this.pace);
        },
        span(ms, easeBonus) {
          return Math.max(300, (ms + (easeBonus || 0) * this.ease * CONFIG.chalEaseWeight)
            / this.hard * this.pace);
        },
        /* Counts go UP with difficulty: more rounds to survive, a longer chain to
           reach. Scaled GENTLY on purpose — human working memory is about seven
           items, so multiplying a memory count by the full difficulty turns hard
           into impossible. A score divisor can take the full ride; a number of
           things you must actually hold in your head cannot. */
        more(base, easeBonus) {
          const v = base * (1 + (this.hard - 1) * 0.62)
            + (easeBonus || 0) * this.ease * CONFIG.chalEaseWeight;
          return Math.max(base, Math.round(v));
        },
        /* Show the score as it accumulates — feedback, not a surprise at the end.
           This is also where the player's own rail chip gets its live position, so
           climbing the tribe order as you play is the same event as the number
           going up. */
        setScore(v) {
          score.textContent = Math.round(clamp01(v) * 100);
          if (Challenge.onScore) { try { Challenge.onScore(clamp01(v)); } catch { /* never break a game */ } }
        },
        /* A countdown bar the minigame drives; returns a stop() handle. */
        clock(ms, onEnd) {
          const bar = timer.firstChild;
          bar.style.transition = 'none'; bar.style.width = '100%';
          void bar.offsetWidth;
          bar.style.transition = `width ${ms}ms linear`;
          bar.style.width = '0%';
          const t = setTimeout(onEnd, ms);
          return { stop() { clearTimeout(t); bar.style.transition = 'none'; } };
        },
        /* Real-time hit-stop: freezes the arena visually without stalling logic. */
        hitstop(ms) {
          arena.classList.add('cg-frozen');
          setTimeout(() => arena.classList.remove('cg-frozen'), ms || 70);
        },
        done(v) {
          const val = clamp01(v);
          if (howto) howto.textContent = '';
          Juice.fx(score, val > 0.66 ? 'large' : val > 0.33 ? 'medium' : 'bad',
            val > 0.66 ? 'STRONG' : val > 0.33 ? 'OK' : 'WEAK');
          ctx.setScore(val);
          DBG.decision('Challenge', 'minigame score',
            { game: game.id, score: +val.toFixed(3), ease: +ctx.ease.toFixed(2), hard: ctx.hard });
          if (onDone) onDone(val);
        }
    };
    return ctx;
  }
};

/* The player's own performance, consumed by the scoring in sim.js. Reset each
   challenge so a stale value can never leak into the next one. */
function setPlayerChallengePerf(v) { GAME.playerPerf = (v === null || v === undefined) ? null : clamp01(v); }
