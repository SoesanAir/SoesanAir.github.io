/* Sweep CONFIG.campDrainScale to find the value that puts the camp in the band
   the design calls for. Reuses the same in-page rig as camp-test.js.

   Target, from survival-crafting + game-balance-analyst:
     - tribe left alone holds the camp around 0.40-0.55 (a readable band)
     - a neglected camp gets roughly 4-9 rough nights a season
     - the player working measurably improves both
     - camp collapse never ends seasons by attrition (< ~1 medivac/season)

   Run: node tools/camp-sweep.js */
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
    '--no-first-run', '--window-size=900,430',
    '--user-data-dir=' + os.tmpdir() + '\\cw-sweep-' + RUN_ID, 'http://localhost:8099/index.html?no3d=1'], { stdio: 'ignore' });
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
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) {
      const d = r.result.exceptionDetails;
      throw new Error('page threw: ' + ((d.exception && d.exception.description) || d.text));
    }
    return r.result.result.value;
  };
  await send('Runtime.enable');
  /* Reused --user-data-dir means a Chrome disk cache; without this a harness
     can quietly run an older copy of the JS than the one on disk. */
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  const waitFor = async s => {
    for (let i = 0; i < 80; i++) { if (await ev(`!!document.querySelector(${JSON.stringify(s)})`)) return; await sleep(250); }
    throw new Error('no ' + s);
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

  /* Reuse the rig verbatim from camp-test so the sweep and the test agree. */
  const testSrc = fs.readFileSync(__dirname + '/camp-test.js', 'utf8');
  const rig = testSrc.slice(testSrc.indexOf('window.__rig = {'), testSrc.indexOf('__rig.quiet();'));
  await ev(rig + '\n__rig.quiet(); true;');

  console.log('scale   needMean  needMin  pinned  badN  goodN  morale  medivac | working: needMean badN');
  for (const scale of [1.4, 1.7, 2.0, 2.3]) {
    const r = await ev(`(() => {
      CONFIG.campDrainScale = ${scale};
      const run = jobs => {
        const rs = [];
        for (let i = 0; i < 20; i++) rs.push(__rig.season(4000 + i * 97, jobs));
        const m = k => rs.reduce((s, x) => s + x[k], 0) / rs.length;
        return { needMean: +m('needMean').toFixed(3), needMin: +Math.min(...rs.map(x => x.needMin)).toFixed(2),
                 pinned: +m('pinnedEmpty').toFixed(3), bad: +m('badNights').toFixed(1),
                 good: +m('goodNights').toFixed(1), morale: +m('moraleMean').toFixed(2),
                 medivac: +m('medivacs').toFixed(2) };
      };
      return { idle: run(0), work: run(2) };
    })()`);
    const i = r.idle, w = r.work;
    console.log(`${String(scale).padStart(4)}    ${String(i.needMean).padEnd(9)} ${String(i.needMin).padEnd(8)} `
      + `${String(i.pinned).padEnd(7)} ${String(i.bad).padEnd(5)} ${String(i.good).padEnd(6)} `
      + `${String(i.morale).padEnd(7)} ${String(i.medivac).padEnd(7)} | ${String(w.needMean).padEnd(8)} ${w.bad}`);
  }
  ws.close(); ch.kill(); process.exit(0);
})();
