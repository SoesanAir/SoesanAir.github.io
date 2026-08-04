/* "What do you make of X?" must not give any cluster a catchphrase. Asks the same
   question many times per cluster and counts distinct answers, and checks that no
   single line dominates.
   Run: node tools/thinkof-test.js */
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
    '--no-first-run', '--user-data-dir=' + os.tmpdir() + '\\cw-think-' + RUN_ID,
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
  for (let i = 0; i < 80; i++) {
    if (await ev(`(() => { const b = document.querySelector('#maroon-choices button'); if (b) { b.click(); return true; } return false; })()`)) await sleep(120);
    else if (await ev(`!!document.querySelector('#screen-camp.active')`)) break;
    else await sleep(150);
  }
  await waitFor('#screen-camp.active'); await waitFor('#figures .bfig');
  await sleep(500);

  const report = await ev(`(() => {
    const clusters = TRAIT_CLUSTERS.map(c => c.name);
    const npc = alive().find(c => !c.isPlayer);
    const subj = alive().find(c => !c.isPlayer && c !== npc);
    const out = {};
    for (const cl of clusters) {
      npc.cluster = cl;
      const counts = {};
      const N = 300;
      for (let i = 0; i < N; i++) {
        // positive sentiment, truthful — the common case the player sees
        const l = renderThinkOfLine(npc, subj, 'positive', 'Truth');
        counts[l] = (counts[l] || 0) + 1;
      }
      const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      out[cl] = { distinct: entries.length, topShare: Math.round(entries[0][1] / N * 100), top: entries[0][0] };
    }
    return out;
  })()`);

  console.log('cluster'.padEnd(21) + 'distinct  most-common share');
  let worstDistinct = 999, worstShare = 0, offender = '';
  for (const [cl, v] of Object.entries(report)) {
    console.log(cl.padEnd(21) + String(v.distinct).padEnd(10) + v.topShare + '%');
    if (v.distinct < worstDistinct) { worstDistinct = v.distinct; }
    if (v.topShare > worstShare) { worstShare = v.topShare; offender = cl + ': ' + v.top; }
  }
  console.log(`\nfewest distinct answers for any cluster: ${worstDistinct}`);
  console.log(`most dominant single line: ${worstShare}%  (${offender})`);

  /* The old Chaos Agent case: one line, 100% of the time. */
  const chaos = report['Chaos Agent'];
  console.log(`\nChaos Agent now: ${chaos.distinct} distinct, top line ${chaos.topShare}% (was 1 line at 100%)`);

  const ok = worstDistinct >= 14 && worstShare <= 20 && !errors.length;
  if (errors.length) console.log('!! errors:', errors.slice(0, 3));
  console.log(ok ? '\nTHINKOF TEST PASS' : '\nTHINKOF TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
