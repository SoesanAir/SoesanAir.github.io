/* ============================================================
   MINIGAMES E — BALANCE AND PRECISION.

   Five formats the show runs almost every season, and the reason they keep
   coming back is that they are all the same sentence: hold something still
   while the apparatus gets worse. None of them has a trick to learn. You are
   only ever asked to correct, and then to correct the correction.

   Two rules were applied throughout and are worth stating once here rather
   than five times below:

     - RUN LENGTHS AND STAGE INTERVALS ARE RAW CONSTANTS. In a survival game the
       clock is the score denominator, so putting it through ctx.span would pay
       ease straight into the score, which is the one thing the shell forbids.
       Ease is spent on the apparatus instead: bigger disc, slower ball, wider
       window, fewer holes.
     - EVERY HOLD BUTTON ALSO ANSWERS A PLAIN CLICK (see ceHold). The headless
       harness fires pointerdown, click and pointerup within about 120ms, and a
       real finger that slides off a button never sends pointerup at all. A
       control that only understands a matched pointer pair is a control that
       is dead in half the situations it will actually meet.

   NOTE ON WIRING: all 28 entries in CHALLENGES are already claimed by
   MINIGAMES_A/B/C or pinned in Challenge.MAP, and MINIGAMES_A is concatenated
   first, so the forChallenges lines below are a statement of intent rather
   than a live binding. These five become reachable when someone adds the
   Challenge.MAP entries; nothing in this file can do that for itself.
   ============================================================ */

/* Press-and-hold that a synthetic or malformed click can still drive.

   press() applies a one-shot impulse AND starts the hold, so a zero-length
   press still does something visible — that is what makes a bare click a
   legal input rather than a no-op. The lastUp guard stops a real tap from
   counting twice, since a browser sends pointerdown, pointerup and then click
   for the same finger. No timers, so there is nothing here to clear when a
   game ends. */
function ceHold(btn, press, release) {
  let on = false, lastUp = -1e9;
  const down = () => {
    if (on) return;
    on = true; btn.classList.add('sand');
    if (press) press();
  };
  const up = () => {
    if (!on) return;
    on = false; lastUp = performance.now(); btn.classList.remove('sand');
    if (release) release();
  };
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointerleave', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('click', () => {
    if (on || performance.now() - lastUp < 400) return;
    down(); up();
  });
  return { held: () => on, release: up };
}

const MINIGAMES_E = [

  /* E1. ROLLER BALL — keep balls on a disc you are holding out in front of you.

     The real format: you stand on a short log holding a flat wooden disc at
     arm's length with a ball rolling on it. At set intervals they add a second
     and then a third ball. Ball off the disc, or a foot off the log, and you
     are out.

     Escalation pattern 1, add an object at a fixed interval. The interval is a
     raw constant because ball count IS the difficulty; easing it would hand a
     strong castaway a quieter game, and since survival time and ball count are
     the same number here, it would also hand them a shorter one.

     The conflict is the whole design. Two balls are never in the same place,
     so the tilt that rescues one is the tilt that loses the other. There is no
     input that is right for both, only an input that is least wrong, and
     picking which ball to abandon this second is the actual skill. */
  {
    id: 'rollerball', name: 'Roller Ball', bucket: 'physical', verb: 'balance',
    tags: ['physicality', 'emotional'],
    how: 'Tilt the disc to keep every ball on it. Another ball arrives every few seconds.',
    forChallenges: ['Balance Beam'],
    start(ctx) {
      const wrap = h('div', 'ce-discwrap');
      const disc = h('div', 'ce-disc');
      const shade = h('i', 'ce-shade');
      disc.appendChild(h('i', 'ce-disc-ring'));
      disc.appendChild(shade);
      wrap.appendChild(disc);
      const warn = h('div', 'cg-warn', 'one ball');
      const pad = h('div', 'ce-dpad');
      const U = h('button', 'btn cg-b ce-dbtn ce-du', '▲');
      const L = h('button', 'btn cg-b ce-dbtn ce-dl', '◀');
      const D = h('button', 'btn cg-b ce-dbtn ce-dd', '▼');
      const R = h('button', 'btn cg-b ce-dbtn ce-dr', '▶');
      pad.appendChild(U); pad.appendChild(L); pad.appendChild(D); pad.appendChild(R);
      ctx.arena.appendChild(wrap); ctx.arena.appendChild(warn); ctx.arena.appendChild(pad);

      const RUN = 16000;               // score denominator — deliberately not eased
      const BALL_EVERY = 5500;         // the crew walk the next ball out on a clock
      const MAX_BALLS = 3;             // three is where the real challenge stops
      /* Ball positions are in disc radii, so a bigger disc is genuinely more
         room rather than a cosmetic zoom: the same real acceleration covers a
         smaller fraction of a wider plate, which is why discR divides G. */
      const discR = ctx.tol(1, 0.45);
      const G = ctx.rate(0.95, 0.35);
      /* Ease barely touches the wobble, and that is on purpose. With a full
         ease cut here a strong castaway got a disc so steady that DOING NOTHING
         survived the entire clock for a perfect score, which is the worst
         possible outcome for a balance game. Ease buys a bigger disc and a
         gentler pull; it does not buy a world that has stopped moving. */
      const wob = ctx.rate(1, 0.12);
      disc.style.setProperty('--ce-disc', (21 + 23 * discR).toFixed(1) + 'vmin');

      let tx = 0, ty = 0, t = 0, elapsed = 0, alive = true;
      /* The slow term below has a period of about 30 seconds, so across one
         16-second round it reads as a steady lean in one direction rather than
         as a wobble — the plate you are holding is never quite level and never
         quite level in the same way twice. Randomising its phase is what stops
         every round being the same lean. */
      const lean0 = rr(0, Math.PI * 2);
      const balls = [];
      const clampT = v => Math.max(-1.4, Math.min(1.4, v));
      /* A TAP HAS TO BE WORTH SOMETHING. The how-to line says tap or hold, so a
         tap cannot be a rounding error. Half a unit of tilt against a tilt that
         self-levels in about a sixth of a second is a real shove — enough to
         turn a ball around, and small enough that two taps in a row is an
         over-correction you then have to answer. The first cut of this paid 0.30
         and the taps did nothing measurable; the only thing that worked was
         holding, which made half the control scheme decoration. */
      const nudge = (dx, dy) => { tx = clampT(tx + dx * 0.5); ty = clampT(ty + dy * 0.5); };
      const hU = ceHold(U, () => nudge(0, -1));
      const hD = ceHold(D, () => nudge(0, 1));
      const hL = ceHold(L, () => nudge(-1, 0));
      const hR = ceHold(R, () => nudge(1, 0));

      const addBall = () => {
        const el = h('i', 'ce-ball');
        disc.appendChild(el);
        const a = rr(0, Math.PI * 2);
        balls.push({ el, x: Math.cos(a) * 0.10, y: Math.sin(a) * 0.10, vx: 0, vy: 0 });
        warn.textContent = balls.length === 1 ? 'one ball' : balls.length + ' balls on the disc';
        warn.classList.toggle('hot', balls.length > 1);
        if (balls.length > 1) Juice.fx(el, 'medium', 'BALL ' + balls.length);
      };

      const finish = ok => {
        if (!alive) return; alive = false; clk.stop();
        hU.release(); hD.release(); hL.release(); hR.release();
        /* Balls arrive on a fixed clock, so "balls kept" and "time survived"
           are the same measurement read two ways. One number covers both. */
        const s = clamp01(elapsed / RUN);
        Juice.fx(wrap, ok ? 'large' : 'bad', ok ? 'STILL STANDING' : 'BALL OFF');
        ctx.done(ok ? s : s * 0.8);
      };
      const clk = ctx.clock(RUN, () => finish(true));

      let last = performance.now();
      const step = now => {
        if (!alive) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        t += dt; elapsed += dt * 1000;
        if (balls.length < MAX_BALLS && elapsed > balls.length * BALL_EVERY) addBall();
        const wx = (hR.held() ? 1 : 0) - (hL.held() ? 1 : 0);
        const wy = (hD.held() ? 1 : 0) - (hU.held() ? 1 : 0);
        tx += (wx - tx) * Math.min(1, dt * 6);
        ty += (wy - ty) * Math.min(1, dt * 6);
        /* The log under your feet never stops moving, so level is somewhere you
           pass through rather than somewhere you can park. Three terms per axis
           at incommensurate frequencies, so the wobble never resolves into a
           rhythm the player can memorise and pre-empt.

           The two fast terms are small on purpose: at three times this amplitude
           the wobble ALONE walked the ball off an untouched disc inside a
           second, which is not a balance game, it is a coin toss with a
           countdown. Its job is to deny you a resting place, not to beat you.
           The third and largest term is the slow lean, and that is the one that
           actually ends an untended round. */
        const bx = (Math.sin(t * 1.31) * 0.055 + Math.sin(t * 0.53 + 1.7) * 0.035
          + Math.sin(t * 0.21 + lean0) * 0.10) * wob;
        const by = (Math.cos(t * 1.07) * 0.050 + Math.sin(t * 0.79 + 0.4) * 0.030
          + Math.cos(t * 0.19 + lean0) * 0.09) * wob;
        const gx = clampT(tx + bx), gy = clampT(ty + by);
        disc.style.transform = `rotateX(${(gy * 9).toFixed(2)}deg) rotateY(${(gx * 9).toFixed(2)}deg)`;
        shade.style.transform = `translate(${(gx * 18).toFixed(1)}%, ${(gy * 18).toFixed(1)}%)`;
        /* Rolling friction between the ball and the wood. Not a rounding error:
           at 0.72 a ball that had picked up speed kept it for three seconds and
           no correction inside the player's reaction time could catch it, which
           made the game a race you had already lost. At 0.5 a correction that
           arrives late still arrives. */
        const roll = Math.pow(0.5, dt);
        for (const b of balls) {
          b.vx = (b.vx + gx * G / discR * dt) * roll;
          b.vy = (b.vy + gy * G / discR * dt) * roll;
          b.x += b.vx * dt; b.y += b.vy * dt;
          b.el.style.left = (50 + b.x * 50) + '%';
          b.el.style.top = (50 + b.y * 50) + '%';
          if (Math.hypot(b.x, b.y) > 1) { b.el.classList.add('ce-gone'); return finish(false); }
        }
        ctx.setScore(clamp01(elapsed / RUN));
        requestAnimationFrame(step);
      };
      addBall();
      requestAnimationFrame(step);
    }
  },

  /* E2. THE BALL DROP — hold a rod level while they keep bolting more rod on.

     The purest staged-escalation format in the show: a metal ball on a
     horizontal wooden cylinder held level by two handles, and at each interval
     a new section is bolted onto BOTH ends. Nothing about the controls
     changes. Only the thing you are holding does.

     Escalation pattern 2. The ball's position is tracked as a FRACTION of the
     rod, which is the honest way to say what the players on the show actually
     complain about: the same small angle error carries the ball the same
     fraction of the rod, and on a rod twice as long that is twice as far
     travelled and twice as far to bring it back. On top of that a longer beam
     is heavier and flexes more, so the wobble grows and your control authority
     over it falls — a long rod answers late and then overshoots.

     Stage interval and run length are raw. Stages survived is the score, so
     easing the interval would either hand out free stages or withhold them. */
  {
    id: 'balldrop', name: 'The Ball Drop', bucket: 'physical', verb: 'level',
    tags: ['physicality', 'smarts'],
    how: 'RAISE either end to keep the ball centred. They bolt on more rod every few seconds.',
    forChallenges: ['Shoulder the Load'],
    start(ctx) {
      const rig = h('div', 'ce-rodrig');
      const rod = h('div', 'ce-rod');
      const ball = h('i', 'ce-rodball');
      rod.appendChild(h('i', 'ce-rod-grain'));
      rod.appendChild(ball);
      rig.appendChild(rod);
      const warn = h('div', 'cg-warn', 'section 1');
      const row = h('div', 'cg-row');
      const L = h('button', 'btn cg-b', 'RAISE ◀'), R = h('button', 'btn cg-b', '▶ RAISE');
      row.appendChild(L); row.appendChild(R);
      ctx.arena.appendChild(rig); ctx.arena.appendChild(warn); ctx.arena.appendChild(row);

      const STAGE_MS = 2400;
      const RUN = 17000;
      const target = ctx.more(5);        // sections to clear for a full mark
      const G = ctx.rate(1.05, 0.35);    // ease = a slower ball
      const edge = ctx.tol(1, 0.20);     // ease = a rod you can overrun a little
      const resp0 = ctx.tol(7.0, 2.2);   // how fast the rod answers your hands
      const set0 = ctx.tol(1.9, 0.7);    // how strongly your arms return it to level
      const wob0 = ctx.rate(0.55, 0.16); // how much the wood flexes
      /* THE BALL'S OWN WEIGHT. Wherever the ball is, it loads that end and tilts
         the rod further that way, which is the difference between a rod that
         sits level when you leave it alone and one that does not. Without this
         term doing nothing survived most of the round.

         It is also where the brief's "a longer rod punishes a small error more"
         stops being an assertion and becomes physics: load scales with half, so
         a ball at the same FRACTION of a longer rod is further out, has more
         leverage, and tilts the rod harder. Every stage makes your own ball a
         bigger part of the problem. */
      const load0 = ctx.rate(0.95, 0.30);

      /* ang > 0 means the RIGHT end is low, so raising the left handle raises
         ang and sends the ball right.

         A HANDLE SETS AN ANGLE, NOT A TORQUE. The first cut of this drove
         angular acceleration, which is the wrong model of a person holding a
         stick: it meant a press took most of a second to show up as tilt and
         then kept tilting after you let go, so the only way to play was to
         guess a second ahead. Your hands set the angle directly and the rod's
         weight shows up as LAG in reaching it — lag that grows every time they
         bolt another section on, which is the escalation doing its job through
         the controls instead of around them. */
      let ang = 0, angT = 0, p = 0, pv = 0, stage = 0, elapsed = 0, t = 0, alive = true;
      let half = 1;
      const seams = [];
      const MAXA = 0.55;
      const bump = d => { angT = Math.max(-MAXA, Math.min(MAXA, angT + d * 0.20)); };
      const hL = ceHold(L, () => bump(1));
      const hR = ceHold(R, () => bump(-1));

      const paintRod = () => {
        rod.style.width = Math.min(96, 42 + stage * 9) + '%';
        for (const s of seams) s.el.style.left = (50 + s.at / half * 50) + '%';
      };
      const bolt = () => {
        stage++;
        const old = half; half = old + 0.45;
        /* The ball keeps its ABSOLUTE place on the wood, which in fractions of
           a now-longer rod means it slides back toward the middle. That is the
           only gift a stage gives you, and it is gone within a second. */
        p *= old / half; pv *= old / half;
        [-old, old].forEach(at => {
          const el = h('i', 'ce-seam'); rod.appendChild(el); seams.push({ el, at });
        });
        paintRod();
        Juice.fx(rig, 'medium', 'SECTION ' + (stage + 1));
        /* Bolting it on knocks the rod. Which way is not up to you. */
        ang += (chance(0.5) ? 1 : -1) * 0.16 * ctx.rate(1, 0.4);
      };

      const finish = dropped => {
        if (!alive) return; alive = false; clk.stop();
        hL.release(); hR.release();
        const cleared = stage + clamp01((elapsed - stage * STAGE_MS) / STAGE_MS);
        const s = clamp01(cleared / target);
        if (dropped) ball.classList.add('ce-dropped');
        Juice.fx(rig, dropped ? 'bad' : 'large', dropped ? 'BALL DOWN' : (stage + 1) + ' SECTIONS');
        ctx.done(dropped ? s * 0.85 : s);
      };
      const clk = ctx.clock(RUN, () => finish(false));

      let last = performance.now();
      const step = now => {
        if (!alive) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        t += dt; elapsed += dt * 1000;
        if (stage < 9 && elapsed > (stage + 1) * STAGE_MS) bolt();
        /* Every per-stage term is a division or a multiplication on the same
           stage number, so the ramp is one idea rather than three. */
        const resp = resp0 / (1 + stage * 0.30);
        const settle = set0 / (1 + stage * 0.40);
        const wobA = wob0 * (1 + stage * 0.55);
        const drive = (hL.held() ? 1 : 0) - (hR.held() ? 1 : 0);
        /* Let go and your arms bring it back toward level, more slowly the
           heavier the rod has become. */
        angT += (drive * MAXA - angT) * Math.min(1, dt * settle);
        ang += (angT - ang) * Math.min(1, dt * resp);
        ang += Math.sin(t * 2.7 + stage) * wobA * dt;
        ang += p * load0 * half * dt;
        ang = Math.max(-1, Math.min(1, ang));
        pv = (pv + ang * G * dt) * Math.pow(0.5, dt);
        p += pv * dt;
        rod.style.transform = `rotate(${(ang * 13).toFixed(2)}deg)`;
        ball.style.left = (50 + p * 50) + '%';
        const cleared = stage + clamp01((elapsed - stage * STAGE_MS) / STAGE_MS);
        ctx.setScore(clamp01(cleared / target));
        const near = Math.abs(p) / edge;
        warn.textContent = near > 0.7 ? 'IT IS GOING OFF THE END' : 'section ' + (stage + 1);
        warn.classList.toggle('hot', near > 0.7);
        if (Math.abs(p) > edge) return finish(true);
        requestAnimationFrame(step);
      };
      paintRod();
      requestAnimationFrame(step);
    }
  },

  /* E3. A BIT TIPSY — spell IMMUNITY on a base that will not stay still.

     Lettered blocks stacked on a tilting base. Every block raises the centre of
     gravity, so the thing gets less stable the closer you are to finishing.
     Topple and you rebuild from nothing, first to spell it wins.

     Deliberately NOT the same game as Sandbag Stack. That one is push-your-luck
     — the whole decision is when to bank. Here the target is fixed at eight
     letters and there is nothing to bank, so the skill is entirely in
     RE-LEVELLING between placements: read the meter, counterweight, wait for
     the window, place. A topple is a setback rather than a loss, which is both
     faithful and the reason the game stays worth playing after a mistake.

     The base is an inverted pendulum: the further from level it already is, the
     harder it runs away, and the block count multiplies that runaway rather
     than adding a second mechanic on top of it. */
  {
    id: 'tipsy', name: 'A Bit Tipsy', bucket: 'physical', verb: 'counterweight',
    tags: ['physicality', 'smarts'],
    how: 'LEAN until the base is level AND still, then PLACE. Topple and the stack starts again.',
    forChallenges: ['Island Survival Build'],
    start(ctx) {
      /* The word is the shell's to choose, not this game's. It was hardcoded to
         IMMUNITY, which meant the game could not be used for a reward challenge —
         the reward system excluded it outright rather than put the word "immunity"
         on a screen that has nothing to do with immunity. The show spells whatever
         the challenge is about, so `ctx.word` carries it and this falls back to
         the old value when nobody sets one. Same length band either way, so the
         difficulty does not move. */
      const WORD = (ctx.word || 'IMMUNITY').toUpperCase();
      const rig = h('div', 'ce-tipsy');
      const stackWrap = h('div', 'ce-stackwrap');
      let stack = h('div', 'ce-stack');
      const base = h('div', 'ce-base');
      stackWrap.appendChild(stack); stackWrap.appendChild(base);
      rig.appendChild(stackWrap);
      const meter = h('div', 'ce-level');
      const winBand = h('i', 'ce-level-win'), needle = h('i', 'ce-level-dot');
      meter.appendChild(winBand); meter.appendChild(needle);
      const word = h('div', 'ce-word');
      const wEls = WORD.split('').map(ch => { const s = h('span', 'ce-wl', ch); word.appendChild(s); return s; });
      const row = h('div', 'cg-row');
      const L = h('button', 'btn cg-b', '◀ LEAN');
      const P = h('button', 'btn cg-b primary', 'PLACE');
      const R = h('button', 'btn cg-b', 'LEAN ▶');
      row.appendChild(L); row.appendChild(P); row.appendChild(R);
      ctx.arena.appendChild(rig); ctx.arena.appendChild(meter);
      ctx.arena.appendChild(word); ctx.arena.appendChild(row);

      const RUN = 20000;
      const win = ctx.tol(0.20, 0.16);    // ease = a wider level window
      const shove = ctx.rate(0.55, 0.20); // ease = a calmer base
      const leanF = ctx.tol(3.4, 1.0);    // ease = more from each counterweight
      /* LEVEL IS NOT ENOUGH; IT HAS TO BE SETTLED. Without this the game was
         beaten by mashing PLACE: a base swinging hard through level is inside
         the window for a moment on every pass, so a masher collected a block per
         swing and spelled the word without ever counterweighting anything. The
         velocity gate is what makes the LEAN buttons the game instead of
         decoration, and it is also the honest version of the real skill —
         nobody sets a block on a base that is still moving. */
      const vwin = ctx.tol(0.40, 0.22);
      /* You have to reach for the next block. Raw-ish but routed: a slower hand
         is harder, so it multiplies with difficulty and ease shortens it. Also
         the second half of the anti-mash fix — one window, one block. */
      const grab = ctx.rate(260, 60);
      /* The meter spans tilt -1..1 across its full width, so a window of ±win
         is drawn win*100 per cent wide. The band is the telegraph: the player
         can see how much room they have before they have to commit. */
      winBand.style.width = (win * 100).toFixed(1) + '%';

      let tilt = rr(-0.15, 0.15), tv = 0, n = 0, best = 0, topples = 0, alive = true;
      let ghost = null, lastPlace = -1e9;
      const hL = ceHold(L, () => { tv -= 0.09; });
      const hR = ceHold(R, () => { tv += 0.09; });

      const paintWord = () => {
        wEls.forEach((e, i) => {
          e.classList.toggle('ce-on', i < n);
          e.classList.toggle('ce-next', i === n);
        });
      };
      const topple = () => {
        topples++;
        if (ghost) ghost.remove();       // never keep more than one wreck around
        stack.classList.add('ce-fell');
        ghost = stack;
        stack = h('div', 'ce-stack');
        stackWrap.insertBefore(stack, base);
        n = 0; tilt = rr(-0.12, 0.12); tv = 0;
        paintWord();
        Juice.fx(rig, 'bad', 'TOPPLED');
        ctx.hitstop(90);
      };
      const place = () => {
        if (!alive) return;
        if (performance.now() - lastPlace < grab) return;
        if (Math.abs(tilt) > win || Math.abs(tv) > vwin) {
          /* Placing on a tilted base is how you knock it over on the show, so
             the fumble costs you the lurch as well as the block. */
          tv += (tilt < 0 ? -1 : 1) * 0.35 * ctx.rate(1, 0.3);
          Juice.fx(P, 'bad', Math.abs(tilt) > win ? 'FUMBLED' : 'STILL MOVING');
          ctx.hitstop(60);
          lastPlace = performance.now();
          return;
        }
        lastPlace = performance.now();
        const b = h('i', 'ce-blk', WORD[n]);
        stack.appendChild(b);
        n++; best = Math.max(best, n);
        paintWord();
        ctx.setScore(clamp01(best / WORD.length));
        /* You cannot set a block down without moving what it lands on. */
        tv += rr(-1, 1) * 0.13 * ctx.rate(1, 0.3);
        Juice.fx(b, n >= WORD.length ? 'large' : 'small', WORD[n - 1]);
        if (n >= WORD.length) finish(true);
      };
      P.onclick = place;

      const finish = spelled => {
        if (!alive) return; alive = false; clk.stop();
        hL.release(); hR.release();
        const s = clamp01(best / WORD.length);
        Juice.fx(rig, spelled ? 'large' : s > 0.5 ? 'medium' : 'bad',
          spelled ? WORD : best + '/' + WORD.length);
        DBG.decision('Challenge', 'tipsy', { letters: best, topples });
        ctx.done(spelled ? 1 : s);
      };
      const clk = ctx.clock(RUN, () => finish(false));

      let last = performance.now();
      const step = now => {
        if (!alive) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        /* n multiplies the runaway rather than adding to it, so the eighth
           letter is a different game from the second without there being a
           second mechanic. The 0.95 was arrived at from the other direction: at
           0.42 a bot that simply pressed PLACE whenever the button lit spelled
           the word every single time, which means the top of the stack was not
           asking for anything the bottom had not already asked for. */
        const insta = shove * (1.0 + n * 0.95);
        tv += tilt * insta * dt;
        tv += rr(-1, 1) * shove * 0.55 * dt;
        tv += ((hR.held() ? 1 : 0) - (hL.held() ? 1 : 0)) * leanF * dt;
        tv *= Math.pow(0.30, dt);
        tilt += tv * dt;
        stackWrap.style.transform = `rotate(${(tilt * 20).toFixed(2)}deg)`;
        needle.style.left = (50 + Math.max(-1, Math.min(1, tilt)) * 50) + '%';
        const level = Math.abs(tilt) < win && Math.abs(tv) < vwin;
        P.classList.toggle('ce-ready', level);
        meter.classList.toggle('ce-open', level);
        if (Math.abs(tilt) > 1) topple();
        requestAnimationFrame(step);
      };
      paintWord();
      requestAnimationFrame(step);
    }
  },

  /* E4. BALANCING POINT — stack coins on the upturned hilt of a sword.

     Precision placement, and the cruelty of the real thing is that the tower
     punishes you later rather than immediately: a coin two millimetres off
     stands up fine and takes the next four down with it.

     So there are two failure modes and they are different. Miss the landing
     zone outright and it goes now. Land inside it but off-centre every time
     and the accumulated lean takes it later, which means a player who is
     consistently slightly right of centre is in more trouble than one who
     alternates. That is the whole strategic layer and it costs one variable.

     The zone shrinks with height, so the coin that matters most is always the
     one you are least equipped to place. Its width is drawn on the sweep bar,
     so the demand is visible before it is made rather than after. */
  {
    id: 'coins', name: 'Balancing Point', bucket: 'physical', verb: 'place',
    tags: ['physicality', 'smarts'],
    how: 'The cursor sweeps. Tap DROP to place a coin there. Off-centre coins add up.',
    forChallenges: ['Rope Bridge Build'],
    start(ctx) {
      const rig = h('div', 'ce-swordrig');
      const sword = h('div', 'ce-sword');
      sword.appendChild(h('i', 'ce-blade'));
      sword.appendChild(h('i', 'ce-guard'));
      let coins = h('div', 'ce-coins');
      sword.appendChild(coins);
      rig.appendChild(sword);
      const sweep = h('div', 'ce-sweep');
      const zone = h('i', 'ce-sweep-zone'), cur = h('i', 'ce-sweep-cur');
      sweep.appendChild(zone); sweep.appendChild(cur);
      const warn = h('div', 'cg-warn', 'no coins up');
      const B = h('button', 'btn cg-b primary cg-wide', 'DROP COIN');
      ctx.arena.appendChild(sweep); ctx.arena.appendChild(rig);
      ctx.arena.appendChild(warn); ctx.arena.appendChild(B);

      const RUN = 18000;
      const target = ctx.more(6);         // coins for a full mark
      const speed = ctx.rate(1.0, 0.35);  // ease = a slower cursor
      const tol0 = ctx.tol(0.44, 0.30);   // ease = a wider landing zone
      let n = 0, best = 0, lean = 0, t = 0, cx = 0, alive = true, rebuildT = null;
      /* Bottoming out at 0.42 of the opening tolerance. Past that the open
         window is a couple of frames wide and the game stops being precision
         and starts being a coin flip on which frame you happened to tap — the
         first pass shrank to 0.30 over thirteen coins and the top of the tower
         was unplayable rather than merely demanding. */
      const tolFor = k => tol0 * Math.max(0.42, 1 - k * 0.06);

      const paint = () => {
        zone.style.width = (tolFor(n) * 100).toFixed(1) + '%';
        coins.style.transform = `rotate(${(lean * 9).toFixed(2)}deg)`;
        warn.textContent = (n ? n + (n === 1 ? ' coin up' : ' coins up') : 'no coins up')
          + '  ·  best ' + best + ' of ' + target;
      };
      const collapse = why => {
        const dead = coins;
        dead.classList.add('ce-fell');
        Juice.fx(rig, 'bad', why);
        ctx.hitstop(80);
        /* The one timer in this file. It is tracked and cleared in finish(),
           and it re-checks alive on the way in, because a collapse landing on
           the same tick as the clock is exactly how these games double-resolve. */
        rebuildT = setTimeout(() => {
          rebuildT = null;
          if (!alive) return;
          dead.remove();
          coins = h('div', 'ce-coins');
          sword.appendChild(coins);
          n = 0; lean = 0; paint();
        }, 320);
      };
      B.onclick = () => {
        if (!alive || rebuildT) return;
        const off = cx, tol = tolFor(n);
        if (Math.abs(off) > tol) return collapse('OFF THE EDGE');
        const c = h('i', 'ce-coin');
        c.style.marginLeft = (off * 13).toFixed(1) + 'px';
        coins.appendChild(c);
        n++; best = Math.max(best, n);
        lean += off * 0.55;
        paint();
        ctx.setScore(clamp01(best / target));
        const clean = Math.abs(off) < tol * 0.3;
        Juice.fx(c, clean ? 'medium' : 'small', clean ? 'DEAD CENTRE' : String(n));
        if (Math.abs(lean) > 1) return collapse('IT LEANED OVER');
        if (n >= target) finish(true);
      };

      const finish = topped => {
        if (!alive) return; alive = false; clk.stop();
        clearTimeout(rebuildT);
        const s = clamp01(best / target);
        Juice.fx(rig, topped ? 'large' : s > 0.5 ? 'medium' : 'bad', best + ' coins');
        ctx.done(topped ? 1 : s);
      };
      const clk = ctx.clock(RUN, () => finish(false));

      let last = performance.now();
      const step = now => {
        if (!alive) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        t += dt;
        cx = Math.sin(t * speed * 2.4);
        cur.style.left = (50 + cx * 50) + '%';
        cur.classList.toggle('ce-in', Math.abs(cx) < tolFor(n));
        requestAnimationFrame(step);
      };
      paint();
      requestAnimationFrame(step);
    }
  },

  /* E5. TABLE MAZE — tilt a grooved board and steer a ball past the drop-holes.

     Falling in a hole sends the ball back to the start. That is a setback and
     not an ending, which is the point: the clock is the opponent, and the
     player who panics after a fall loses more to the next thirty seconds than
     they lost to the hole.

     BOARD GENERATION. Holes go in alternating rows only, and never fill one, so
     a route exists by construction — every other row is clear, and each hole
     row keeps at least two free columns to weave through. The flood fill is
     belt and braces on top of that. It costs nothing and it means the next
     person to change perRow or HOLEROWS cannot ship an unwinnable board by
     accident, which is a far worse bug than a board that is too easy: an easy
     board reads as a bad round, an impossible one reads as the game lying. */
  {
    id: 'maze', name: 'Table Maze', bucket: 'mental', verb: 'steer',
    tags: ['smarts', 'physicality'],
    how: 'Tilt the board to roll the ball to the exit. A hole sends you back to the start.',
    forChallenges: ['Maze Crawl'],
    start(ctx) {
      const COLS = 7, ROWS = 7;
      const HOLEROWS = [1, 3, 5];
      const SC = 3, SR = ROWS - 1, EC = 3, ER = 0;

      /* Was a raw 20000, which quietly opted this game out of the global pace
         lever — every other game routes its clock through ctx.span, so a change to
         chalPace moved all of them except this one. Routed properly now. */
      const RUN = ctx.span(20000);
      /* Drag carries the ease here: ctx.tol because more drag is a kinder
         board. Thrust is derived from drag so terminal speed stays the same for
         everyone — ease buys a ball that STOPS, not a ball that is slow, which
         is what "less slippery" actually means when you play it.

         SPEED is therefore this one number and nothing else: at steady state the
         thrust and the drag cancel to leave terminal velocity = SPEED cells per
         second, whatever the castaway's stats. Reported as too fast to steer, so
         2.56 — twenty percent down from the 3.2 it shipped at. Taps inherit it
         too, because the impulse in kick() is a fraction of push. */
      const SPEED = 2.56;
      const drag = ctx.tol(3.0, 1.5);
      const push = drag * SPEED;
      const holeR = Math.min(0.40, ctx.rate(0.22, 0.08));
      const perRow = Math.min(COLS - 2,
        Math.max(1, ctx.more(3) - Math.round(ctx.ease * 2 * CONFIG.chalEaseWeight)));

      const blocked = new Set();
      const K = (c, r) => r * COLS + c;
      const build = () => {
        blocked.clear();
        const all = [];
        for (let c = 0; c < COLS; c++) all.push(c);
        for (const r of HOLEROWS) {
          for (const c of shuffle(all.slice()).slice(0, perRow)) blocked.add(K(c, r));
        }
      };
      const reaches = () => {
        const seen = new Set([K(SC, SR)]), q = [[SC, SR]];
        while (q.length) {
          const cell = q.shift(), c = cell[0], r = cell[1];
          if (c === EC && r === ER) return true;
          for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nc = c + d[0], nr = r + d[1];
            if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
            const k = K(nc, nr);
            if (blocked.has(k) || seen.has(k)) continue;
            seen.add(k); q.push([nc, nr]);
          }
        }
        return false;
      };
      let ok = false, tries = 0;
      while (!ok && tries++ < 40) { build(); ok = reaches(); }
      if (!ok) blocked.clear();          // an empty board beats an unwinnable one

      const board = h('div', 'ce-board');
      const pxc = c => ((c + 0.5) / COLS * 100) + '%';
      const pyr = r => ((r + 0.5) / ROWS * 100) + '%';
      const startEl = h('i', 'ce-startpad');
      startEl.style.left = pxc(SC); startEl.style.top = pyr(SR);
      const exitEl = h('i', 'ce-exit');
      exitEl.style.left = pxc(EC); exitEl.style.top = pyr(ER);
      board.appendChild(startEl); board.appendChild(exitEl);
      const holes = [];
      blocked.forEach(k => {
        const c = k % COLS, r = Math.floor(k / COLS);
        const el = h('i', 'ce-hole');
        el.style.left = pxc(c); el.style.top = pyr(r);
        el.style.width = (holeR * 2 / COLS * 100).toFixed(2) + '%';
        board.appendChild(el);
        holes.push({ c: c + 0.5, r: r + 0.5 });
      });
      const mb = h('i', 'ce-mball');
      board.appendChild(mb);
      const warn = h('div', 'cg-warn', 'get to the far side');
      const pad = h('div', 'ce-dpad');
      const U = h('button', 'btn cg-b ce-dbtn ce-du', '▲');
      const L = h('button', 'btn cg-b ce-dbtn ce-dl', '◀');
      const D = h('button', 'btn cg-b ce-dbtn ce-dd', '▼');
      const R = h('button', 'btn cg-b ce-dbtn ce-dr', '▶');
      pad.appendChild(U); pad.appendChild(L); pad.appendChild(D); pad.appendChild(R);
      ctx.arena.appendChild(board); ctx.arena.appendChild(warn); ctx.arena.appendChild(pad);

      let bx = SC + 0.5, by = SR + 0.5, vx = 0, vy = 0, falls = 0, best = 0, alive = true;
      const D0 = Math.hypot(SC - EC, SR - ER) || 1;
      const kick = (dx, dy) => { vx += dx * push * 0.09; vy += dy * push * 0.09; };
      const hU = ceHold(U, () => kick(0, -1));
      const hD = ceHold(D, () => kick(0, 1));
      const hL = ceHold(L, () => kick(-1, 0));
      const hR = ceHold(R, () => kick(1, 0));

      const fall = () => {
        falls++;
        bx = SC + 0.5; by = SR + 0.5; vx = 0; vy = 0;
        Juice.fx(board, 'bad', 'DOWN A HOLE');
        ctx.hitstop(80);
        warn.textContent = falls + (falls === 1 ? ' fall' : ' falls') + ' — back to the start';
        warn.classList.add('hot');
      };
      const finish = out => {
        if (!alive) return; alive = false; clk.stop();
        hU.release(); hD.release(); hL.release(); hR.release();
        /* Getting there is worth a floor no amount of falling can take away —
           you finished the course, which is what the challenge asked for. */
        const s = out ? Math.max(0.62, clamp01(1 - falls * 0.07))
          : clamp01(best * 0.72 - falls * 0.03);
        Juice.fx(board, out ? 'large' : s > 0.4 ? 'medium' : 'bad',
          out ? 'THROUGH' : Math.round(best * 100) + '% of the way');
        ctx.done(s);
      };
      const clk = ctx.clock(RUN, () => finish(false));

      let last = performance.now();
      const step = now => {
        if (!alive) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        vx += ((hR.held() ? 1 : 0) - (hL.held() ? 1 : 0)) * push * dt;
        vy += ((hD.held() ? 1 : 0) - (hU.held() ? 1 : 0)) * push * dt;
        const damp = Math.exp(-drag * dt);
        vx *= damp; vy *= damp;
        bx += vx * dt; by += vy * dt;
        if (bx < 0.4) { bx = 0.4; vx = 0; }
        if (bx > COLS - 0.4) { bx = COLS - 0.4; vx = 0; }
        if (by < 0.4) { by = 0.4; vy = 0; }
        if (by > ROWS - 0.4) { by = ROWS - 0.4; vy = 0; }
        for (const hl of holes) {
          if (Math.hypot(bx - hl.c, by - hl.r) < holeR) { fall(); break; }
        }
        mb.style.left = (bx / COLS * 100) + '%';
        mb.style.top = (by / ROWS * 100) + '%';
        const gap = Math.hypot(bx - (EC + 0.5), by - (ER + 0.5));
        best = Math.max(best, clamp01(1 - gap / D0));
        ctx.setScore(clamp01(best * 0.8));
        if (gap < 0.5) return finish(true);
        requestAnimationFrame(step);
      };
      mb.style.left = (bx / COLS * 100) + '%';
      mb.style.top = (by / ROWS * 100) + '%';
      requestAnimationFrame(step);
    }
  }
];
