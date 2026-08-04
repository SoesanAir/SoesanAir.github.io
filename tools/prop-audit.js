/* Render EVERY prop in the library, one at a time, and prove it works.

   658 props from six packs is far too many to eyeball, and the failures are exactly
   the kind that hide: a prop can load without error and still be invisible, or flat
   black, or 20 metres tall, or sampling another pack's palette. Every one of those has
   actually happened in this project. So each prop gets rendered alone against a known
   background and the framebuffer is measured.

   What each verdict means:

     EMPTY    nothing drew. Geometry missing, or scaled to a speck, or all backfaces.
     FLAT     one colour only. Almost always the wrong atlas — a prop whose UVs point
              into another pack's palette lands on a single swatch and comes out a
              solid block. This is the check that caught 50 mis-atlased props.
     NO_UV    no texture coordinates, so it cannot pick a colour at all and renders as
              whatever pixel 0,0 happens to be.
     GIANT    over 30 m tall. The Temples pack authors gateways you walk through; one
              of them put a 29 m carved head just off the top of frame.
     SPECK    under 5 cm. Nothing will ever see it.
     OK       drew real geometry in more than one colour at a sane size.

   Also writes a contact sheet so the whole library can be judged by eye at once, and
   a machine-readable report for the docs.

   Run: node tools/prop-audit.js            audit everything
        node tools/prop-audit.js Palm Rock   audit only names matching these
*/
const http = require('http'), { spawn } = require('child_process'), os = require('os'), path = require('path'), fs = require('fs');
const WebSocket = require('ws');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9300 + Math.floor(Math.random() * 1600);
const NL = String.fromCharCode(10);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = p => new Promise((s, j) => http.get({ host: '127.0.0.1', port: PORT, path: p }, r => {
  let d = ''; r.on('data', c => d += c); r.on('end', () => s(JSON.parse(d)));
}).on('error', j));

(async () => {
  const dir = path.join(__dirname, '..');
  const filters = process.argv.slice(2).filter(a => !a.startsWith('--'));

  const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT,
    '--no-first-run', '--window-size=900,430',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--user-data-dir=' + path.join(os.tmpdir(), 'cw-audit-' + process.pid),
    'http://localhost:8099/tools/_audit.html'], { stdio: 'ignore' });
  let t = null;
  for (let i = 0; i < 60 && !t; i++) {
    await sleep(500);
    try { t = (await get('/json/list')).find(x => x.type === 'page' && x.url.includes('_audit')); } catch { }
  }
  if (!t) { console.log('no audit page — is the :8099 server up?'); process.exit(1); }
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
  for (let i = 0; i < 160; i++) { if (await ev('!!window.__auditReady')) break; await sleep(500); }
  if (!await ev('!!window.__auditReady')) { console.log('audit page never became ready'); process.exit(1); }

  const names = await ev('__auditNames(' + JSON.stringify(filters) + ')');
  console.log('auditing ' + names.length + ' props' + NL);

  const rows = [];
  for (const name of names) {
    let r;
    try { r = await ev('__auditOne(' + JSON.stringify(name) + ')'); }
    catch (e) { r = { name, verdict: 'THREW', note: String(e.message).slice(0, 80) }; }
    rows.push(r);
    if (r.verdict !== 'OK') {
      console.log('  ' + r.verdict.padEnd(6) + name.padEnd(34)
        + (r.note || '') + (r.h !== undefined ? '  h=' + r.h + 'm' : ''));
    }
  }

  /* ---------- summary ---------- */
  const by = {};
  for (const r of rows) by[r.verdict] = (by[r.verdict] || 0) + 1;
  console.log('');
  console.log('VERDICTS');
  for (const v of Object.keys(by).sort()) {
    console.log('  ' + v.padEnd(7) + String(by[v]).padStart(4)
      + (v === 'OK' ? '   renders with real geometry and more than one colour' : ''));
  }
  const okPct = Math.round((by.OK || 0) / rows.length * 100);
  console.log('  ' + okPct + '% of the library renders cleanly');

  /* Per-pack, because a whole pack failing points at its atlas rather than its models. */
  const packs = {};
  for (const r of rows) {
    const p = r.pack || '?';
    packs[p] = packs[p] || { n: 0, ok: 0 };
    packs[p].n++; if (r.verdict === 'OK') packs[p].ok++;
  }
  console.log('');
  console.log('BY PACK');
  for (const p of Object.keys(packs).sort()) {
    console.log('  ' + p.padEnd(5) + String(packs[p].ok).padStart(4) + ' / '
      + String(packs[p].n).padStart(4) + ' ok');
  }

  /* Size outliers are worth naming: they are what blows the download budget. */
  const heavy = rows.filter(r => r.kb).sort((a, b) => b.kb - a.kb).slice(0, 10);
  console.log('');
  console.log('HEAVIEST (download budget)');
  for (const r of heavy) console.log('  ' + r.name.padEnd(34) + String(r.kb).padStart(5) + ' KB  ' + String(r.tris).padStart(6) + ' tris');

  fs.writeFileSync(path.join(__dirname, '_prop-audit.json'), JSON.stringify(rows, null, 1));
  console.log('');
  console.log('wrote tools/_prop-audit.json');

  /* Contact sheet: the whole library on one image, so a human can judge it at a
     glance. Assertions cannot tell you a rock looks like a rock. */
  const sheets = await ev('__auditSheet(' + JSON.stringify(names) + ')');
  for (let i = 0; i < sheets.length; i++) {
    fs.writeFileSync(path.join(__dirname, '_prop-sheet-' + (i + 1) + '.png'), Buffer.from(sheets[i], 'base64'));
  }
  console.log('wrote ' + sheets.length + ' contact sheet(s): tools/_prop-sheet-N.png');

  const bad = rows.filter(r => r.verdict !== 'OK');
  console.log(bad.length ? NL + 'PROP AUDIT: ' + bad.length + ' need attention'
    : NL + 'PROP AUDIT PASS — every prop renders');
  ws.close(); ch.kill();
  process.exit(bad.length ? 1 : 0);
})();
