/* Does the brief still fit in one ntfy message after a FULL season?

   ntfy's public server caps a message at 4KB and Telemetry.toNtfy truncates to
   3900 before sending. The brief has grown a lot — challenge stats, the played
   table, the interest profile, the flags — and the FLAGS block is the LAST thing
   in it. So if a long season pushes the brief past the cap, the single most
   valuable section is the one that gets cut off, and the report gets less useful
   the longer you play. Exactly backwards.

   Run: node tools/brief-size-test.js */
const http = require('http'), { spawn } = require('child_process'), os = require('os');
const WebSocket = require('ws');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const RUN_ID = process.pid.toString(36) + Math.floor(Math.random() * 1e6).toString(36);
const PORT = 9200 + Math.floor(Math.random() * 2000);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = p => new Promise((s, j) => http.get({ host: '127.0.0.1', port: PORT, path: p }, r => {
  let d = ''; r.on('data', c => d += c); r.on('end', () => s(JSON.parse(d)));
}).on('error', j));

(async () => {
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT,
    '--no-first-run', '--window-size=900,430',
    '--user-data-dir=' + os.tmpdir() + '\\cw-brief-' + RUN_ID,
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
    if (r.result.exceptionDetails) throw new Error('threw: ' + ((r.result.exceptionDetails.exception || {}).description || '').split('\n')[0]);
    return r.result.result.value;
  };
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  const waitFor = async s => {
    for (let i = 0; i < 80; i++) { if (await ev(`!!document.querySelector(${JSON.stringify(s)})`)) return; await sleep(250); }
    throw new Error('no ' + s);
  };
  const fails = [];
  const check = (n, ok, d) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${n}${d ? '  — ' + d : ''}`); if (!ok) fails.push(n); };

  await waitFor('#screen-title.active');
  await ev(`localStorage.clear()`);
  await send('Page.reload', { ignoreCache: true });
  await waitFor('#screen-title.active'); await sleep(300);
  await ev(`document.getElementById('btn-new-game').click()`);
  await waitFor('#screen-create.active');
  await ev(`GAME.fastMaroon = true; GAME.fastChallenge = true; document.getElementById('btn-create-go').click()`);
  for (let i = 0; i < 400; i++) {
    if (await ev(`!!document.querySelector('#screen-camp.active')`)) break;
    await ev(`(() => { const b = document.querySelector('#maroon-choices button') || document.querySelector('.maroon-next'); if (b && !b.disabled) b.click(); })()`);
    await sleep(120);
  }
  await waitFor('#screen-camp.active');
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>/skip tutorial/i.test(b.textContent));if(b)b.click();})()`);
  await sleep(400);

  /* Simulate a long, busy season: many days, many councils, plenty of actions and
     dialogue, so the brief is as fat as it will ever realistically get. */
  const sizes = await ev(`(async () => {
    DBG.setEnabled(false);
    if (!Feed.__realPost) { Feed.__realPost = Feed.post; Feed.post = () => {}; }
    window.toast = () => {}; Modal.open = () => {};
    Telemetry.cfg.auto = false;      // measure, do not publish

    const out = [];
    const mates = () => campmates(GAME.player).filter(c => !c.isPlayer);
    for (let d = 0; d < 26; d++) {
      GAME.day = d + 1;
      Weather.roll();
      TribeWork.dailyTick(alive());
      /* Player actions, dialogue seen, and a council every other day. */
      const m = mates();
      if (m.length) {
        for (let k = 0; k < 4; k++) {
          const npc = m[k % m.length];
          openTalkMenu(npc);
          if (k % 4 === 0) doBond(npc);
          else if (k % 4 === 1) doSmallTalk(npc);
          else if (k % 4 === 2) doJoke(npc);
          else doReadRoom(npc);
          closeDialogue();
        }
        Camp.doJob(CAMP_JOBS.find(j => j.id === 'water'));
      }
      Morale.tick(alive());
      dailySurvivalTick(alive());
      CampNeeds.decay(campPool());
      Ledger.roll(alive());
      const n = Nights.roll(campPool());
      if (n) Trace.mark('night', { tag: n.tag, bad: n.bad, id: n.id });
      applySleepRecovery(alive(), false);
      /* A council on even days, through the real path so ballots log. */
      if (d % 2 === 1 && campmates(GAME.player).length > 3) {
        const pool = campmates(GAME.player);
        seedVoteWeights(GAME.cast, GAME.merged, GAME.player.name);
        const votes = new Map();
        for (const v of pool) {
          const tgt = Voting.calculateVote(v, pool, null, GAME.merged, GAME.day, GAME.player.name);
          if (tgt) votes.set(v, tgt);
        }
        const tally = Voting.tally(new Map([...votes.entries()].map(([v, x]) => [v.name, x.name])));
        const elim = pool.find(c => c.name === tally.eliminated) || [...votes.values()][0];
        if (elim && !elim.isPlayer) finishTribal(votes, elim, pool, false);
      }
      /* A challenge every other day so the challenge section fills up. */
      if (d % 2 === 0) {
        const chal = Challenges.pickChallenge();
        const g = Challenge.gameFor(chal);
        setPlayerChallengePerf(0.4 + (d % 5) * 0.12);
        Journal.challenge({
          kind: GAME.merged ? 'individual' : 'tribal', chal: chal.name, cat: chal.cat, game: g.id,
          perf: GAME.playerPerf, playerScore: 0.5, playerWon: d % 3 === 0,
          winner: 'someone', rank: 2, field: alive().length
        });
        setPlayerChallengePerf(null);
      }
      Trace.close();
      out.push({ day: GAME.day, brief: Report.brief().length });
    }
    const brief = Report.brief();
    const cap = NTFY_MAX;
    const flagsAt = brief.indexOf('FLAGS');
    return {
      perDay: out,
      finalBrief: brief.length,
      cap,
      overCap: brief.length > cap,
      /* Where the important part sits relative to the truncation point. */
      flagsAt, flagsSurvives: flagsAt >= 0 && flagsAt < cap,
      flagCount: (brief.match(/^  ! /gm) || []).length,
      fullLen: Report.full().length,
      tail: brief.slice(-260)
    };
  })()`);

  console.log('\nbrief size by day:');
  const marks = sizes.perDay.filter((_, i) => i % 5 === 0 || i === sizes.perDay.length - 1);
  console.log('  ' + marks.map(m => 'd' + m.day + ' ' + m.brief + 'B').join('   '));
  console.log(`\nfinal brief ${sizes.finalBrief}B against a ${sizes.cap}B cap`
    + ` · full report ${(sizes.fullLen / 1024).toFixed(0)}KB`);
  console.log(`FLAGS block starts at byte ${sizes.flagsAt} (${sizes.flagCount} flags raised)`);
  console.log('\nlast 260 bytes of the brief:\n' + sizes.tail.split('\n').map(l => '  | ' + l).join('\n'));

  check('a full 26-day season still fits in one ntfy message', !sizes.overCap,
    `${sizes.finalBrief}B / ${sizes.cap}B`);
  check('the FLAGS block survives truncation', sizes.flagsSurvives,
    `starts at ${sizes.flagsAt}, cap ${sizes.cap}`);
  check('flags are actually being raised', sizes.flagCount > 0, `${sizes.flagCount}`);

  const ok = !fails.length;
  if (fails.length) console.log('\nfailing checks: ' + fails.join(', '));
  console.log(ok ? '\nBRIEF SIZE TEST PASS' : '\nBRIEF SIZE TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
