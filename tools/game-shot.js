/* Screenshot the real camp screen with a few rig states forced on, so the
   animation can be eyeballed in situ. Run: node tools/game-shot.js */
const http = require('http'), { spawn } = require('child_process'), fs = require('fs'), os = require('os');
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
    '--no-first-run', '--window-size=900,430', '--force-device-scale-factor=2.4',
    '--user-data-dir=' + os.tmpdir() + '\\cw-shot-' + RUN_ID, 'http://localhost:8099/index.html?no3d=1'], { stdio: 'ignore' });
  let t = null;
  for (let i = 0; i < 40 && !t; i++) {
    await sleep(400);
    try { t = (await get('/json/list')).find(x => x.type === 'page' && x.url.includes('index.html')); } catch { }
  }
  const ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false });
  let id = 0; const pend = new Map();
  ws.on('message', m => { const j = JSON.parse(m); if (j.id && pend.has(j.id)) { pend.get(j.id)(j); pend.delete(j.id); } });
  await new Promise(r => ws.on('open', r));
  const send = (method, params) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async e => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result.result.value;

  await send('Runtime.enable');
  /* Reused --user-data-dir means a Chrome disk cache; without this a harness
     can quietly run an older copy of the JS than the one on disk. */
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await sleep(1200);
  await ev(`document.getElementById('btn-new-game').click()`);
  await sleep(700);
  await ev(`GAME.fastMaroon = true; document.getElementById('btn-create-go').click()`);
  // skip the marooning opener
  for (let i = 0; i < 80; i++) {
    if (await ev(`(() => { const b = document.querySelector('#maroon-choices button'); if (b) { b.click(); return true; } return false; })()`)) await sleep(120);
    else if (await ev(`!!document.querySelector('#screen-camp.active')`)) break;
    else await sleep(150);
  }
  await sleep(2600);
  // dismiss the tutorial / any modal so the beach is unobstructed
  await ev(`(() => {
    const btns = [...document.querySelectorAll('button')];
    const skip = btns.find(b => /skip tutorial/i.test(b.textContent));
    if (skip) skip.click();
    return !!skip;
  })()`);
  await sleep(600);
  await ev(`(() => { const m = document.querySelector('.modal-backdrop.open, #modal.open');
    if (m) m.classList.remove('open'); return !!m; })()`);
  await sleep(400);
  /* Force a spread of states and freeze them mid-pose so a still frame is
     representative rather than accidental. */
  const n = await ev(`(() => {
    const f = [...document.querySelectorAll('#figures .bfig')];
    const states = ['walking','em-talking','em-cheer','em-wave','em-shrug','weary'];
    f.forEach((el, i) => {
      const s = states[i % states.length];
      el.classList.add(s);
      el.querySelectorAll('.rig > .part').forEach(p => {
        p.style.animationPlayState = 'paused';
        p.style.animationDelay = '-' + (0.13 + (i % 3) * 0.06).toFixed(2) + 's';
      });
      const lbl = el.querySelector('.btag');
      if (lbl) lbl.textContent = s;
    });
    return f.length;
  })()`);
  console.log('figures posed:', n);
  // minimize the log and leave two unread entries so the flicker bar is visible
  await ev(`(() => {
    Feed.setCollapsed(false);
    Feed.post('Wren and Kofi keep ending up together.', 'drama', 3);
    Feed.post('Your torch is running low.', 'danger', 3);
    return true;
  })()`);
  await sleep(500);
  await sleep(400);
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(__dirname + '/_game.png', Buffer.from(r.result.data, 'base64'));
  console.log('saved tools/_game.png');
  ws.close(); ch.kill(); process.exit(0);
})();
