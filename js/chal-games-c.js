/* ============================================================
   MINIGAMES 16-20 — NERVE AND SOCIAL.

   The last two are the ones no other Survivor game has: they read the actual
   relationship graph, so who likes you decides how the challenge goes.
   ============================================================ */
const MINIGAMES_C = [

  /* 16. STARVATION AUCTION — bid against the tribe on a shared budget. */
  {
    id: 'auction', name: 'Starvation Auction', bucket: 'nerve', verb: 'bid',
    tags: ['smarts', 'emotional'],
    how: 'Lots come up one at a time. Bid or pass. Your budget does not refill.',
    forChallenges: ['Starvation Auction'],
    start(ctx) {
      const budget0 = 100;
      let budget = budget0, won = 0, lot = 0, done = false;
      const lots = shuffle([
        { n: 'Rice and beans', v: 30 }, { n: 'Fresh water', v: 25 },
        { n: 'Fruit basket', v: 20 }, { n: 'Chicken dinner', v: 40 },
        { n: 'Blanket', v: 15 }, { n: 'Letter from home', v: 35 }
      ]).slice(0, 5);
      const info = h('div', 'cg-warn', '');
      const title = h('div', 'cg-eq', '');
      const row = h('div', 'cg-row');
      const bidB = h('button', 'btn cg-b primary', 'BID'), passB = h('button', 'btn cg-b sand', 'PASS');
      row.appendChild(bidB); row.appendChild(passB);
      const bar = h('div', 'cg-bidbar'); bar.appendChild(h('i'));
      ctx.arena.appendChild(title); ctx.arena.appendChild(bar); ctx.arena.appendChild(info); ctx.arena.appendChild(row);
      let ask = 0, rivalMax = 0;
      const nextLot = () => {
        if (lot >= lots.length || budget <= 0) return fin();
        const L = lots[lot];
        ask = 10;
        /* Rivals bid harder when the castaway is less shrewd — ease as softer field. */
        rivalMax = Math.round(L.v * ctx.rate(0.85, 0.30) + rr(0, 12));
        title.textContent = L.n + '  —  worth ' + L.v;
        info.textContent = `Budget ${budget}. Current bid ${ask}.`;
        bar.firstChild.style.width = Math.min(100, (budget / budget0) * 100) + '%';
      };
      const raise = () => {
        if (done) return;
        const L = lots[lot];
        ask += 10;
        if (ask > budget) { Juice.fx(bidB, 'bad', 'no funds'); return pass(); }
        if (ask > rivalMax) {
          budget -= ask; won += L.v;
          Juice.fx(title, 'medium', 'WON ' + L.n);
          ctx.setScore(clamp01(won / 100));
          lot++; return nextLot();
        }
        info.textContent = `Outbid. They went to ${ask + 10}. Budget ${budget}.`;
        Juice.fx(info, 'small');
      };
      const pass = () => { if (done) return; Juice.fx(passB, 'small', 'passed'); lot++; nextLot(); };
      bidB.onclick = raise; passB.onclick = pass;
      const fin = () => {
        if (done) return; done = true;
        const leftover = budget / budget0 * 0.15;
        Juice.fx(title, won > 50 ? 'large' : won > 0 ? 'medium' : 'bad', won + ' of value');
        ctx.done(clamp01(won / 110 + leftover));
      };
      ctx.clock(ctx.span(32000), fin);
      nextLot();
    }
  },

  /* 17. NIGHT WATCH — tap real sounds, ignore decoys. */
  {
    id: 'watch', name: 'Night Watch', bucket: 'nerve', verb: 'tap',
    tags: ['emotional', 'smarts'],
    how: 'Tap the SOUNDS. Never tap the shadows — a false alarm wakes the camp.',
    forChallenges: ['Night Watch'],
    start(ctx) {
      const field = h('div', 'cg-night');
      ctx.arena.appendChild(field);
      let hits = 0, falses = 0, missed = 0, done = false;
      /* Same as Island Sprint: pure reaction, so it gets the tap allowance. */
      const life = ctx.span(1250, 700) * CONFIG.chalTapEase;   // ease = longer to react
      const spawn = () => {
        if (done) return;
        const real = chance(0.62);
        const m = h('div', 'cg-mark ' + (real ? 'real' : 'decoy'), real ? '♪' : '•');
        m.style.left = (6 + Math.random() * 84) + '%';
        m.style.top = (10 + Math.random() * 66) + '%';
        let gone = false;
        const kill = miss => {
          if (gone) return; gone = true;
          if (miss && real) { missed++; }
          m.remove();
        };
        m.onclick = () => {
          if (gone || done) return;
          if (real) { hits++; Juice.fx(m, 'small', '+1'); }
          else { falses++; Juice.fx(m, 'bad', 'FALSE ALARM'); ctx.hitstop(80); }
          ctx.setScore(clamp01(hits / ctx.more(14) - falses * 0.12));
          kill(false);
        };
        field.appendChild(m);
        Juice.pop(m, 0.7);
        setTimeout(() => kill(true), life);
        setTimeout(spawn, 480 + Math.random() * 520);
      };
      ctx.clock(18000, () => {
        if (done) return; done = true;
        Juice.fx(ctx.score, 'medium');
        ctx.done(clamp01(hits / ctx.more(14) - falses * 0.14 - missed * 0.03));
      });
      spawn();
    }
  },

  /* 18. HOLD YOUR NERVE — the pot rises, rivals drop, bank or bust. */
  {
    id: 'nerve', name: 'Hold Your Nerve', bucket: 'nerve', verb: 'push-luck',
    tags: ['emotional'],
    how: 'The pot grows every second. BANK to take it. Hold too long and it busts.',
    start(ctx) {
      const pot = h('div', 'cg-pot', '0');
      const others = h('div', 'cg-warn', '');
      const b = h('button', 'btn cg-b primary cg-wide', 'BANK');
      ctx.arena.appendChild(pot); ctx.arena.appendChild(others); ctx.arena.appendChild(b);
      let v = 0, done = false, standing = 4;
      /* Bust chance climbs; a steadier castaway gets a longer fuse. */
      const fuse = ctx.rate(0.006) + (1 - ctx.ease) * 0.010 * ctx.hard;
      let last = performance.now();
      const step = now => {
        if (done) return;
        const dt = Math.min(0.06, (now - last) / 1000); last = now;
        v += dt * 9;
        pot.textContent = Math.round(v);
        ctx.setScore(clamp01(v / 100));
        if (v > 22) pot.classList.add('hot');
        if (standing > 0 && chance(dt * 0.55)) {
          standing--;
          others.textContent = standing + ' still holding besides you';
          Juice.fx(others, 'small', 'someone banked');
        }
        if (chance(dt * fuse * (v * 0.9))) {
          done = true;
          Juice.fx(pot, 'bad', 'BUST');
          return ctx.done(0.05);
        }
        Juice.shake(dt * v * 0.004);
        requestAnimationFrame(step);
      };
      b.onclick = () => {
        if (done) return; done = true;
        const bonus = standing === 0 ? 0.18 : 0;   // last one holding
        Juice.fx(pot, v > 45 ? 'large' : 'medium', 'BANKED ' + Math.round(v));
        ctx.done(clamp01(v / 95 + bonus));
      };
      requestAnimationFrame(step);
    }
  },

  /* 19. TRUST FALL — your partner's stat helps you, unless they drop you.
     Reads the real relationship graph: pick someone who does not like you and
     they will let you fall. */
  {
    id: 'trustfall', name: 'Trust Fall', bucket: 'nerve', verb: 'choose',
    tags: ['emotional'],
    how: 'Pick who catches you. Their strength counts as much as yours — if they want it to.',
    start(ctx) {
      const P = GAME.player;
      const mates = campmates(P).filter(c => !c.isPlayer).slice(0, 6);
      ctx.arena.appendChild(h('div', 'cg-clue', 'Choose your partner. You are trusting them with the fall.'));
      const grid = h('div', 'cg-grid-cards');
      let done = false;
      if (!mates.length) return ctx.done(0.5);
      for (const m of mates) {
        const card = castCard(m, m.occupation);
        card.addEventListener('click', () => {
          if (done) return; done = true;
          const warmth = m.getTrust(P.name) * 0.65 + m.getRel(P.name) * 0.35;
          const theirs = m.stats.physicality;
          /* A cold partner may deliberately drop you. */
          const drops = warmth < 0.35 && chance(0.35 + (0.35 - warmth));
          Juice.attach(ctx.frame);
          if (drops) {
            Juice.fx(card, 'bad', 'THEY LET GO');
            Feed.post(`${m.displayName} let you fall. Everyone saw it.`, 'danger', GAME.day);
            m.addRel(P.name, -0.04, 'dropped you in a challenge');
            P.addTrust(m.name, -0.15, 'they dropped you');
            DBG.decision('Challenge', 'trust fall DROPPED', { partner: m.name, warmth: +warmth.toFixed(2) });
            return ctx.done(0.08);
          }
          const s = clamp01(0.30 + theirs * 0.4 + warmth * 0.3);
          Juice.fx(card, s > 0.66 ? 'large' : 'medium', s > 0.66 ? 'CLEAN CATCH' : 'held');
          m.addTrust(P.name, 0.06, 'you trusted them with the fall');
          m.addRel(P.name, 0.05, 'you trusted them with the fall');
          DBG.decision('Challenge', 'trust fall CAUGHT', { partner: m.name, warmth: +warmth.toFixed(2), score: +s.toFixed(2) });
          ctx.done(s);
        });
        grid.appendChild(card);
      }
      ctx.arena.appendChild(grid);
      ctx.clock(ctx.span(22000), () => { if (!done) { done = true; ctx.done(0.25); } });
    }
  },

  /* 20. PUZZLE RELAY — you run one leg; choosing the running order is the game. */
  {
    id: 'relay', name: 'Puzzle Relay', bucket: 'nerve', verb: 'choose',
    tags: ['smarts', 'physicality'],
    how: 'Order your three legs. Then run yours. Put the right person on the right leg.',
    start(ctx) {
      const P = GAME.player;
      const mates = campmates(P).filter(c => !c.isPlayer);
      const legs = [
        { n: 'Swim leg', key: 'physicality' },
        { n: 'Untie the knots', key: 'smarts' },
        { n: 'Final sprint', key: 'physicality' }
      ];
      const chosen = [];
      let done = false;
      const label = h('div', 'cg-clue', '');
      const grid = h('div', 'cg-grid-cards');
      ctx.arena.appendChild(label); ctx.arena.appendChild(grid);
      if (mates.length < 2) return ctx.done(0.5);

      const paint = () => {
        label.textContent = `Who runs the ${legs[chosen.length].n}? (weights ${STAT_LABELS[legs[chosen.length].key] || legs[chosen.length].key})`;
        grid.innerHTML = '';
        for (const m of mates) {
          if (chosen.some(c => c.who === m)) continue;
          const card = castCard(m, m.occupation);
          card.addEventListener('click', () => {
            if (done) return;
            const leg = legs[chosen.length];
            chosen.push({ who: m, leg });
            Juice.fx(card, 'small', leg.n);
            ctx.setScore(clamp01(chosen.length / 3 * 0.4));
            if (chosen.length >= legs.length) runIt(); else paint();
          });
          grid.appendChild(card);
        }
      };
      const runIt = () => {
        grid.innerHTML = '';
        label.textContent = 'Your leg. Tap the knots as they light.';
        /* The player's own leg is a quick 6-tap sort. */
        const pads = h('div', 'cg-grid3'); const cells = [];
        for (let i = 0; i < 9; i++) { const c = h('button', 'cg-pad'); pads.appendChild(c); cells.push(c); }
        ctx.arena.appendChild(pads);
        let lit = ri(0, 9), got = 0, need = 6;
        cells[lit].classList.add('lit');
        cells.forEach((c, i) => c.onclick = () => {
          if (done) return;
          if (i !== lit) { Juice.fx(c, 'bad'); return; }
          got++; c.classList.remove('lit');
          Juice.fx(c, 'small', got + '/' + need);
          if (got >= need) return settle();
          do { lit = ri(0, 9); } while (cells[lit].classList.contains('lit'));
          cells[lit].classList.add('lit');
        });
        const settle = () => {
          if (done) return; done = true;
          /* Team legs resolve from the stat each leg actually wants. */
          let team = 0;
          for (const c of chosen) team += c.who.stats[c.leg.key];
          team /= chosen.length;
          const mine = clamp01(got / need);
          const s = clamp01(team * 0.55 + mine * 0.45);
          Juice.fx(pads, s > 0.62 ? 'large' : 'medium', 'RELAY DONE');
          DBG.decision('Challenge', 'relay', {
            order: chosen.map(c => c.who.name + '@' + c.leg.n), team: +team.toFixed(2), mine: +mine.toFixed(2)
          });
          ctx.done(s);
        };
        ctx.clock(ctx.span(16000), settle);
      };
      paint();
      ctx.clock(ctx.span(45000), () => { if (!done) { done = true; ctx.done(0.3); } });
    }
  }
];

/* The MINIGAMES array is assembled in chal-games-index.js, which loads after all
   seven batches. It used to be built here, at the end of the last game file — an
   arrangement that quietly drops any batch added after it. */
