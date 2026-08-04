/* The studio splash, and the Menu button that now sits on the title screen.

   Two things here are invisible to a human glancing at a screenshot and both have
   bitten before in this codebase:

     1. A BROKEN SRC LOOKS LIKE A DARK SCREEN. The splash plate is #01020A. If the
        logo 404s, the card still fades in, holds and fades out on schedule and
        the only difference is that nothing was ever on it. So the logo is
        measured — naturalWidth/naturalHeight from the decoder, and a laid-out
        box — rather than eyeballed.
     2. A SPLASH THAT STICKS is worse than one that never played. It is checked
        both ways: it must clear on a tap, and it must clear on its own if left
        alone. And it must not come back when the screen stack moves, which is
        the failure mode of anything that hangs off Screens.

   Plus the title Menu: it opens the same builder the camp HUD does, and that
   builder was written when a live season was the only way to reach it. Any
   surviving GAME.player assumption shows up as a page exception, so every
   Runtime.exceptionThrown is a failure here.

   Run: node tools/splash-test.js   (static server on :8099, `ws` installed) */
const http = require('http'), { spawn } = require('child_process'), os = require('os'), fs = require('fs'), path = require('path');
const WebSocket = require('ws');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
/* Unique per run: a fixed port + profile means a crashed harness leaves a Chrome
   holding both, and the next run attaches to that stale instance mid-test. */
const RUN_ID = process.pid.toString(36) + Math.floor(Math.random() * 1e6).toString(36);
const PORT = 9200 + Math.floor(Math.random() * 2000);
const NL = String.fromCharCode(10);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = p => new Promise((s, j) => http.get({ host: '127.0.0.1', port: PORT, path: p }, r => {
  let d = ''; r.on('data', c => d += c); r.on('end', () => s(JSON.parse(d)));
}).on('error', j));

(async () => {
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT,
    '--no-first-run', '--window-size=920,440', '--force-device-scale-factor=2',
    '--user-data-dir=' + path.join(os.tmpdir(), 'cw-splash-' + RUN_ID),
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
      throw new Error('page threw: ' + (((d.exception || {}).description) || d.text).split(NL)[0]);
    }
    return r.result.result.value;
  };
  const shot = async name => {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, '_look-' + name + '.png'), Buffer.from(s.result.data, 'base64'));
  };
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });

  /* Every uncaught page exception is a failure. `errors` is sliced per phase so
     the report says WHICH step threw rather than just that something did. */
  const errors = [];
  ws.on('message', m => {
    const j = JSON.parse(m);
    if (j.method === 'Runtime.exceptionThrown') {
      const d = j.params.exceptionDetails;
      const txt = ((d.exception || {}).description) || d.text;
      if (txt && txt !== 'Event') errors.push(String(txt).split(NL)[0]);
    }
  });

  const waitFor = async (s, tries = 80) => {
    for (let i = 0; i < tries; i++) {
      if (await ev('!!document.querySelector(' + JSON.stringify(s) + ')')) return true;
      await sleep(250);
    }
    return false;
  };
  const has = s => ev('!!document.querySelector(' + JSON.stringify(s) + ')');

  const fails = [];
  const check = (name, ok, detail) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`);
    if (!ok) fails.push(name);
  };

  /* A reload that lands on a page whose title screen is up. The splash starts its
     clock when the logo finishes decoding, which is the same moment the window
     load event fires, so waiting for #screen-title.active leaves the full ~2.3s
     of splash still to run — no race with the measurements below. */
  const freshBoot = async () => {
    await send('Page.reload', { ignoreCache: true });
    if (!await waitFor('#screen-title.active')) throw new Error('title screen never came up after reload');
  };

  await waitFor('#screen-title.active');
  await ev('localStorage.clear()');

  /* ================= 1. it is there, and there is something on it ============ */
  console.log(NL + 'splash on load');
  await freshBoot();
  const m = await ev(`(() => {
    const s = document.getElementById('splash');
    const img = document.getElementById('splash-logo');
    const app = document.getElementById('app');
    if (!s || !img) return { present: false };
    const ir = img.getBoundingClientRect(), ar = app.getBoundingClientRect();
    const cs = getComputedStyle(s);
    return {
      present: true,
      visible: cs.display !== 'none' && +cs.opacity > 0.01,
      bg: cs.backgroundColor,
      zIndex: cs.zIndex,
      natW: img.naturalWidth, natH: img.naturalHeight,
      complete: img.complete,
      boxW: Math.round(ir.width), boxH: Math.round(ir.height),
      appW: Math.round(ar.width), appH: Math.round(ar.height),
      /* fits = inside the app box on every side, not merely smaller than it */
      fits: ir.width <= ar.width + 1 && ir.height <= ar.height + 1
        && ir.left >= ar.left - 1 && ir.right <= ar.right + 1
        && ir.top >= ar.top - 1 && ir.bottom <= ar.bottom + 1,
      rendering: getComputedStyle(img).imageRendering,
      titleActive: !!document.querySelector('#screen-title.active')
    };
  })()`);
  check('splash is on screen at load', m.present && m.visible,
    m.present ? `bg ${m.bg}, z-index ${m.zIndex}` : '#splash is not in the DOM');
  /* The load-bearing one: a 404 src renders an empty box on the same dark plate
     and is indistinguishable from a correct splash in a screenshot. */
  check('logo actually decoded', !!(m.natW > 0 && m.natH > 0),
    `naturalSize ${m.natW}x${m.natH}, complete=${m.complete}`);
  check('logo has a laid-out box', m.boxW > 0 && m.boxH > 0, `${m.boxW}x${m.boxH}px`);
  check('logo fits inside #app', !!m.fits, `${m.boxW}x${m.boxH} in ${m.appW}x${m.appH}`);
  check('smooth scaling, not pixelated', m.rendering === 'auto', 'image-rendering: ' + m.rendering);
  /* Land the shot in the hold, past the 620ms settle and well before the 1800ms
     fade. Mid-settle the image is on a compositing layer and its own black reads
     two levels off the plate, which is invisible in the hand but shows up as a
     square in a screenshot anyone is judging the look from. */
  await sleep(750);
  const held = await ev(`(() => {
    const s = document.getElementById('splash');
    if (!s) return { gone: true };
    const px = getComputedStyle(document.getElementById('splash-logo'));
    return { gone: false, logoOpacity: px.opacity, splashOpacity: getComputedStyle(s).opacity };
  })()`);
  check('logo is fully settled during the hold', !held.gone && held.logoOpacity === '1'
    && held.splashOpacity === '1', JSON.stringify(held));
  await shot('splash');
  console.log('  wrote tools/_look-splash.png');

  /* ================= 2. a tap gets past it =================================== */
  console.log(NL + 'skip on tap');
  const centre = await ev('({x: Math.round(innerWidth/2), y: Math.round(innerHeight/2)})');
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: centre.x, y: centre.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: centre.x, y: centre.y, button: 'left', clickCount: 1 });
  await sleep(120);
  const afterTap = await ev(`({
    splash: !!document.getElementById('splash'),
    title: !!document.querySelector('#screen-title.active'),
    newGame: !!document.querySelector('#screen-title.active #btn-new-game')
  })`);
  check('tap clears the splash at once', !afterTap.splash,
    afterTap.splash ? 'still in the DOM 120ms after pointerdown' : 'gone in under 120ms');
  check('tap lands on the title screen', afterTap.title && afterTap.newGame,
    'New Season button reachable: ' + afterTap.newGame);

  /* ================= 3. it also leaves on its own ============================ */
  console.log(NL + 'clears itself when left alone');
  await freshBoot();
  const stillUp = await has('#splash');
  check('splash still up right after boot', stillUp, 'nothing to time out otherwise');
  /* 2.28s of animation, plus the grace the module allows for a slow logo decode,
     plus slack for a loaded machine. */
  await sleep(4200);
  const afterWait = await ev(`({
    splash: !!document.getElementById('splash'),
    title: !!document.querySelector('#screen-title.active')
  })`);
  check('splash clears with no input', !afterWait.splash, 'checked 4.2s after boot');
  check('title screen is active underneath', afterWait.title);

  /* ================= 4. and it stays gone ==================================== */
  console.log(NL + 'stays gone across screens');
  await ev("document.getElementById('btn-new-game').click()");
  if (!await waitFor('#screen-create.active')) throw new Error('creation screen never opened');
  check('no splash on the creation screen', !await has('#splash'));
  await ev("document.getElementById('btn-create-back').click()");
  if (!await waitFor('#screen-title.active')) throw new Error('did not get back to the title');
  check('no splash on returning to the title', !await has('#splash'));
  /* Screens.push/pop rather than a button, because the stack is the thing that
     would resurrect a splash implemented as a .screen. */
  await ev("Screens.push('screen-camp'); Screens.pop(); true");
  await sleep(150);
  check('no splash after a push/pop of the stack', !await has('#splash'));

  /* ================= 5. Menu on the title, with no season ==================== */
  console.log(NL + 'title menu with no season in progress');
  const before = errors.length;
  const btn = await ev(`(() => {
    const b = document.getElementById('btn-title-menu');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { text: b.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height),
             onTitle: !!b.closest('#screen-title') };
  })()`);
  check('title screen has a Menu button', !!btn && btn.onTitle && btn.w > 0 && btn.h > 0,
    btn ? `"${btn.text}" ${btn.w}x${btn.h}px` : '#btn-title-menu missing');
  check('no season is in progress', !await ev('!!(GAME.seasonActive && GAME.player)'));

  /* A real tap at the button's coordinates, not .click(): the title screen's
     centred column is a full-bleed flex child sitting right under this corner,
     and .click() would pass a z-index mistake that a thumb would not. */
  const bc = await ev(`(() => {
    const r = document.getElementById('btn-title-menu').getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: bc.x, y: bc.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: bc.x, y: bc.y, button: 'left', clickCount: 1 });
  await sleep(250);
  const menu = await ev(`(() => {
    const veil = document.getElementById('modal-veil');
    const body = document.getElementById('modal-body');
    const txt = body ? body.textContent : '';
    return {
      open: veil.classList.contains('open'),
      title: (document.getElementById('modal-title') || {}).textContent,
      buttons: [...body.querySelectorAll('button')].map(b => b.textContent.trim()),
      /* season-only entries must be absent, not merely non-fatal */
      leaksSeed: /Season seed/i.test(txt),
      leaksAbandon: /Abandon season/i.test(txt),
      hasMotion: /Motion:/.test(txt),
      hasLog: /Design log/.test(txt)
    };
  })()`);
  check('menu opens from the title', menu.open && menu.title === 'Menu', 'title: ' + menu.title);
  check('settings are reachable', menu.hasMotion, menu.buttons.join(' | '));
  check('design log is reachable', menu.hasLog);
  check('no season-only entries', !menu.leaksSeed && !menu.leaksAbandon,
    (menu.leaksSeed ? 'seed shown ' : '') + (menu.leaksAbandon ? 'abandon shown' : 'seed and abandon both hidden'));
  check('opening it threw nothing', errors.length === before,
    errors.slice(before).join(' | ') || 'no exceptions');
  await shot('title-menu');
  console.log('  wrote tools/_look-title-menu.png');

  /* The design log is the reason the button exists at all — it must survive being
     opened with no GAME.player behind it. */
  const beforeLog = errors.length;
  await ev("(() => { Modal.close(); openDesignLog(); })()");
  await sleep(300);
  check('design log opens with no season', await ev("document.getElementById('modal-title').textContent === 'Design log'"));
  check('design log threw nothing', errors.length === beforeLog, errors.slice(beforeLog).join(' | ') || 'no exceptions');
  await ev('Modal.close()');

  /* ================= 6. reduced motion gets a still card ===================== */
  console.log(NL + 'reduced motion');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await send('Page.reload', { ignoreCache: true });
  /* Tight poll for the frame the clock starts on. The still card only lives
     900ms, so waiting on #screen-title.active (250ms granularity) could easily
     miss it and report a working splash as a missing one. */
  let rm = null;
  for (let i = 0; i < 200; i++) {
    rm = await ev(`(() => {
      const s = document.getElementById('splash');
      if (!s || !s.classList.contains('go')) return null;
      const cs = getComputedStyle(s), lg = getComputedStyle(document.getElementById('splash-logo'));
      return { name: cs.animationName, dur: cs.animationDuration, fill: cs.animationFillMode,
               play: cs.animationPlayState, logoName: lg.animationName, logoOpacity: lg.opacity };
    })()`);
    if (rm) break;
    await sleep(25);
  }
  check('reduced motion still shows the card', !!rm, rm ? JSON.stringify(rm) : 'never saw #splash.go');
  check('card stands still instead of animating',
    !!rm && rm.name === 'splash-still' && rm.logoName === 'none' && rm.logoOpacity === '1',
    rm ? `${rm.name} / logo ${rm.logoName}` : 'n/a');
  check('and it is the short one', !!rm && rm.dur === '0.9s' && rm.play === 'running',
    rm ? `${rm.dur}, ${rm.play}` : 'n/a');
  await sleep(1500);
  check('still card clears on its own', !await has('#splash'), 'checked 1.5s after it started');
  await send('Emulation.setEmulatedMedia', { features: [] });

  if (errors.length) console.log(NL + '!! page errors: ' + JSON.stringify(errors.slice(0, 6)));
  const ok = !fails.length && !errors.length;
  if (fails.length) console.log(NL + 'failing checks: ' + fails.join(', '));
  console.log(ok ? NL + 'SPLASH TEST PASS' : NL + 'SPLASH TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})().catch(e => { console.log(NL + 'harness error: ' + e.message + NL + NL + 'SPLASH TEST FAIL'); process.exit(1); });
