/* Verify tap-to-walk: synthesise a tap on the beach and confirm the player
   walks there; also confirm a tap ON a castaway opens dialogue instead, and
   that a scroll-swipe does NOT trigger a walk.
   Run: node tools/tap-test.js   (needs a static server on :8099 and `ws`) */
const http = require('http'), { spawn } = require('child_process'), os = require('os');
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
    '--user-data-dir=' + os.tmpdir() + '\\cw-tap-' + RUN_ID, 'http://localhost:8099/index.html?no3d=1'], { stdio: 'ignore' });
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
  const errors = [];
  ws.on('message', m => {
    const j = JSON.parse(m);
    if (j.method === 'Runtime.exceptionThrown') { if (j.params.exceptionDetails.text !== 'Uncaught') errors.push(j.params.exceptionDetails.text); };
  });

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
  await sleep(2500);
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(b=>/skip tutorial/i.test(b.textContent)); if(b)b.click(); })()`);
  await sleep(800);

  const layerOk = await ev(`!!document.querySelector('#world .tap-layer')`);
  console.log('tap layer present :', layerOk);

  /* Helper that dispatches a real pointer sequence at a given offsetX on the
     layer. offsetX is what the handler reads, so drive it directly. */
  const tapAt = async (offX, moved, held) => await ev(`(async () => {
    const layer = document.querySelector('#world .tap-layer');
    const r = layer.getBoundingClientRect();
    const mk = (type, extra) => new PointerEvent(type, Object.assign({
      bubbles: true, cancelable: true, clientX: r.left + 10, clientY: r.top + 10
    }, extra || {}));
    // offsetX is read-only on synthesized events, so define it for the test
    const down = mk('pointerdown');
    Object.defineProperty(down, 'offsetX', { value: ${offX} });
    layer.dispatchEvent(down);
    await new Promise(r2 => setTimeout(r2, ${held}));
    layer.dispatchEvent(mk('pointerup', { clientX: r.left + 10 + ${moved}, clientY: r.top + 10 }));
    return true;
  })()`);

  const playerX = () => ev(`(() => {
    const p = document.querySelector('#figures .bfig.player');
    return p ? parseFloat(p.style.left) : null;
  })()`);

  const before = await playerX();
  const target = await ev(`Math.round(document.querySelector('#world .tap-layer').offsetWidth * 0.62)`);
  await tapAt(target, 0, 60);
  await sleep(300);
  const walkingNow = await ev(`!!document.querySelector('#figures .bfig.player.walking')`);
  const pinged = await ev(`!!document.querySelector('#world .tap-ping')`);
  await sleep(2600);
  const after = await playerX();
  console.log(`walk: x ${before} -> ${after} (target ~62%)  walking-class=${walkingNow} ping=${pinged}`);

  // a swipe (moved far) must NOT walk
  const beforeSwipe = await playerX();
  await tapAt(30, 60, 60);
  await sleep(500);
  const afterSwipe = await playerX();
  console.log(`swipe ignored     : ${beforeSwipe === afterSwipe} (x stayed ${afterSwipe})`);

  // tapping a castaway must open dialogue, not walk
  await ev(`(() => { const n=[...document.querySelectorAll('#figures .bfig:not(.player)')][0]; if(n) n.click(); return true; })()`);
  await sleep(2200);
  const dlgOpen = await ev(`document.getElementById('dialogue-layer').classList.contains('open')`);
  console.log('tap castaway opens dialogue :', dlgOpen);

  const moved = after !== null && before !== null && Math.abs(after - before) > 3;
  const inRange = after > 55 && after < 70;
  const ok = layerOk && moved && inRange && pinged && beforeSwipe === afterSwipe && dlgOpen && !errors.length;
  if (errors.length) console.log('!! errors:', errors.slice(0, 3));
  console.log(ok ? '\nTAP TEST PASS' : '\nTAP TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
