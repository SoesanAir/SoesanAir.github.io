/* Reproduce the REAL left-click placement path in headless Chrome.
   The boot-check only places props programmatically; this arms a brush from the
   palette and dispatches an actual mouse click on the canvas, then checks a prop
   landed. Run: node tools/editor-click-test.js */
const http = require('http'), { spawn } = require('child_process'), os = require('os'), path = require('path');
const WebSocket = require('ws');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 8200 + Math.floor(Math.random() * 1500), DBG = 9200 + Math.floor(Math.random() * 1500);
const NL = String.fromCharCode(10), sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = p => new Promise((s, j) => http.get({ host: '127.0.0.1', port: DBG, path: p }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => s(JSON.parse(d))); }).on('error', j));

(async () => {
  const server = spawn('node', [path.join(__dirname, 'serve.js'), String(PORT)], { stdio: 'ignore' });
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + DBG, '--no-first-run', '--window-size=1000,600',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--user-data-dir=' + path.join(os.tmpdir(), 'cw-clk-' + process.pid),
    'http://localhost:' + PORT + '/editor.html'], { stdio: 'ignore' });
  const done = (c, m) => { try { chrome.kill(); } catch {} try { server.kill(); } catch {} console.log(m); process.exit(c); };

  let target = null;
  for (let i = 0; i < 50 && !target; i++) { await sleep(400); try { target = (await getJSON('/json/list')).find(x => x.type === 'page' && x.url.includes('editor')); } catch {} }
  if (!target) return done(1, 'FAIL: page never opened');
  const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false });
  let id = 0; const pend = new Map(); const errors = [];
  ws.on('message', m => { const j = JSON.parse(m); if (j.id && pend.has(j.id)) { pend.get(j.id)(j); pend.delete(j.id); } if (j.method === 'Runtime.exceptionThrown') errors.push('EXC ' + ((j.params.exceptionDetails.exception || {}).description || '').split(NL)[0]); });
  await new Promise(r => ws.on('open', r));
  const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.result && r.result.exceptionDetails) throw new Error((r.result.exceptionDetails.exception || {}).description || 'threw'); return r.result.result.value; };
  await send('Runtime.enable');

  let ready = false;
  for (let i = 0; i < 40 && !ready; i++) { await sleep(500); ready = await ev('!!window.__editor').catch(() => false); }
  if (!ready) return done(1, 'FAIL: no boot');

  // Arm a brush by clicking the first palette row, like a user.
  const armed = await ev("(()=>{const it=document.querySelector('#list .item'); if(!it) return null; it.click(); return {brush:document.getElementById('brush').textContent, shown:document.getElementById('brush').style.display!=='none'};})()");
  const before = await ev('window.__editor.count()');

  // Real mouse click at the centre of the 3D viewport (avoid the side panels).
  const cx = 500, cy = 320;
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', buttons: 1, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(600);
  const afterMouse = await ev('window.__editor.count()');

  // Fallback: dispatch a synthetic PointerEvent, to tell "handler not firing" from
  // "raycast missing the ground".
  let afterSynthetic = afterMouse;
  if (afterMouse === before) {
    afterSynthetic = await ev("(async()=>{const c=document.getElementById('view');const r=c.getBoundingClientRect();const opt={bubbles:true,cancelable:true,button:0,buttons:1,clientX:r.left+r.width/2,clientY:r.top+r.height/2,pointerId:1,pointerType:'mouse'};c.dispatchEvent(new PointerEvent('pointerdown',opt));await new Promise(r=>setTimeout(r,300));window.dispatchEvent(new PointerEvent('pointerup',opt));await new Promise(r=>setTimeout(r,200));return window.__editor.count();})()");
  }

  const msg = 'armed=' + JSON.stringify(armed) + ' before=' + before + ' afterMouse=' + afterMouse + ' afterSynthetic=' + afterSynthetic + (errors.length ? NL + errors.join(NL) : '');
  if (afterMouse > before) return done(0, 'PASS: real mouse click placed a prop. ' + msg);
  if (afterSynthetic > before) return done(2, 'DIAG: synthetic pointer worked but CDP mouse did not (test artifact); handler+raycast OK. ' + msg);
  return done(3, 'REPRO: click placed nothing — handler or raycast broken. ' + msg);
})().catch(e => { console.log('FAIL: ' + (e && e.message || e)); process.exit(1); });
