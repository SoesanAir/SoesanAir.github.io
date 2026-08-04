/* Table Maze ball speed, measured rather than reasoned about.

   The change was one constant, but the thing it controls is two steps removed from
   it: SPEED sets push, push fights drag, and terminal velocity is where they
   cancel. That is exactly the kind of chain where a plausible edit produces a
   different number than intended — so this holds a direction button down and
   measures how fast the ball actually crosses the board.

   Also checks the clock, because RUN was changed from a raw 20000 to ctx.span in
   the same edit and a broken clock would end the round early rather than visibly.

   Run: node tools/maze-speed.js */
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
    '--user-data-dir=' + path.join(os.tmpdir(), 'cw-maze-' + RUN_ID),
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
    for (let i = 0; i < 120; i++) { if (await ev('!!document.querySelector(' + JSON.stringify(s) + ')')) return; await sleep(250); }
    throw new Error('no ' + s);
  };
  const fails = [];
  const check = (n, ok, d) => { console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + n + (d ? '  — ' + d : '')); if (!ok) fails.push(n); };

  await waitFor('#screen-title.active');
  await ev('localStorage.clear()');
  await send('Page.reload', { ignoreCache: true });
  await waitFor('#screen-title.active'); await sleep(400);
  await ev("document.getElementById('btn-new-game').click()");
  await waitFor('#screen-create.active');
  await ev("GAME.fastMaroon=true;document.getElementById('btn-create-go').click()");
  for (let i = 0; i < 400; i++) {
    if (await ev("!!document.querySelector('#screen-camp.active')")) break;
    await ev("(()=>{const b=document.querySelector('#maroon-choices button')||document.querySelector('.maroon-next');if(b&&!b.disabled)b.click();})()");
    await sleep(120);
  }
  await waitFor('#screen-camp.active');
  await ev('window.toast=()=>{}; Telemetry.cfg.auto=false; GAME.fastChallenge=false; true;');

  /* Real screen, real shell, real speed — same reason howto-live pushes the screen
     first: without it everything measures zero inside a display:none section. */
  await ev(`(() => {
    Screens.push('screen-challenge');
    Challenge.play(MINIGAMES.find(g => g.id === 'maze'), GAME.player, CHALLENGES[0]);
    return true;
  })()`);
  await sleep(600);
  /* Dismiss the how-to card, then let the 3-2-1 run out. */
  await ev("document.getElementById('chal-game').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))");
  await sleep(2800);
  check('the maze is running', await ev("!!document.querySelector('.ce-mball')"));

  /* Hold LEFT so the ball runs along the bottom row with no holes to fall into
     (holes live on rows 1/3/5; the ball starts on row 6). Sample the position and
     take the fastest sustained crossing as terminal velocity. */
  const m = await ev(`(async () => {
    const mb = document.querySelector('.ce-mball');
    const L = document.querySelector('.ce-dl');
    if (!mb || !L) return null;
    const COLS = 7;
    const posCells = () => parseFloat(mb.style.left) / 100 * COLS;
    L.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const samples = [];
    const t0 = performance.now();
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 25));
      samples.push({ t: performance.now() - t0, x: posCells() });
    }
    L.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    /* Terminal velocity = the steepest sustained slope over a 200ms window, which
       skips the acceleration ramp at the start and the wall at the end. */
    let fastest = 0;
    for (let i = 0; i + 8 < samples.length; i++) {
      const a = samples[i], b = samples[i + 8];
      const v = Math.abs(b.x - a.x) / ((b.t - a.t) / 1000);
      if (v > fastest) fastest = v;
    }
    return { cellsPerSec: +fastest.toFixed(2), travelled: +Math.abs(samples[0].x - samples[samples.length - 1].x).toFixed(2) };
  })()`);

  console.log(NL + 'ball speed, holding one direction on the empty bottom row');
  console.log('  terminal velocity : ' + (m ? m.cellsPerSec : '?') + ' cells/sec');
  console.log('  distance covered  : ' + (m ? m.travelled : '?') + ' cells in 1s');
  check('the ball moved at all', m && m.cellsPerSec > 0.2, m ? m.cellsPerSec + ' cells/sec' : 'no reading');
  /* 2.56 is the target. Allow a real margin: this is rAF-driven in headless
     Chrome, and the ball also decelerates into the wall part-way through. */
  check('terminal velocity is the intended 2.56, not the old 3.2',
    m && m.cellsPerSec >= 2.0 && m.cellsPerSec <= 2.9,
    m ? m.cellsPerSec + ' vs 3.2 before (-' + Math.round((1 - m.cellsPerSec / 3.2) * 100) + '%)' : 'no reading');

  /* The clock: RUN moved from a raw 20000 to ctx.span(20000), which at
     chalPace 1.35 and chalDifficulty 1.0 should be about 27s. */
  const runMs = await ev(`(() => {
    const g = MINIGAMES.find(x => x.id === 'maze');
    const ctx = Challenge.makeCtx({ arena: document.createElement('div'), frame: document.createElement('div'),
      score: document.createElement('div'), timer: document.createElement('div'), game: g, ease: 0.5, onDone: () => {} });
    return Math.round(ctx.span(20000));
  })()`);
  console.log(NL + '  round length      : ' + runMs + 'ms  (was a flat 20000, now follows chalPace)');
  check('the clock now honours the pace lever', runMs > 20000,
    runMs + 'ms at chalPace ' + await ev('CONFIG.chalPace'));
  check('the slower ball has more time, not the same time', runMs >= 20000 * 1.2,
    'needs 25% more time for a 20% slower ball; got ' + Math.round((runMs / 20000 - 1) * 100) + '% more');

  const ok = !fails.length;
  if (fails.length) console.log(NL + 'failing checks: ' + fails.join(', '));
  console.log(ok ? NL + 'MAZE SPEED PASS' : NL + 'MAZE SPEED FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
