/* Play a short scripted session and dump the design log, so the log's shape and
   detail level can be reviewed. Writes tools/_sample-log.txt.
   Run: node tools/sample-log.js */
const http = require('http'), { spawn } = require('child_process'), os = require('os'), fs = require('fs');
const WebSocket = require('ws');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
/* Unique per run: a fixed port + profile means a crashed harness leaves a
   Chrome holding both, and the next run attaches to that stale instance
   mid-test instead of booting a fresh page. */
const RUN_ID = process.pid.toString(36) + Math.floor(Math.random() * 1e6).toString(36);
const PORT = 9200 + Math.floor(Math.random() * 2000);
const get = p => new Promise((res, rej) =>
  http.get({ host: '127.0.0.1', port: PORT, path: p }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
  }).on('error', rej));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT,
    '--no-first-run', '--user-data-dir=' + os.tmpdir() + '\\cw-samp-' + RUN_ID,
    'http://localhost:8099/index.html?no3d=1'], { stdio: 'ignore' });
  let t = null;
  for (let i = 0; i < 40 && !t; i++) {
    await sleep(400);
    try { t = (await get('/json/list')).find(x => x.type === 'page' && x.url.includes('index.html')); } catch { }
  }
  const ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false });
  let id = 0; const pend = new Map();
  ws.on('message', m => { const j = JSON.parse(m); if (j.id && pend.has(j.id)) { pend.get(j.id)(j); pend.delete(j.id); } });
  await new Promise(r => ws.on('open', r));
  const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  const ev = async e => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result.result.value;
  await send('Runtime.enable');
  /* Reused --user-data-dir means a Chrome disk cache; without this a harness
     can quietly run an older copy of the JS than the one on disk. */
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  const waitFor = async sel => { for (let i = 0; i < 60; i++) { if (await ev(`!!document.querySelector(${JSON.stringify(sel)})`)) return; await sleep(250); } throw new Error('no ' + sel); };

  await waitFor('#screen-title.active');
  await sleep(200);
  await ev(`DBG.clear(); document.getElementById('btn-new-game').click()`);
  await waitFor('#screen-create.active');
  await ev(`GAME.fastMaroon = true; document.getElementById('btn-create-go').click()`);
  // skip the marooning opener
  for (let i = 0; i < 80; i++) {
    if (await ev(`(() => { const b = document.querySelector('#maroon-choices button'); if (b) { b.click(); return true; } return false; })()`)) await sleep(120);
    else if (await ev(`!!document.querySelector('#screen-camp.active')`)) break;
    else await sleep(150);
  }
  await waitFor('#figures .bfig');
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>/skip tutorial/i.test(b.textContent));if(b)b.click();})()`);
  await sleep(600);

  /* A short but representative session: talk, bond, ask an opinion, vouch,
     push a vote, then try to widen a circle. */
  await ev(`(() => {
    const p = alive().filter(c => !c.isPlayer && c.tribeName === GAME.player.tribeName);
    goTalkTo(p[0]);
    doBond(p[0]);
    doAskThinkOf(p[0], p[1]);
    doDefend(p[0], p[1]);
    doPushVote(p[0], p[2]);
    PlayerAlliances.reset(); Coalitions.reset();
    Coalitions.form([GAME.player.name, p[0].name], GAME.day);
    tryAddToCircle(p[0], p[1], Coalitions.active(GAME.player.name));
    DBG.snapshot('end of sample session');
    return true;
  })()`);
  await sleep(800);

  const txt = await ev(`DBG.text()`);
  fs.writeFileSync(__dirname + '/_sample-log.txt', txt);
  const lines = txt.split('\n');
  console.log(lines.slice(0, 6).join('\n'));
  console.log('   ...');
  // show the interesting middle: actions and the circle decision
  console.log(lines.filter(l => /\[action\]|\[alliance\]/.test(l)).slice(0, 14).join('\n'));
  console.log('   ...');
  console.log(lines.filter(l => /\[rel\]|\[vote\]/.test(l)).slice(0, 10).join('\n'));
  console.log('\nTOTAL LINES:', await ev(`DBG.count()`), ' chars:', txt.length);
  ws.close(); ch.kill(); process.exit(0);
})();
