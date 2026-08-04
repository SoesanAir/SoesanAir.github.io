/* The how-to card on the REAL path, with the countdown behind it.

   Why this exists separately from howto-test.js: every other harness in this
   directory sets GAME.fastChallenge so it can run forty minigames headlessly, and
   fastChallenge makes Howto.show resolve instantly without rendering. So the entire
   suite is blind to the wiring in Challenge.play — the card could be hooked up
   backwards, or not at all, and everything would still be green.

   This one runs a challenge at real speed and checks the actual sequence:

     card appears  ->  countdown is NOT running yet  ->  tap  ->  card goes
                   ->  countdown runs  ->  the game actually starts

   The ordering matters and is the whole point of the feature. The card used to be
   one line of grey prose under the arena while 3-2-1 ticked over the top of it,
   which is the worst moment to ask anyone to read.

   Run: node tools/howto-live.js */
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
    '--user-data-dir=' + path.join(os.tmpdir(), 'cw-hlive-' + RUN_ID),
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
  /* fastMaroon to skip the opener, but fastChallenge stays OFF — that is the point. */
  await ev("GAME.fastMaroon=true;document.getElementById('btn-create-go').click()");
  for (let i = 0; i < 400; i++) {
    if (await ev("!!document.querySelector('#screen-camp.active')")) break;
    await ev("(()=>{const b=document.querySelector('#maroon-choices button')||document.querySelector('.maroon-next');if(b&&!b.disabled)b.click();})()");
    await sleep(120);
  }
  await waitFor('#screen-camp.active');
  await ev('window.toast=()=>{}; Telemetry.cfg.auto=false; GAME.fastChallenge=false; true;');

  /* Launch one minigame through the real shell, at real speed.

     Screens.push FIRST. Calling Challenge.play() straight from the camp screen
     leaves #screen-challenge inactive, which is display:none, so #chal-game and
     everything in it measures 0x0 at opacity 0. The card is still in the DOM and
     still blocks the countdown, so every behavioural assertion here passes while
     the thing is invisible — which is exactly how a "0px card in a 334px app"
     sailed through the size check the first time round. */
  console.log(NL + 'a challenge at real speed, no fastChallenge');
  await ev(`(() => {
    const game = MINIGAMES.find(g => g.id === 'sprint') || MINIGAMES[0];
    window.__done = false;
    Screens.push('screen-challenge');
    Challenge.play(game, GAME.player, CHALLENGES[0]).then(v => { window.__done = v; });
    return game.id;
  })()`);
  await sleep(700);
  /* Guard the guard: if the screen is not really up, the measurements below are
     meaningless and should fail loudly rather than pass at zero. */
  check('the challenge screen is actually on, so sizes mean something',
    await ev("document.getElementById('chal-game').getBoundingClientRect().height > 100"),
    await ev("Math.round(document.getElementById('chal-game').getBoundingClientRect().height) + 'px layer'"));

  const cardUp = await ev("!!document.querySelector('.hw-card')");
  check('the card is on screen before anything else happens', cardUp,
    await ev("(document.querySelector('.hw-card')||{className:'none'}).className"));
  check('it is hosted on the layer, so it is not clipped by the empty frame',
    await ev("(()=>{const c=document.querySelector('.hw-card');if(!c)return false;const l=document.getElementById('chal-game');return !!l&&l.contains(c)&&!document.querySelector('.cg-frame').contains(c);})()"));

  /* The ordering claim: 3-2-1 must not be running underneath the card. */
  const cdText = await ev("(document.querySelector('.cg-countdown')||{textContent:''}).textContent.trim()");
  check('the countdown has not started yet', cdText === '', 'countdown shows "' + cdText + '"');

  /* It must fit. #app is 344px tall in this window and the card is inside it. */
  const fit = await ev(`(() => {
    const c = document.querySelector('.hw-card'); if (!c) return null;
    const a = document.getElementById('app').getBoundingClientRect();
    const r = c.getBoundingClientRect();
    return { spill: +(Math.max(0, a.top - r.top) + Math.max(0, r.bottom - a.bottom)).toFixed(1),
             h: Math.round(r.height), app: Math.round(a.height),
             opacity: getComputedStyle(c).opacity };
  })()`);
  check('it is actually visible, not a zero-height ghost',
    fit && fit.h > 60 && fit.opacity !== '0', fit ? fit.h + 'px tall, opacity ' + fit.opacity : 'no card');
  check('it fits inside the app', fit && fit.spill === 0, fit ? fit.h + 'px card in ' + fit.app + 'px app' : 'no card');

  /* Tap anywhere, as a finger would. */
  await ev("document.getElementById('chal-game').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))");
  await sleep(250);
  check('tapping dismisses it', !(await ev("!!document.querySelector('.hw-card')")));

  /* And only now does the countdown run and the game begin. */
  await sleep(700);
  const cd2 = await ev("(document.querySelector('.cg-countdown')||{textContent:''}).textContent.trim()");
  check('the countdown starts after the card, not during it', cd2 !== '', 'shows "' + cd2 + '"');
  await sleep(2600);
  check('the game actually starts',
    await ev("document.querySelectorAll('.cg-arena *').length > 0"),
    await ev("document.querySelectorAll('.cg-arena *').length") + ' arena elements');
  check('and it did not resolve early', (await ev('window.__done')) === false);

  const ok = !fails.length;
  if (fails.length) console.log(NL + 'failing checks: ' + fails.join(', '));
  console.log(ok ? NL + 'HOWTO LIVE PASS' : NL + 'HOWTO LIVE FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
