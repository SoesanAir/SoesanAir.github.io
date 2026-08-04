/* Build the ENVIRONMENT EDITOR's asset library from all six source packs.

   The game ships a curated 107 props (assets/scene3d/props.json) and loads them all
   up front, so it must stay small. The editor is different: it lazy-loads a GLB only
   when you place that prop, so it can afford a library of hundreds. This tool pulls a
   broad, variant-capped selection across all six packs, converts anything not already
   converted, and writes a SEPARATE catalogue (props-editor.json) that only the editor
   reads. The game's props.json is never touched.

   Reuses tools/_convert.html (FBX->GLB in headless Chrome with the project's own
   three.js), so anything that survives is loadable at runtime by construction.
   Additive and resumable: a GLB that already exists is reused, not reconverted.

   Run:  node tools/build-editor-assets.js [--limit N] [--maxv N]
*/
const http = require('http'), { spawn } = require('child_process'), os = require('os'), path = require('path'), fs = require('fs');
const WebSocket = require('ws');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ROOT = 'C:/projects/Personal/Castaway/Castaway/More Assets Then You Need/Assets';
const WEB = path.join(__dirname, '..');
const MODELS = path.join(WEB, 'assets/scene3d/models');
const STAGE = path.join(__dirname, '_fbx');
const NL = String.fromCharCode(10);
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? +process.argv[i + 1] : d; };
const LIMIT = arg('--limit', 900);      // cap on NEW conversions this run
const MAXV = arg('--maxv', 3);          // variants per family per pack
const sleep = ms => new Promise(r => setTimeout(r, ms));

const PACKS = [
  { key: 'TAI', dir: 'Toon Adventure Island' },
  { key: 'TFF', dir: 'Toon Fantasy Nature' },
  { key: 'TNA', dir: 'Toon Nature Assets' },
  { key: 'TFD', dir: 'Toon Deserted Temples' },
  { key: 'TEM', dir: 'Toon Enchanted Meadow' },
  { key: 'DS', dir: 'Toon Desert' }
];
const PREFIX = /^(TAI|TFF|TFD|TNA|TEM|DS)_/;
/* Whole subtrees that are not environment props. */
const SKIP_PATH = /MeshCollider|_LOD|[\\/](Colliders|Source|Variants|Characters|Vehicles|Roads|Decals|Terrain|Skybox|Particles|Animations|Documentation|Scenes|Shaders|Profiles|Materials)[\\/]/i;
const SKIP_NAME = /_Mobile$|Collider|_Nav$/i;

const CAT_WORDS = ['Vegetation', 'Rocks', 'Props', 'Buildings', 'Ruins', 'Water', 'Animals',
  'Nautical', 'Treasure', 'Weapons', 'Skeletons', 'Pottery', 'Candles', 'Structures',
  'Background', 'Boats', 'Food', 'Wood'];
/* Fallback categoriser by name when the folder does not carry a known category. */
function categoryFrom(file, name) {
  const segs = file.split(/[\\/]/);
  for (const s of segs) if (CAT_WORDS.includes(s)) return s.toLowerCase();
  const n = name.toLowerCase();
  if (/palm|tree|bush|plant|fern|flower|grass|vine|reed|cactus|aspen|leaf|leaves|shrub|nettle|mushroom|sapling/.test(n)) return 'vegetation';
  if (/rock|boulder|cliff|stone|pebble/.test(n)) return 'rocks';
  if (/log|trunk|branch|twig|stump|deadfall/.test(n)) return 'wood';
  if (/skull|bone|skeleton/.test(n)) return 'skeletons';
  if (/column|altar|pillar|statue|ruin|temple|arch|plinth|stair|obelisk/.test(n)) return 'ruins';
  if (/boat|raft|anchor|net|buoy|oar|dock/.test(n)) return 'nautical';
  if (/shell|starfish|coconut|turtle|coral/.test(n)) return 'beach';
  if (/cloud|mountain|hill/.test(n)) return 'background';
  if (/crate|barrel|cloth|fire|camp|tent|torch|jug|sack|pot|basket|bucket|table|chair|bed|shelf|ladder|plank|stake|cauldron|tripod/.test(n)) return 'camp';
  if (/bridge|scaffold|rope|flag|pole|grip|steps|platform/.test(n)) return 'challenge';
  if (/building|house|hut|barn|wall|roof|door|window|fence/.test(n)) return 'buildings';
  return 'props';
}
const family = name => name
  .replace(/_Module_\d+.*$/i, '')
  .replace(/_\d+[A-Za-z]?$/i, '')
  .replace(/_\d+$/i, '') || name;

function walk(d, cb) {
  let e = [];
  try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const x of e) { const p = path.join(d, x.name); if (x.isDirectory()) walk(p, cb); else cb(p); }
}

/* ---- resolve candidates across every pack ---- */
function resolve() {
  const byName = {};             // name -> { name, file, pack, cat }
  const famCount = {};           // pack|cat|family -> n
  for (const { key, dir } of PACKS) {
    const found = [];
    walk(path.join(ROOT, dir), f => { if (/\.fbx$/i.test(f) && !SKIP_PATH.test(f)) found.push(f); });
    found.sort();
    for (const f of found) {
      const base = path.basename(f, path.extname(f));
      const name = base.replace(PREFIX, '');
      if (!/^[A-Za-z0-9_]+$/.test(name) || SKIP_NAME.test(name)) continue;
      if (byName[name]) continue;                 // first pack wins on collision
      const cat = categoryFrom(f, name);
      const fk = key + '|' + cat + '|' + family(name);
      famCount[fk] = (famCount[fk] || 0) + 1;
      if (famCount[fk] > MAXV) continue;           // cap near-identical variants
      byName[name] = { name, file: f, pack: key, cat };
    }
  }
  return Object.values(byName);
}

(async () => {
  console.log('resolving all six packs (maxv ' + MAXV + ')…');
  const all = resolve();
  const have = new Set(fs.existsSync(MODELS) ? fs.readdirSync(MODELS).filter(f => f.endsWith('.glb')).map(f => f.slice(0, -4)) : []);
  const reuse = all.filter(c => have.has(c.name));
  let need = all.filter(c => !have.has(c.name));

  /* Round-robin by pack so a --limit still covers every pack. */
  const byPack = {}; for (const c of need) (byPack[c.pack] = byPack[c.pack] || []).push(c);
  const order = []; let more = true;
  while (more) { more = false; for (const k of Object.keys(byPack)) { const a = byPack[k]; if (a.length) { order.push(a.shift()); more = true; } } }
  const convert = order.slice(0, LIMIT);
  const skipped = order.length - convert.length;

  const catCount = {}; for (const c of all) catCount[c.cat] = (catCount[c.cat] || 0) + 1;
  console.log('  total ' + all.length + ' props · reuse ' + reuse.length + ' · to convert ' + convert.length + (skipped ? ' (+' + skipped + ' over --limit)' : ''));
  console.log('  categories: ' + Object.entries(catCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(' · '));

  /* ---- stage the FBX we still need to convert ---- */
  fs.mkdirSync(STAGE, { recursive: true });
  fs.mkdirSync(MODELS, { recursive: true });
  for (const c of convert) {
    const dest = path.join(STAGE, c.name + '.fbx');
    if (!fs.existsSync(dest)) fs.copyFileSync(c.file, dest);
  }

  /* ---- write the catalogue up front (names we INTEND to have); prune failures after ---- */
  const scenes = {}; const packMap = {};
  const keep = reuse.concat(convert);
  for (const c of keep) { (scenes[c.cat] = scenes[c.cat] || []).push(c.name); packMap[c.name] = c.pack; }

  let converted = [], failed = [];
  if (convert.length) {
    const PORT = 8300 + Math.floor(Math.random() * 1200);
    const DBG = 9300 + Math.floor(Math.random() * 1200);
    const server = spawn('node', [path.join(__dirname, 'serve.js'), String(PORT)], { stdio: 'ignore' });
    const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + DBG,
      '--no-first-run', '--window-size=600,400', '--disable-gpu',
      '--user-data-dir=' + path.join(os.tmpdir(), 'cw-edconv-' + process.pid),
      'http://localhost:' + PORT + '/tools/_convert.html'], { stdio: 'ignore' });
    const getList = () => new Promise((s, j) => http.get({ host: '127.0.0.1', port: DBG, path: '/json/list' }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => s(JSON.parse(d))); }).on('error', j));
    let t = null;
    for (let i = 0; i < 60 && !t; i++) { await sleep(400); try { t = (await getList()).find(x => x.type === 'page' && x.url.includes('_convert')); } catch {} }
    if (!t) { console.log('FAIL: converter page never opened'); server.kill(); chrome.kill(); process.exit(1); }
    const ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
    let id = 0; const pend = new Map();
    ws.on('message', m => { const j = JSON.parse(m); if (j.id && pend.has(j.id)) { pend.get(j.id)(j); pend.delete(j.id); } });
    await new Promise(r => ws.on('open', r));
    const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
    const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(((r.result.exceptionDetails.exception || {}).description || '').split(NL)[0]); return r.result.result.value; };
    await send('Runtime.enable');
    for (let i = 0; i < 80; i++) { if (await ev('!!window.__ready')) break; await sleep(300); }

    console.log('converting ' + convert.length + ' models…');
    let i = 0;
    for (const c of convert) {
      try {
        const r = await ev('convert(' + JSON.stringify(c.name) + ')');
        fs.writeFileSync(path.join(MODELS, c.name + '.glb'), Buffer.from(r.b64, 'base64'));
        converted.push(c.name);
      } catch (e) { failed.push(c.name + ': ' + String(e.message).slice(0, 50)); }
      if (++i % 25 === 0) console.log('  ' + i + '/' + convert.length + ' (' + failed.length + ' failed)');
    }
    ws.close(); chrome.kill(); server.kill();
  }

  /* Prune any failed conversions from the catalogue so the editor never 404s. */
  const failedNames = new Set(failed.map(f => f.split(':')[0]));
  for (const cat in scenes) scenes[cat] = scenes[cat].filter(n => !failedNames.has(n));
  for (const n of failedNames) delete packMap[n];
  const finalCount = Object.keys(packMap).length;

  fs.writeFileSync(path.join(WEB, 'assets/scene3d/props-editor.json'),
    JSON.stringify({ format: 'castaway-editor-catalogue', scenes, pack: packMap }));

  console.log(NL + 'wrote assets/scene3d/props-editor.json — ' + finalCount + ' props ('
    + reuse.length + ' reused, ' + converted.length + ' new)');
  if (failed.length) { console.log(failed.length + ' failed:'); for (const f of failed.slice(0, 15)) console.log('  ! ' + f); }
  console.log(skipped ? 'NOTE: ' + skipped + ' more available beyond --limit ' + LIMIT + ' — raise it to include them.' : 'DONE');
  process.exit(0);
})().catch(e => { console.log('FATAL: ' + (e && e.stack || e)); process.exit(1); });
