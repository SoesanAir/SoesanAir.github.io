/* Does the same castaway win every challenge?

   Reported: "there is an immediate winner in each tribe that's ruling the
   challenge completely."

   The log backs it up. One post-merge round:

     Yolanda 1.12 · Floopy 0.82 · Betty 0.44 · David 0.28 · Alexis 0.22

   WHAT THIS ACTUALLY TURNED OUT TO BE. The first run of this probe refuted the
   obvious reading. The winner's identity already varied correctly — 5.8 different
   winners across 8 challenges, top castaway taking 30%, which is the show's own
   shape. Nobody was ruling anything.

   What was true is that the PLAYER had no lever. An average castaway playing the
   minigame FLAWLESSLY won 11% of an 11-strong field; random is 9%. Every challenge
   was decided by somebody else no matter what you did, and that is what "ruling the
   challenge completely" feels like from the player's chair. Two causes:

     - the player got no form roll at all, while every NPC drew +/-0.51. A fixed
       number trying to clear the maximum of ten dice makes the win curve a step:
       at skillSpan 0.40 flawless won 31%, at 0.50 it won 61%, and playing WELL but
       not perfectly won 3-5% at every single setting. No reward for improving.
     - the dice were ~2.5x the whole stat spread, so nothing legible decided
       anything and no result was explicable afterwards.

   Fixed by giving the player the same form band as everyone else, replacing most of
   the raw dice with per-castaway aptitude by challenge format, and re-deriving the
   two levers jointly in tools/chal-grid.js.

   (A suspicion worth recording as REFUTED: npcFormSwing scales down with ability,
   so the strong are steadier, and that looked like it should compound into
   dominance. The measurements say otherwise — distinct winners and top share are
   both healthy. Left alone rather than "fixed" on theory.)

   WHAT GOOD LOOKS LIKE, from the show. Across a post-merge run of eight or nine
   individual immunities, a real season produces roughly five different winners.
   Challenge beasts exist — Ozzy, Joe — and they win two or three, occasionally
   four. Nobody wins them all, and the reason is that the formats differ: the
   swimmer does not win the puzzle, and the puzzle-solver does not win the endurance
   hang.

   So the targets this measures against:

     distinct winners over 8 challenges   >= 4.0 mean      (real: about 5)
     best castaway's share of wins        <= 45%           (real: 25-40%)
     a season where one person wins 6+    rare, under 10%

   Run: node tools/chal-fair.js */
const http = require('http'), { spawn } = require('child_process'), os = require('os'), path = require('path');
const WebSocket = require('ws');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const RUN_ID = process.pid.toString(36) + Math.floor(Math.random() * 1e6).toString(36);
const PORT = 9200 + Math.floor(Math.random() * 2000);
const NL = String.fromCharCode(10);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = p => new Promise((s, j) => http.get({ host: '127.0.0.1', port: PORT, path: p }, r => {
  let d = ''; r.on('data', c => d += c); r.on('end', () => s(JSON.parse(d)));
}).on('error', j));

(async () => {
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT,
    '--no-first-run', '--window-size=900,430',
    '--user-data-dir=' + path.join(os.tmpdir(), 'cw-fair-' + RUN_ID),
    'http://localhost:8099/index.html?no3d=1'], { stdio: 'ignore' });
  let t = null;
  for (let i = 0; i < 40 && !t; i++) {
    await sleep(400);
    try { t = (await get('/json/list')).find(x => x.type === 'page' && x.url.includes('index.html')); } catch { }
  }
  if (!t) { console.log('no page'); process.exit(1); }
  const ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false });
  let id = 0; const pend = new Map();
  ws.on('message', m => { const j = JSON.parse(m); if (j.id && pend.has(j.id)) { pend.get(j.id)(j); pend.delete(j.id); } });
  await new Promise(r => ws.on('open', r));
  const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error('threw: ' + ((r.result.exceptionDetails.exception || {}).description || '').split(NL)[0]);
    return r.result.result.value;
  };
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  const waitFor = async s => {
    for (let i = 0; i < 100; i++) { if (await ev('!!document.querySelector(' + JSON.stringify(s) + ')')) return; await sleep(250); }
    throw new Error('no ' + s);
  };
  const fails = [];
  const check = (n, ok, d) => { console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + n + (d ? '  — ' + d : '')); if (!ok) fails.push(n); };

  await waitFor('#screen-title.active');
  await ev('localStorage.clear()');
  await send('Page.reload', { ignoreCache: true });
  await waitFor('#screen-title.active'); await sleep(300);
  await ev("document.getElementById('btn-new-game').click()");
  await waitFor('#screen-create.active');
  await ev("GAME.fastMaroon=true;GAME.fastChallenge=true;document.getElementById('btn-create-go').click()");
  for (let i = 0; i < 400; i++) {
    if (await ev("!!document.querySelector('#screen-camp.active')")) break;
    await ev("(()=>{const b=document.querySelector('#maroon-choices button')||document.querySelector('.maroon-next');if(b&&!b.disabled)b.click();})()");
    await sleep(120);
  }
  await waitFor('#screen-camp.active');
  await ev('DBG.setEnabled(false); window.toast=()=>{}; Telemetry.cfg.auto=false; true;');

  const r = await ev(`(() => {
    const SEASONS = 300, ROUNDS = 8, FIELD = 11;
    /* A fresh field of castaways per season, so this measures the SYSTEM and not
       one lucky roster — the same discipline camp-test.js uses. */
    const distinct = [], topShare = [], runaway = [];
    const catWins = {};
    for (let s = 0; s < SEASONS; s++) {
      const field = [];
      for (let i = 0; i < FIELD; i++) {
        const c = Generator.generateCastaway();
        c.hunger = 0.5; c.fatigue = 0.5; c.morale = 0.65;
        if (typeof Fire !== 'undefined') Fire.seed([c]);
        field.push(c);
      }
      /* Eight different challenges, drawn the way a season draws them. */
      const pool = CHALLENGES.filter(c => !c.finalFourOnly && !c.rewardOnly && !c.fire);
      const wins = {};
      for (let k = 0; k < ROUNDS; k++) {
        const chal = pool[(s * 7 + k * 13) % pool.length];
        let best = null, bs = -Infinity;
        for (const c of field) {
          const sc = Challenges.score(c, chal);
          if (sc > bs) { bs = sc; best = c; }
        }
        wins[best.name] = (wins[best.name] || 0) + 1;
        catWins[chal.cat] = catWins[chal.cat] || {};
      }
      const counts = Object.values(wins);
      distinct.push(counts.length);
      const top = Math.max(...counts);
      topShare.push(top / ROUNDS);
      runaway.push(top >= 6 ? 1 : 0);
    }
    /* ---- the OTHER half of "ruling the challenge completely" ----
       The identity of the winner already varies. What the player actually sees on
       the tribe rails is the MARGIN, and a field of 1.12 / 0.82 / 0.44 / 0.28 /
       0.22 reads as a runaway even when a different person tops it next time.

       And the player's own stake: if a flawless minigame cannot beat a strong
       castaway's ordinary day, the minigame is decoration. Measured directly. */
    const gaps = [], spreads = [];
    let playerWins = 0, playerRounds = 0;
    for (let s = 0; s < 200; s++) {
      const field = [];
      for (let i = 0; i < FIELD; i++) {
        const c = Generator.generateCastaway();
        c.hunger = 0.5; c.fatigue = 0.5; c.morale = 0.65;
        if (typeof Fire !== 'undefined') Fire.seed([c]);
        field.push(c);
      }
      /* An exactly-average player who plays the minigame flawlessly. */
      const me = Generator.generateCastaway();
      for (const k of STAT_KEYS) me.stats[k] = 0.5;
      me.isPlayer = true; me.hunger = 0.5; me.fatigue = 0.5; me.morale = 0.65;
      if (typeof Fire !== 'undefined') Fire.seed([me]);
      const pool = CHALLENGES.filter(c => !c.finalFourOnly && !c.rewardOnly && !c.fire);
      for (let k = 0; k < ROUNDS; k++) {
        const chal = pool[(s * 5 + k * 11) % pool.length];
        const scores = field.map(c => Challenges.score(c, chal)).sort((a, b) => b - a);
        gaps.push(scores[0] - scores[1]);
        spreads.push(scores[0] - scores[scores.length - 1]);
        const wasPerf = GAME.playerPerf;
        GAME.playerPerf = 1.0;
        const mine = Challenges.score(me, chal);
        GAME.playerPerf = wasPerf;
        playerRounds++;
        if (mine > scores[0]) playerWins++;
      }
    }

    /* ---- the thing that cutting the dice could plausibly break ----
       Pre-merge, a tribe score is an AVERAGE, and averaging eleven people already
       cancels most of the individual noise. Take the dice down further and the
       stronger tribe starts winning every single week, which is a death spiral: the
       losing tribe keeps voting people out, gets weaker, and loses harder. Real
       seasons have 6-2 drubbings but they also have tribes that trade wins.

       Measured as: how often does one tribe lose FIVE OR MORE of six pre-merge
       challenges. Some lopsided seasons are good drama; most seasons being lopsided
       is a broken pre-merge. */
    let lopsided = 0, strongerWon = 0, tribalRounds = 0;
    for (let s = 0; s < 200; s++) {
      const mk = () => {
        const t = [];
        for (let i = 0; i < 9; i++) {
          const c = Generator.generateCastaway();
          c.hunger = 0.5; c.fatigue = 0.5; c.morale = 0.65;
          if (typeof Fire !== 'undefined') Fire.seed([c]);
          t.push(c);
        }
        return t;
      };
      const A = mk(), B = mk();
      const pool = CHALLENGES.filter(c => !c.finalFourOnly && !c.rewardOnly && !c.fire);
      /* "Stronger on paper" has to mean stronger AT THIS CHALLENGE, weighted the way
         the challenge weights it. Summing all seven stats instead gives ~50%, which
         reads as "stats do not matter" when the truth is that a tribe of talkers
         really should lose the swimming. */
      const paper = (t, chal) => t.reduce((x, c) =>
        x + STAT_KEYS.reduce((y, k, i) => y + c.stats[k] * chal.w[i], 0), 0) / t.length;
      let aWins = 0;
      for (let k = 0; k < 6; k++) {
        const chal = pool[(s * 3 + k * 17) % pool.length];
        const aStrong = paper(A, chal) >= paper(B, chal);
        const r = Challenges.runTribal(chal, A, B);
        if (r === 'A') aWins++;
        tribalRounds++;
        if ((r === 'A') === aStrong) strongerWon++;
      }
      if (aWins >= 5 || aWins <= 1) lopsided++;
    }

    const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
    /* Distribution of "how many did the best person win", which is the shape that
       actually matters — a mean hides a bimodal disaster. */
    const hist = {};
    for (const s of topShare) { const n = Math.round(s * 8); hist[n] = (hist[n] || 0) + 1; }
    return {
      seasons: SEASONS, rounds: ROUNDS,
      distinct: +mean(distinct).toFixed(2),
      topShare: +mean(topShare).toFixed(3),
      runaway: +mean(runaway).toFixed(3),
      hist,
      gap: +mean(gaps).toFixed(3),
      spread: +mean(spreads).toFixed(3),
      gapFrac: +(mean(gaps) / mean(spreads)).toFixed(3),
      playerWin: +(playerWins / playerRounds).toFixed(3),
      lopsided: +(lopsided / 200).toFixed(3),
      strongerWon: +(strongerWon / tribalRounds).toFixed(3)
    };
  })()`);

  console.log(NL + r.seasons + ' seasons x ' + r.rounds + ' individual challenges, fresh field each time');
  console.log('  distinct winners per season : ' + r.distinct + '   (target >= 4.0, real show about 5)');
  console.log('  best castaway wins          : ' + (r.topShare * 100).toFixed(0) + '%'
    + '   (target <= 45%, real show 25-40%)');
  console.log('  seasons where one wins 6+   : ' + (r.runaway * 100).toFixed(1) + '%   (target < 10%)');
  console.log(NL + '  how many the best person won:');
  for (let n = 1; n <= 8; n++) {
    const c = r.hist[n] || 0;
    const bar = '#'.repeat(Math.round(c / r.seasons * 40));
    console.log('    ' + n + ' of 8  ' + String(c).padStart(4) + '  ' + bar);
  }

  console.log(NL + '  within a single challenge — what the rails actually show:');
  console.log('    1st to 2nd gap  : ' + r.gap);
  console.log('    1st to last     : ' + r.spread);
  console.log('    gap as share of the whole field : ' + (r.gapFrac * 100).toFixed(0) + '%'
    + '   (a blowout above ~25%)');
  console.log('    average player, flawless minigame, beats the field: '
    + (r.playerWin * 100).toFixed(0) + '%   (target 35-55%)');

  console.log(NL + '  pre-merge, where scores are tribe averages:');
  console.log('    the stronger tribe on paper wins : ' + (r.strongerWon * 100).toFixed(0) + '%'
    + '   (want 55-75% — paper should tell, not decide)');
  console.log('    seasons decided 5-1 or worse     : ' + (r.lopsided * 100).toFixed(0) + '%'
    + '   (want under 35% — some drubbings, not mostly)');

  console.log('');
  check('challenges produce a spread of winners, not one beast',
    r.distinct >= 4.0, r.distinct + ' distinct of ' + r.rounds);
  check('nobody owns the season', r.topShare <= 0.45, (r.topShare * 100).toFixed(0) + '%');
  check('a total runaway is rare', r.runaway < 0.10, (r.runaway * 100).toFixed(1) + '%');
  check('playing the minigame well is the biggest lever the player has',
    r.playerWin >= 0.35 && r.playerWin <= 0.55, 'flawless wins ' + (r.playerWin * 100).toFixed(0) + '%');
  check('one castaway does not visibly run away with a single challenge',
    r.gapFrac <= 0.22, '1st-to-2nd is ' + (r.gapFrac * 100).toFixed(0) + '% of the field');
  check('the pre-merge is not a death spiral',
    r.lopsided < 0.35 && r.strongerWon <= 0.75,
    (r.lopsided * 100).toFixed(0) + '% lopsided, paper wins ' + (r.strongerWon * 100).toFixed(0) + '%');

  const ok = !fails.length;
  if (fails.length) console.log(NL + 'failing checks: ' + fails.join(', '));
  console.log(ok ? NL + 'CHALLENGE FAIRNESS PASS' : NL + 'CHALLENGE FAIRNESS FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
