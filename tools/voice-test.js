/* The same action must sound different depending on how the castaway feels, and
   each feeling must have several lines of its own. Measures distinct lines per
   (action, feeling) and asserts the bands do not share wording.
   Run: node tools/voice-test.js */
const http = require('http'), { spawn } = require('child_process'), os = require('os');
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
    '--no-first-run', '--user-data-dir=' + os.tmpdir() + '\\cw-voice-' + RUN_ID,
    'http://localhost:8099/index.html?no3d=1'], { stdio: 'ignore' });
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
  ws.on('message', m => { const j = JSON.parse(m); if (j.method === 'Runtime.exceptionThrown') { const d = (j.params.exceptionDetails.exception || {}).description || j.params.exceptionDetails.text; if (d && d !== 'Event') errors.push(d); } });
  const waitFor = async s => { for (let i = 0; i < 60; i++) { if (await ev(`!!document.querySelector(${JSON.stringify(s)})`)) return; await sleep(250); } console.log('!! errors:', errors.slice(0, 3)); throw new Error('no ' + s); };

  await waitFor('#screen-title.active');
  await ev(`localStorage.clear()`);
  await send('Page.reload', { ignoreCache: true });
  await waitFor('#screen-title.active'); await sleep(300);
  await ev(`document.getElementById('btn-new-game').click()`);
  await waitFor('#screen-create.active');
  await ev(`GAME.fastMaroon = true; document.getElementById('btn-create-go').click()`);
  // skip the marooning opener
  for (let i = 0; i < 80; i++) {
    if (await ev(`(() => { const b = document.querySelector('#maroon-choices button'); if (b) { b.click(); return true; } return false; })()`)) await sleep(120);
    else if (await ev(`!!document.querySelector('#screen-camp.active')`)) break;
    else await sleep(150);
  }
  await waitFor('#screen-camp.active'); await waitFor('#figures .bfig');
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>/skip tutorial/i.test(b.textContent));if(b)b.click();})()`);
  await sleep(700);

  const report = await ev(`(() => {
    const actions = Object.keys(VOICE);
    const bands = ['cold', 'wary', 'warm', 'close'];
    const npc = alive().find(c => !c.isPlayer);
    const out = {}, overlaps = [], counts = {};
    for (const a of actions) {
      out[a] = {};
      const seenPerBand = {};
      for (const b of bands) {
        const set = new Set();
        for (let i = 0; i < 400; i++) {
          // force the band so blending cannot muddy the measurement
          const s = Voice.line(a, npc, { band: b, vars: { tn: 'Casey' } });
          if (s) set.add(s);
        }
        seenPerBand[b] = set;
        out[a][b] = set.size;
      }
      // no line may appear in two different feelings
      for (let i = 0; i < bands.length; i++) {
        for (let j = i + 1; j < bands.length; j++) {
          for (const l of seenPerBand[bands[i]]) {
            if (seenPerBand[bands[j]].has(l)) overlaps.push(a + ': ' + bands[i] + '/' + bands[j] + ' -> ' + l);
          }
        }
      }
      counts[a] = bands.reduce((n, b) => n + VOICE[a][b].length, 0);
    }
    return { out, overlaps: overlaps.slice(0, 5), counts,
             actions: actions.length,
             total: Object.values(counts).reduce((a, b) => a + b, 0) };
  })()`);

  console.log(`banded actions: ${report.actions}   total banded lines: ${report.total}\n`);
  console.log('action'.padEnd(16) + 'cold  wary  warm  close');
  for (const [a, v] of Object.entries(report.out)) {
    console.log(a.padEnd(16) + String(v.cold).padEnd(6) + String(v.wary).padEnd(6) +
      String(v.warm).padEnd(6) + String(v.close));
  }
  console.log('\nlines shared between feelings:', report.overlaps.length);
  report.overlaps.forEach(o => console.log('   ' + o));

  /* Show the same action across feelings so the difference is visible. */
  const demo = await ev(`(() => {
    const npc = alive().find(c => !c.isPlayer);
    const out = {};
    for (const b of ['cold', 'wary', 'warm', 'close'])
      out[b] = Voice.line('align', npc, { band: b });
    return out;
  })()`);
  console.log('\n"Suggest working together", same castaway, four feelings:');
  Object.entries(demo).forEach(([b, l]) => console.log(`   ${b.padEnd(6)} "${l}"`));

  /* And that live play routes through it: band moves with the relationship. */
  const live = await ev(`(() => {
    const P = GAME.player;
    const npc = alive().find(c => !c.isPlayer);
    const r = {};
    for (const [label, tr] of [['hostile', 0.05], ['neutral', 0.4], ['friendly', 0.55], ['devoted', 0.9]]) {
      npc.relationships.get(P.name).trust = tr;
      npc.relationships.get(P.name).rel = tr;
      r[label] = Voice.band(npc, P.name);
    }
    return r;
  })()`);
  console.log('\nrelationship -> feeling band:', JSON.stringify(live));

  const minPerBand = Math.min(...Object.values(report.out).flatMap(v => Object.values(v)));
  const ok = report.actions >= 11 && report.total >= 400
    && minPerBand >= 8 && report.overlaps.length === 0
    && live.hostile === 'cold' && live.neutral === 'wary'
    && live.friendly === 'warm' && live.devoted === 'close'
    && !errors.length;
  console.log(`\nsmallest single feeling pool: ${minPerBand} lines`);
  if (errors.length) console.log('!! errors:', errors.slice(0, 3));
  console.log(ok ? '\nVOICE TEST PASS' : '\nVOICE TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
