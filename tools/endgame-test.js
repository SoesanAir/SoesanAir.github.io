/* The endgame must be PLAYED, not resolved.

   The bug this exists to prevent: eighteen castaways minus thirteen scheduled
   councils left five alive when day 26 ended, and runFinale trimmed that to two
   with consecutive bare votes — no morning, no immunity challenge, no hours to
   work anybody. Reported from real play as "final four was back to back tribals.
   No game, no hustling, no immunity. Just tribal after tribal."

   So every council must be preceded by a challenge on the same day, the final four
   must be fire, and the season must still terminate.

   Run: node tools/endgame-test.js */
const http = require('http'), { spawn } = require('child_process'), os = require('os');
const WebSocket = require('ws');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const RUN_ID = process.pid.toString(36) + Math.floor(Math.random() * 1e6).toString(36);
const PORT = 9200 + Math.floor(Math.random() * 2000);
const get = p => new Promise((res, rej) =>
  http.get({ host: '127.0.0.1', port: PORT, path: p }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
  }).on('error', rej));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT,
    '--no-first-run', '--window-size=900,430',
    '--user-data-dir=' + os.tmpdir() + '\\cw-endgame-' + RUN_ID,
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
    if (r.result.exceptionDetails) {
      const d = r.result.exceptionDetails;
      throw new Error('page threw: ' + ((d.exception && d.exception.description) || d.text));
    }
    return r.result.result.value;
  };
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  const errors = [];
  ws.on('message', m => {
    const j = JSON.parse(m);
    if (j.method === 'Runtime.exceptionThrown') {
      const d = (j.params.exceptionDetails.exception || {}).description || j.params.exceptionDetails.text;
      if (d && d !== 'Event') errors.push(String(d).split('\n')[0]);
    }
  });
  const waitFor = async s => {
    for (let i = 0; i < 80; i++) { if (await ev(`!!document.querySelector(${JSON.stringify(s)})`)) return; await sleep(250); }
    throw new Error('no ' + s);
  };
  const fails = [];
  const check = (name, ok, detail) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`);
    if (!ok) fails.push(name);
  };

  await waitFor('#screen-title.active');
  await ev(`localStorage.clear()`);
  await send('Page.reload', { ignoreCache: true });
  await waitFor('#screen-title.active'); await sleep(300);
  await ev(`document.getElementById('btn-new-game').click()`);
  await waitFor('#screen-create.active');
  await ev(`GAME.fastMaroon = true; GAME.fastChallenge = true; document.getElementById('btn-create-go').click()`);
  for (let i = 0; i < 400; i++) {
    if (await ev(`!!document.querySelector('#screen-camp.active')`)) break;
    await ev(`(() => {
      const b = document.querySelector('#maroon-choices button') || document.querySelector('.maroon-next');
      if (b && !b.disabled) b.click();
    })()`);
    await sleep(120);
  }
  await waitFor('#screen-camp.active');
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>/skip tutorial/i.test(b.textContent));if(b)b.click();})()`);
  await sleep(400);

  /* ---- the schedule logic, before simulating anything ---- */
  console.log('\n--- the schedule ---');
  const sched = await ev(`(() => {
    const kill = n => { const live = alive().filter(c => !c.isPlayer); for (let i = 0; i < n && i < live.length; i++) live[i].eliminated = true; };
    const revive = () => GAME.cast.forEach(c => { c.eliminated = false; });
    const out = {};
    revive(); GAME.merged = true;
    /* Day 25 is not a scheduled council day. With a big field it should not be one;
       once the field is small it must be. */
    GAME.day = 25;
    out.bigFieldOffDay = isTribalDay(25);
    kill(12);                                  // 6 alive
    out.aliveNow = alive().length;
    out.smallFieldOffDay = isTribalDay(25);
    out.endsAt6 = seasonShouldEnd();
    kill(2);                                   // 4 alive
    out.endsAt4 = seasonShouldEnd();
    out.finalFourGame = Challenges.finalFourFire().name;
    out.pickAt4 = (alive().length <= 4 ? Challenges.finalFourFire() : Challenges.pickChallenge()).name;
    kill(2);                                   // 2 alive
    out.endsAt2 = seasonShouldEnd();
    revive(); GAME.merged = false; GAME.day = 1;
    return out;
  })()`);
  console.log('  ' + JSON.stringify(sched));
  check('a full field does not get a council on an unscheduled day', sched.bigFieldOffDay === false, 'day 25, 18 alive');
  check('a small field gets a council EVERY day', sched.smallFieldOffDay === true,
    `day 25, ${sched.aliveNow} alive`);
  check('the season does not end while six are left', sched.endsAt6 === false, 'still playing');
  check('nor while four are left', sched.endsAt4 === false, 'still playing');
  check('it ends at the final two', sched.endsAt2 === true, 'finale');
  check('the final four plays fire', /Fire/i.test(sched.pickAt4), sched.pickAt4);

  /* ---- now simulate the whole rest of a season and watch the ORDER ---- */
  console.log('\n--- a full season, watching the order of events ---');
  const run = await ev(`(async () => {
    DBG.setEnabled(false);
    if (!Feed.__realPost) { Feed.__realPost = Feed.post; Feed.post = () => {}; }
    window.toast = () => {};
    Modal.open = () => {};

    /* Record every challenge and every council with the day it happened on. */
    const log = [];
    const realPick = Challenges.pickChallenge.bind(Challenges);
    const realFire = Challenges.finalFourFire.bind(Challenges);
    const realTribalRun = Challenges.runTribal.bind(Challenges);
    const realIndiv = Challenges.runIndividual.bind(Challenges);
    const realFinish = window.finishTribal;
    Challenges.pickChallenge = () => { const c = realPick(); log.push({ day: GAME.day, kind: 'chal', name: c.name, alive: alive().length }); return c; };
    Challenges.finalFourFire = () => { const c = realFire(); log.push({ day: GAME.day, kind: 'chal', name: c.name, alive: alive().length }); return c; };
    window.finishTribal = function (votes, elim, pool, inter) {
      log.push({ day: GAME.day, kind: 'tribal', out: elim && elim.displayName, alive: alive().length });
      return realFinish.call(this, votes, elim, pool, inter);
    };

    /* The jury finale waits on button clicks, so awaiting the whole of watch mode
       from inside one evaluate deadlocks the harness against itself. Stub the
       finale — this test is about the ROUNDS that get you there, not the jury. */
    const realFinale = window.runFinale;
    let finaleAt = null;
    window.runFinale = async () => { finaleAt = { day: GAME.day, alive: alive().length }; GAME.seasonActive = false; };

    /* Watch mode runs the same day loop headlessly. Send the player home first so
       it takes over, then let it play the season out. */
    GAME.playerEliminated = true; GAME.watchMode = true;
    await watchRestOfSeason();
    window.runFinale = realFinale;

    Challenges.pickChallenge = realPick;
    Challenges.finalFourFire = realFire;
    window.finishTribal = realFinish;
    return { log, day: GAME.day, alive: alive().length, finaleAt };
  })()`);

  const log = run.log;
  const tribals = log.filter(e => e.kind === 'tribal');
  const chals = log.filter(e => e.kind === 'chal');
  console.log(`  reached day ${run.day} · ${run.alive} alive · ${chals.length} challenges · ${tribals.length} councils`);
  /* Every council must have a challenge earlier in the log on the SAME day. */
  const orphans = tribals.filter(tr =>
    !chals.some(c => c.day === tr.day && log.indexOf(c) < log.indexOf(tr)));
  console.log('  councils with no challenge that day: ' + orphans.length
    + (orphans.length ? ' -> ' + JSON.stringify(orphans.slice(0, 4)) : ''));
  /* And no two councils may share a day — that is the "tribal after tribal" report. */
  const byDay = {};
  for (const tr of tribals) byDay[tr.day] = (byDay[tr.day] || 0) + 1;
  const doubled = Object.entries(byDay).filter(([, n]) => n > 1);
  const endgame = log.filter(e => e.alive <= 6);
  console.log('  the last few days: ' + log.slice(-10).map(e =>
    e.kind === 'chal' ? `d${e.day}:chal(${e.name.slice(0, 14)})` : `d${e.day}:VOTE(${e.out})`).join(' '));

  console.log('  finale reached at: ' + JSON.stringify(run.finaleAt));
  check('the season reaches its finale', !!run.finaleAt,
    run.finaleAt ? `day ${run.finaleAt.day} with ${run.finaleAt.alive} alive` : 'never got there');
  check('and it gets there by playing down to the finalists',
    !!run.finaleAt && run.finaleAt.alive <= 2, run.finaleAt ? run.finaleAt.alive + ' alive' : '-');
  check('EVERY council had a challenge that same day', orphans.length === 0,
    `${tribals.length} councils, ${orphans.length} without`);
  check('no two councils on the same day', doubled.length === 0,
    doubled.length ? JSON.stringify(doubled) : 'none');
  check('the endgame is played out over several days, not resolved at once',
    new Set(endgame.filter(e => e.kind === 'tribal').map(e => e.day)).size >= 3,
    `${new Set(endgame.filter(e => e.kind === 'tribal').map(e => e.day)).size} endgame council days`);
  check('the final four round is a fire challenge',
    chals.some(c => c.alive <= 4 && /Fire/i.test(c.name)),
    (chals.find(c => c.alive <= 4) || {}).name || 'no final-four challenge found');
  check('the day cap was not what ended it', run.day < 26 + 14,
    `day ${run.day} of a ${26 + 14} cap`);

  if (errors.length) console.log('\n!! page errors: ' + JSON.stringify(errors.slice(0, 3)));
  const ok = !fails.length && !errors.length;
  if (fails.length) console.log('\nfailing checks: ' + fails.join(', '));
  console.log(ok ? '\nENDGAME TEST PASS' : '\nENDGAME TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
