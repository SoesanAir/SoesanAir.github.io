/* Report the computed animation actually applied to each rig part under each
   state class. Catches CSS cascade problems that eyeballing a still frame hides.
   Run: node tools/anim-test.js */
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
    '--no-first-run', '--user-data-dir=' + os.tmpdir() + '\\cw-anim-' + RUN_ID,
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
  if (process.env.REDUCED === '1') {
    await send('Emulation.setEmulatedMedia',
      { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    console.log('*** emulating prefers-reduced-motion: reduce ***');
  }
  const waitFor = async sel => { for (let i = 0; i < 60; i++) { if (await ev(`!!document.querySelector(${JSON.stringify(sel)})`)) return; await sleep(250); } throw new Error('no ' + sel); };

  await waitFor('#screen-title.active');
  await sleep(200);
  await ev(`document.getElementById('btn-new-game').click()`);
  await waitFor('#screen-create.active');
  await ev(`GAME.fastMaroon = true; document.getElementById('btn-create-go').click()`);
  // skip the marooning opener
  for (let i = 0; i < 80; i++) {
    if (await ev(`(() => { const b = document.querySelector('#maroon-choices button'); if (b) { b.click(); return true; } return false; })()`)) await sleep(120);
    else if (await ev(`!!document.querySelector('#screen-camp.active')`)) break;
    else await sleep(150);
  }
  await waitFor('#screen-camp.active');
  await waitFor('#figures .bfig');
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>/skip tutorial/i.test(b.textContent));if(b)b.click();})()`);
  await sleep(700);

  const PARTS = ['head', 'torso', 'armL', 'armR', 'legL', 'legR'];
  const STATES = ['(idle)', 'walking', 'em-talking', 'em-cheer', 'em-wave', 'em-shrug', 'em-slump', 'weary'];

  const table = await ev(`(() => {
    const fig = document.querySelector('#figures .bfig');
    const out = {};
    const states = ${JSON.stringify(STATES)};
    const parts = ${JSON.stringify(PARTS)};
    for (const st of states) {
      fig.className = 'bfig';
      if (st !== '(idle)') fig.classList.add(st);
      out[st] = {};
      for (const p of parts) {
        const el = fig.querySelector('.rig > .' + p);
        const cs = getComputedStyle(el);
        out[st][p] = cs.animationName + '|' + cs.animationDuration + '|' + cs.animationPlayState;
      }
    }
    fig.className = 'bfig';
    return out;
  })()`);

  const sprite = await ev(`getComputedStyle(document.querySelector('#figures .bfig .sprite')).animationName`);
  console.log('whole-body .sprite animation:', sprite);
  console.log('state'.padEnd(12), PARTS.map(p => p.padEnd(20)).join(''));
  let problems = [];
  for (const st of STATES) {
    const row = PARTS.map(p => {
      const [name] = table[st][p].split('|');
      return (name === 'none' ? '-' : name.replace('rig-', '')).padEnd(20);
    }).join('');
    console.log(st.padEnd(12), row);
    // every non-idle state must change at least one part away from its idle animation
    if (st !== '(idle)') {
      const changed = PARTS.filter(p => table[st][p] !== table['(idle)'][p]);
      if (!changed.length) problems.push(st + ': nothing differs from idle');
    }
  }
  // walking specifically must drive the legs
  const legWalk = table['walking'].legL.startsWith('rig-legL-walk');
  console.log('\nwalking drives legL:', legWalk);
  if (!legWalk) problems.push('walking does not animate legL: ' + table['walking'].legL);

  console.log(problems.length ? '\nPROBLEMS:\n - ' + problems.join('\n - ') : '\nANIM TEST PASS');
  ws.close(); ch.kill(); process.exit(problems.length ? 1 : 0);
})();
