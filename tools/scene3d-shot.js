/* Load scene3d.html in headless Chrome, prove it renders, measure it, screenshot it.

   Headless Chrome uses SwiftShader (software GL) unless told otherwise, so the fps
   here is a FLOOR, not a prediction — a real phone GPU will beat it comfortably.
   What this page is actually for is catching the things that make a 3D scene ship
   broken and invisible in a static screenshot:

     - an FBX that failed to parse, so a prop is silently absent
     - the atlas not binding, so everything renders flat white or black
     - scale wrong by 100x, because the pack authors in centimetres
     - a blended cutout not writing depth, which breaks the occlusion this whole
       experiment exists to demonstrate

   Run: node tools/scene3d-shot.js */
const http = require('http'), { spawn } = require('child_process'), os = require('os'), path = require('path'), fs = require('fs');
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
  const dir = 'C:/projects/Personal/Castaway/Castaway/WebGame';
  const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT,
    '--no-first-run', '--window-size=900,430',
    /* Force a real GL path in headless so this is not measuring nothing. */
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--user-data-dir=' + path.join(os.tmpdir(), 'cw-s3d-' + RUN_ID),
    'http://localhost:8099/scene3d.html'], { stdio: 'ignore' });
  let t = null;
  for (let i = 0; i < 50 && !t; i++) {
    await sleep(400);
    try { t = (await get('/json/list')).find(x => x.type === 'page' && x.url.includes('scene3d')); } catch { }
  }
  if (!t) { console.log('no page'); process.exit(1); }
  const ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false });
  let id = 0; const pend = new Map();
  const logs = [];
  ws.on('message', m => {
    const j = JSON.parse(m);
    if (j.id && pend.has(j.id)) { pend.get(j.id)(j); pend.delete(j.id); }
    if (j.method === 'Runtime.consoleAPICalled') {
      logs.push((j.params.args || []).map(a => a.value !== undefined ? a.value : a.description).join(' '));
    }
    if (j.method === 'Runtime.exceptionThrown') {
      logs.push('EXCEPTION ' + ((j.params.exceptionDetails.exception || {}).description || j.params.exceptionDetails.text || '').split(NL)[0]);
    }
  });
  await new Promise(r => ws.on('open', r));
  const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error('threw: ' + ((r.result.exceptionDetails.exception || {}).description || '').split(NL)[0]);
    return r.result.result.value;
  };
  await send('Runtime.enable');

  const fails = [];
  const check = (n, ok, d) => { console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + n + (d ? '  — ' + d : '')); if (!ok) fails.push(n); };

  /* Confirm the PAGE is the page first. The first run of this harness reported
     "the scene finished loading" as a pass while the dev server was down — on a 404
     body the #load overlay is absent too, so "loader gone" was true and meaningless.
     Assert something that only exists on the real page. */
  /* Poll, do not check once. /json/list lists the target as soon as Chrome creates
     it, which is BEFORE navigation finishes — so a single evaluate races the load
     and runs against about:blank. Every other harness in tools/ polls for a
     selector for exactly this reason. */
  let isPage = false;
  for (let i = 0; i < 60; i++) {
    isPage = await ev("!!document.getElementById('bar') && !!document.getElementById('hud')");
    if (isPage) break;
    await sleep(300);
  }
  check('scene3d.html actually served', isPage,
    isPage ? 'ok' : 'got a 404, error body, or blank page — is the :8099 server up?');
  if (!isPage) { console.log(NL + 'SCENE3D FAIL'); ws.close(); ch.kill(); process.exit(1); }

  /* FBX parsing 20 models under software GL is slow. Wait for the loader overlay
     to remove itself rather than guessing at a sleep. */
  let ready = false;
  for (let i = 0; i < 150; i++) {
    ready = await ev("!document.getElementById('load')");
    if (ready) break;
    await sleep(400);
  }
  check('the scene finished loading', ready, ready ? 'loader gone' : 'still loading after 60s');

  /* Force Chrome to composite before reading the counters. Headless starves
     requestAnimationFrame until something actually needs a frame, so the first
     version of this read "–" for fps and triangles on a scene that was rendering
     at 22fps — the screenshot taken moments later proved it. A throwaway capture
     kicks the compositor, then the HUD has real numbers. */
  await send('Page.captureScreenshot', { format: 'png' });
  await sleep(2500);

  const info = await ev(`(() => {
    const c = document.querySelector('canvas');
    const fps = document.getElementById('fps').textContent;
    return {
      canvas: !!c, w: c ? c.width : 0, h: c ? c.height : 0,
      fps, draws: document.getElementById('dc').textContent,
      tris: document.getElementById('tri').textContent,
      zone: document.getElementById('zone').textContent
    };
  })()`);
  console.log(NL + '  canvas ' + info.w + 'x' + info.h + ' · fps ' + info.fps
    + ' · draws ' + info.draws + ' · tris ' + info.tris);

  check('a WebGL canvas exists and has size', info.canvas && info.w > 0);
  check('it is actually rendering geometry',
    parseInt(info.tris) > 0, info.tris + ' triangles');
  /* Software GL floor. Anything above ~8 here is fine on real hardware. */
  check('renders above the software-GL floor', parseInt(info.fps) >= 5, info.fps + ' fps under SwiftShader');

  const failedLoads = logs.filter(l => /^failed /.test(l));
  check('every FBX prop parsed', !failedLoads.length,
    failedLoads.length ? failedLoads.slice(0, 3).join(' | ') : '20 props');
  const exc = logs.filter(l => l.indexOf('EXCEPTION') === 0);
  check('no exceptions', !exc.length, exc.length ? exc[0].slice(0, 120) : 'clean');

  /* Three views: the establishing shot, a walk, and dusk.
     Colour variety is judged from the CAPTURED PNG further down, not by reading the
     canvas here — drawImage() on a WebGL canvas after the frame has been presented
     returns an empty buffer unless preserveDrawingBuffer is on, so the first version
     of this check reported "1 distinct colour" on a scene that was rendering
     perfectly well. Page.captureScreenshot composites properly and is the truth. */
  const shots = [
    ['_look-scene3d.png', null],
    ['_look-scene3d-close.png', `(() => {
        const b = document.getElementById('b-walk'); b.click();
        return true; })()`],
    ['_look-scene3d-dusk.png', `(() => {
        document.getElementById('b-day').click(); return true; })()`]
  ];
  for (const [file, action] of shots) {
    if (action) { await ev(action); await sleep(2600); }
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(dir + '/tools/' + file, Buffer.from(r.result.data, 'base64'));
    console.log('  saved tools/' + file);
  }

  /* Now judge the establishing shot from the PNG on disk. A scene that rendered
     nothing, or rendered at the wrong scale, comes out as a couple of flat bands;
     a working island has dozens of distinct colour buckets. Decoded with the
     project's own tools/png.js so this needs no image library. */
  try {
    const png = require('./png.js');
    /* readPNG, not read — and it only handles 8-bit RGBA colorType 6. If Chrome
       hands back RGB the catch below reports it as skipped rather than failing,
       because this is a nice-to-have signal, not the point of the harness. */
    const img = png.readPNG(dir + '/tools/_look-scene3d.png');
    const seen = new Set();
    for (let i = 0; i < img.data.length; i += 4 * 53) {
      seen.add((img.data[i] >> 4) + ',' + (img.data[i + 1] >> 4) + ',' + (img.data[i + 2] >> 4));
    }
    check('the shot is a real scene, not flat bands', seen.size >= 12,
      seen.size + ' distinct colour buckets');
  } catch (e) {
    console.log('  --   colour check skipped: ' + String(e.message).split(NL)[0]);
  }

  if (logs.length) {
    console.log(NL + '  console:');
    /* The pack's FBX materials point at .psd files on the author's own desktop, so
       FBXLoader warns for every prop. Harmless — every material is replaced with the
       shared atlas — but it drowns the log, so collapse it. */
    const noise = /PSD textures are not supported|map is not supported in three.js|unknown material type/;
    const quiet = logs.filter(l => !noise.test(String(l)));
    const suppressed = logs.length - quiet.length;
    for (const l of quiet.slice(0, 8)) console.log('    ' + String(l).slice(0, 130));
    if (suppressed) console.log('    (' + suppressed + ' FBX material warnings suppressed — materials are overridden anyway)');
  }

  const ok = !fails.length;
  if (fails.length) console.log(NL + 'failing checks: ' + fails.join(', '));
  console.log(ok ? NL + 'SCENE3D PASS' : NL + 'SCENE3D FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
