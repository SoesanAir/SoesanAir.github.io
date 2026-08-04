/* Boot-check for editor.html in headless Chrome.

   A 3D editor can ship broken and invisible: an atlas that fails to bind, a GLB
   that 404s, a null-guard that throws on first click. This loads the real page,
   waits for boot, places one prop from EACH atlas pack (so every material and the
   GLB loader are exercised), round-trips through the environment JSON, and fails
   loudly on any console exception.

   Run: node tools/editor-check.js
*/
const http = require('http'), { spawn } = require('child_process'), os = require('os'), path = require('path');
const WebSocket = require('ws');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const RUN = process.pid.toString(36) + Math.floor(Math.random() * 1e6).toString(36);
const PORT = 8200 + Math.floor(Math.random() * 1500);
const DBG = 9200 + Math.floor(Math.random() * 1500);
const NL = String.fromCharCode(10);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = p => new Promise((s, j) => http.get({ host: '127.0.0.1', port: DBG, path: p }, r => {
  let d = ''; r.on('data', c => d += c); r.on('end', () => s(JSON.parse(d)));
}).on('error', j));

(async () => {
  const server = spawn('node', [path.join(__dirname, 'serve.js'), String(PORT)], { stdio: 'ignore' });
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + DBG,
    '--no-first-run', '--window-size=1000,600',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--user-data-dir=' + path.join(os.tmpdir(), 'cw-editor-' + RUN),
    'http://localhost:' + PORT + '/editor.html'], { stdio: 'ignore' });

  const done = (code, msg) => { try { chrome.kill(); } catch {} try { server.kill(); } catch {} console.log(msg); process.exit(code); };

  let target = null;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(400);
    try { target = (await getJSON('/json/list')).find(x => x.type === 'page' && x.url.includes('editor')); } catch {}
  }
  if (!target) return done(1, 'FAIL: editor page never opened');

  const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false });
  let id = 0; const pend = new Map(); const errors = [];
  ws.on('message', m => {
    const j = JSON.parse(m);
    if (j.id && pend.has(j.id)) { pend.get(j.id)(j); pend.delete(j.id); }
    if (j.method === 'Runtime.exceptionThrown') {
      errors.push('EXCEPTION ' + ((j.params.exceptionDetails.exception || {}).description || j.params.exceptionDetails.text || '').split(NL)[0]);
    }
    if (j.method === 'Runtime.consoleAPICalled' && j.params.type === 'error') {
      errors.push('console.error ' + (j.params.args || []).map(a => a.value || a.description).join(' '));
    }
  });
  await new Promise(r => ws.on('open', r));
  const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
    if (r.result && r.result.exceptionDetails) throw new Error((r.result.exceptionDetails.exception || {}).description || 'threw');
    return r.result.result.value;
  };
  await send('Runtime.enable');

  // Wait for boot (the debug handle appears only after a clean boot).
  let ready = false;
  for (let i = 0; i < 40 && !ready; i++) { await sleep(500); ready = await ev('!!window.__editor').catch(() => false); }
  if (!ready) return done(1, 'FAIL: editor did not boot (window.__editor never appeared)' + (errors.length ? NL + errors.join(NL) : ''));

  const catalogue = await ev('window.__editor.names().length');
  if (!catalogue) return done(1, 'FAIL: prop catalogue empty');

  // One prop per atlas pack — exercises every material path and the GLB loader.
  // Includes the two new packs (TEM Apple, DS Barn) when present in the catalogue.
  const names = await ev('window.__editor.names()');
  const nameSet = new Set(names);
  const want = [['Palm_Tree_01A', 'TAI'], ['Braizer_01A', 'TFD'], ['Fern_01A', 'TFF'], ['Rock_Boulder_1A', 'TNA'], ['Grass_Patch_01', 'grass'], ['Apple_01A', 'TEM'], ['Barn_01A', 'DS']];
  const probes = want.map(w => w[0]).filter(n => nameSet.has(n));
  const placed = await ev(
    '(async () => { const E = window.__editor; let x = -15;' +
    ' for (const n of ' + JSON.stringify(probes) + ') { await E.spawn(n, x, 0, { scale: 1 }); x += 5; }' +
    ' return E.count(); })()'
  );
  if (placed !== probes.length) return done(1, 'FAIL: placed ' + placed + ' of ' + probes.length + ' probe props');
  const packsCovered = want.filter(w => nameSet.has(w[0])).map(w => w[1]);

  // Screenshot for a human colour check across packs.
  try {
    await send('Page.enable');
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    if (shot.result && shot.result.data) require('fs').writeFileSync(require('path').join(__dirname, '_editor-shot.png'), Buffer.from(shot.result.data, 'base64'));
  } catch {}

  // Export and round-trip.
  const env = await ev('JSON.stringify(window.__editor.toEnv())').then(JSON.parse);
  if (!env || env.format !== 'castaway-env' || env.props.length !== probes.length)
    return done(1, 'FAIL: export malformed');
  const back = await ev('(async () => { await window.__editor.fromEnv(' + JSON.stringify(env) + '); return window.__editor.count(); })()');
  if (back !== probes.length) return done(1, 'FAIL: reload round-trip gave ' + back);

  if (errors.length) return done(1, 'FAIL: console errors during boot' + NL + errors.join(NL));

  done(0, 'PASS: booted, catalogue ' + catalogue + ' props, placed+exported+reloaded ' + probes.length +
    ' props covering packs [' + packsCovered.join(', ') + '], no console errors. Screenshot: tools/_editor-shot.png');
})().catch(e => { console.log('FAIL: ' + (e && e.message || e)); process.exit(1); });
