/* ============================================================
   MINIGAMES F — PRECISION, STRENGTH AND PHYSICAL NERVE.

   Five formats lifted straight off the show: the slingshot-and-sand tile
   smash, the climb-jump-swing key grab, reverse tug of war, floating-platform
   sumo, and the braided rope the whole tribe is tied into.

   The common thread is that none of them is a hidden dice roll. Every one puts
   the thing it is about to judge you on ON SCREEN first — the aim guides, the
   pendulum, the opponent's surge, the tell, the crossings — because the
   playtest that killed Log Carry killed it for showing the player nothing to
   read. If a miss here is not legible as a miss, the game is broken.
   ============================================================ */
const MINIGAMES_F = [

  /* 1. BLUE PLATE SPECIAL — two-stage aim lock at a wall of tiles.

     The real challenge: fire rocks from a slingshot at tiles on the other
     tribes' structures. Every tile you break opens a hole and sand pours out of
     it onto that player's tiki. Bury the tiki and they are out. The sand is the
     point — the tiles are only the tap you open.

     So the sand is the score. Not a hit counter: an amount of sand, which keeps
     falling from every hole you have already made while you line up the next
     shot. That is escalation pattern 3, an environmental ramp, and it is the
     one place in this file where doing nothing still earns — but only if you
     already did something.

     Aiming is the classic two-stage lock: an oscillating ANGLE, then an
     oscillating POWER, one tap each. It needs no explanation and it is honest
     about what it is measuring. The guides matter more than the sling does:
     the angle draws a horizontal line across the wall and the power draws a
     vertical one, so the player is not aiming an abstraction, they are watching
     a crosshair pull apart and choosing when to pin each half of it. */
  {
    id: 'sling', name: 'Blue Plate Special', bucket: 'physical', verb: 'aim',
    tags: ['physicality', 'smarts'],
    how: 'Tap to lock the ANGLE line, tap again to lock the POWER line. Break tiles — the sand buries the tiki.',
    start(ctx) {
      const field = h('div', 'cf-slingfield');
      const wall = h('div', 'cf-wall');
      const guideY = h('div', 'cf-guide-y');            // the angle lock, drawn on the wall
      const guideX = h('div', 'cf-guide-x');            // the power lock, drawn on the wall
      wall.appendChild(guideY); wall.appendChild(guideX);
      const rock = h('div', 'cf-rock');
      wall.appendChild(rock);
      const tiki = h('div', 'cf-tiki');
      const sandFill = h('div', 'cf-sandfill');
      tiki.appendChild(sandFill);
      tiki.appendChild(h('div', 'cf-tiki-head', 'TIKI'));
      const arm = h('div', 'cf-arm');
      field.appendChild(wall); field.appendChild(tiki); field.appendChild(arm);
      const powBar = h('div', 'cf-powbar'); powBar.appendChild(h('i'));
      const warn = h('div', 'cg-warn', 'lock the angle');
      const fireB = h('button', 'btn cg-b primary cg-wide', 'LOCK ANGLE');
      ctx.arena.appendChild(field);
      ctx.arena.appendChild(powBar);
      ctx.arena.appendChild(warn);
      ctx.arena.appendChild(fireB);

      /* Ease is spent entirely on a steadier hand: both oscillators slow down.
         Nothing about the wall or the sand changes, so a strong castaway is not
         given a bigger target, only more time to find the one that is there. */
      const angSpeed = ctx.rate(2.6, 1.1);              // radians/sec of the angle sweep
      const powSpeed = ctx.rate(3.2, 1.3);              // deliberately coprime-ish with the above
      const hitPad = ctx.tol(0.022, 0.026);             // slop around a tile, in wall widths
      /* Fitting the next rock and drawing the sling back. Without it the best
         strategy was to hammer the button and spray — a miss cost nothing, so
         volume beat accuracy and the two-stage lock was decoration. Capping the
         rate of fire is what makes the aim worth taking, and it is also what
         actually happens: you only have so many rocks and you have to reload. */
      const RELOAD = ctx.rate(0.62) * 1000;
      const bury = ctx.more(8);                         // sand units needed to bury the tiki
      const perHole = ctx.tol(0.30, 0.12);              // sand/sec out of ONE broken tile
      const FLIGHT = 380;

      let alive = true, phase = 'angle', lockA = 0, lockP = 0;
      let broken = 0, sand = 0, fly = null;
      const timers = [];
      const T = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };

      /* Six tiles. They are repositioned after every break rather than merely
         removed, because "the target shrinks" has to mean something you can see:
         the survivors migrate to the corners and the top of the structure, which
         is where the last tiles always are once the easy ones are gone. */
      const tiles = [];
      for (let i = 0; i < 6; i++) {
        const el = h('div', 'cf-tile');
        el.appendChild(h('i', 'cf-tile-crack'));
        wall.appendChild(el);
        tiles.push({ el, x: 0, y: 0, hw: 0, hh: 0, dead: false });
      }
      const place = () => {
        const live = tiles.filter(t => !t.dead);
        /* Shrink and scatter with the count of holes already made, not with the
           clock: the player earns the harder wall. */
        const hw = 0.085 * (1 - 0.075 * broken);
        const hh = 0.105 * (1 - 0.075 * broken);
        const edge = Math.min(0.85, 0.20 + broken * 0.16);   // odds of an extreme column
        live.forEach((t, i) => {
          const far = Math.random() < edge;
          const leftSide = i % 2 === 0;
          t.x = far
            ? (leftSide ? rr(0.07, 0.26) : rr(0.74, 0.93))
            : rr(0.30, 0.70);
          t.y = rr(0.36 + broken * 0.075, 0.92);
          t.hw = hw; t.hh = hh;
          t.el.style.width = (hw * 200) + '%';
          t.el.style.height = (hh * 200) + '%';
          t.el.style.left = (t.x * 100) + '%';
          t.el.style.top = ((1 - t.y) * 100) + '%';
        });
      };
      place();

      const setGuides = (av, pv) => {
        guideY.style.top = ((1 - av) * 100) + '%';
        guideX.style.left = (pv * 100) + '%';
        arm.style.transform = `rotate(${-(6 + av * 70).toFixed(1)}deg)`;
        powBar.firstChild.style.width = (pv * 100) + '%';
      };

      const shoot = () => {
        fly = { t0: performance.now() };
        rock.classList.add('on');
        warn.textContent = 'away';
        warn.classList.remove('hot');
        fireB.textContent = '...';
        phase = 'fly';
      };

      const land = () => {
        rock.classList.remove('on');
        const hit = tiles.find(t => !t.dead
          && Math.abs(lockP - t.x) < t.hw + hitPad
          && Math.abs(lockA - t.y) < t.hh + hitPad);
        if (hit) {
          hit.dead = true; hit.el.classList.add('cf-shatter');
          broken++;
          /* An immediate spill plus a permanent new stream. The instant chunk is
             so the break lands as a hit; the stream is what actually wins it. */
          sand += 0.45;
          Juice.fx(hit.el, broken >= 4 ? 'large' : 'medium', 'SAND');
          T(() => { hit.el.style.display = 'none'; }, 280);
          place();
          if (broken >= tiles.length) return T(() => finish('WALL DOWN'), 420);
        } else {
          Juice.fx(rock, 'bad', 'wide');
          ctx.hitstop(50);
        }
        phase = 'reload';
        fireB.textContent = 'RELOADING';
        T(() => {
          if (!alive) return;
          phase = 'angle';
          guideY.classList.remove('set'); guideX.classList.remove('set');
          fireB.textContent = 'LOCK ANGLE';
          warn.textContent = broken ? broken + ' hole' + (broken > 1 ? 's' : '') + ' pouring' : 'lock the angle';
        }, RELOAD);
      };

      fireB.onclick = () => {
        if (!alive) return;
        if (phase === 'angle') {
          const now = performance.now() / 1000;
          lockA = 0.5 + 0.5 * Math.sin(now * angSpeed);
          phase = 'power';
          fireB.textContent = 'LOCK POWER';
          warn.textContent = 'angle set — now the power';
          guideY.classList.add('set');
          Juice.pop(guideY, 0.6);
        } else if (phase === 'power') {
          const now = performance.now() / 1000;
          lockP = 0.5 + 0.5 * Math.sin(now * powSpeed + 1.1);
          guideX.classList.add('set');
          Juice.pop(guideX, 0.6);
          shoot();
        }
      };

      const finish = why => {
        if (!alive) return; alive = false;
        clk.stop(); timers.forEach(clearTimeout);
        const s = clamp01(sand / bury);
        Juice.fx(tiki, s > 0.66 ? 'large' : s > 0.25 ? 'medium' : 'bad',
          why || (s > 0.66 ? 'BURIED' : Math.round(s * 100) + '% buried'));
        ctx.done(s);
      };
      const clk = ctx.clock(16000, () => finish(null));

      let last = performance.now();
      const loop = now => {
        if (!alive) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        const t = now / 1000;
        /* A locked axis stops moving; an unlocked one keeps sweeping. The power
           bar sweeps during the angle stage too — you need to have been watching
           it before it is your turn to pin it, or the second lock is a guess. */
        const aiming = phase === 'angle' || phase === 'power';
        const av = phase === 'angle' ? 0.5 + 0.5 * Math.sin(t * angSpeed) : lockA;
        const pv = aiming ? 0.5 + 0.5 * Math.sin(t * powSpeed + 1.1) : lockP;
        setGuides(av, pv);

        if (fly) {
          const u = clamp01((now - fly.t0) / FLIGHT);
          const x = -0.14 + (lockP + 0.14) * u;
          const y = 0.02 + (lockA - 0.02) * u + 0.26 * Math.sin(Math.PI * u);
          rock.style.left = (x * 100) + '%';
          rock.style.top = ((1 - y) * 100) + '%';
          if (u >= 1) { fly = null; land(); }
        }

        /* The ramp. Every hole pours for the rest of the round, so the third
           break is worth far more than the first and stalling late costs less
           than stalling early. */
        if (broken) {
          sand += broken * perHole * dt;
          sandFill.style.height = Math.min(100, (sand / bury) * 100) + '%';
          if (sand / bury > 0.72) { warn.classList.add('hot'); }
        }
        ctx.setScore(clamp01(sand / bury));
        if (sand >= bury) return finish('BURIED');
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
  },

  /* 2. SMASH AND GRAB — jump off the platform and swing on the way past.

     The real challenge: swim out, climb a tower, take a club, and jump off it
     while swinging at a tile hanging on a rope. Break the tile, take the key.
     Miss and you swim back and climb again.

     That re-climb is the whole reason the swing matters, so it is modelled
     literally rather than as a score penalty. A miss costs you a swim AND a
     climb; a hit costs you only the climb. Nothing is deducted, but the clock
     is the resource and a miss spends about twice as much of it.

     The timing window is a spatial overlap and is drawn as one. You fall down a
     fixed column; the tile swings on a pendulum whose far end reaches into that
     column. A hit needs the tile to be beside you AND level with you at the
     same instant, and because both bodies are on screen the whole time a miss
     is readable — the tile was still out wide, or you were already past it.

     Escalation is pattern 2, the apparatus changing in stages: each key you
     take, the rope is shortened and the next tile hangs higher, so you are
     level with it for less of the fall. */
  {
    id: 'smash', name: 'Smash and Grab', bucket: 'physical', verb: 'swing',
    tags: ['physicality'],
    how: 'You fall past a swinging tile. Tap SWING when the club can reach it. Miss and you swim back.',
    start(ctx) {
      const rig = h('div', 'cf-rig');
      const water = h('div', 'cf-water');
      const tower = h('div', 'cf-tower-f');
      const pivot = h('div', 'cf-pivot');
      const arm = h('div', 'cf-pendarm');
      const tile = h('div', 'cf-hangtile', '⚿');
      arm.appendChild(tile);
      pivot.appendChild(arm);
      const faller = h('div', 'cf-faller');
      /* The strike box is drawn at its true size and follows you down. If the
         tile's centre is inside it when you swing, you hit — so the window is
         never invisible and a miss is a picture of a miss, not a verdict. */
      const reach = h('div', 'cf-reach');
      rig.appendChild(water); rig.appendChild(tower); rig.appendChild(pivot);
      rig.appendChild(reach); rig.appendChild(faller);
      const keysRow = h('div', 'cf-keys');
      const state = h('div', 'cg-warn', 'climbing');
      const swingB = h('button', 'btn cg-b primary cg-wide', 'SWING');
      ctx.arena.appendChild(rig);
      ctx.arena.appendChild(keysRow);
      ctx.arena.appendChild(state);
      ctx.arena.appendChild(swingB);

      /* Ease buys a longer club and a lazier pendulum — a bigger overlap in both
         axes at once, which is the only kindness this format has to give. */
      const reachX = ctx.tol(0.14, 0.075);           // club half-width, in rig widths
      const reachY = ctx.tol(0.155, 0.055);          // how level you have to be
      const swing = ctx.rate(2.0, 0.7);              // pendulum radians/sec
      const need = ctx.more(3);                      // keys wanted
      const FALLMS = ctx.span(2100);                 // the drop itself is not eased
      const CLIMBMS = ctx.span(700);
      const SWIMMS = ctx.span(1000);                 // the honest cost of a miss
      const FALLER_X = 0.30;                         // the column you drop down
      /* The pivot and the starting rope length are set so that the NEAR end of
         the swing lands almost exactly in your column: PIVOT_X - armLen*ASPECT
         *sin(AMP) is about 0.30. A pendulum driven by sin() dwells at its
         extremes, so the tile spends most of its time either right beside you or
         right out of reach, which is what makes the swing a decision. */
      const PIVOT_X = 0.50;
      const AMP = 1.0;                               // radians each way, about 57 degrees
      /* .cf-rig is pinned to a 2:1 aspect ratio in CSS so that one rig-height is
         exactly half a rig-width. Without a known ratio the drawn pendulum and
         the measured pendulum would disagree on every screen size. */
      const ASPECT = 0.5;
      reach.style.width = (reachX * 2 * 100) + '%';
      reach.style.height = (reachY * 2 * 100) + '%';

      let alive = true, keys = 0, swings = 0, hits = 0;
      let phase = 'climb', phaseT = performance.now(), swungThisFall = false;
      /* The tile gets a fresh push every time you start climbing. This is not
         decoration: the fall/swim/climb cycle and the pendulum are both perfectly
         periodic, so a fixed phase can put them in resonance and hand the player
         the identical — and possibly impossible — swing on every single attempt.
         Re-pushing it also means the swing you read on the ladder is the swing you
         are about to jump into, rather than one you memorised two falls ago. */
      let pend0 = rr(0, Math.PI * 2);
      let armLen = 0.48;                             // in rig heights; shortens per key
      const timers = [];
      const T = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };

      const paintKeys = () => {
        keysRow.innerHTML = '';
        for (let i = 0; i < need; i++) {
          keysRow.appendChild(h('span', 'cf-key' + (i < keys ? ' got' : ''), '⚿'));
        }
      };
      paintKeys();

      const enter = (p, ms) => {
        if (p === 'climb') pend0 = rr(0, Math.PI * 2);
        phase = p; phaseT = performance.now() + ms;
      };
      enter('climb', CLIMBMS);

      const tilePos = now => {
        const th = Math.sin(now / 1000 * swing + pend0) * AMP;
        return { x: PIVOT_X + Math.sin(th) * armLen * ASPECT, y: 0.06 + Math.cos(th) * armLen, th };
      };

      const doSwing = () => {
        if (!alive || phase !== 'fall' || swungThisFall) return;
        swungThisFall = true; swings++;
        reach.classList.remove('cf-swipe'); void reach.offsetWidth; reach.classList.add('cf-swipe');
        const now = performance.now();
        const u = clamp01(1 - (phaseT - now) / FALLMS);
        const fy = 0.10 + u * 0.78;
        const tp = tilePos(now);
        const dx = Math.abs(tp.x - FALLER_X), dy = Math.abs(tp.y - fy);
        if (dx < reachX && dy < reachY) {
          hits++; keys++; paintKeys();
          tile.classList.add('cf-shatter');
          Juice.fx(tile, keys >= need ? 'large' : 'medium', 'KEY');
          ctx.setScore(clamp01(keys / need));
          /* Pattern 2: the rope comes up a notch per key, so the next tile hangs
             higher and its near extreme no longer quite reaches your column —
             by the last key you are clipping the edge of it. */
          armLen = Math.max(0.30, armLen - 0.05);
          T(() => tile.classList.remove('cf-shatter'), 300);
          if (keys >= need) return T(() => finish('ALL KEYS'), 420);
          enter('climb', CLIMBMS);
          state.textContent = 'got it — climbing again';
        } else {
          /* Say WHY, in the language of the picture, so the next swing is informed. */
          const msg = dy >= reachY
            ? (tp.y > fy ? 'swung early' : 'swung late')
            : (tp.x > FALLER_X ? 'out of reach' : 'behind you');
          Juice.fx(reach, 'bad', msg);
          state.textContent = msg;
        }
      };
      swingB.onclick = doSwing;

      const finish = why => {
        if (!alive) return; alive = false;
        clk.stop(); timers.forEach(clearTimeout);
        const s = clamp01(keys / need);
        Juice.fx(keysRow, s >= 1 ? 'large' : s > 0.3 ? 'medium' : 'bad',
          why || (hits + ' of ' + Math.max(1, swings) + ' swings'));
        ctx.done(s);
      };
      const clk = ctx.clock(18000, () => finish(null));

      const loop = now => {
        if (!alive) return;
        const tp = tilePos(now);
        arm.style.height = (armLen * 100) + '%';
        arm.style.transform = `rotate(${(tp.th * 180 / Math.PI).toFixed(1)}deg)`;
        pivot.style.left = (PIVOT_X * 100) + '%';

        if (phase === 'fall') {
          const u = clamp01(1 - (phaseT - now) / FALLMS);
          faller.style.left = (FALLER_X * 100) + '%';
          faller.style.top = ((0.10 + u * 0.78) * 100) + '%';
          faller.classList.add('falling');
          if (u >= 1) {
            if (!swungThisFall) { Juice.fx(faller, 'bad', 'no swing'); }
            /* The swim back is the failure cost, and it is time, not points. */
            enter('swim', SWIMMS);
            state.textContent = 'swimming back';
            faller.classList.remove('falling');
          }
        } else if (phase === 'climb') {
          const u = clamp01(1 - (phaseT - now) / CLIMBMS);
          faller.style.left = (0.10 * 100) + '%';
          faller.style.top = ((0.86 - u * 0.76) * 100) + '%';
          if (now >= phaseT) {
            enter('fall', FALLMS);
            swungThisFall = false;
            state.textContent = 'FALLING — swing';
            state.classList.add('hot');
          }
        } else if (phase === 'swim') {
          const u = clamp01(1 - (phaseT - now) / SWIMMS);
          faller.style.left = ((0.30 - u * 0.20) * 100) + '%';
          faller.style.top = '88%';
          state.classList.remove('hot');
          if (now >= phaseT) { enter('climb', CLIMBMS); state.textContent = 'climbing'; }
        }
        /* Follows the body, and only armed while you are in the air — on the
           ladder it would imply you could reach something you cannot. */
        reach.classList.toggle('live', phase === 'fall');
        reach.style.left = faller.style.left;
        reach.style.top = faller.style.top;
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
  },

  /* 3. DRAGGED THROUGH MUD — reverse tug of war, won on rhythm not on speed.

     The real challenge: both tribes haul on one rope and the two people on the
     ends try to reach their own flag before the other end drags them back.

     Mashing must lose, or there is no game. Two things make sure of it. First,
     stamina: a pull costs grip, an empty tank gasses you out and they haul you
     while you are folded over. Second, and more importantly, the opponent has a
     visible SURGE/REST cycle and a pull during their rest is worth several
     pulls during their surge. So the input is one button and the decision is
     entirely about when — read them, spend the tank in their rest, sit out the
     surge and get it back.

     The cycle is telegraphed twice over: a phase label and a bar that fills
     toward the change, because a rhythm you can only discover by losing to it
     is not a rhythm, it is a trap.

     Escalation is pattern 4, drift as you tire: recovery gets slower the longer
     the contest runs, so the same rhythm that worked at the start slowly stops
     being enough. */
  {
    id: 'tug', name: 'Dragged Through Mud', bucket: 'physical', verb: 'pull',
    tags: ['physicality', 'emotional'],
    how: 'Tap PULL. Pull hard while they REST, and let go while they SURGE — and never empty your grip.',
    start(ctx) {
      const rope = h('div', 'cf-ropebar');
      rope.appendChild(h('div', 'cf-flag them', '◀'));
      rope.appendChild(h('div', 'cf-flag you', '▶'));
      const knot = h('div', 'cf-knot');
      rope.appendChild(knot);
      const oppWrap = h('div', 'cf-opp');
      const oppLabel = h('div', 'cf-opp-label', 'they are resting');
      const oppBar = h('div', 'cf-oppbar'); oppBar.appendChild(h('i'));
      oppWrap.appendChild(oppLabel); oppWrap.appendChild(oppBar);
      const stamWrap = h('div', 'cf-stamwrap');
      const stamBar = h('div', 'cf-stam'); stamBar.appendChild(h('i'));
      stamWrap.appendChild(h('span', 'cf-stam-tag', 'GRIP'));
      stamWrap.appendChild(stamBar);
      const pullB = h('button', 'btn cg-b primary cg-wide', 'PULL');
      ctx.arena.appendChild(rope);
      ctx.arena.appendChild(oppWrap);
      ctx.arena.appendChild(stamWrap);
      ctx.arena.appendChild(pullB);

      /* Ease is a bigger tank and a faster refill. The tank is shown at its real
         size — the bar itself is physically longer for a strong castaway — so the
         advantage is legible rather than a hidden multiplier. */
      const tank = ctx.tol(1, 0.4);
      const recover0 = ctx.tol(0.62, 0.25);            // grip per second at the start
      const cost = ctx.rate(0.024);                    // grip per pull, during their rest
      /* Fighting a heave costs multiples of what pulling into a rest costs. This
         is the number that makes mashing lose: a masher spends their tank on the
         surge, where a pull is worth almost nothing, and arrives at the rest
         window — the only window that pays — with nothing left to spend. */
      const COST_MULT = { rest: 1, wind: 1.3, surge: 2.5 };
      /* Deliberately NOT eased. The rope pulls just as hard on everyone; if ease
         cut the drag as well as filling the tank it would stack three ways at
         once and decide the contest before the player touched the button. */
      const dragRest = ctx.rate(0.0764);               // rope units per second
      const gainRest = ctx.tol(0.137, 0.03);           // per pull, while they rest
      const gainSurge = ctx.tol(0.03, 0.01);           // per pull, while they heave
      const TOTAL = 18000;
      const GASMS = ctx.rate(0.65) * 1000;             // folded over, being hauled
      const RECOVER_GAP = ctx.rate(0.14) * 1000;       // hands still before grip returns
      stamWrap.style.width = Math.round(52 + clamp01((tank - 0.45) / 0.55) * 48) + '%';

      /* You start already being dragged. Reverse tug of war never begins level —
         the other end has been hauling since the horn — and starting at zero with
         a full tank in a guaranteed rest phase handed the player most of the win
         inside the first two seconds, before they had read anything. */
      let alive = true, p = -0.22, stam = tank, gasUntil = 0, lastPull = 0, pulls = 0;
      /* rest -> wind-up -> surge, and the wind-up exists purely as a warning.
         The bases look odd because they are pre-multiplied to land on 1500 / 500 /
         1100 at the shipped difficulty of 1.7, which is where this was balanced.
         They are routed through the helpers anyway so the direction is right: a
         harder game gives a shorter rest to exploit and a longer heave to survive. */
      const CYCLE = [
        { k: 'rest', ms: ctx.span(2550, 400), label: 'they are RESTING — pull' },
        { k: 'wind', ms: ctx.span(850), label: 'they are winding up' },
        { k: 'surge', ms: ctx.rate(0.65) * 1000, label: 'THEY ARE HEAVING — hold on' }
      ];
      /* Enter the cycle wherever it happens to be, so the opening is not a scripted
         free rest window every single time. */
      let ph = ri(0, CYCLE.length), phEnd = performance.now() + rr(0.35, 1) * CYCLE[ph].ms;

      const posScore = () => clamp01((p + 0.5) / 1.5);

      const pull = () => {
        if (!alive) return;
        const now = performance.now();
        if (now < gasUntil) { Juice.fx(pullB, 'bad', 'no grip'); return; }
        const k = CYCLE[ph].k;
        stam -= cost * COST_MULT[k]; lastPull = now; pulls++;
        const g = k === 'rest' ? gainRest : k === 'wind' ? gainRest * 0.55 : gainSurge;
        p += g;
        Juice.pop(knot, k === 'rest' ? 0.7 : 0.3);
        if (k === 'rest' && pulls % 4 === 0) Juice.fx(knot, 'small', 'ground');
        if (stam <= 0) {
          stam = 0; gasUntil = now + GASMS;
          Juice.fx(stamBar, 'bad', 'GASSED OUT');
          ctx.hitstop(70);
        }
      };
      pullB.onclick = pull;

      const finish = why => {
        if (!alive) return; alive = false; clk.stop();
        const won = p >= 1;
        const s = won ? 1 : (p <= -1 ? 0.06 : posScore() * 0.85);
        Juice.fx(knot, won ? 'large' : p <= -1 ? 'bad' : 'medium',
          why || (won ? 'YOUR FLAG' : p <= -1 ? 'DRAGGED OFF' : 'held them'));
        ctx.done(s);
      };
      const clk = ctx.clock(TOTAL, () => finish(null));

      const t0 = performance.now();
      let last = t0;
      const loop = now => {
        if (!alive) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        const elapsed = now - t0;

        if (now >= phEnd) {
          ph = (ph + 1) % CYCLE.length;
          phEnd = now + CYCLE[ph].ms;
          oppLabel.textContent = CYCLE[ph].label;
          oppWrap.className = 'cf-opp ' + CYCLE[ph].k;
          if (CYCLE[ph].k === 'surge') Juice.shake(0.18);
        }
        oppBar.firstChild.style.width = clamp01(1 - (phEnd - now) / CYCLE[ph].ms) * 100 + '%';

        const k = CYCLE[ph].k;
        const gassed = now < gasUntil;
        /* They pull constantly; the surge is when it hurts, and being gassed is
           when it really hurts. */
        const drag = dragRest * (k === 'surge' ? 2.4 : k === 'wind' ? 1.2 : 1) * (gassed ? 1.5 : 1);
        p -= drag * dt;

        /* Pattern 4: the refill decays across the contest, so the rhythm that
           was sustainable in the first minute quietly stops being sustainable. */
        const fatigue = 1 - 0.5 * clamp01(elapsed / TOTAL);
        if (!gassed && now - lastPull > RECOVER_GAP) stam = Math.min(tank, stam + recover0 * fatigue * dt);

        knot.style.left = (50 + p * 46) + '%';
        knot.classList.toggle('winning', p > 0.35);
        stamBar.firstChild.style.width = clamp01(stam / tank) * 100 + '%';
        stamBar.classList.toggle('low', stam / tank < 0.28);
        pullB.classList.toggle('cf-gassed', gassed);
        pullB.textContent = gassed ? 'CATCHING YOUR BREATH' : 'PULL';
        ctx.setScore(posScore());

        if (p >= 1) return finish('YOUR FLAG');
        if (p <= -1) return finish('DRAGGED OFF');
        requestAnimationFrame(loop);
      };
      oppWrap.className = 'cf-opp ' + CYCLE[ph].k;
      oppLabel.textContent = CYCLE[ph].label;
      knot.style.left = (50 + p * 46) + '%';
      requestAnimationFrame(loop);
    }
  },

  /* 4. SUMO AT SEA — a read, not a reflex.

     The real challenge: two castaways on a floating platform over open water,
     armed with padded bags, and you may use anything except your hands. It is
     one of the few Survivor formats that is genuinely a duel, and a duel is won
     by watching the other person, so this is built as a read and not as a
     reaction test. The choose window is deliberately generous. Nothing here
     rewards a fast thumb.

     Each round the opponent gives a tell, the tell is honest, and then they
     commit. Three actions in a ring: SHOVE beats FEINT, FEINT beats BRACE,
     BRACE beats SHOVE. Both the ring and the tell dictionary are printed on
     screen the whole time, because a rock-paper-scissors you have to memorise
     by losing is just a slot machine with extra steps. Nobody should ever have
     to guess what beats what — they should have to catch what is coming.

     Escalation is pattern 2 applied to information rather than apparatus: the
     tell is shown for less time every round. Early on it is impossible to miss.
     By round seven it is a flicker. Guess instead of read and you go 1-in-3,
     which over a six-round duel is a loss. */
  {
    id: 'sumo', name: 'Sumo at Sea', bucket: 'nerve', verb: 'read',
    tags: ['emotional', 'gameAwareness'],
    how: 'Watch the tell, then counter. SHOVE beats FEINT, FEINT beats BRACE, BRACE beats SHOVE.',
    start(ctx) {
      const sea = h('div', 'cf-sea');
      const raft = h('div', 'cf-raft');
      raft.appendChild(h('i', 'cf-raft-edge l'));
      raft.appendChild(h('i', 'cf-raft-edge r'));
      const them = h('div', 'cf-fig them', 'THEM');
      const you = h('div', 'cf-fig you', 'YOU');
      raft.appendChild(them); raft.appendChild(you);
      sea.appendChild(raft);
      const tellEl = h('div', 'cf-tell', 'watch them');
      const ring = h('div', 'cf-rule', 'SHOVE beats FEINT   ·   FEINT beats BRACE   ·   BRACE beats SHOVE');
      const dict = h('div', 'cf-rule dim', 'plants their feet = BRACE   ·   winds up = SHOVE   ·   shifts their weight = FEINT');
      const row = h('div', 'cg-row');
      ctx.arena.appendChild(sea);
      ctx.arena.appendChild(tellEl);
      ctx.arena.appendChild(ring);
      ctx.arena.appendChild(dict);
      ctx.arena.appendChild(row);

      const ACTS = ['SHOVE', 'FEINT', 'BRACE'];
      const BEATS = { SHOVE: 'FEINT', FEINT: 'BRACE', BRACE: 'SHOVE' };
      const TELL = {
        BRACE: 'THEY PLANT THEIR FEET',
        SHOVE: 'THEY WIND UP',
        FEINT: 'THEY SHIFT THEIR WEIGHT'
      };

      /* Ease buys a longer, clearer tell, which is the literal meaning of being
         good at reading people. It buys nothing at all in the resolution. */
      let tellMs = ctx.span(950, 750);
      const minTell = ctx.span(230, 120);
      const chooseMs = ctx.span(3200, 800);
      const gain = ctx.tol(0.26, 0.05);                 // how far a won round drives them
      const hit = ctx.rate(0.24, 0.06);                 // how far a lost round drives you

      let alive = true, phase = 'idle', oppAct = null, push = 0, rounds = 0, reads = 0;
      const timers = [];
      const T = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
      let chooseTimer = null;

      const btns = {};
      ACTS.forEach(a => {
        const b = h('button', 'btn cg-b cf-act', a);
        b.onclick = () => choose(a);
        row.appendChild(b); btns[a] = b;
      });

      const paint = () => {
        them.style.left = (38 - push * 33) + '%';
        you.style.left = (62 - push * 33) + '%';
        them.classList.toggle('teeter', push > 0.55);
        you.classList.toggle('teeter', push < -0.55);
        ctx.setScore(clamp01((push + 1) / 2));
      };
      paint();

      const round = () => {
        if (!alive) return;
        rounds++;
        oppAct = pick(ACTS);
        phase = 'tell';
        tellEl.textContent = TELL[oppAct];
        tellEl.className = 'cf-tell show';
        Juice.pop(tellEl, 0.5);
        const shown = tellMs;
        /* Shrink AFTER using it, so round one is always the full look. */
        tellMs = Math.max(minTell, tellMs * 0.80);
        T(() => {
          if (!alive) return;
          phase = 'choose';
          tellEl.textContent = 'THEY COMMIT — counter it';
          tellEl.className = 'cf-tell hidden';
          chooseTimer = T(() => { if (alive && phase === 'choose') resolve(null); }, chooseMs);
        }, shown);
      };

      const choose = a => {
        if (!alive) return;
        if (phase !== 'choose') { Juice.fx(btns[a], 'bad', 'wait for the tell'); return; }
        resolve(a);
      };

      const resolve = mine => {
        if (!alive) return;
        phase = 'settle';
        if (chooseTimer) { clearTimeout(chooseTimer); chooseTimer = null; }
        const win = mine !== null && BEATS[mine] === oppAct;
        const tie = mine !== null && mine === oppAct;
        if (win) {
          reads++;
          push += gain;
          Juice.fx(them, 'medium', 'READ THEM');
        } else if (tie) {
          Juice.fx(you, 'small', 'locked up');
        } else {
          push -= hit;
          Juice.fx(you, 'bad', mine === null ? 'too slow' : 'they had you');
          ctx.hitstop(70);
        }
        tellEl.className = 'cf-tell result ' + (win ? 'good' : tie ? '' : 'bad');
        tellEl.textContent = 'they ' + oppAct + (mine ? ' · you ' + mine : ' · you froze');
        paint();
        if (push >= 1) return T(() => finish('THEY WENT IN'), 420);
        if (push <= -1) return T(() => finish('YOU WENT IN'), 420);
        T(round, 720);
      };

      const finish = why => {
        if (!alive) return; alive = false;
        clk.stop(); timers.forEach(clearTimeout);
        const s = push >= 1 ? 1 : push <= -1 ? 0.06 : clamp01((push + 1) / 2) * 0.85;
        Juice.fx(raft, s > 0.66 ? 'large' : s > 0.3 ? 'medium' : 'bad',
          why || (reads + ' of ' + rounds + ' read'));
        ctx.done(s);
      };
      const clk = ctx.clock(24000, () => finish(null));

      T(round, 500);
    }
  },

  /* 5. KNOW YOUR ROPES — find the strand that is genuinely on top.

     The real challenge: the whole tribe is physically braided into one rope and
     has to unbraid itself out of it. Only one person can move at a time, and
     working out who is the entire task — everyone else is pinned under someone.

     So this is a drawing problem, not a tapping problem, and almost all of the
     effort here went into the drawing. The braid is rendered the way a knot
     diagram is rendered: every strand is a full line, and at every crossing a
     short patch in the over-strand's colour is laid across the join, breaking
     the under-strand. There is no cheat and no highlight on the answer. A
     strand is free when it is over at EVERY one of its crossings, and the only
     way to know is to look at all of them.

     Crucially the over/under pattern is not a stacking order. Each crossing is
     decided independently, so "it was on top over there" tells you nothing
     about here, and you cannot shortcut the scan. Exactly one strand is free by
     construction: every other strand crosses the free one and loses there.

     A wrong pull tightens the knot — the offsets shrink, every crossing slides
     toward the middle, and the diagram gets harder to read for the rest of the
     round. That is a penalty you can see rather than a number that went down.

     Escalation: clear a braid and a bigger one replaces it, three strands then
     four then five. Five is where the real thing tops out and where the scan
     stops being casual — ten crossings to check. */
  {
    id: 'knots', name: 'Know Your Ropes', bucket: 'mental', verb: 'untangle',
    tags: ['smarts', 'physicality'],
    how: 'Only one strand is over the top at EVERY crossing. Pull that one. A wrong pull tightens the knot.',
    start(ctx) {
      const status = h('div', 'cg-warn', '');
      const field = h('div', 'cf-braid');
      const tally = h('div', 'cf-tally', '');
      ctx.arena.appendChild(status);
      ctx.arena.appendChild(field);
      ctx.arena.appendChild(tally);

      const need = ctx.more(5);                       // strands to free
      const pen = ctx.rate(0.09, 0.05);               // ease = a cheaper mistake
      /* Ease as clearer crossings: a ring is drawn at every intersection so a
         sharp castaway is at least told WHERE to look. It never says which
         strand is on top, so the deduction is still the player's. */
      const ringOpacity = clamp01((0.10 + ctx.ease * 0.85) / ctx.hard);

      let alive = true, busy = false, freed = 0, wrong = 0, tighten = 1;
      let size = 3, braid = null;
      const timers = [];
      const T = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };

      /* Intersection of two infinite lines, each stored as an angle plus a
         perpendicular offset from the centre of the field. Screen convention:
         y grows downward, which is also what CSS rotate() assumes, so the same
         numbers drive both the maths and the transform. */
      const cross = (A, B, tA, tB) => {
        const dix = Math.cos(A.a), diy = Math.sin(A.a);
        const djx = Math.cos(B.a), djy = Math.sin(B.a);
        const nix = -Math.sin(A.a), niy = Math.cos(A.a);
        const njx = -Math.sin(B.a), njy = Math.cos(B.a);
        const det = djx * diy - dix * djy;
        if (Math.abs(det) < 0.20) return null;        // too near parallel to read honestly
        const wx = tB * njx - tA * nix, wy = tB * njy - tA * niy;
        const t = (-wx * djy + djx * wy) / det;
        return { cx: 0.5 + tA * nix + t * dix, cy: 0.5 + tA * niy + t * diy, sep: Math.abs(det) };
      };

      /* Lay out n strands so that every pair crosses well inside the field.
         Spread the angles evenly and keep the offsets small, then verify; a few
         attempts is always enough, and the last attempt is used if none is
         clean so this can never spin. */
      const layout = n => {
        let last = null;
        for (let attempt = 0; attempt < 40; attempt++) {
          const st = [];
          for (let i = 0; i < n; i++) {
            st.push({
              a: ((i + 0.5) / n * 180 - 90 + rr(-9, 9)) * Math.PI / 180,
              off: ((i - (n - 1) / 2) / Math.max(1, n)) * 0.30 + rr(-0.04, 0.04)
            });
          }
          last = st;
          let ok = true;
          for (let i = 0; i < n && ok; i++) for (let j = i + 1; j < n && ok; j++) {
            const p = cross(st[i], st[j], st[i].off, st[j].off);
            if (!p || p.cx < 0.14 || p.cx > 0.86 || p.cy < 0.14 || p.cy > 0.86) ok = false;
          }
          if (ok) return st;
        }
        return last;
      };

      /* Choose the free strand and then decide every crossing. The free one wins
         all of its own; the rest are coin flips, which is what makes the pattern
         non-transitive and the scan compulsory. */
      const reweave = () => {
        const live = braid.st.map((s, i) => i).filter(i => !braid.out[i]);
        braid.free = pick(live);
        braid.over = {};
        for (let x = 0; x < live.length; x++) {
          for (let y = x + 1; y < live.length; y++) {
            const i = live[x], j = live[y];
            braid.over[i + '-' + j] = (i === braid.free || j === braid.free)
              ? braid.free
              : pick([i, j]);
          }
        }
      };

      const build = n => {
        braid = { n, st: layout(n), out: {}, free: -1, over: {} };
        reweave();
        render();
      };

      const render = () => {
        field.innerHTML = '';
        const live = braid.st.map((s, i) => i).filter(i => !braid.out[i]);
        const offOf = i => braid.st[i].off * tighten;
        for (const i of live) {
          const s = braid.st[i];
          const t = offOf(i);
          const el = h('button', 'cf-strand cf-s' + (i % 5));
          el.style.left = (50 + t * -Math.sin(s.a) * 100) + '%';
          el.style.top = (50 + t * Math.cos(s.a) * 100) + '%';
          el.style.transform = `translate(-50%,-50%) rotate(${(s.a * 180 / Math.PI).toFixed(2)}deg)`;
          el.onclick = () => pullStrand(i);
          field.appendChild(el);
        }
        /* Bridges last and on top: the patch that makes the over-strand look
           continuous and cuts the under-strand in half. */
        for (let x = 0; x < live.length; x++) {
          for (let y = x + 1; y < live.length; y++) {
            const i = live[x], j = live[y];
            const p = cross(braid.st[i], braid.st[j], offOf(i), offOf(j));
            if (!p) continue;
            if (ringOpacity > 0.02) {
              const ring = h('i', 'cf-xring');
              ring.style.left = (p.cx * 100) + '%';
              ring.style.top = (p.cy * 100) + '%';
              ring.style.opacity = ringOpacity.toFixed(2);
              field.appendChild(ring);
            }
            const over = braid.over[i + '-' + j];
            const b = h('i', 'cf-bridge cf-s' + (over % 5));
            b.style.left = (p.cx * 100) + '%';
            b.style.top = (p.cy * 100) + '%';
            b.style.width = Math.round(20 / Math.max(0.30, p.sep) + 14) + 'px';
            b.style.transform = `translate(-50%,-50%) rotate(${(braid.st[over].a * 180 / Math.PI).toFixed(2)}deg)`;
            field.appendChild(b);
          }
        }
        status.textContent = live.length > 1
          ? 'braid of ' + live.length + ' — one strand is over at every crossing'
          : 'last strand — pull it clear';
        tally.textContent = freed + ' freed' + (wrong ? '  ·  ' + wrong + ' tightened' : '');
      };

      const score = () => clamp01(freed / need - wrong * pen);

      const pullStrand = i => {
        if (!alive || busy) return;
        const el = [...field.querySelectorAll('.cf-strand')][
          braid.st.map((s, k) => k).filter(k => !braid.out[k]).indexOf(i)];
        if (i === braid.free) {
          freed++;
          braid.out[i] = true;
          if (el) el.classList.add('cf-out');
          const remaining = braid.st.filter((s, k) => !braid.out[k]).length;
          Juice.fx(el || field, remaining ? 'small' : 'medium', 'FREE');
          ctx.setScore(score());
          if (freed >= need) { busy = true; return T(() => finish('UNBRAIDED'), 420); }
          busy = true;
          T(() => {
            if (!alive) return;
            busy = false;
            /* Down to two strands the answer is whoever wins the single crossing,
               which is not a deduction. Bring on the next, bigger braid instead
               of handing out a free pull. */
            if (remaining <= 2) { size = Math.min(5, size + 1); build(size); }
            else { reweave(); render(); }
          }, 260);
        } else {
          wrong++;
          /* It tightens: every crossing slides in toward the middle and stays
             there. The weave itself is untouched, so a player mid-deduction has
             not had the answer moved on them, only made harder to see. */
          tighten *= 0.87;
          Juice.fx(el || field, 'bad', 'IT TIGHTENS');
          ctx.hitstop(70);
          ctx.setScore(score());
          render();
        }
      };

      const finish = why => {
        if (!alive) return; alive = false;
        clk.stop(); timers.forEach(clearTimeout);
        const s = score();
        Juice.fx(field, s > 0.66 ? 'large' : s > 0.25 ? 'medium' : 'bad', why || freed + ' strands');
        ctx.done(s);
      };
      const clk = ctx.clock(ctx.span(30000, 6000), () => finish(null));

      build(size);
    }
  }
];

