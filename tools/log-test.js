/* Verify the minimized Camp Log: collapses to one line, flickers while unread,
   escalates for player-relevant entries, clears on expand, and survives reload.
   Run: node tools/log-test.js   (needs a static server on :8099 and `ws`) */
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
    '--no-first-run', '--window-size=900,430', '--force-device-scale-factor=2.2',
    '--user-data-dir=' + os.tmpdir() + '\\cw-log-' + RUN_ID, 'http://localhost:8099/index.html?no3d=1'], { stdio: 'ignore' });
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
  const errors = [];
  ws.on('message', m => { const j = JSON.parse(m); if (j.method === 'Runtime.exceptionThrown') { if (j.params.exceptionDetails.text !== 'Uncaught') errors.push(j.params.exceptionDetails.text); }; });

  const waitFor = async sel => { for (let i = 0; i < 40; i++) { if (await ev(`!!document.querySelector(${JSON.stringify(sel)})`)) return; await sleep(250); } throw new Error('no ' + sel); };
  await waitFor('#screen-title.active');
  await sleep(200);
  await ev(`document.getElementById('btn-new-game').click()`);
  await waitFor('#screen-create.active');
  await ev(`GAME.fastMaroon = true; document.getElementById('btn-create-go').click()`);
  // skip the marooning opener
  for (let i = 0; i < 80; i++) {
    if (await ev(`(() => { const b = document.querySelector('#maroon-choices button'); if (b) { b.click(); return true; } return false; })()`)) await sleep(120);
    else if (await ev(`!!document.querySelector('#screen-camp.active')`)) break;
    else await sleep(150);
  }
  await waitFor('#screen-camp.active');
  await waitFor('#figures .bfig');
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>/skip tutorial/i.test(b.textContent)); if(b)b.click();})()`);
  await sleep(900);

  const state = () => ev(`(() => {
    const main = document.getElementById('camp-main');
    const panel = document.getElementById('log-panel');
    const tick = document.getElementById('feed-ticker');
    const cnt = document.getElementById('feed-unread');
    const scene = document.getElementById('camp-scene').getBoundingClientRect();
    return {
      min: main.classList.contains('log-min'),
      unread: panel.classList.contains('unread'),
      urgent: panel.classList.contains('urgent'),
      tickerVisible: getComputedStyle(tick).display !== 'none',
      feedVisible: getComputedStyle(document.getElementById('feed')).display !== 'none',
      headVisible: getComputedStyle(document.getElementById('log-head')).display !== 'none',
      count: cnt.classList.contains('hidden') ? null : cnt.textContent,
      text: document.getElementById('feed-ticker-text').textContent.slice(0, 40),
      lines: tick.getClientRects().length ? Math.round(tick.getBoundingClientRect().height) : 0,
      sceneW: Math.round(scene.width),
      animating: getComputedStyle(panel).animationName
    };
  })()`);

  /* Normalize: the collapsed preference persists in localStorage, so a previous
     run would otherwise leave this profile already minimized. */
  await ev(`(() => { Feed.setCollapsed(false); Feed.markRead(); return true; })()`);
  await sleep(300);

  const expanded = await state();
  console.log('expanded   :', `min=${expanded.min} feed=${expanded.feedVisible} ticker=${expanded.tickerVisible} sceneW=${expanded.sceneW}`);

  await ev(`document.getElementById('btn-feed-min').click()`);
  await sleep(400);
  const col = await state();
  console.log('collapsed  :', `min=${col.min} head=${col.headVisible} feed=${col.feedVisible} ticker=${col.tickerVisible} barHeight=${col.lines}px sceneW=${col.sceneW}`);

  // a neutral entry -> flicker, no urgency
  await ev(`Feed.post('A gull steals something from camp.', '', 3)`);
  await sleep(250);
  const s1 = await state();
  console.log('after post :', `unread=${s1.unread} urgent=${s1.urgent} count=${s1.count} anim=${s1.animating}`);

  // a player-relevant entry -> urgent
  await ev(`Feed.post('Your torch is running low.', 'danger', 3)`);
  await sleep(250);
  const s2 = await state();
  console.log('after mine :', `unread=${s2.unread} urgent=${s2.urgent} count=${s2.count} anim=${s2.animating}`);
  console.log('ticker text:', JSON.stringify(s2.text));

  // expanding clears the signal
  await ev(`document.getElementById('feed-ticker').click()`);
  await sleep(350);
  const s3 = await state();
  console.log('expanded   :', `min=${s3.min} unread=${s3.unread} urgent=${s3.urgent} count=${s3.count}`);

  // preference persists across reload
  await ev(`document.getElementById('btn-feed-min').click()`);
  await sleep(300);
  await send('Page.reload', { ignoreCache: true });
  await sleep(2500);
  const s4 = await ev(`document.getElementById('camp-main').classList.contains('log-min')`);
  console.log('persisted after reload:', s4);

  const ok = !expanded.min && expanded.feedVisible && !expanded.tickerVisible
    && col.min && !col.headVisible && !col.feedVisible && col.tickerVisible
    && col.lines > 0 && col.lines < 56 && col.sceneW > expanded.sceneW
    && s1.unread && !s1.urgent && s1.count === '1' && s1.animating.includes('log-flicker')
    && s2.unread && s2.urgent && s2.count === '2' && s2.animating === 'log-flicker-urgent'
    && !s3.min && !s3.unread && !s3.urgent && s3.count === null
    && s4 === true && !errors.length;
  if (errors.length) console.log('!! errors:', errors.slice(0, 3));
  console.log(ok ? '\nLOG TEST PASS' : '\nLOG TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
