/* Convert the staged FBX to GLB, in headless Chrome, using the project's own three.js.

   There is no Blender and no FBX SDK on this machine, and FBX is not a shipping
   format — 21 MB of it for 100 props, and FBXLoader takes seconds per model even on
   a desktop. GLB parses an order of magnitude faster and is a fraction of the size
   once the dead material and attribute data is stripped.

   Using the same three.js that will later load the result is a deliberate choice:
   anything that survives this round trip is loadable at runtime by construction.

   Prerequisite: node tools/scene-manifest.js --stage
   Run:          node tools/fbx2glb.js
*/
const http = require('http'), { spawn } = require('child_process'), os = require('os'), path = require('path'), fs = require('fs');
const WebSocket = require('ws');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9300 + Math.floor(Math.random() * 1500);
const NL = String.fromCharCode(10);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = p => new Promise((s, j) => http.get({ host: '127.0.0.1', port: PORT, path: p }, r => {
  let d = ''; r.on('data', c => d += c); r.on('end', () => s(JSON.parse(d)));
}).on('error', j));

(async () => {
  const dir = path.join(__dirname, '..');
  const stage = path.join(__dirname, '_fbx');
  if (!fs.existsSync(path.join(stage, 'index.json'))) {
    console.log('no tools/_fbx/index.json — run: node tools/scene-manifest.js --stage');
    process.exit(1);
  }
  const staged = JSON.parse(fs.readFileSync(path.join(stage, 'index.json'), 'utf8'));
  const index = staged.scenes || staged;
  const stagedPack = staged.pack || {};
  const names = [...new Set(Object.values(index).flat())];
  const out = path.join(dir, 'assets/scene3d/models');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT,
    '--no-first-run', '--window-size=600,400', '--disable-gpu',
    '--user-data-dir=' + path.join(os.tmpdir(), 'cw-conv-' + process.pid),
    'http://localhost:8099/tools/_convert.html'], { stdio: 'ignore' });
  let t = null;
  for (let i = 0; i < 60 && !t; i++) {
    await sleep(400);
    try { t = (await get('/json/list')).find(x => x.type === 'page' && x.url.includes('_convert')); } catch { }
  }
  if (!t) { console.log('no converter page — is the :8099 server up?'); process.exit(1); }
  const ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
  let id = 0; const pend = new Map();
  ws.on('message', m => { const j = JSON.parse(m); if (j.id && pend.has(j.id)) { pend.get(j.id)(j); pend.delete(j.id); } });
  await new Promise(r => ws.on('open', r));
  const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) {
      throw new Error(((r.result.exceptionDetails.exception || {}).description || r.result.exceptionDetails.text || '').split(NL)[0]);
    }
    return r.result.result.value;
  };
  await send('Runtime.enable');
  for (let i = 0; i < 80; i++) { if (await ev('!!window.__ready')) break; await sleep(300); }

  console.log('converting ' + names.length + ' models' + NL);
  let srcTotal = 0, dstTotal = 0, failed = [], stats = [];
  for (const name of names) {
    const src = path.join(stage, name + '.fbx');
    const srcBytes = fs.existsSync(src) ? fs.statSync(src).size : 0;
    try {
      const r = await ev('convert(' + JSON.stringify(name) + ')');
      fs.writeFileSync(path.join(out, name + '.glb'), Buffer.from(r.b64, 'base64'));
      srcTotal += srcBytes; dstTotal += r.bytes;
      stats.push({ name, src: srcBytes, dst: r.bytes, tris: r.tris, meshes: r.meshes, uv: r.hadUV });
      /* A prop with no UVs cannot pick a colour out of the palette atlas and will
         render as whatever pixel 0,0 happens to be. Worth knowing about now rather
         than wondering later why one rock is the wrong colour. */
      if (!r.hadUV) console.log('  ! ' + name + ' has NO UVs — will mis-colour');
    } catch (e) {
      failed.push(name + ': ' + String(e.message).slice(0, 70));
    }
  }

  stats.sort((a, b) => b.dst - a.dst);
  console.log('  largest:');
  for (const s of stats.slice(0, 8)) {
    console.log('    ' + s.name.padEnd(26) + (s.dst / 1024).toFixed(0).padStart(5) + ' KB  '
      + String(s.tris).padStart(6) + ' tris  ' + s.meshes + ' mesh');
  }
  console.log('');
  console.log('  FBX in   : ' + (srcTotal / 1048576).toFixed(1) + ' MB');
  console.log('  GLB out  : ' + (dstTotal / 1048576).toFixed(2) + ' MB   ('
    + (100 - dstTotal / srcTotal * 100).toFixed(0) + '% smaller)');
  console.log('  triangles: ' + stats.reduce((a, s) => a + s.tris, 0).toLocaleString() + ' across ' + stats.length + ' props');
  if (failed.length) {
    console.log(NL + '  FAILED ' + failed.length + ':');
    for (const f of failed) console.log('    ' + f);
  }

  /* The runtime index: which props belong to which scene. Written next to the GLBs
     so the game has one file to fetch to know what exists. */
  const ok = new Set(stats.map(s => s.name));
  const runtime = {};
  for (const scene in index) runtime[scene] = index[scene].filter(n => ok.has(n));
  /* props.json carries BOTH the per-scene lists and a name->pack map. The pack is not
     cosmetic bookkeeping: it decides which atlas a prop's UVs address, because every
     pack ships its own palette. Writing only the scene lists here silently dropped the
     map and sent 50 of 107 props back to the wrong atlas. */
  const packOf = {};
  for (const nm in stagedPack) if (ok.has(nm)) packOf[nm] = stagedPack[nm];
  fs.writeFileSync(path.join(out, '..', 'props.json'), JSON.stringify({ scenes: runtime, pack: packOf }));
  console.log(NL + '  wrote assets/scene3d/props.json');
  console.log(failed.length ? NL + 'CONVERT PARTIAL' : NL + 'CONVERT OK');
  ws.close(); ch.kill(); process.exit(failed.length ? 1 : 0);
})();
