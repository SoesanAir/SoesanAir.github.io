/* ============================================================
   MINIGAMES G — MEMORY, DEDUCTION AND NERVE.

   Two of these read the player's ACTUAL season. Fallen Comrades and Touchy
   Subjects are the two challenges in the real show that cannot be faked with
   generated content: their whole point is that the answers were sitting in
   front of you for thirty days and you either noticed or you did not. Asking
   about an invented cast would make them trivia; asking about YOUR cast makes
   them the only challenges in the game that test whether you have been paying
   attention to your own run.

   Everything they touch is READ-ONLY. Building a question out of somebody's
   trust value must never move it — a challenge that quietly edits the
   relationship graph is a challenge that rewrites the season it is testing.

   Both must also survive having no season at all. The test harness runs
   minigames with whatever state happens to be lying around, and a real season
   can serve these up on day four when nobody has gone home yet. So both build
   an intermediate roster first and only then generate questions from it — the
   roster comes from the real season when there is one and from an invented
   past season when there is not, and the question generators cannot tell the
   difference.
   ============================================================ */

/* An invented previous season, used when the real one cannot answer. Kept
   deliberately unlike the live season — different tribe names, jobs nobody in
   OCCUPATIONS has — so a player never mistakes it for their own cast. */
const CGG_PAST = [
  { n: 'Marla', job: 'ambulance paramedic', tribe: 'Coral' },
  { n: 'Dev', job: 'roofer', tribe: 'Coral' },
  { n: 'Yusuf', job: 'school caretaker', tribe: 'Coral' },
  { n: 'Bree', job: 'wedding photographer', tribe: 'Coral' },
  { n: 'Anton', job: 'harbour pilot', tribe: 'Basalt' },
  { n: 'Priya', job: 'orchestral cellist', tribe: 'Basalt' },
  { n: 'Cole', job: 'long-haul trucker', tribe: 'Basalt' },
  { n: 'Ines', job: 'pastry chef', tribe: 'Basalt' }
];

const CGG_FAKE_TRIBE = ['Rina', 'Ozzie', 'Beatriz', 'Colm', 'Pia', 'Ned', 'Hattie'];

/* Is there a season worth reading? Deliberately paranoid: GAME may not exist
   at all, may exist with an empty cast, or may exist mid-teardown. */
function cggSeason() {
  return (typeof GAME !== 'undefined' && GAME && Array.isArray(GAME.cast) && GAME.cast.length > 0)
    ? GAME : null;
}

/* Everyone who has left, in the order they left.

   eliminatedPreFinal takes the first nine and the jury takes the rest, so the
   two arrays concatenated ARE the running order — and both survive a save and
   reload. The cast sweep at the end is a backstop for anyone the ordered lists
   somehow missed; they land at the end rather than being dropped, because a
   name with an unknown position is still worth asking a job question about. */
function cggFallen(G) {
  const seen = new Set(), out = [];
  const add = c => { if (c && c.name && !seen.has(c.name)) { seen.add(c.name); out.push(c); } };
  (G.eliminatedPreFinal || []).forEach(add);
  (G.jury || []).forEach(add);
  G.cast.filter(c => c && c.eliminated).forEach(add);
  return out;
}

/* The roster Fallen Comrades asks about: name, job, tribe, the last name they
   wrote, and who wrote theirs. `real` is only true when the season could fill
   all four slots for at least four people. */
function cggRoster() {
  const G = cggSeason();
  const fallen = G ? cggFallen(G) : [];
  /* Four is the floor because every question shows four options. Below that a
     real-season quiz would have to pad itself with invented names, which is
     worse than admitting it is a different season. */
  if (!G || fallen.length < 4) {
    const gone = shuffle(CGG_PAST.map(x => Object.assign({}, x)));
    gone.forEach((g, i) => {
      const others = gone.filter(x => x.n !== g.n);
      g.ballot = others[(i + 3) % others.length].n;
      g.killers = [others[(i + 1) % others.length].n, others[(i + 2) % others.length].n];
    });
    return { real: false, gone, here: [] };
  }
  const hist = Array.isArray(G.voteHistory) ? G.voteHistory : [];
  const dn = n => { const c = G.cast.find(x => x.name === n); return c ? c.displayName : n; };
  const gone = fallen.map(c => {
    /* Their last ballot. voteHistory only keeps the last eight councils, so an
       early boot legitimately has none — the generator skips them rather than
       inventing one. */
    let ballot = null;
    for (let i = hist.length - 1; i >= 0 && !ballot; i--) {
      const e = (hist[i].votes || []).find(v => v[0] === c.name);
      if (e) ballot = dn(e[1]);
    }
    const night = hist.find(x => x.eliminated === c.name);
    const killers = night ? (night.votes || []).filter(v => v[1] === c.name).map(v => dn(v[0])) : [];
    return {
      n: c.displayName || c.name,
      job: c.occupation || '',
      /* Their tribe at the moment they left, which is what anyone would
         remember them in. There is no record of a starting tribe once a swap
         has overwritten it, so the question never claims one. */
      tribe: c.tribeName || '',
      ballot, killers
    };
  });
  return { real: true, gone, here: G.cast.filter(c => !c.eliminated).map(c => c.displayName || c.name) };
}

/* Four options with the right answer somewhere in them, or null if there are
   not three distinct wrong answers to be had. Every generator goes through
   this, so no question can ever render with a short or duplicated field. */
function cggOpts(correct, pool) {
  if (!correct) return null;
  const wrong = [];
  for (const x of shuffle(pool.slice())) {
    if (!x || x === correct || wrong.indexOf(x) >= 0) continue;
    wrong.push(x);
    if (wrong.length >= 3) break;
  }
  if (wrong.length < 3) return null;
  const opts = shuffle([correct].concat(wrong));
  return { opts, a: opts.indexOf(correct) };
}

/* The question set. Each takes the roster and returns a question or null when
   the season cannot support it — an early boot with no ballot on record, a
   cast where everyone left from the same tribe. Nothing here throws. */
const CGG_COMRADE_Q = [
  R => {
    const o = cggOpts(R.gone[0].n, R.gone.slice(1).map(g => g.n));
    return o && { q: 'Who was the first to have their torch snuffed?', opts: o.opts, a: o.a };
  },
  R => {
    const last = R.gone[R.gone.length - 1];
    const o = cggOpts(last.n, R.gone.slice(0, -1).map(g => g.n));
    return o && { q: 'Who was the most recent to go home?', opts: o.opts, a: o.a };
  },
  R => {
    const who = pick(R.gone.filter(g => g.job));
    if (!who) return null;
    const o = cggOpts(who.job, R.gone.map(g => g.job));
    return o && { q: `What did ${who.n} do back home?`, opts: o.opts, a: o.a };
  },
  /* The odd-one-out, which is how the real challenge asks about tribes:
     three from one buff and one who never wore it. */
  R => {
    const byTribe = {};
    R.gone.forEach(g => { if (g.tribe) (byTribe[g.tribe] = byTribe[g.tribe] || []).push(g.n); });
    for (const t of shuffle(Object.keys(byTribe))) {
      if (byTribe[t].length < 3) continue;
      const odd = R.gone.filter(g => g.tribe && g.tribe !== t).map(g => g.n);
      if (!odd.length) continue;
      const one = pick(odd);
      const opts = shuffle(shuffle(byTribe[t].slice()).slice(0, 3).concat([one]));
      return { q: `Which of these four never wore the ${t} buff?`, opts, a: opts.indexOf(one) };
    }
    return null;
  },
  R => {
    const who = pick(R.gone.filter(g => g.ballot));
    if (!who) return null;
    const o = cggOpts(who.ballot, R.gone.map(g => g.n).concat(R.here).filter(n => n !== who.n));
    return o && { q: `Whose name did ${who.n} write at their last council?`, opts: o.opts, a: o.a };
  },
  R => {
    const who = pick(R.gone.filter(g => g.killers && g.killers.length));
    if (!who) return null;
    const right = pick(who.killers);
    /* Every other voter from that night is excluded from the wrong pile — a
       distractor who genuinely wrote the name would be marked wrong for
       telling the truth. */
    const pool = R.gone.map(g => g.n).concat(R.here)
      .filter(n => n !== who.n && who.killers.indexOf(n) < 0);
    const o = cggOpts(right, pool);
    return o && { q: `Who wrote ${who.n}'s name down the night they left?`, opts: o.opts, a: o.a };
  }
];

/* The survey Touchy Subjects runs. `k` names a read taken off real game state
   and `hi` says whether the majority answer is the top or the bottom of it. */
const CGG_SURVEY = [
  { q: 'Who is the biggest threat to win this whole thing?', k: 'threat', hi: true },
  { q: 'Who does this tribe trust the least?', k: 'trust', hi: false },
  { q: 'Who is everybody fondest of out here?', k: 'liked', hi: true },
  { q: 'Whose name has been written down the most?', k: 'votes', hi: true },
  { q: 'Who would you least want anchoring a physical challenge?', k: 'muscle', hi: false },
  { q: 'Who is playing the hardest game out here?', k: 'sharp', hi: true },
  { q: 'Who is coasting — doing the least round camp?', k: 'work', hi: false }
];

/* The subjects of the survey, with the six reads the questions sort on.

   All six come off state the player could have watched accumulate: vote
   weights are what the tribe is actually thinking about writing, rel and trust
   are the relationship graph, voteHistory is what was read out at council, and
   workTotal is the camp ledger. Reads only — getVW, getRel and getTrust are
   accessors, and nothing here calls their add* counterparts. */
function cggSubjects() {
  const G = cggSeason();
  if (G) {
    const P = G.player;
    const living = G.cast.filter(c => c && !c.eliminated);
    /* Prefer people who share a camp and a council — surveying a tribe the
       player has never met is not a memory test. But the challenge belongs to
       the late game, and by the final four a tribe-scoped, player-excluded pool
       is three people and four options cannot be filled. So widen twice before
       giving up: to everyone left, then to everyone left INCLUDING the player,
       which at that stage is a fair question anyway — "who is the biggest
       threat" with your own name on the board is the version of this the show
       actually runs at the end. */
    const camp = (G.merged || !P) ? living : living.filter(c => c.tribeName === P.tribeName);
    let raters = camp, subs = camp.filter(c => !c.isPlayer);
    if (subs.length < 4) { raters = living; subs = living.filter(c => !c.isPlayer); }
    if (subs.length < 4) { raters = living; subs = living.slice(); }
    if (subs.length >= 4) {
      const hist = Array.isArray(G.voteHistory) ? G.voteHistory : [];
      const out = subs.map(s => {
        let threat = 0, rel = 0, trust = 0, n = 0;
        for (const r of raters) {
          if (r === s) continue;
          threat += Math.max(0, r.getVW(s.name));
          rel += r.getRel(s.name);
          trust += r.getTrust(s.name);
          n++;
        }
        let votes = 0;
        for (const cn of hist) for (const v of (cn.votes || [])) if (v[1] === s.name) votes++;
        return {
          n: s.displayName || s.name,
          v: {
            threat, votes,
            liked: n ? rel / n : 0.5,
            trust: n ? trust / n : 0.5,
            muscle: s.stats ? s.stats.physicality : 0.5,
            sharp: s.stats ? s.stats.gameAwareness : 0.5,
            work: typeof s.workTotal === 'number' ? s.workTotal : null
          }
        };
      });
      return { real: true, subs: out };
    }
  }
  /* No season, or too few people left to fill four options. An invented tribe
     with invented numbers — the questions and the strikes work identically, so
     the harness exercises the same code the season does. */
  const subs = shuffle(CGG_FAKE_TRIBE.slice()).slice(0, 6).map(n => ({
    n,
    v: {
      threat: rr(0, 4), votes: ri(0, 6), liked: rr(0.15, 0.85), trust: rr(0.15, 0.85),
      muscle: rr(0.1, 0.9), sharp: rr(0.1, 0.9), work: rr(0, 10)
    }
  }));
  return { real: false, subs };
}

/* One survey question: the extreme of a read, plus three people who are
   strictly on the other side of it. Ties are dropped rather than guessed at,
   because a question with two right answers punishes the player for knowing
   the tribe better than the question does. */
function cggSurveyQ(Q, subs) {
  const have = subs.filter(s => typeof s.v[Q.k] === 'number' && isFinite(s.v[Q.k]));
  if (have.length < 4) return null;
  const sorted = have.slice().sort((a, b) => Q.hi ? b.v[Q.k] - a.v[Q.k] : a.v[Q.k] - b.v[Q.k]);
  const top = sorted[0];
  const rest = sorted.slice(1).filter(s => s.v[Q.k] !== top.v[Q.k]);
  if (rest.length < 3) return null;
  const opts = shuffle([top].concat(shuffle(rest.slice()).slice(0, 3))).map(s => s.n);
  return { q: Q.q, opts, a: opts.indexOf(top.n) };
}

const MINIGAMES_G = [

  /* G1. FALLEN COMRADES — the final-stretch classic: questions about the people
     who are already gone.

     The real one is always the same shape. Probst reads a personal detail about
     an eliminated castaway and four names go up, or he reads a name and four
     details go up. It plays as trivia and it is really a test of whether you
     spent thirty days listening to people you had already decided to vote out.

     Ease buys time and, above a threshold, one wrong option struck out before
     you look. It never buys a point: a sharp castaway gets a longer look at the
     same question, not a better answer. */
  {
    id: 'comrades', name: 'Fallen Comrades', bucket: 'mental', verb: 'recall',
    tags: ['gameAwareness', 'relational'],
    how: 'Questions about the castaways who are already gone. One tap each, and the clock is running.',
    forChallenges: ['Tribal Trivia'],
    start(ctx) {
      const R = cggRoster();
      const want = ctx.more(3);
      /* Draw from the generators without repeating a question. Forty attempts
         is far more than enough for four questions and bounds the loop against
         a roster where most generators return null. */
      const qs = [], texts = new Set();
      for (let i = 0; i < 40 && qs.length < want; i++) {
        let q = null;
        try { q = pick(CGG_COMRADE_Q)(R); } catch (e) { q = null; }
        if (!q || texts.has(q.q)) continue;
        texts.add(q.q); qs.push(q);
      }
      const need = Math.max(1, qs.length);

      const note = h('div', 'cgg-note', R.real
        ? 'They are still out here somewhere. Prove you were listening.'
        : 'Nobody has gone home from your season yet — so it is last season\'s lot.');
      const tally = h('div', 'cg-warn', '');
      const qEl = h('div', 'cgg-q', '');
      const fuse = h('div', 'cgg-fuse'); fuse.appendChild(h('i'));
      const col = h('div', 'col cgg-opts');
      ctx.arena.appendChild(note); ctx.arena.appendChild(qEl);
      ctx.arena.appendChild(fuse); ctx.arena.appendChild(tally); ctx.arena.appendChild(col);

      const perQ = ctx.span(7000, 3500);                 // ease = a longer look at each one
      /* Ease also strikes one wrong answer off every question, but only above a
         threshold that difficulty raises. Tuned so that at the shipped
         difficulty only a genuinely sharp castaway clears it, at an easy
         setting most do, and at a hard one nobody does — a freebie every
         castaway gets is not ease, it is just an easier game. */
      const cull = ctx.tol(0.35, 1.2) > 0.5;
      let qi = 0, right = 0, locked = false, done = false, qTimer = null, nextTimer = null;

      const finish = () => {
        if (done) return; done = true;
        clearTimeout(qTimer); clearTimeout(nextTimer); clk.stop();
        const s = clamp01(right / need);
        Juice.fx(qEl, s > 0.66 ? 'large' : s > 0.33 ? 'medium' : 'bad', right + ' of ' + need);
        if (typeof DBG !== 'undefined') {
          DBG.decision('Challenge', 'fallen comrades', { real: R.real, right, asked: need });
        }
        ctx.done(s);
      };

      const answer = (i, el) => {
        if (done || locked) return;
        locked = true; clearTimeout(qTimer);
        const Q = qs[qi];
        if (i === Q.a) { right++; Juice.fx(el, 'small', 'right'); }
        else Juice.fx(el, 'bad', i < 0 ? 'too slow — ' + Q.opts[Q.a] : Q.opts[Q.a]);
        ctx.setScore(clamp01(right / need));
        qi++;
        nextTimer = setTimeout(() => { locked = false; show(); }, 340);
      };

      const show = () => {
        if (done) return;
        if (qi >= qs.length) return finish();
        const Q = qs[qi];
        qEl.textContent = Q.q;
        tally.textContent = `Question ${qi + 1} of ${qs.length} — ${right} right`;
        col.innerHTML = '';
        /* Struck at random among the wrong answers. Taking the FIRST wrong one
           leaks the answer: it would strike slot 0 unless the answer is slot 0,
           in which case it strikes slot 1 — so "slot 1 is crossed out" would
           always mean "the answer is slot 0". */
        const struck = cull ? pick(Q.opts.map((_, i) => i).filter(i => i !== Q.a)) : -1;
        Q.opts.forEach((o, i) => {
          const b = h('button', 'btn cg-b cg-wide cgg-opt', o);
          if (i === struck) { b.disabled = true; b.classList.add('struck'); }
          else b.onclick = () => answer(i, b);
          col.appendChild(b);
        });
        /* The fuse is the telegraph: the question's own clock, separate from the
           header bar, so running out of time is something you watched happen. */
        const bar = fuse.firstChild;
        bar.style.transition = 'none'; bar.style.width = '100%';
        void bar.offsetWidth;
        bar.style.transition = `width ${perQ}ms linear`;
        bar.style.width = '0%';
        clearTimeout(qTimer);
        qTimer = setTimeout(() => answer(-1, qEl), perQ);
      };

      const clk = ctx.clock(perQ * Math.max(1, qs.length) + 1200, finish);
      if (!qs.length) return finish();
      show();
    }
  },

  /* G2. TOUCHY SUBJECTS — name who the tribe named.

     In the real one everybody fills out a survey about each other, then Probst
     reads a question and you guess which name came up most. Get it wrong and
     you take a strike; three and you are out of it.

     The whole challenge is a bet that you know your tribe. So where the season
     can answer the question honestly, it does: the majority answer is taken off
     vote weights, the relationship graph, the ballot history and the camp
     ledger rather than rolled. Reading them is exactly the information a player
     who talks to everybody already has.

     Ease buys a hint that strikes one wrong name off the board. Not a point. */
  {
    id: 'touchy', name: 'Touchy Subjects', bucket: 'mental', verb: 'predict',
    tags: ['social', 'relational', 'gameAwareness'],
    how: 'Name who the tribe MOSTLY named. Three strikes and you are out of it.',
    forChallenges: ['Jury Reads'],
    start(ctx) {
      const T = cggSubjects();
      const want = ctx.more(3);
      const qs = [];
      for (const Q of shuffle(CGG_SURVEY.slice())) {
        if (qs.length >= want) break;
        const built = cggSurveyQ(Q, T.subs);
        if (built) qs.push(built);
      }
      const need = Math.max(1, qs.length);

      const note = h('div', 'cgg-note', T.real
        ? 'Everyone filled out the same survey. Guess the name that came up most.'
        : 'A tribe you never met filled out the survey. Read them anyway.');
      const qEl = h('div', 'cgg-q', '');
      const strikeRow = h('div', 'cgg-strikes');
      const pips = [];
      for (let i = 0; i < 3; i++) { const p = h('span', 'cgg-strike', '✕'); strikeRow.appendChild(p); pips.push(p); }
      const tally = h('div', 'cg-warn', '');
      const col = h('div', 'col cgg-opts');
      /* A count you are GIVEN, so it goes through tol: bigger is easier and
         difficulty divides it away. Typically nought or one, two only for a
         very strong castaway on a soft setting. */
      let hints = Math.max(0, Math.round(ctx.tol(0.4, 3.0)));
      const hintB = h('button', 'btn cg-b sand', 'HINT (' + hints + ')');
      ctx.arena.appendChild(note); ctx.arena.appendChild(qEl); ctx.arena.appendChild(strikeRow);
      ctx.arena.appendChild(tally); ctx.arena.appendChild(col); ctx.arena.appendChild(hintB);

      let qi = 0, right = 0, strikes = 0, locked = false, done = false, nextTimer = null;

      const finish = why => {
        if (done) return; done = true;
        clearTimeout(nextTimer); clk.stop();
        const s = clamp01(right / need);
        Juice.fx(qEl, s > 0.66 ? 'large' : s > 0.33 ? 'medium' : 'bad', why);
        if (typeof DBG !== 'undefined') {
          DBG.decision('Challenge', 'touchy subjects', { real: T.real, right, strikes, asked: need });
        }
        ctx.done(s);
      };

      const answer = (i, el) => {
        if (done || locked) return;
        locked = true;
        const Q = qs[qi];
        if (i === Q.a) {
          right++;
          Juice.fx(el, 'medium', 'THE TRIBE AGREES');
        } else {
          strikes++;
          pips[strikes - 1].classList.add('out');
          Juice.fx(el, 'bad', 'they said ' + Q.opts[Q.a]);
          ctx.hitstop(70);
        }
        ctx.setScore(clamp01(right / need));
        qi++;
        nextTimer = setTimeout(() => {
          locked = false;
          if (strikes >= 3) return finish('THREE STRIKES');
          show();
        }, 420);
      };

      const show = () => {
        if (done) return;
        if (qi >= qs.length) return finish(right + ' of ' + need);
        const Q = qs[qi];
        qEl.textContent = Q.q;
        tally.textContent = `${right} right · ${3 - strikes} strike${3 - strikes === 1 ? '' : 's'} left`;
        col.innerHTML = '';
        Q.opts.forEach((o, i) => {
          const b = h('button', 'btn cg-b cg-wide cgg-opt', o);
          b.onclick = () => answer(i, b);
          col.appendChild(b);
        });
        hintB.disabled = hints <= 0;
      };

      hintB.onclick = () => {
        if (done || locked || hints <= 0) return;
        const Q = qs[qi];
        const live = [...col.children].filter((b, i) => !b.disabled && i !== Q.a);
        if (!live.length) return;
        hints--;
        const b = pick(live);
        b.disabled = true; b.classList.add('struck');
        hintB.textContent = 'HINT (' + hints + ')';
        hintB.disabled = hints <= 0;
        Juice.fx(b, 'small', 'not them');
      };

      const clk = ctx.clock(ctx.span(30000, 9000), () => finish('TIME'));
      if (!qs.length) return finish('no survey');
      show();
    }
  },

  /* G3. TOWER SHUFFLE — Towers of Hanoi, the puzzle finisher Survivor keeps
     coming back to. Move the stack to the far post, one ring at a time, never a
     bigger ring onto a smaller one.

     Every illegal move says WHY. An unexplained rejection reads as a bug, and a
     player who thinks the game is broken stops trying to solve it — which on a
     rule the puzzle never stated is a fair conclusion.

     The apparatus is sized by ctx.more rather than growing mid-round: a
     single-solve puzzle cannot escalate inside a run without throwing away the
     work already done. Three rings is a warm-up, five under a clock is a real
     puzzle, and it is capped there because 2^n-1 gets silly fast. */
  {
    id: 'hanoi', name: 'Tower Shuffle', bucket: 'mental', verb: 'solve',
    tags: ['smarts'],
    how: 'Tap a post to lift its top ring, tap another to drop it. Never a big ring on a small one.',
    start(ctx) {
      const N = Math.max(3, Math.min(5, ctx.more(3)));
      const posts = [[], [], []];
      for (let s = N; s >= 1; s--) posts[0].push(s);          // bottom of the array is the bottom of the stack
      const optimum = Math.pow(2, N) - 1;
      /* Moves you may spend before the efficiency bonus starts decaying. Ease
         buys a longer leash, not a higher ceiling. */
      const allow = optimum + Math.max(1, Math.round(ctx.tol(3, 9)));

      const head = h('div', 'cg-warn', `${N} rings · ${optimum} moves is perfect`);
      const rig = h('div', 'cgg-posts');
      const cols = [];
      for (let i = 0; i < 3; i++) {
        const p = h('button', 'cgg-post');
        p.appendChild(h('span', 'cgg-spine'));
        const stack = h('span', 'cgg-rings');
        p.appendChild(stack);
        p.appendChild(h('span', 'cgg-base-label', i === 2 ? 'FINISH' : i === 0 ? 'START' : ''));
        rig.appendChild(p);
        cols.push({ btn: p, stack });
      }
      const why = h('div', 'cg-warn', 'Move the stack to the right-hand post.');
      const handRow = h('div', 'cgg-hand');
      const handLbl = h('span', 'cgg-hand-lbl', 'empty hands');
      handRow.appendChild(handLbl);
      ctx.arena.appendChild(head); ctx.arena.appendChild(rig);
      ctx.arena.appendChild(handRow); ctx.arena.appendChild(why);

      let held = null, from = -1, moves = 0, live = true;

      /* How much of the finished tower is actually built: rings seated on the
         far post in the right order, counted up from the bottom. Anything above
         a wrong ring does not count, because it will have to come off. */
      const built = () => {
        const p = posts[2];
        let k = 0;
        while (k < p.length && p[k] === N - k) k++;
        return k;
      };
      const eff = () => clamp01(1 - Math.max(0, moves - allow) / allow);
      const value = () => {
        const prog = built() / N;
        return clamp01(prog * (0.78 + 0.22 * eff()));
      };

      const paint = () => {
        posts.forEach((p, i) => {
          cols[i].stack.innerHTML = '';
          p.forEach(size => {
            const r = h('span', 'cgg-ring');
            r.style.width = (34 + (size / N) * 60) + '%';
            cols[i].stack.appendChild(r);
          });
          cols[i].btn.classList.toggle('picked', from === i && held !== null);
        });
        if (held !== null) {
          handLbl.textContent = 'holding ring ' + held + ' of ' + N;
          handRow.classList.add('full');
        } else {
          handLbl.textContent = 'empty hands';
          handRow.classList.remove('full');
        }
        head.textContent = `${moves} move${moves === 1 ? '' : 's'} · ${optimum} is perfect · ${built()}/${N} placed`;
        ctx.setScore(value());
      };

      const finish = solved => {
        if (!live) return; live = false; clk.stop();
        Juice.fx(rig, solved ? 'large' : built() ? 'medium' : 'bad',
          solved ? 'TOWER BUILT' : built() + '/' + N);
        ctx.done(value());
      };

      cols.forEach((c, i) => c.btn.onclick = () => {
        if (!live) return;
        if (held === null) {
          if (!posts[i].length) {
            why.textContent = 'That post is empty — there is nothing on it to lift.';
            why.classList.add('hot');
            Juice.fx(c.btn, 'bad');
            return;
          }
          held = posts[i].pop(); from = i;
          why.textContent = 'Now tap the post you want it on.';
          why.classList.remove('hot');
          Juice.pop(c.btn, 0.5);
          return paint();
        }
        if (i === from) {
          posts[i].push(held); held = null; from = -1;
          why.textContent = 'Put it back.';
          why.classList.remove('hot');
          return paint();
        }
        const top = posts[i][posts[i].length - 1];
        if (top !== undefined && top < held) {
          why.textContent = `Ring ${held} is bigger than ring ${top}. It will not sit on top of it.`;
          why.classList.add('hot');
          Juice.fx(c.btn, 'bad');
          ctx.hitstop(60);
          return;
        }
        posts[i].push(held); held = null; from = -1; moves++;
        why.textContent = moves > allow ? 'Slow going. Finish it anyway.' : 'Good.';
        why.classList.remove('hot');
        Juice.fx(c.btn, 'small');
        paint();
        if (posts[2].length === N) return finish(true);
      });

      const clk = ctx.clock(ctx.span(34000, 12000), () => finish(false));
      paint();
    }
  },

  /* G4. TRIBAL TILES — the recurring symbol-grid puzzle: fill the board so no
     row and no column repeats a symbol. A Latin square with the corners
     knocked off.

     The puzzle is BUILT FROM A SOLUTION, never rolled and hoped over. Start
     with shifted rows, which is a valid square by construction, then permute
     the rows, the columns and the symbol labels — all three operations preserve
     the property — and finally take cells away. There is always at least one
     completion, because the one it was cut from is still a completion.

     Conflicts light up the instant they appear. Without that the player is
     doing constraint propagation in their head against a twenty-second clock,
     which is not a challenge, it is homework. */
  {
    id: 'latin', name: 'Tribal Tiles', bucket: 'mental', verb: 'arrange',
    tags: ['smarts'],
    how: 'No symbol twice in any row or column. Tap a tile to cycle it, or tap a tile then a symbol.',
    start(ctx) {
      const S = 4, SYM = ['▲', '●', '■', '✦'];
      const label = shuffle([0, 1, 2, 3]);
      let sol = [];
      for (let r = 0; r < S; r++) {
        const row = [];
        for (let c = 0; c < S; c++) row.push(label[(c + r) % S]);
        sol.push(row);
      }
      sol = shuffle(sol);
      const cord = shuffle([0, 1, 2, 3]);
      sol = sol.map(row => cord.map(c => row[c]));

      /* Ease is spent entirely here: a bigger head start, never a kinder score.
         Which is why the score below counts only the cells the PLAYER filled —
         handing out givens would otherwise hand out points with them. */
      /* Capped at ten of sixteen: past that the grid is more given than puzzle,
         which is where a soft difficulty setting was landing it. */
      const givens = Math.max(4, Math.min(10, Math.round(ctx.tol(9, 14))));
      const fixed = new Set();
      const order = shuffle(Array.from({ length: S * S }, (_, i) => i));
      for (let i = 0; i < givens; i++) fixed.add(order[i]);
      const blanks = Math.max(1, S * S - fixed.size);

      const cur = [];
      for (let i = 0; i < S * S; i++) cur.push(fixed.has(i) ? sol[Math.floor(i / S)][i % S] : -1);

      const grid = h('div', 'cg-grid4 cgg-latin');
      const cells = [];
      for (let i = 0; i < S * S; i++) {
        const c = h('button', 'cg-cell cgg-cell');
        if (fixed.has(i)) c.classList.add('cgg-given');
        grid.appendChild(c); cells.push(c);
      }
      const tray = h('div', 'cgg-tray');
      const status = h('div', 'cg-warn', 'No repeats in any row or column.');
      ctx.arena.appendChild(status); ctx.arena.appendChild(grid); ctx.arena.appendChild(tray);

      let sel = -1, live = true;

      /* A filled cell clashes if anything else in its row or column shares its
         symbol. On a full 4x4 with four symbols, "nothing clashes" IS a Latin
         square, so this doubles as the win condition and as the score — and it
         credits any valid completion, not only the one the puzzle was cut from. */
      const clashing = i => {
        const v = cur[i];
        if (v < 0) return false;
        const r = Math.floor(i / S), c = i % S;
        for (let k = 0; k < S; k++) {
          if (k !== c && cur[r * S + k] === v) return true;
          if (k !== r && cur[k * S + c] === v) return true;
        }
        return false;
      };
      const scored = () => {
        let n = 0;
        for (let i = 0; i < S * S; i++) if (!fixed.has(i) && cur[i] >= 0 && !clashing(i)) n++;
        return n;
      };

      const paint = () => {
        let bad = 0, filled = 0;
        for (let i = 0; i < S * S; i++) {
          const el = cells[i];
          el.textContent = cur[i] >= 0 ? SYM[cur[i]] : '';
          const cl = clashing(i);
          el.classList.toggle('cgg-clash', cl);
          el.classList.toggle('cgg-sel', i === sel);
          if (cl) bad++;
          if (cur[i] >= 0) filled++;
        }
        const got = scored();
        ctx.setScore(clamp01(got / blanks));
        status.textContent = bad ? bad + ' tile' + (bad === 1 ? '' : 's') + ' clashing'
          : filled === S * S ? 'clean board' : (S * S - filled) + ' still empty';
        status.classList.toggle('hot', bad > 0);
        return { bad, filled };
      };

      const finish = solved => {
        if (!live) return; live = false; clk.stop();
        Juice.fx(grid, solved ? 'large' : scored() ? 'medium' : 'bad',
          solved ? 'CLEAN GRID' : scored() + '/' + blanks);
        ctx.done(clamp01(scored() / blanks));
      };

      const set = (i, v) => {
        if (!live || fixed.has(i)) return;
        cur[i] = v;
        const st = paint();
        if (st.filled === S * S && st.bad === 0) return finish(true);
      };

      cells.forEach((el, i) => el.onclick = () => {
        if (!live) return;
        if (fixed.has(i)) {
          status.textContent = 'That one was already laid out for you.';
          Juice.fx(el, 'bad');
          return;
        }
        sel = i;
        /* Tapping cycles, which makes the grid playable on its own; the tray
           below is the faster way in once you know what you want. */
        set(i, cur[i] >= S - 1 ? -1 : cur[i] + 1);
        Juice.pop(el, 0.4);
      });

      SYM.forEach((s, v) => {
        const b = h('button', 'cgg-sym', s);
        b.onclick = () => {
          if (!live) return;
          if (sel < 0) { status.textContent = 'Pick a tile first.'; Juice.fx(b, 'bad'); return; }
          set(sel, v);
          Juice.fx(cells[sel], 'small');
        };
        tray.appendChild(b);
      });
      const clr = h('button', 'cgg-sym cgg-clear', '×');
      clr.onclick = () => { if (live && sel >= 0) { set(sel, -1); Juice.pop(cells[sel], 0.4); } };
      tray.appendChild(clr);

      const clk = ctx.clock(ctx.span(34000), () => finish(false));
      paint();
    }
  },

  /* G5. ISLAND DELICACIES — the gross-food challenge, individual format: last
     to finish each dish is out, and every course is worse than the last.

     HOLD to keep swallowing. Revulsion climbs while you hold and falls when you
     stop, and letting it max out means you gag: most of the plate comes back
     and you lose a second you did not have.

     So the verb is PACING, which is a genuinely different thing to ask than the
     other nerve games do — Hold Your Nerve and the auction are both push-luck
     against a hidden number. This one has no hidden number at all. The meter is
     right there; the difficulty is that stopping costs you the clock and not
     stopping costs you the plate.

     Escalation is pattern 3, the environmental ramp: the dishes get worse. The
     revulsion multiplier more than doubles across the courses, so the burst you
     could get away with on the breadfruit will empty your stomach on the last
     plate. */
  {
    id: 'gross', name: 'Island Delicacies', bucket: 'nerve', verb: 'stomach',
    tags: ['emotional'],
    how: 'HOLD to swallow. Back off before the revulsion meter tops out — gag and you lose the plate.',
    start(ctx) {
      const COURSES = [
        { n: 'Fermented breadfruit paste', mult: 1.00 },
        { n: 'Raw sea cucumber', mult: 1.28 },
        { n: 'Coconut grubs, still moving', mult: 1.62 },
        { n: 'Boiled pig snout', mult: 2.00 },
        { n: 'Fish eyes in brine', mult: 2.45 }
      ];
      const need = Math.min(COURSES.length, ctx.more(3));

      const dishEl = h('div', 'cgg-dish', '');
      const courseEl = h('div', 'cgg-course', '');
      const plate = h('div', 'cgg-plate'); plate.appendChild(h('i'));
      const gutLbl = h('div', 'cg-warn', 'revulsion');
      const gut = h('div', 'cgg-gut'); gut.appendChild(h('i'));
      const B = h('button', 'btn cg-b primary cg-wide', 'HOLD TO SWALLOW');
      ctx.arena.appendChild(courseEl); ctx.arena.appendChild(dishEl);
      ctx.arena.appendChild(plate); ctx.arena.appendChild(gut);
      ctx.arena.appendChild(gutLbl); ctx.arena.appendChild(B);

      /* Swallowing speed is something you are GIVEN, so it goes through tol and
         difficulty divides it. Revulsion is done TO you, so it goes through
         rate — and that is the one ease is spent on: a stronger stomach, not a
         bigger plate and not a point. */
      const bite = ctx.tol(1.25, 0.35);            // plate per second while holding
      const climb = ctx.rate(0.55, 0.24);          // revulsion per second, before the course
      const settle = ctx.tol(1.35, 0.7);           // revulsion shed per second when you stop

      let dish = 0, eaten = 0, rev = 0, cleared = 0, live = true;
      let held = false, holdMs = 0, gagUntil = 0;
      let last = performance.now();

      const cur = () => COURSES[Math.min(dish, COURSES.length - 1)];

      const paint = () => {
        courseEl.textContent = `Course ${Math.min(dish + 1, COURSES.length)} of ${COURSES.length} · ${cleared} down, ${need} to clear`;
        dishEl.textContent = cur().n;
      };

      const finish = won => {
        if (!live) return; live = false; clk.stop();
        held = false;
        Juice.fx(dishEl, won ? 'large' : cleared ? 'medium' : 'bad',
          cleared + ' plate' + (cleared === 1 ? '' : 's') + ' clean');
        ctx.done(clamp01(cleared / need));
      };

      const gag = () => {
        /* Most of the plate comes back and you are still queasy when you
           recover, so a gag costs the burst you were part-way through as well
           as the second of clock. */
        eaten *= 0.30; rev = 0.45;
        gagUntil = performance.now() + 900;
        held = false; B.classList.remove('sand');
        Juice.fx(plate, 'bad', 'YOU GAGGED');
        ctx.hitstop(90);
      };

      const clearDish = () => {
        cleared++;
        ctx.setScore(clamp01(cleared / need));
        Juice.fx(plate, cleared >= need ? 'large' : 'medium', 'PLATE CLEAN');
        if (cleared >= need) return finish(true);
        dish++;
        if (dish >= COURSES.length) return finish(false);
        eaten = 0;
        rev = Math.min(rev, 0.35);                 // you carry the last course into this one
        paint();
      };

      const step = now => {
        if (!live) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        const gagging = now < gagUntil;
        if (held && !gagging) {
          holdMs += dt * 1000;
          eaten += bite * dt;
          rev += climb * cur().mult * dt;
        } else {
          rev -= settle * dt;
        }
        rev = Math.max(0, rev);
        plate.firstChild.style.width = Math.min(100, eaten * 100) + '%';
        gut.firstChild.style.width = Math.min(100, rev * 100) + '%';
        gut.classList.toggle('hot', rev > 0.72);
        gutLbl.textContent = gagging ? 'you are gagging — wait it out'
          : rev > 0.86 ? 'IT IS COMING BACK UP'
            : rev > 0.6 ? 'back off, back off' : 'revulsion';
        gutLbl.classList.toggle('hot', rev > 0.72 || gagging);
        if (rev > 0.86 && held) Juice.shake(dt * 0.5);
        if (rev >= 1) gag();
        else if (eaten >= 1) clearDish();
        if (!live) return;
        requestAnimationFrame(step);
      };

      const grip = on => {
        if (!live) return;
        if (on) { holdMs = 0; if (performance.now() < gagUntil) return; }
        held = on;
        B.classList.toggle('sand', on);
        B.textContent = on ? 'SWALLOWING...' : 'HOLD TO SWALLOW';
      };
      B.addEventListener('pointerdown', () => grip(true));
      B.addEventListener('pointerup', () => grip(false));
      B.addEventListener('pointerleave', () => grip(false));
      B.addEventListener('pointercancel', () => grip(false));
      /* A bare click is one bite. Automated harnesses click synthetically and
         never hold, and a game that only responds to a press-and-hold would sit
         there for the full clock rather than being played. holdMs guards
         against paying twice for a real hold that also fired a click. */
      B.addEventListener('click', () => {
        if (!live || holdMs > 130 || performance.now() < gagUntil) return;
        eaten += bite * 0.22;
        rev += climb * cur().mult * 0.26;
        Juice.pop(B, 0.35);
        if (rev >= 1) gag();
        else if (eaten >= 1) clearDish();
      });

      /* Playing the meter perfectly clears the four courses in a bit over twelve
         seconds at the shipped difficulty, so the clock leaves a few seconds of
         slack for the fact that nobody reacts perfectly. Ease is not spent here
         — a stronger stomach is the whole of it. */
      const clk = ctx.clock(ctx.span(30000), () => finish(false));
      paint();
      requestAnimationFrame(step);
    }
  }
];
