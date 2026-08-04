/* ============================================================
   MINIGAMES 1-7 — PHYSICAL. One verb each; ease spent on kindness.
   ============================================================ */
const MINIGAMES_A = [

  /* 1. HOLD THE ROPE — hold, and correct a drifting wobble. */
  {
    id: 'rope', name: 'Hold the Rope', bucket: 'physical', verb: 'hold',
    tags: ['physicality', 'emotional'],
    how: 'HOLD to grip. Tap LEFT / RIGHT to stay centred. Drift out and you drop.',
    forChallenges: ['Endurance Hang', 'Flame Endurance', 'Willpower Wall'],
    start(ctx) {
      const lane = h('div', 'cg-lane'), dot = h('div', 'cg-dot');
      lane.appendChild(h('div', 'cg-lane-safe')); lane.appendChild(dot);
      const row = h('div', 'cg-row');
      const L = h('button', 'btn cg-b', '◀'), G = h('button', 'btn cg-b primary', 'HOLD'), R = h('button', 'btn cg-b', '▶');
      row.appendChild(L); row.appendChild(G); row.appendChild(R);
      ctx.arena.appendChild(lane); ctx.arena.appendChild(row);
      /* ease widens the safe zone and calms the drift */
      const safe = ctx.tol(0.16, 0.16);
      lane.firstChild.style.width = (safe * 200) + '%';
      let x = 0, v = 0, held = false, held_ms = 0, alive = true;
      const target = 14000;                        // hold the whole clock to score 1.0
      const set = () => { dot.style.left = (50 + x * 50) + '%'; };
      const nudge = d => { if (!alive) return; v += d * 0.055; Juice.pop(dot, 0.4); };
      L.onclick = () => nudge(-1); R.onclick = () => nudge(1);
      const grip = on => { held = on; G.classList.toggle('sand', on); };
      G.addEventListener('pointerdown', () => grip(true));
      G.addEventListener('pointerup', () => grip(false));
      G.addEventListener('pointerleave', () => grip(false));
      const clk = ctx.clock(target, () => finish(true));
      let last = performance.now();
      const step = now => {
        if (!alive) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (held) held_ms += dt * 1000;
        v += (Math.sin(now / 700) * 0.4 + (Math.random() - 0.5) * 0.6) * dt * ctx.rate(1.25, 0.5);
        v *= 0.965; x += v * dt;
        set();
        ctx.setScore(clamp01(held_ms / target));
        if (Math.abs(x) > safe + 0.5 || (!held && held_ms > 400)) return finish(false);
        requestAnimationFrame(step);
      };
      const finish = ok => {
        if (!alive) return; alive = false; clk.stop();
        Juice.fx(dot, ok ? 'large' : 'bad', ok ? 'HELD ON' : 'DROPPED');
        ctx.done(ok ? clamp01(held_ms / target) : clamp01(held_ms / target) * 0.55);
      };
      set(); requestAnimationFrame(step);
    }
  },

  /* 2. LOG CARRY RHYTHM — alternate steps under a log that tips when you are late.

     Rebuilt after a playtest verdict of "I'm just tapping crazy hoping it will
     work", which was entirely fair: the game HAD a required side (`want`) and a
     timing window, and it showed the player neither. All you could see was a
     circle that pulsed once you were already too late to react to it, so there
     was nothing to read and nothing to learn — the only strategy the display
     supported was mashing.

     Three things fixed it, all of them about telegraphing rather than difficulty:

       1. WHICH SIDE IS NEXT is now the loudest thing on screen. The next foot
          lights; the other one is visibly asleep.
       2. THE BEAT IS VISIBLE BEFORE IT LANDS. A bar fills toward the step and the
          button turns green during the window, so the input is anticipated
          instead of guessed. A rhythm game you can only react to is a coin flip.
       3. FAILURE IS VISIBLE IN THE FICTION. The log tips further with every miss
          and levels with every good step, so the screen always says how close to
          dropping it you are. Mashing now visibly tips the log, which is the
          honest answer to mashing. */
  {
    id: 'logcarry', name: 'Log Carry', bucket: 'physical', verb: 'rhythm',
    tags: ['physicality'],
    how: 'Step on the LIT side as the bar fills. Alternate feet. Miss and the log tips.',
    forChallenges: ['Log Carry', 'Shoulder the Load'],
    start(ctx) {
      const rig = h('div', 'cg-logrig');
      const log = h('div', 'cg-log');
      log.appendChild(h('span', 'cg-log-grain'));
      rig.appendChild(log);
      const tipWarn = h('div', 'cg-warn', 'steady');
      const row = h('div', 'cg-row cg-steprow');
      const mkFoot = label => {
        const b = h('button', 'btn cg-b cg-step');
        b.appendChild(h('span', 'cg-step-label', label));
        const fill = h('i', 'cg-step-fill');
        b.appendChild(fill);
        b._fill = fill;
        return b;
      };
      const L = mkFoot('LEFT'), R = mkFoot('RIGHT');
      row.appendChild(L); row.appendChild(R);
      ctx.arena.appendChild(rig); ctx.arena.appendChild(tipWarn); ctx.arena.appendChild(row);

      let want = 'L', hits = 0, misses = 0, iv = ctx.span(700, 120), alive = true;
      let tilt = 0;                                 // -1..1, which way the log is going
      const win = ctx.tol(260, 220);                // ease = a kinder timing window
      const TIP = 1;                                // past this you drop it
      let beatAt = performance.now() + iv;

      const paint = () => {
        const el = want === 'L' ? L : R, off = want === 'L' ? R : L;
        el.classList.add('want'); off.classList.remove('want');
        off._fill.style.width = '0%';
        off.classList.remove('now');
      };
      const tap = side => {
        if (!alive) return;
        const now = performance.now();
        const off = Math.abs(now - beatAt);
        const el = side === 'L' ? L : R;
        if (side === want && off < win) {
          hits++;
          want = side === 'L' ? 'R' : 'L';
          /* A good step brings the log back level; a perfect one nearly rights it. */
          const quality = 1 - off / win;
          tilt *= (1 - 0.45 - 0.35 * quality);
          Juice.fx(el, quality > 0.6 ? 'medium' : 'small', quality > 0.6 ? 'PERFECT' : 'good');
          /* Only ADVANCE the beat on a good step, so the bar the player is reading
             always belongs to the step they are actually about to take. */
          beatAt = now + iv;
          iv = Math.max(ctx.span(300), iv - 12 * ctx.hard);   // and it keeps quickening
          paint();
        } else {
          misses++;
          /* Wrong foot tips it toward that foot; a mistimed right foot still
             counts as a stumble. Either way the log says so. */
          tilt += (side === 'L' ? -1 : 1) * (side === want ? 0.22 : 0.42);
          Juice.fx(el, 'bad', side === want ? 'mistimed' : 'wrong foot');
          ctx.hitstop(60);
        }
        ctx.setScore(clamp01(hits / ctx.more(18)));
      };
      L.onclick = () => tap('L'); R.onclick = () => tap('R');

      const finish = dropped => {
        if (!alive) return; alive = false; clk.stop();
        const base = clamp01(hits / Math.max(8, hits + misses)) * clamp01(hits / ctx.more(18));
        Juice.fx(log, dropped ? 'bad' : 'large', dropped ? 'DROPPED IT' : 'CARRIED');
        if (dropped) log.classList.add('dropped');
        ctx.done(dropped ? base * 0.4 : base);
      };
      const clk = ctx.clock(15000, () => finish(false));

      const loop = () => {
        if (!alive) return;
        const now = performance.now();
        const el = want === 'L' ? L : R;
        /* The approach: 0 just after the last step, 1 at the moment to step. */
        const p = clamp01(1 - (beatAt - now) / iv);
        el._fill.style.width = (p * 100).toFixed(1) + '%';
        el.classList.toggle('now', Math.abs(now - beatAt) < win);
        /* Missing the beat entirely tips the log the way you failed to catch. */
        if (now - beatAt > win) {
          misses++;
          tilt += (want === 'L' ? -1 : 1) * 0.30;
          Juice.fx(el, 'bad', 'late');
          want = want === 'L' ? 'R' : 'L';
          beatAt = now + iv;
          paint();
        }
        /* The log always drifts toward whichever side it is already leaning —
           doing nothing is not neutral, which is what carrying a log is like. */
        tilt += Math.sign(tilt) * Math.abs(tilt) * 0.004 * ctx.hard;
        tilt = Math.max(-1.4, Math.min(1.4, tilt));
        log.style.transform = `rotate(${(tilt * 16).toFixed(1)}deg)`;
        const mag = Math.abs(tilt);
        tipWarn.textContent = mag > TIP * 0.7 ? 'IT IS GOING OVER' : mag > TIP * 0.4 ? 'tipping' : 'steady';
        tipWarn.classList.toggle('hot', mag > TIP * 0.7);
        if (mag > TIP) return finish(true);
        requestAnimationFrame(loop);
      };
      paint(); loop();
    }
  },

  /* 3. BREATH HOLD — hold under water and release at the very edge. */
  {
    id: 'breath', name: 'Breath Hold', bucket: 'physical', verb: 'release',
    tags: ['emotional', 'physicality'],
    how: 'HOLD to stay under. Release as late as you dare — black out and you score nothing.',
    forChallenges: ['Breath Hold'],
    start(ctx) {
      const gauge = h('div', 'cg-gauge'), fill = h('div', 'cg-gauge-fill');
      gauge.appendChild(fill);
      const warn = h('div', 'cg-warn', '');
      const b = h('button', 'btn cg-b primary cg-wide', 'HOLD BREATH');
      ctx.arena.appendChild(gauge); ctx.arena.appendChild(warn); ctx.arena.appendChild(b);
      const cap = ctx.span(9000, 7000);            // ease = more lung
      let held = 0, going = false, done = false, last = 0;
      const step = now => {
        if (done) return;
        if (going) {
          held += now - last;
          const f = held / cap;
          fill.style.height = Math.min(100, f * 100) + '%';
          ctx.setScore(Math.min(1, f) * 0.95);
          if (f > 0.72) { warn.textContent = 'YOUR CHEST IS BURNING'; warn.classList.add('hot'); Juice.shake(0.05); }
          else if (f > 0.45) warn.textContent = 'getting tight...';
          if (f >= 1) { done = true; Juice.fx(gauge, 'bad', 'BLACKED OUT'); return ctx.done(0.05); }
        }
        last = now;
        requestAnimationFrame(step);
      };
      b.addEventListener('pointerdown', () => { if (done) return; going = true; last = performance.now(); b.textContent = 'HOLDING...'; requestAnimationFrame(step); });
      b.addEventListener('pointerup', () => {
        if (done || !going) return; done = true;
        const f = held / cap;
        Juice.fx(gauge, f > 0.8 ? 'large' : f > 0.5 ? 'medium' : 'small', Math.round(held / 100) / 10 + 's');
        ctx.done(clamp01(f * 0.98));
      });
    }
  },

  /* 4. BALANCE BEAM — correct a drifting dot against gusts. */
  {
    id: 'beam', name: 'Balance Beam', bucket: 'physical', verb: 'correct',
    tags: ['physicality', 'emotional'],
    how: 'Tap LEFT / RIGHT to stay on the beam. Gusts will shove you.',
    forChallenges: ['Balance Beam', 'Rope Bridge Build'],
    start(ctx) {
      const lane = h('div', 'cg-lane thin'), dot = h('div', 'cg-dot');
      lane.appendChild(dot);
      const row = h('div', 'cg-row');
      const L = h('button', 'btn cg-b', '◀'), R = h('button', 'btn cg-b', '▶');
      row.appendChild(L); row.appendChild(R);
      const gust = h('div', 'cg-warn', '');
      ctx.arena.appendChild(lane); ctx.arena.appendChild(gust); ctx.arena.appendChild(row);
      let x = 0, v = 0, t = 0, alive = true, on = 0;
      const tol = ctx.tol(0.72, 0.2);
      L.onclick = () => { v -= 0.05; Juice.pop(dot, 0.35); };
      R.onclick = () => { v += 0.05; Juice.pop(dot, 0.35); };
      const clk = ctx.clock(15000, () => fin(true));
      let last = performance.now();
      const step = now => {
        if (!alive) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
        if (Math.random() < 0.006 * ctx.hard) {
          const g = (Math.random() < 0.5 ? -1 : 1) * (0.09 + Math.random() * 0.07) * ctx.rate(1.2, 0.4);
          v += g; gust.textContent = g < 0 ? 'GUST ←' : 'GUST →';
          Juice.shake(0.3); setTimeout(() => gust.textContent = '', 700);
        }
        v += Math.sin(t * 1.9) * 0.02 * dt * 60 * ctx.rate(1.1, 0.4);
        v *= 0.96; x += v * dt;
        dot.style.left = (50 + x * 50) + '%';
        if (Math.abs(x) < tol) on += dt;
        ctx.setScore(clamp01(on / ctx.more(13)));
        if (Math.abs(x) > 1) return fin(false);
        requestAnimationFrame(step);
      };
      const fin = ok => {
        if (!alive) return; alive = false; clk.stop();
        Juice.fx(dot, ok ? 'large' : 'bad', ok ? 'STEADY' : 'FELL');
        ctx.done(ok ? clamp01(on / ctx.more(13)) : clamp01(on / ctx.more(13)) * 0.5);
      };
      requestAnimationFrame(step);
    }
  },

  /* 5. ISLAND SPRINT — tap each stone as it lights, chain without missing. */
  {
    id: 'sprint', name: 'Island Sprint', bucket: 'physical', verb: 'tap',
    tags: ['physicality'],
    how: 'Tap the lit stone. Only the lit one. Keep the chain going.',
    forChallenges: ['Island Sprint', 'Maze Crawl'],
    start(ctx) {
      const grid = h('div', 'cg-stones');
      const cells = [];
      for (let i = 0; i < 6; i++) { const c = h('button', 'cg-stone'); grid.appendChild(c); cells.push(c); }
      ctx.arena.appendChild(grid);
      let lit = -1, chain = 0, best = 0, miss = 0, alive = true;
      /* Reaction speed, so it gets the tap allowance on top — 1.7x difficulty
         turned this from brisk into a blur. */
      const showFor = ctx.span(650, 250) * CONFIG.chalTapEase;
      let timer = null;
      const light = () => {
        if (!alive) return;
        if (lit >= 0) cells[lit].classList.remove('lit');
        let n; do { n = ri(0, 6); } while (n === lit);
        lit = n; cells[lit].classList.add('lit');
        clearTimeout(timer);
        timer = setTimeout(() => { if (!alive) return; chain = 0; miss++; Juice.fx(cells[lit], 'bad', 'too slow'); light(); }, showFor);
      };
      cells.forEach((c, i) => c.onclick = () => {
        if (!alive) return;
        if (i === lit) {
          chain++; best = Math.max(best, chain);
          Juice.fx(c, chain % 5 === 0 ? 'medium' : 'small', chain > 1 ? 'x' + chain : 'go');
          ctx.setScore(clamp01(best / ctx.more(16)));
          light();
        } else { chain = 0; miss++; Juice.fx(c, 'bad'); ctx.hitstop(70); }
      });
      const clk = ctx.clock(14000, () => {
        alive = false; clearTimeout(timer); clk.stop();
        ctx.done(clamp01(best / ctx.more(16)) * clamp01(1 - miss * 0.05));
      });
      light();
    }
  },

  /* 6. SANDBAG STACK — bank early or keep stacking a leaning tower. */
  {
    id: 'stack', name: 'Sandbag Stack', bucket: 'physical', verb: 'push-luck',
    tags: ['physicality', 'smarts'],
    how: 'STACK to add a bag. Each one leans the tower. BANK before it topples.',
    forChallenges: ['Sandbag Stack'],
    start(ctx) {
      const tower = h('div', 'cg-tower');
      const row = h('div', 'cg-row');
      const S = h('button', 'btn cg-b primary', 'STACK'), B = h('button', 'btn cg-b sand', 'BANK');
      row.appendChild(S); row.appendChild(B);
      const lean = h('div', 'cg-warn', 'steady');
      ctx.arena.appendChild(tower); ctx.arena.appendChild(lean); ctx.arena.appendChild(row);
      let n = 0, tilt = 0, done = false;
      const limit = ctx.tol(1, 0.6);               // ease = the tower tolerates more lean
      S.onclick = () => {
        if (done) return;
        n++;
        const bag = h('div', 'cg-bag'); tower.appendChild(bag); Juice.pop(bag, 0.9);
        tilt += ctx.rate(0.10) + Math.random() * 0.16 * ctx.rate(1.2, 0.4);
        tower.style.transform = `rotate(${(tilt * 7).toFixed(1)}deg)`;
        lean.textContent = tilt > limit * 0.75 ? 'IT IS GOING TO GO' : tilt > limit * 0.45 ? 'leaning badly' : 'steady';
        lean.classList.toggle('hot', tilt > limit * 0.75);
        Juice.shake(0.12 + tilt * 0.2);
        ctx.setScore(clamp01(n / ctx.more(12)));
        if (tilt > limit) {
          done = true;
          tower.classList.add('fell');
          Juice.fx(tower, 'bad', 'TOPPLED');
          ctx.done(0.08);
        }
      };
      B.onclick = () => {
        if (done) return; done = true;
        Juice.fx(tower, n >= 7 ? 'large' : 'medium', n + ' banked');
        ctx.done(clamp01(n / ctx.more(12)));
      };
      ctx.clock(ctx.span(20000), () => { if (!done) { done = true; ctx.done(clamp01(n / ctx.more(12)) * 0.8); } });
    }
  },

  /* 7. DIG FOR CACHE — hot/cold search on a limited number of digs. */
  {
    id: 'dig', name: 'Dig for the Cache', bucket: 'physical', verb: 'search',
    tags: ['physicality', 'smarts'],
    how: 'Dig a square. It tells you how warm you are. Find the cache before your digs run out.',
    start(ctx) {
      const grid = h('div', 'cg-grid5');
      const N = 25, target = ri(0, N);
      let digs = Math.max(3, Math.round(ctx.span(5, 5))), found = false;   // ease = more digs
      const left = h('div', 'cg-warn', digs + ' digs left');
      ctx.arena.appendChild(left); ctx.arena.appendChild(grid);
      const cells = [];
      for (let i = 0; i < N; i++) {
        const c = h('button', 'cg-cell');
        c.onclick = () => {
          if (found || digs <= 0 || c.classList.contains('dug')) return;
          c.classList.add('dug');
          digs--; left.textContent = digs + ' digs left';
          if (i === target) {
            found = true;
            c.classList.add('hit'); c.textContent = '★';
            Juice.fx(c, 'large', 'FOUND IT');
            return ctx.done(clamp01(0.45 + digs * 0.09));
          }
          const dx = Math.abs(i % 5 - target % 5), dy = Math.abs(Math.floor(i / 5) - Math.floor(target / 5));
          const d = Math.max(dx, dy);
          c.textContent = d <= 1 ? 'HOT' : d === 2 ? 'warm' : 'cold';
          c.classList.add(d <= 1 ? 'hot' : d === 2 ? 'warm' : 'cold');
          Juice.fx(c, d <= 1 ? 'small' : null);
          if (digs <= 0) { Juice.fx(left, 'bad', 'OUT OF DIGS'); ctx.done(0.1); }
        };
        grid.appendChild(c); cells.push(c);
      }
      ctx.clock(ctx.span(25000), () => { if (!found) ctx.done(0.1); });
    }
  }
];
