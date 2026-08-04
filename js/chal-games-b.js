/* ============================================================
   MINIGAMES 8-15 — MENTAL. Ease buys thinking time and hints, never points.
   ============================================================ */
const MINIGAMES_B = [

  /* 8. SLIDE PUZZLE — 3x3, scored on how close to solved plus moves spare. */
  {
    id: 'slide', name: 'Slide Puzzle', bucket: 'mental', verb: 'drag',
    tags: ['smarts'],
    how: 'Tap a tile next to the gap to slide it. Get 1-8 in order.',
    forChallenges: ['Slide Puzzle'],
    start(ctx) {
      const grid = h('div', 'cg-grid3');
      let a = [1, 2, 3, 4, 5, 6, 7, 8, 0];
      /* Shuffle by legal moves only, so it is always solvable. Fewer shuffles
         when the castaway is sharp — ease as an easier board. */
      const shuffles = Math.round(60 * ctx.hard - ctx.ease * 34 * CONFIG.chalEaseWeight);
      const idxOf0 = () => a.indexOf(0);
      const nbrs = i => {
        const r = Math.floor(i / 3), c = i % 3, o = [];
        if (r > 0) o.push(i - 3); if (r < 2) o.push(i + 3);
        if (c > 0) o.push(i - 1); if (c < 2) o.push(i + 1);
        return o;
      };
      for (let s = 0; s < shuffles; s++) { const z = idxOf0(), n = pick(nbrs(z)); a[z] = a[n]; a[n] = 0; }
      const cells = [];
      const solved = () => a.every((v, i) => v === (i < 8 ? i + 1 : 0));
      const correct = () => a.filter((v, i) => v === (i < 8 ? i + 1 : 0)).length;
      const draw = () => {
        a.forEach((v, i) => {
          cells[i].textContent = v === 0 ? '' : v;
          cells[i].classList.toggle('gap', v === 0);
          cells[i].classList.toggle('ok', v !== 0 && v === i + 1);
        });
        ctx.setScore(clamp01((correct() - 1) / 8));
      };
      let moves = 0, done = false;
      for (let i = 0; i < 9; i++) {
        const c = h('button', 'cg-tile');
        c.onclick = () => {
          if (done) return;
          const z = idxOf0();
          if (nbrs(i).indexOf(z) < 0) { Juice.fx(c, 'bad'); return; }
          a[z] = a[i]; a[i] = 0; moves++;
          Juice.fx(c, 'small'); draw();
          if (solved()) { done = true; Juice.fx(grid, 'large', 'SOLVED'); ctx.done(clamp01(0.7 + Math.max(0, 40 - moves) * 0.0075)); }
        };
        grid.appendChild(c); cells.push(c);
      }
      ctx.arena.appendChild(grid); draw();
      ctx.clock(ctx.span(30000), () => { if (!done) { done = true; ctx.done(clamp01((correct() - 1) / 8) * 0.65); } });
    }
  },

  /* 9. CIPHER DECODE — substitution with two letters given. */
  {
    id: 'cipher', name: 'Cipher Decode', bucket: 'mental', verb: 'deduce',
    tags: ['smarts'],
    how: 'Each symbol is a letter. Two are given. Tap letters to fill the word.',
    forChallenges: ['Cipher Decode'],
    start(ctx) {
      const words = ['TORCH', 'ISLAND', 'SHELTER', 'COCONUT', 'PADDLE', 'JUNGLE', 'FIRE', 'TRIBE'];
      const word = pick(words);
      const shown = Math.max(1, Math.round(ctx.span(1, 2)));  // ease = more letters given
      const given = new Set();
      while (given.size < Math.min(shown, word.length - 2)) given.add(ri(0, word.length));
      const slots = h('div', 'cg-slots'), sEls = [];
      word.split('').forEach((ch, i) => {
        const s = h('div', 'cg-slot', given.has(i) ? ch : '');
        if (given.has(i)) s.classList.add('given');
        slots.appendChild(s); sEls.push(s);
      });
      const keys = h('div', 'cg-keys');
      let cur = word.split('').map((ch, i) => given.has(i) ? ch : '');
      let done = false;
      const check = () => {
        const filled = cur.every(c => c);
        ctx.setScore(cur.filter((c, i) => c === word[i]).length / word.length);
        if (!filled) return;
        done = true;
        const right = cur.join('') === word;
        Juice.fx(slots, right ? 'large' : 'bad', right ? 'DECODED' : word);
        ctx.done(right ? 1 : 0.15);
      };
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(k => {
        const b = h('button', 'cg-key', k);
        b.onclick = () => {
          if (done) return;
          const i = cur.findIndex((c, j) => !c && !given.has(j));
          if (i < 0) return;
          cur[i] = k; sEls[i].textContent = k;
          Juice.fx(sEls[i], k === word[i] ? 'small' : 'bad');
          check();
        };
        keys.appendChild(b);
      });
      const undo = h('button', 'btn cg-b sand', 'Backspace');
      undo.onclick = () => {
        if (done) return;
        for (let i = cur.length - 1; i >= 0; i--) if (cur[i] && !given.has(i)) { cur[i] = ''; sEls[i].textContent = ''; break; }
      };
      ctx.arena.appendChild(slots); ctx.arena.appendChild(keys); ctx.arena.appendChild(undo);
      ctx.clock(ctx.span(30000), () => { if (!done) { done = true; ctx.done(0.2); } });
    }
  },

  /* 10. MEMORY GRID — Simon. Ease = a longer look. */
  {
    id: 'memory', name: 'Memory Grid', bucket: 'mental', verb: 'remember',
    tags: ['smarts'],
    how: 'Watch the pattern, then repeat it. It gets one longer each round.',
    forChallenges: ['Memory Grid', 'Blind Build'],
    start(ctx) {
      const grid = h('div', 'cg-grid3');
      const cells = [];
      for (let i = 0; i < 9; i++) { const c = h('button', 'cg-pad'); grid.appendChild(c); cells.push(c); }
      const label = h('div', 'cg-warn', 'watch');
      ctx.arena.appendChild(label); ctx.arena.appendChild(grid);
      const flashMs = ctx.span(380, 260);                    // ease = longer look
      let seq = [], step = 0, round = 0, best = 0, playing = true, done = false;
      const show = async () => {
        playing = true; label.textContent = 'watch'; label.classList.remove('hot');
        for (const i of seq) {
          cells[i].classList.add('lit'); Juice.pop(cells[i], 0.6);
          await new Promise(r => setTimeout(r, flashMs));
          cells[i].classList.remove('lit');
          await new Promise(r => setTimeout(r, 140));
        }
        playing = false; step = 0; label.textContent = 'your turn'; label.classList.add('hot');
      };
      const next = () => { round++; best = Math.max(best, round - 1); seq.push(ri(0, 9)); ctx.setScore(clamp01((round - 1) / ctx.more(8))); show(); };
      cells.forEach((c, i) => c.onclick = () => {
        if (playing || done) return;
        if (i === seq[step]) {
          step++; Juice.fx(c, 'small');
          if (step >= seq.length) { Juice.fx(grid, 'medium', 'round ' + round); setTimeout(next, 420); }
        } else {
          done = true; Juice.fx(c, 'bad', 'WRONG');
          ctx.done(clamp01((round - 1) / ctx.more(8)));
        }
      });
      ctx.clock(ctx.span(40000), () => { if (!done) { done = true; ctx.done(clamp01((round - 1) / ctx.more(8))); } });
      next();
    }
  },

  /* 11. COORDINATES — deduce one cell from three clues, one guess. */
  {
    id: 'coords', name: 'Coordinates', bucket: 'mental', verb: 'deduce',
    tags: ['smarts'],
    how: 'Read the clues. You get ONE tap.',
    forChallenges: ['Coordinates'],
    start(ctx) {
      const N = 5, target = ri(0, N * N);
      const tr = Math.floor(target / N), tc = target % N;
      const clues = [
        `Row ${tr + 1}.`,
        tc < 2 ? 'West side of the island.' : tc > 2 ? 'East side.' : 'Dead centre, east to west.',
        `Column is ${tc % 2 === 0 ? 'even-numbered from the left (1,3,5)' : 'even-numbered (2 or 4)'}.`
      ];
      if (ctx.ease > 0.55 * ctx.hard) clues.push(`Column ${tc + 1}.`);   // ease = an extra clue
      const box = h('div', 'col');
      clues.forEach(c => box.appendChild(h('div', 'cg-clue', c)));
      const grid = h('div', 'cg-grid5');
      let done = false;
      for (let i = 0; i < N * N; i++) {
        const c = h('button', 'cg-cell');
        c.textContent = `${Math.floor(i / N) + 1}·${i % N + 1}`;
        c.onclick = () => {
          if (done) return; done = true;
          if (i === target) { c.classList.add('hit'); Juice.fx(c, 'large', 'EXACT'); ctx.done(1); }
          else {
            c.classList.add('cold');
            const d = Math.abs(Math.floor(i / N) - tr) + Math.abs(i % N - tc);
            Juice.fx(c, 'bad', 'off by ' + d);
            ctx.done(clamp01(0.5 - d * 0.09));
          }
        };
        grid.appendChild(c);
      }
      ctx.arena.appendChild(box); ctx.arena.appendChild(grid);
      ctx.clock(ctx.span(30000), () => { if (!done) { done = true; ctx.done(0.1); } });
    }
  },

  /* 12. MATCHSTICK MATH — move one stick to fix the equation. */
  {
    id: 'matches', name: 'Matchstick Math', bucket: 'mental', verb: 'deduce',
    tags: ['smarts'],
    how: 'The sum is wrong. Pick the ONE change that makes it true.',
    forChallenges: ['Matchstick Math'],
    start(ctx) {
      const puzzles = [
        { q: '6 + 4 = 4', opts: ['6 - 4 = 2', '5 + 4 = 9', '6 + 4 = 10'], a: 2 },
        { q: '9 - 3 = 5', opts: ['9 - 3 = 6', '8 - 3 = 5', '9 - 4 = 5'], a: 1 },
        { q: '7 + 1 = 9', opts: ['7 + 1 = 8', '7 + 2 = 9', '1 + 1 = 9'], a: 1 },
        { q: '5 + 5 = 55', opts: ['5 + 5 = 10', '5 × 5 = 25', '5 - 5 = 0'], a: 0 },
        { q: '3 + 8 = 9', opts: ['3 + 6 = 9', '3 + 8 = 11', '8 - 3 = 5'], a: 0 }
      ];
      const p = pick(puzzles);
      /* ease = one wrong option struck out before you start */
      const strike = ctx.ease > 0.6 * ctx.hard ? p.opts.findIndex((_, i) => i !== p.a) : -1;
      ctx.arena.appendChild(h('div', 'cg-eq', p.q));
      let done = false;
      const col = h('div', 'col');
      p.opts.forEach((o, i) => {
        const b = h('button', 'btn cg-b cg-wide', o);
        if (i === strike) { b.disabled = true; b.classList.add('struck'); }
        b.onclick = () => {
          if (done) return; done = true;
          const right = i === p.a;
          Juice.fx(b, right ? 'large' : 'bad', right ? 'CORRECT' : 'no');
          ctx.done(right ? 1 : 0.12);
        };
        col.appendChild(b);
      });
      ctx.arena.appendChild(col);
      ctx.clock(ctx.span(25000), () => { if (!done) { done = true; ctx.done(0.1); } });
    }
  },

  /* 13. SEQUENCE LOCK — infer the rule, enter the next three. */
  {
    id: 'sequence', name: 'Sequence Lock', bucket: 'mental', verb: 'deduce',
    tags: ['smarts'],
    how: 'Work out the pattern and key in the next three numbers.',
    forChallenges: ['Sequence Lock'],
    start(ctx) {
      const rules = [
        { f: (n, s) => s + 3, name: '+3' }, { f: (n, s) => s * 2, name: '×2' },
        { f: (n, s) => s + n, name: '+n' }, { f: (n, s) => s + 5, name: '+5' },
        { f: (n, s) => s * 3, name: '×3' }
      ];
      const r = pick(rules);
      let v = ri(1, 6); const seq = [v];
      for (let i = 1; i < 7; i++) { v = r.f(i + 1, v); seq.push(v); }
      const showN = 4;
      const need = seq.slice(showN, showN + 3);
      ctx.arena.appendChild(h('div', 'cg-eq', seq.slice(0, showN).join('  ') + '  ?  ?  ?'));
      const slots = h('div', 'cg-slots'), sEls = [];
      for (let i = 0; i < 3; i++) { const s = h('div', 'cg-slot'); slots.appendChild(s); sEls.push(s); }
      const keys = h('div', 'cg-keys');
      let buf = '', at = 0, lives = Math.max(1, Math.round(ctx.span(1, 2))), done = false;   // ease = more lives
      const lifeEl = h('div', 'cg-warn', lives + ' attempt' + (lives > 1 ? 's' : ''));
      for (let d = 0; d <= 9; d++) {
        const b = h('button', 'cg-key', String(d));
        b.onclick = () => { if (done) return; buf += d; sEls[at].textContent = buf; Juice.fx(sEls[at], 'small'); };
        keys.appendChild(b);
      }
      const ok = h('button', 'btn cg-b primary', 'Enter');
      ok.onclick = () => {
        if (done || !buf) return;
        const good = parseInt(buf, 10) === need[at];
        Juice.fx(sEls[at], good ? 'medium' : 'bad', good ? 'yes' : String(need[at]));
        if (!good) {
          lives--; lifeEl.textContent = lives + ' left';
          if (lives <= 0) { done = true; return ctx.done(clamp01(at * 0.28)); }
          buf = ''; sEls[at].textContent = ''; return;
        }
        at++; buf = '';
        ctx.setScore(at / 3);
        if (at >= 3) { done = true; Juice.fx(slots, 'large', 'UNLOCKED'); ctx.done(1); }
      };
      ctx.arena.appendChild(slots); ctx.arena.appendChild(lifeEl); ctx.arena.appendChild(keys); ctx.arena.appendChild(ok);
      ctx.clock(ctx.span(35000), () => { if (!done) { done = true; ctx.done(clamp01(at * 0.28)); } });
    }
  },

  /* 14. WORD UNSCRAMBLE — anagram against a clock, hints cost score. */
  {
    id: 'unscramble', name: 'Word Unscramble', bucket: 'mental', verb: 'deduce',
    tags: ['smarts'],
    how: 'Tap the letters in order to spell the island word. A hint costs you.',
    forChallenges: ['Word Unscramble'],
    start(ctx) {
      const words = ['SHELTER', 'PADDLE', 'TORCHES', 'COCONUT', 'MACHETE', 'LAGOON', 'RATIONS', 'BAMBOO'];
      const word = pick(words);
      const letters = shuffle(word.split(''));
      const slots = h('div', 'cg-slots'), sEls = [];
      word.split('').forEach(() => { const s = h('div', 'cg-slot'); slots.appendChild(s); sEls.push(s); });
      const bank = h('div', 'cg-keys');
      let at = 0, penalty = 0, done = false;
      const finish = () => {
        done = true;
        Juice.fx(slots, 'large', 'GOT IT');
        ctx.done(clamp01(1 - penalty));
      };
      letters.forEach(ch => {
        const b = h('button', 'cg-key', ch);
        b.onclick = () => {
          if (done || b.disabled) return;
          if (ch === word[at]) {
            sEls[at].textContent = ch; Juice.fx(sEls[at], 'small');
            b.disabled = true; at++; ctx.setScore(at / word.length);
            if (at >= word.length) finish();
          } else { penalty += 0.06; Juice.fx(b, 'bad'); ctx.hitstop(60); }
        };
        bank.appendChild(b);
      });
      const hint = h('button', 'btn cg-b sand', 'Hint (costs score)');
      hint.onclick = () => {
        if (done || at >= word.length) return;
        penalty += 0.18;
        const want = word[at];
        const b = [...bank.children].find(x => x.textContent === want && !x.disabled);
        if (b) { b.classList.add('hinted'); Juice.pop(b, 1); }
      };
      ctx.arena.appendChild(slots); ctx.arena.appendChild(bank); ctx.arena.appendChild(hint);
      const ms = ctx.span(26000, 12000);                       // ease = more time
      ctx.clock(ms, () => { if (!done) { done = true; ctx.done(clamp01(at / word.length * 0.6)); } });
    }
  },

  /* 15. BLIND BUILD — shown briefly, then rebuild from memory. */
  {
    id: 'blind', name: 'Blind Build', bucket: 'mental', verb: 'remember',
    tags: ['smarts'],
    how: 'Study the shape. When it hides, tap the same squares.',
    start(ctx) {
      const N = 16;
      /* Positions to hold in your head. Grows with difficulty but only just —
         nine is already past what most people can keep, so this adds two at most. */
      const count = 5 + Math.round((ctx.hard - 1) * 2) + Math.round((1 - ctx.ease) * 2);
      const shape = new Set();
      while (shape.size < count) shape.add(ri(0, N));
      const grid = h('div', 'cg-grid4');
      const cells = [];
      for (let i = 0; i < N; i++) { const c = h('button', 'cg-cell'); grid.appendChild(c); cells.push(c); }
      const label = h('div', 'cg-warn', 'memorise');
      ctx.arena.appendChild(label); ctx.arena.appendChild(grid);
      shape.forEach(i => cells[i].classList.add('lit'));
      let phase = 'show', picked = new Set(), done = false;
      const lookMs = ctx.span(1500, 1600);                     // ease = longer look
      setTimeout(() => {
        shape.forEach(i => cells[i].classList.remove('lit'));
        phase = 'build'; label.textContent = 'rebuild it'; label.classList.add('hot');
      }, lookMs);
      cells.forEach((c, i) => c.onclick = () => {
        if (phase !== 'build' || done || picked.has(i)) return;
        picked.add(i);
        const right = shape.has(i);
        c.classList.add(right ? 'hit' : 'cold');
        Juice.fx(c, right ? 'small' : 'bad');
        const got = [...picked].filter(x => shape.has(x)).length;
        const wrong = picked.size - got;
        ctx.setScore(clamp01(got / count - wrong * 0.12));
        if (got >= count || wrong >= 3) {
          done = true;
          Juice.fx(grid, got >= count ? 'large' : 'bad', got + '/' + count);
          ctx.done(clamp01(got / count - wrong * 0.15));
        }
      });
      ctx.clock(lookMs + ctx.span(18000), () => {
        if (done) return; done = true;
        const got = [...picked].filter(x => shape.has(x)).length;
        ctx.done(clamp01(got / count * 0.7));
      });
    }
  }
];
