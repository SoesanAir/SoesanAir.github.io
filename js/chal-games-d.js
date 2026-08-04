/* ============================================================
   MINIGAMES D — ENDURANCE. Five real Survivor endurance formats.

   Endurance challenges are the ones the show gives an act to, and they are all
   built the same way: a posture you can hold indefinitely at minute one and not
   at all at minute twenty, plus one escalation that makes the difference. The
   five below take one escalation pattern each from docs/minigame-api.md, so no
   two of them get worse in the same way:

     brace  — pattern 2, the apparatus shrinks (the pegs drop)
     simmo  — pattern 1, an object is added on a fixed interval (another ball)
     bucket — pattern 4, mechanical drift as you tire (the rope unwinds)
     perch  — pattern 5, temptation (Peff brings out food)
     tide   — pattern 3, environmental ramp (the water keeps coming up)

   CSS classes are all `cd-` per the file convention, and then sub-prefixed per
   game (`cd-br-`, `cd-sm-`, `cd-bk-`, `cd-pe-`, `cd-td-`) because five games in
   one stylesheet otherwise fight over obvious names like `.cd-head`.
   ============================================================ */
const MINIGAMES_D = [

  /* 21. CHIMNEY SWEEP — four grips, all failing, and only two hands to fix them.

     The real challenge is the purest apparatus in the show: you brace your arms
     against two opposing walls and stand barefoot on two small pegs, high enough
     up that nobody is pretending it is safe. Every fifteen minutes everyone
     climbs DOWN to a smaller pair of pegs.

     Four things had to be true for this to be a game rather than a metronome:

       1. FOUR SEPARATE FAILURES. One grip meter per contact point, each decaying
          on its own. The player is not holding a posture, they are triaging four
          of them with one thumb.
       2. THE RATES DRIFT. Each limb has a multiplier doing a slow random walk, so
          the correct rotation is never the same twice and the player has to keep
          READING the meters. A fixed left-right-left rotation would be a rhythm
          game, and the file already has one of those.
       3. RE-SETTING A LIMB COSTS THE OTHER THREE. You have to unweight a limb to
          re-set it, so mashing is actively negative: a tap on a full limb buys
          nothing and spends grip everywhere else. The only profitable tap is on
          whichever meter has least left, which is exactly the read the format
          asks for.
       4. FAILURE IS VISIBLE AND GRADUAL. A limb that empties SLIPS — the figure
          drops a step down the walls and that limb comes back on a worse
          purchase. The figure's height in the chimney is the health bar, so
          there is no separate number to check. */
  {
    id: 'brace', name: 'Chimney Sweep', bucket: 'physical', verb: 'sustain',
    tags: ['physicality', 'emotional'],
    how: 'Four contact points, four grips, all sliding. Tap whichever is closest to going. The pegs shrink every few seconds.',
    start(ctx) {
      const chim = h('div', 'cd-br-chimney');
      const wallL = h('div', 'cd-br-wall l'), wallR = h('div', 'cd-br-wall r');
      const gap = h('div', 'cd-br-gap');
      const fig = h('div', 'cd-br-fig');
      /* Drawn as a person rather than four bars: head, torso, two arms out to the
         walls, two legs splayed down to the pegs. The legs are diagonals painted
         with a gradient across a box positioned by left/right, so they still meet
         the hip and the foot when the walls close in. */
      fig.appendChild(h('div', 'cd-br-head'));
      fig.appendChild(h('div', 'cd-br-torso'));
      fig.appendChild(h('div', 'cd-br-arm l'));
      fig.appendChild(h('div', 'cd-br-arm r'));
      fig.appendChild(h('div', 'cd-br-leg l'));
      fig.appendChild(h('div', 'cd-br-leg r'));

      const mkPad = (cls, label) => {
        const b = h('button', 'cd-br-pad ' + cls);
        const bar = h('i', 'cd-br-grip');
        b.appendChild(bar);
        b.appendChild(h('span', 'cd-br-tag', label));
        b._bar = bar;
        return b;
      };
      /* Starting multipliers are deliberately uneven so the very first read is
         already a read and not a rotation. */
      const limbs = [
        { el: mkPad('cd-br-hl', 'L HAND'), g: 1, m: 0.92, nm: 'left hand' },
        { el: mkPad('cd-br-hr', 'R HAND'), g: 1, m: 1.10, nm: 'right hand' },
        { el: mkPad('cd-br-fl', 'L FOOT'), g: 1, m: 1.02, nm: 'left foot' },
        { el: mkPad('cd-br-fr', 'R FOOT'), g: 1, m: 0.84, nm: 'right foot' }
      ];
      for (const L of limbs) fig.appendChild(L.el);
      gap.appendChild(fig);
      chim.appendChild(wallL); chim.appendChild(wallR); chim.appendChild(gap);
      const warn = h('div', 'cg-warn', 'braced');
      const status = h('div', 'cd-br-slips', '');
      ctx.arena.appendChild(chim); ctx.arena.appendChild(warn); ctx.arena.appendChild(status);

      /* Seconds you must last for full marks. Difficulty raises the bar through
         more(), and the clock is set from the same number so "survive the clock"
         is worth exactly 1.0 at every difficulty. */
      const target = ctx.more(12);
      const decay = ctx.rate(0.16, 0.06);        // grip per second, per limb, at stage 0
      const shift = ctx.rate(0.030);             // what the other three pay when you re-set one
      /* Slip tolerance is a tolerance: hard divides it, ease widens it. Two slips
         minimum or the first mistake is the whole game. */
      const slipMax = Math.max(2, Math.round(ctx.tol(4, 5)));
      /* 6800/1.7 lands on the four-second beat the format description asks for at
         the shipped difficulty; a harder setting drops the pegs sooner, which is
         the right direction for it to move. */
      const stageEvery = ctx.span(6800);
      const FIG_TOP = 8, DROP_ROOM = 74;
      const dropPer = DROP_ROOM / slipMax;       // bottom out exactly as you run out of slips

      let alive = true, stage = 0, slips = 0, drop = 0;
      const timers = [];
      const t0 = performance.now();
      let last = t0, nextStage = t0 + stageEvery;

      const paint = () => {
        for (const L of limbs) {
          const g = clamp01(L.g);
          L.el._bar.style.height = (g * 100).toFixed(0) + '%';
          L.el.classList.toggle('warn', g < 0.55 && g >= 0.28);
          L.el.classList.toggle('gone', g < 0.28);
        }
        status.textContent = 'slips ' + slips + ' of ' + slipMax + '   ·   pegs ' + (stage + 1);
      };

      const finish = ok => {
        if (!alive) return; alive = false; clk.stop();
        timers.forEach(clearTimeout);
        const base = clamp01((performance.now() - t0) / (target * 1000));
        if (!ok) fig.classList.add('fell');
        Juice.fx(ok ? chim : fig, ok ? 'large' : 'bad', ok ? 'STILL UP THERE' : 'OFF THE WALL');
        ctx.done(ok ? base : base * 0.6);
      };
      const clk = ctx.clock(target * 1000, () => finish(true));

      const slip = L => {
        slips++;
        /* A slip does not hand the limb back at full: you caught yourself on a
           worse purchase than the one you lost. */
        L.g = 0.30;
        for (const O of limbs) if (O !== L) O.g = Math.max(0.05, O.g - 0.08);
        drop += dropPer;
        fig.style.top = (FIG_TOP + drop) + 'px';
        fig.classList.add('slipping');
        timers.push(setTimeout(() => { if (alive) fig.classList.remove('slipping'); }, 280));
        Juice.fx(L.el, 'bad', 'the ' + L.nm + ' went');
        warn.textContent = slips >= slipMax ? 'THAT IS IT' : 'SLIPPED — ' + (slipMax - slips) + ' left in you';
        warn.classList.add('hot');
        timers.push(setTimeout(() => { if (alive) warn.classList.remove('hot'); }, 1000));
        if (slips >= slipMax) finish(false);
      };

      const narrow = () => {
        const w = Math.min(24, 9 + stage * 2.4);
        wallL.style.width = w + '%'; wallR.style.width = w + '%';
        gap.style.left = w + '%'; gap.style.right = w + '%';
        warn.textContent = pick(['THE PEGS DROP', 'DOWN TO SMALLER PEGS', 'EVERYBODY DOWN A STEP']);
        warn.classList.add('hot');
        Juice.shake(0.34);
        timers.push(setTimeout(() => { if (alive) warn.classList.remove('hot'); }, 900));
      };

      for (const L of limbs) {
        L.el.onclick = () => {
          if (!alive) return;
          const before = L.g;
          L.g = 1;
          for (const O of limbs) if (O !== L) O.g = Math.max(0, O.g - shift);
          Juice.fx(L.el, before < 0.25 ? 'medium' : 'small', before < 0.25 ? 'JUST' : null);
          paint();
        };
      }

      const step = now => {
        if (!alive) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (now >= nextStage) { stage++; nextStage = now + stageEvery; narrow(); }
        /* 0.32 a stage, measured rather than guessed. A player with perfect
           information and no reaction time — which is what the sim is — can hold
           four limbs indefinitely at any decay rate simply by tapping faster,
           because the cost of a tap is split across three limbs while the benefit
           lands on one. Nothing about the per-tap economy closes that, so the
           ceiling has to come from the escalation instead: at this step the pegs
           reach a decay that beats a 2.5-tap-per-second rotation at about the
           moment the clock runs out, so a flawless score is available and not
           routine. */
        const stageMul = 1 + stage * 0.32;
        for (const L of limbs) {
          /* The random walk on m is what stops a learned rotation from working. */
          L.m = Math.max(0.70, Math.min(1.35, L.m + rr(-1, 1) * 0.40 * dt));
          L.g -= decay * L.m * stageMul * dt;
          if (L.g <= 0) { slip(L); if (!alive) return; }
        }
        paint();
        ctx.setScore(clamp01((now - t0) / (target * 1000)));
        requestAnimationFrame(step);
      };
      paint(); requestAnimationFrame(step);
    }
  },

  /* 22. SIMMOTION — one track, two ends, and more balls than you have hands.

     The real one: drop a ball into a chute at the top of a spiral, a turnstile
     inside makes it come out of ALTERNATING ends, and you sprint to whichever end
     that is, catch it and re-feed it. One hand is tied behind your back. A new
     ball is added at intervals until there are several in the air at once, and a
     single ball touching the ground puts you out on the spot.

     The alternating turnstile is free here: catching a ball re-feeds it and it
     reverses, so a ball caught on the right is next due on the left. That means
     the player is never guessing WHERE, only WHEN — which is the honest version
     of the challenge, where the panic comes from three balls due at once rather
     than from not knowing which end to stand at.

     Everything about the read is borrowed from Log Carry's fix, since the docs
     are explicit that a timing game must telegraph: the ball is visible on the
     track the whole way, the basket it is heading for lights amber as it comes
     and green during the catch window, and an approach bar fills underneath.

     Dropping ANY ball ends the run. That is faithful, and it is also what makes
     the fourth ball frightening rather than merely busy. */
  {
    id: 'simmo', name: 'Simmotion', bucket: 'physical', verb: 'intercept',
    tags: ['physicality', 'smarts'],
    how: 'Balls run the track and come out of alternate ends. Tap the basket as one arrives. Drop any ball and you are out.',
    start(ctx) {
      const track = h('div', 'cd-sm-track');
      track.appendChild(h('div', 'cd-sm-rail a'));
      track.appendChild(h('div', 'cd-sm-rail b'));
      track.appendChild(h('div', 'cd-sm-rail c'));
      const warn = h('div', 'cg-warn', 'one ball. one free hand.');
      const row = h('div', 'cg-row');
      const mkBasket = label => {
        const b = h('button', 'btn cg-b cd-sm-basket');
        const fill = h('i', 'cd-sm-fill');
        b.appendChild(fill);
        b.appendChild(h('span', 'cd-sm-lab', label));
        b._fill = fill;
        return b;
      };
      const L = mkBasket('◀ LEFT'), R = mkBasket('RIGHT ▶');
      row.appendChild(L); row.appendChild(R);
      ctx.arena.appendChild(track); ctx.arena.appendChild(warn); ctx.arena.appendChild(row);

      const travel = ctx.span(3400, 1200);        // ease = a slower track
      const win = ctx.tol(420, 340);              // ease = a wider pair of hands
      const addEvery = ctx.span(5200);            // pattern 1: another ball, on the clock
      const maxBalls = Math.min(4, ctx.more(3));
      /* Catches for full marks. Measured, and deliberately WITHOUT an ease term:
         ease slows the track, which means a strong castaway sees fewer arrivals in
         the same run, so an ease-scaled bar would quietly turn their kindness into
         a worse score. Set instead to what flawless play reaches at the slow end
         (about 18 in a run), so a perfect score is available at either end of the
         stat range and the ease is felt in how easy each individual catch is. */
      const need = ctx.more(12);
      /* The run length rises with difficulty alongside `need`, so a harder game
         asks for more catches and gives you the track time to attempt them —
         otherwise raising the bar would just be lowering everyone's score. */
      const runFor = ctx.more(11);
      const LEAD = win * 3.4;                     // how early a basket starts telegraphing

      const balls = [];
      let alive = true, caught = 0, fumbles = 0;
      let last = performance.now(), nextAdd = last + addEvery;

      /* Two balls due at the same end inside one catch window is not a test of
         anything, it is a coin flip on which one the tap resolves. Push the later
         arrival back until the two are separately catchable. */
      const desync = b => {
        for (let i = 0; i < 6; i++) {
          if (!balls.some(o => o !== b && o.to === b.to && Math.abs(o.t1 - b.t1) < win * 1.8)) return;
          b.t1 += win * 2.0;
        }
      };
      const feed = (b, from, now, grace) => {
        b.to = from === 'L' ? 'R' : 'L';
        b.t0 = now;
        b.t1 = now + travel * b.sp * (grace || 1);
        desync(b);
      };
      const addBall = now => {
        const el = h('div', 'cd-sm-ball');
        track.appendChild(el);
        const b = { el, sp: rr(0.88, 1.14) };
        /* The opening ball gets a long first run so the player can watch one go
           the whole way before anything is asked of them. */
        feed(b, chance(0.5) ? 'R' : 'L', now, balls.length ? 1 : 1.5);
        balls.push(b);
        Juice.fx(el, 'medium', 'BALL ' + balls.length);
        warn.textContent = balls.length + (balls.length === 1 ? ' ball' : ' balls') + ' in play';
        warn.classList.toggle('hot', balls.length >= 3);
      };

      const finish = (dropped, b) => {
        if (!alive) return; alive = false; clk.stop();
        const base = clamp01(caught / need - fumbles * 0.03);
        if (dropped && b) { b.el.classList.add('dropped'); Juice.fx(b.el, 'bad', 'ON THE GROUND'); }
        else Juice.fx(track, 'large', caught + ' CAUGHT');
        ctx.done(dropped ? base * 0.8 : clamp01(base + 0.10));
      };
      const clk = ctx.clock(runFor * 1000, () => finish(false, null));

      const grab = side => {
        if (!alive) return;
        const now = performance.now();
        let best = null, bestOff = 1e9;
        for (const b of balls) {
          if (b.to !== side) continue;
          const off = Math.abs(now - b.t1);
          if (off < win && off < bestOff) { best = b; bestOff = off; }
        }
        const btn = side === 'L' ? L : R;
        if (!best) {
          /* Grabbing at nothing is not fatal — with your other hand tied you are
             allowed to be early — but it costs a little at the end. */
          fumbles++;
          Juice.fx(btn, 'bad', 'nothing there');
          ctx.hitstop(50);
          return;
        }
        caught++;
        const clean = bestOff < win * 0.35;
        Juice.fx(best.el, clean ? 'medium' : 'small', clean ? 'CLEAN' : 'got it');
        feed(best, side, now);
        ctx.setScore(clamp01(caught / need));
      };
      L.onclick = () => grab('L'); R.onclick = () => grab('R');

      const paintBasket = (btn, off) => {
        const has = off !== null;
        btn.classList.toggle('now', has && Math.abs(off) < win);
        btn.classList.toggle('soon', has && off >= 0 && off < LEAD);
        btn._fill.style.width = has ? (clamp01(1 - off / LEAD) * 100).toFixed(0) + '%' : '0%';
      };

      const step = now => {
        if (!alive) return;
        last = now;
        if (now >= nextAdd && balls.length < maxBalls) { addBall(now); nextAdd = now + addEvery; }
        let offL = null, offR = null;
        for (const b of balls) {
          const p = clamp01((now - b.t0) / (b.t1 - b.t0));
          const x = b.to === 'R' ? 5 + p * 90 : 95 - p * 90;
          /* A triangle wave on the vertical reads as the switchbacks of the spiral
             without needing a canvas to draw one. */
          const tri = Math.abs(((p * 3) % 2) - 1);
          b.el.style.left = x.toFixed(2) + '%';
          b.el.style.top = (12 + tri * 44).toFixed(1) + 'px';
          const off = b.t1 - now;
          b.el.classList.toggle('near', Math.abs(off) < win);
          if (b.to === 'L') { if (offL === null || Math.abs(off) < Math.abs(offL)) offL = off; }
          else { if (offR === null || Math.abs(off) < Math.abs(offR)) offR = off; }
          if (off < -win) return finish(true, b);
        }
        paintBasket(L, offL); paintBasket(R, offR);
        requestAnimationFrame(step);
      };
      addBall(last);
      requestAnimationFrame(step);
    }
  },

  /* 23. WRIST ASSURED — the leverage gets worse the longer you are good at it.

     Real format: a handle with a rope coiled round it, and a bucket of water
     hanging off the rope. As your wrist tires the coil pays out, the bucket sinks
     and your leverage worsens, which makes the coil pay out faster. Bucket
     touches down and you are out. It is the show's cleanest example of escalation
     pattern 4 — nothing is added and nothing shrinks, the machine simply turns
     against you at a rate set by how long you have already lasted.

     A press-and-hold with a single failure state is not a game, so the counter-
     action is the RE-COIL: let go, let the handle spin back, and re-grip at the
     right moment to wind rope back on. It cannot be free, because a free button
     that undoes the only threat is just a longer timer — so while your hand is
     off the handle the bucket runs down more than twice as fast. A perfect
     re-coil nets you rope; a mistimed one is the fastest way to lose. */
  {
    id: 'bucket', name: 'Wrist Assured', bucket: 'physical', verb: 'endure',
    tags: ['physicality'],
    how: 'HOLD the handle. The rope pays out and the bucket sinks. Let go and re-grip in the GREEN to wind some back.',
    start(ctx) {
      const rig = h('div', 'cd-bk-rig');
      rig.appendChild(h('div', 'cd-bk-beam'));
      const handle = h('div', 'cd-bk-handle');
      const coils = [];
      for (let i = 0; i < 6; i++) { const c = h('i', 'cd-bk-coil'); handle.appendChild(c); coils.push(c); }
      const rope = h('div', 'cd-bk-rope');
      const pail = h('div', 'cd-bk-bucket');
      pail.appendChild(h('i', 'cd-bk-water'));
      const sand = h('div', 'cd-bk-sand');
      rig.appendChild(handle); rig.appendChild(rope); rig.appendChild(pail); rig.appendChild(sand);

      /* The coil gauge only exists while your hand is off, which is the whole
         telegraph: a marker sweeps and there is a green band on it. */
      const gauge = h('div', 'cd-bk-gauge');
      const band = h('i', 'cd-bk-sweet'), mark = h('b', 'cd-bk-mark');
      gauge.appendChild(band); gauge.appendChild(mark);
      const warn = h('div', 'cg-warn', 'take hold of the handle');
      const B = h('button', 'btn cg-b primary cg-wide', 'HOLD THE HANDLE');
      ctx.arena.appendChild(rig); ctx.arena.appendChild(gauge);
      ctx.arena.appendChild(warn); ctx.arena.appendChild(B);

      const target = ctx.more(12);                 // seconds held for full marks
      const base = ctx.rate(0.055, 0.020);         // rope paid out per second while gripped
      const tire = ctx.rate(0.10, 0.045);          // how fast that rate itself grows
      const LOOSE = 2.2;                           // multiplier while your hand is off
      const sweet = ctx.span(560, 240);            // ms after letting go that the re-grip lands
      const swin = ctx.tol(210, 190);              // how forgiving that moment is
      const WIND = 0.30;                           // rope wound back by a perfect re-coil
      const FULL = sweet * 2.2;                    // the gauge's full scale
      /* Sized so a perfect re-coil beats the fall it cost you and a bad one does
         not: at a mid-run pay-out of ~0.12/s, 560ms off the handle costs about
         0.15 of rope against a best case of 0.30 back. */
      band.style.left = (clamp01((sweet - swin) / FULL) * 100) + '%';
      band.style.width = (clamp01(2 * swin / FULL) * 100) + '%';

      let alive = true, started = false, holding = false;
      let depth = 0.06, heldSec = 0, surv = 0, relAt = 0, ptr = 0;
      const timers = [];
      let last = performance.now();

      const paint = () => {
        const d = clamp01(depth);
        rope.style.height = (10 + d * 96).toFixed(1) + 'px';
        pail.style.top = (44 + d * 96).toFixed(1) + 'px';
        const left = Math.ceil((1 - d) * coils.length);
        coils.forEach((c, i) => c.classList.toggle('off', i >= left));
        if (!started) return;
        warn.textContent = d > 0.82 ? 'IT IS ABOUT TO TOUCH DOWN' : d > 0.55 ? 'the bucket is getting low' : holding ? 'holding' : 'wind it back';
        warn.classList.toggle('hot', d > 0.82);
      };

      const finish = down => {
        if (!alive) return; alive = false; clk.stop();
        timers.forEach(clearTimeout);
        const b = clamp01(surv / target);
        if (down) pail.classList.add('down');
        Juice.fx(pail, down ? 'bad' : 'large', down ? 'TOUCHED DOWN' : (Math.round(surv * 10) / 10) + 's');
        ctx.done(down ? b * 0.85 : b);
      };
      const clk = ctx.clock(target * 1000, () => finish(false));

      const grip = on => {
        if (!alive || on === holding) return;
        holding = on;
        B.classList.toggle('sand', on);
        B.textContent = on ? 'HOLDING' : 'RE-GRIP';
        gauge.classList.toggle('live', !on && started);
        if (on && !started) { started = true; warn.textContent = 'holding'; return; }
        if (!on) { relAt = performance.now(); mark.style.left = '0%'; return; }
        if (!relAt) return;
        const off = performance.now() - relAt;
        const q = clamp01(1 - Math.abs(off - sweet) / swin);
        relAt = 0;
        if (q > 0.02) {
          depth = Math.max(0, depth - WIND * q);
          Juice.fx(handle, q > 0.7 ? 'medium' : 'small', q > 0.7 ? 'COILED' : 'half a turn');
        } else {
          Juice.fx(handle, 'bad', 'it just ran');
        }
        paint();
      };

      B.addEventListener('pointerdown', () => { ptr = performance.now(); grip(true); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(e => B.addEventListener(e, () => grip(false)));
      /* Fallback for a plain click — a keyboard press, or a harness that clicks
         rather than holds. Ignored when a real pointer press is already in flight
         so the two never double-fire. */
      B.addEventListener('click', () => {
        if (!alive || performance.now() - ptr < 900) return;
        grip(true);
        timers.push(setTimeout(() => grip(false), 300));
      });

      const step = now => {
        if (!alive) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (started) {
          if (holding) heldSec += dt;
          surv += dt;
          /* Pattern 4: the pay-out rate is a function of how long you have held,
             so being good at this is what makes it hard. */
          depth += base * (1 + heldSec * tire) * dt * (holding ? 1 : LOOSE);
          ctx.setScore(clamp01(surv / target));
          if (!holding) mark.style.left = (clamp01((now - relAt) / FULL) * 100).toFixed(1) + '%';
          if (depth > 0.82) Juice.shake(dt * 0.6);
        }
        paint();
        if (depth >= 1) return finish(true);
        requestAnimationFrame(step);
      };
      paint(); requestAnimationFrame(step);
    }
  },

  /* 24. UNCOMFORTABLY NUMB — the balance is easy. The bowl of rice is not.

     Stand on a narrow perch, hold a handle over your head, and wait. Then Probst
     walks out with food and asks who wants it. This is escalation pattern 5, the
     only purely social one and the one nothing outside Survivor does, so the
     temptation is the game and the balance is the excuse for it.

     Which means the balance is deliberately gentle — about a third of Hold the
     Rope's drift — and the risk comes from the offers themselves: REFUSING one
     shoves you, because saying no out loud is exactly when people on that perch
     wobble, and every refusal permanently raises the drift because you are one
     offer more tired than you were.

     The trade-off has to survive arithmetic or it is a fake choice. At the last
     offer you are ~11.6s into a 17s target: banking pays 0.68 + 0.25 = 0.93,
     riding it out pays 1.0, and falling pays about 0.38. Continuing is worth
     1 - 0.62p, so the offer is the correct play as soon as the chance of falling
     in the last five seconds passes about 11% — which, with the drift at 2.5x and
     a fresh shove in your legs, it comfortably does. Holding out is the greedy
     line, not the obvious one, and that is the whole point of the format. */
  {
    id: 'perch', name: 'Uncomfortably Numb', bucket: 'nerve', verb: 'resist',
    tags: ['emotional', 'physicality'],
    how: 'Tap LEFT / RIGHT to stay on the perch. Peff will offer you food to come down. Taking it banks what you have.',
    start(ctx) {
      const stage = h('div', 'cd-pe-stage');
      stage.appendChild(h('div', 'cd-pe-bar'));
      const fig = h('div', 'cd-pe-fig');
      fig.appendChild(h('div', 'cd-pe-arms'));
      fig.appendChild(h('div', 'cd-pe-head'));
      fig.appendChild(h('div', 'cd-pe-torso'));
      fig.appendChild(h('div', 'cd-pe-legs'));
      const post = h('div', 'cd-pe-post');
      stage.appendChild(fig); stage.appendChild(post);
      stage.appendChild(h('div', 'cd-pe-sea'));
      const warn = h('div', 'cg-warn', 'steady');

      const panel = h('div', 'cd-pe-offer');
      const otext = h('div', 'cd-pe-txt', '');
      const ocmp = h('div', 'cd-pe-cmp', '');
      const fuse = h('div', 'cd-pe-fuse'); fuse.appendChild(h('i'));
      const orow = h('div', 'cg-row');
      const takeB = h('button', 'btn cg-b sand', 'TAKE IT');
      const noB = h('button', 'btn cg-b primary', 'STAY UP');
      orow.appendChild(takeB); orow.appendChild(noB);
      panel.appendChild(otext); panel.appendChild(ocmp); panel.appendChild(fuse); panel.appendChild(orow);

      const row = h('div', 'cg-row');
      const Lb = h('button', 'btn cg-b', '◀'), Rb = h('button', 'btn cg-b', '▶');
      row.appendChild(Lb); row.appendChild(Rb);
      ctx.arena.appendChild(stage); ctx.arena.appendChild(warn);
      ctx.arena.appendChild(panel); ctx.arena.appendChild(row);

      const target = ctx.more(12);                    // seconds on the perch for full marks
      /* Gentler than Hold the Rope before any offers — that game drifts at
         rate(1.25, 0.5) against a much tighter safe band — but not so gentle that
         multiplying it later cannot hurt. The fall threshold is a full 1.0 of
         travel either way, so standing there is genuinely easy until Peff turns up. */
      const driftBase = ctx.rate(0.95, 0.40);
      const shove = ctx.rate(0.45, 0.15);             // what saying no does to your legs
      const look = ctx.span(4600, 1200);              // how long an offer stays on the ground
      /* Peff's offers, in the order the show escalates them: food you need, food
         you want, and then the one that is not food at all. */
      const OFFERS = [
        { at: 0.24, bonus: 0.14, txt: 'Peff sets a bowl down where the wind will carry it to you. Rice and beans, still steaming.' },
        { at: 0.46, bonus: 0.19, txt: 'Chocolate and peanut butter. Peff is not pretending this is a fair fight any more.' },
        { at: 0.68, bonus: 0.25, txt: 'A letter from home. Peff turns it over so you can see the handwriting on the front.' }
      ];

      let alive = true, offerUp = null, refused = 0, x = 0, v = 0, t = 0, next = 0;
      const timers = [];
      let last = performance.now();
      const hold = () => clamp01(t / target);

      const setOffer = up => {
        panel.classList.toggle('up', !!up);
        takeB.disabled = !up; noB.disabled = !up;
      };
      setOffer(false);

      const finish = (kind, val) => {
        if (!alive) return; alive = false; clk.stop();
        timers.forEach(clearTimeout);
        setOffer(false);
        if (kind === 'fell') {
          fig.classList.add('fell');
          Juice.fx(fig, 'bad', 'OFF THE PERCH');
          return ctx.done(clamp01(hold() * 0.45));
        }
        if (kind === 'took') {
          Juice.fx(panel, 'medium', 'STEPPED DOWN');
          return ctx.done(clamp01(val));
        }
        Juice.fx(stage, 'large', 'NEVER MOVED');
        ctx.done(clamp01(hold()));
      };
      const clk = ctx.clock(target * 1000, () => finish('lasted'));

      const hide = () => { offerUp = null; setOffer(false); };
      const refuse = () => {
        if (!alive || !offerUp) return;
        refused++;
        v += (chance(0.5) ? -1 : 1) * shove;
        Juice.fx(noB, 'small', 'no');
        warn.textContent = 'you shook your head and nearly went with it';
        warn.classList.add('hot');
        timers.push(setTimeout(() => { if (alive) warn.classList.remove('hot'); }, 1100));
        hide();
      };
      const take = () => {
        if (!alive || !offerUp) return;
        finish('took', hold() + offerUp.bonus);
      };
      takeB.onclick = take; noB.onclick = refuse;
      Lb.onclick = () => { if (alive) { v -= 0.055; Juice.pop(post, 0.3); } };
      Rb.onclick = () => { if (alive) { v += 0.055; Juice.pop(post, 0.3); } };

      const offerNow = o => {
        offerUp = o;
        otext.textContent = o.txt;
        const bank = Math.round(clamp01(hold() + o.bonus) * 100);
        ocmp.textContent = 'take it and bank ' + bank + '   ·   stay up and you are playing for 100';
        setOffer(true);
        fuse.firstChild.style.transition = 'none';
        fuse.firstChild.style.width = '100%';
        void fuse.firstChild.offsetWidth;
        fuse.firstChild.style.transition = 'width ' + look + 'ms linear';
        fuse.firstChild.style.width = '0%';
        Juice.fx(panel, 'medium', 'PEFF HAS FOOD');
        /* An ignored offer is a refusal, so the game can never stall on a player
           who simply does not answer. */
        timers.push(setTimeout(() => { if (alive && offerUp === o) refuse(); }, look));
      };

      const step = now => {
        if (!alive) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
        if (next < OFFERS.length && t >= OFFERS[next].at * target) { const o = OFFERS[next]; next++; offerNow(o); }
        /* 1.15 a refusal, set by measurement. At 0.5 a bot that corrected every
           220ms never fell even after three refusals, which made holding out a
           free 1.0 and the whole choice a decoration. Turning food down has to
           genuinely cost your legs or the format has no teeth. */
        v += (Math.sin(t * 1.7) * 0.5 + rr(-0.5, 0.5)) * dt * driftBase * (1 + refused * 1.15);
        v *= 0.955; x += v * dt;
        fig.style.transform = 'rotate(' + (x * 15).toFixed(2) + 'deg)';
        const mag = Math.abs(x);
        if (!offerUp) {
          warn.textContent = mag > 0.7 ? 'YOU ARE GOING OVER' : mag > 0.4 ? 'tipping' : 'steady';
          warn.classList.toggle('hot', mag > 0.7);
        }
        ctx.setScore(hold());
        if (mag > 1) return finish('fell');
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  },

  /* 25. LAST GASP — a shrinking pocket of air under a steel grate.

     The real one has you swim under a grate bolted over the water and hold your
     face in the few inches of air between the water and the steel while the tide
     comes in. Escalation pattern 3 in its purest form: nothing is added, nothing
     is taken away, the sea simply keeps rising.

     Two levels do all the work. The TIDE is a slow monotonic rise, and the SWELL
     is a sine on top of it. Breathing is only possible in a trough, so as the
     tide climbs, the fraction of each wave that clears your mouth falls from
     about four fifths to about a tenth without a single extra rule — the windows
     get rarer and shorter on their own, which is exactly what the water does.

     One breath per wave, enforced by re-arming only once the water has closed
     over you again. That is mash-proof without a cooldown constant, and it makes
     each trough a discrete thing you either took or did not. A gasp buys about
     1.7 seconds against a meter that runs about 5, so missing one window is
     survivable and missing two is not.

     Tapping while you are under is the other failure: you take water, lose a
     chunk of the meter and spend a moment choking, which is usually the moment
     the next trough goes past. */
  {
    id: 'tide', name: 'Last Gasp', bucket: 'nerve', verb: 'time',
    tags: ['emotional', 'physicality'],
    how: 'BREATHE only when the swell drops below your mouth. Wrong moment and you take water. Empty meter and you black out.',
    start(ctx) {
      const tank = h('div', 'cd-td-tank');
      const water = h('div', 'cd-td-water');
      water.appendChild(h('i', 'cd-td-surf'));
      const head = h('div', 'cd-td-head');
      head.appendChild(h('i', 'cd-td-face'));
      const mouth = h('div', 'cd-td-mouth');
      const grate = h('div', 'cd-td-grate');
      tank.appendChild(water); tank.appendChild(mouth); tank.appendChild(head); tank.appendChild(grate);
      const meter = h('div', 'cd-td-meter');
      const mfill = h('i'); meter.appendChild(mfill);
      const warn = h('div', 'cg-warn', 'the tide is coming in');
      const B = h('button', 'btn cg-b primary cg-wide', 'BREATHE');
      ctx.arena.appendChild(tank); ctx.arena.appendChild(meter);
      ctx.arena.appendChild(warn); ctx.arena.appendChild(B);

      /* Apparatus geometry, as fractions of the tank measured up from the bottom.
         Two constraints, and both of them bit:

         TIDE0 + AMP must sit clearly ABOVE the mouth, or the swell never closes
         over your face at the start, the breath never re-arms, and the opening
         seconds have no rhythm in them at all — the first pass had the peak of the
         swell exactly level with the mouth and gave the player one breath for the
         whole first phase.

         MOUTH + AMP is where the troughs stop clearing your mouth for good, and
         that has to land AFTER the clock or the game is unwinnable by construction.
         At 0.0052 it arrives around 19s on weak stats and 25s on strong, against a
         17s target. */
      const MOUTH = 0.76, TIDE0 = 0.70, AMP = 0.10;
      const target = ctx.more(12);                 // seconds under the grate for full marks
      /* PERCENT of the tank per second, not a fraction, and deliberately so:
         ctx.rate() floors its result at 0.02, so a fraction-per-second tide of
         about 0.008 came back as 0.02 — two and a half times too fast and, worse,
         identical for a weak and a strong castaway because both ends of the stat
         range floored to the same number. Anything routed through rate() has to
         land well clear of 0.02 or the helper quietly eats the ease. */
      const risePct = ctx.rate(0.52, 0.26);
      const drain = ctx.rate(0.130, 0.052);        // ease = a longer meter, felt as a slower drain
      const period0 = ctx.span(2600, 900);         // ease = a longer swell, so longer troughs
      /* Sized against the demand of one wave, which is what makes the input matter.
         The meter runs about five seconds and a wave is about one and a half, so a
         wave costs roughly 0.30 of meter. At 0.50 a gasp covered nearly two waves,
         which meant a player could skip half the troughs and still finish level —
         the taps stopped mattering and the game became a wait. At 0.36 the supply
         only matched the demand, so even flawless play trended down and blacked out
         at fourteen seconds, putting a hard ceiling of 0.54 on the whole game.
         0.42 leaves a small surplus: take every window and you reach the clock,
         skip two in a row and you do not. */
      const GASP = 0.42;
      const swallow = ctx.rate(0.16, 0.05);        // what a mistimed breath costs
      /* A lockout is a duration you are FORCED to sit through, so it is a rate:
         bigger is worse, and ease shortens it. */
      const choke = ctx.rate(560, 220);

      let alive = true, armed = true, open = true;
      let tide = TIDE0, breath = 1, surv = 0, phase = 0, gulps = 0, chokeTil = 0;
      let last = performance.now();

      const finish = blacked => {
        if (!alive) return; alive = false; clk.stop();
        const b = clamp01(surv / target - gulps * 0.015);
        if (blacked) tank.classList.add('out');
        Juice.fx(head, blacked ? 'bad' : 'large', blacked ? 'BLACKED OUT' : 'STILL BREATHING');
        ctx.done(blacked ? b * 0.6 : b);
      };
      const clk = ctx.clock(target * 1000, () => finish(false));

      B.onclick = () => {
        if (!alive) return;
        const now = performance.now();
        if (now < chokeTil) { Juice.fx(B, 'bad', 'still choking'); return; }
        if (open) {
          if (!armed) { Juice.float(B, 'nothing left in that one', ''); return; }
          armed = false;
          breath = Math.min(1, breath + GASP);
          Juice.fx(B, breath > 0.85 ? 'medium' : 'small', 'gasp');
          return;
        }
        gulps++;
        breath = Math.max(0, breath - swallow);
        chokeTil = now + choke;
        Juice.fx(B, 'bad', 'WATER');
        ctx.hitstop(70);
        if (breath <= 0) finish(true);
      };

      const step = now => {
        if (!alive) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        surv += dt;
        tide = Math.min(0.90, tide + (risePct / 100) * dt);
        /* The troughs get rarer from the rising mean on their own; shortening the
           period as well is what makes the late ones feel snatched. */
        const prog = clamp01((tide - TIDE0) / 0.16);
        phase += (dt * 1000 / (period0 * (1 - 0.20 * prog))) * Math.PI * 2;
        const level = tide + AMP * Math.sin(phase);
        /* Re-arming only once the water has closed over you again is what makes
           "one breath per wave" true without a cooldown constant. */
        open = level < MOUTH;
        if (!open) armed = true;
        breath = Math.max(0, breath - drain * dt);

        water.style.height = (clamp01(level) * 100).toFixed(2) + '%';
        head.classList.toggle('under', !open);
        head.classList.toggle('gulp', now < chokeTil);
        mfill.style.width = (breath * 100).toFixed(1) + '%';
        mfill.classList.toggle('low', breath < 0.30);
        B.classList.toggle('cd-td-go', open && armed && now >= chokeTil);
        warn.textContent = now < chokeTil ? 'COUGHING IT UP'
          : open ? (armed ? 'AIR — TAKE IT' : 'you have had that one')
            : breath < 0.3 ? 'UNDER, AND NOTHING LEFT' : 'under';
        warn.classList.toggle('hot', breath < 0.30);
        if (breath < 0.18) Juice.shake(dt * 0.7);

        ctx.setScore(clamp01(surv / target));
        if (breath <= 0) return finish(true);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  }
];
