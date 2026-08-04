/* Measure the individual-immunity win table for a given (challengeSkillSpan,
   npcFormSwing) using the REAL scoring path, set before any measurement runs.

   The in-run override version of this disagreed with the live config by 3x, so
   this sets the values once at the top and never touches them again.

   Usage: node tools/chal-probe.js [span] [swing]
   With no arguments it reports whatever is in data.js. */
const http = require('http'), { spawn } = require('child_process'), os = require('os');
const WebSocket = require('ws');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const RUN_ID = process.pid.toString(36) + Math.floor(Math.random() * 1e6).toString(36);
const PORT = 9200 + Math.floor(Math.random() * 2000);
const SPAN = process.argv[2] ? parseFloat(process.argv[2]) : null;
const SWING = process.argv[3] ? parseFloat(process.argv[3]) : null;
const get = p => new Promise((res, rej) =>
  http.get({ host: '127.0.0.1', port: PORT, path: p }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
  }).on('error', rej));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT,
    '--no-first-run', '--window-size=900,430',
    '--user-data-dir=' + os.tmpdir() + '\\cw-chalprobe-' + RUN_ID,
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
      throw new Error('page threw: ' + ((d.exception && d.exception.description) || d.text));
    }
    return r.result.result.value;
  };
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  const waitFor = async s => {
    for (let i = 0; i < 80; i++) { if (await ev(`!!document.querySelector(${JSON.stringify(s)})`)) return; await sleep(250); }
    throw new Error('no ' + s);
  };

  await waitFor('#screen-title.active');
  await ev(`localStorage.clear()`);
  await send('Page.reload', { ignoreCache: true });
  await waitFor('#screen-title.active'); await sleep(300);
  await ev(`document.getElementById('btn-new-game').click()`);
  await waitFor('#screen-create.active');
  await ev(`GAME.fastMaroon = true; GAME.fastChallenge = true; document.getElementById('btn-create-go').click()`);
  for (let i = 0; i < 400; i++) {
    if (await ev(`!!document.querySelector('#screen-camp.active')`)) break;
    await ev(`(() => {
      const b = document.querySelector('#maroon-choices button') || document.querySelector('.maroon-next');
      if (b && !b.disabled) b.click();
    })()`);
    await sleep(120);
  }
  await waitFor('#screen-camp.active');
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>/skip tutorial/i.test(b.textContent));if(b)b.click();})()`);
  await sleep(400);

  /* Set once, before anything is measured. */
  if (SPAN !== null) await ev(`CONFIG.challengeSkillSpan = ${SPAN}; true`);
  if (SWING !== null) await ev(`CONFIG.npcFormSwing = ${SWING}; true`);

  await ev(`
    DBG.setEnabled(false);
    /* A clean copy of the cast's stats, so forcing the player's ability in one
       measurement cannot leak into the next. */
    window.__base = GAME.cast.map(c => Object.assign({}, c.stats));
    window.__cp = {
      restore() { GAME.cast.forEach((c, i) => { c.stats = Object.assign({}, window.__base[i]); }); },
      round(seed, perf, field, ability) {
        seedRng(seed);
        this.restore();
        const P = GAME.player;
        const others = GAME.cast.filter(c => c !== P).slice(0, field - 1);
        const pool = [P].concat(others);
        for (const c of pool) { c.eliminated = false; c.hunger = 0.2; c.fatigue = 0.2; c.morale = 0.62; }
        if (ability !== null) for (const k of STAT_KEYS) P.stats[k] = ability;
        const chal = CHALLENGES.find(c => c.cat === 'Physical' && !c.fire);
        setPlayerChallengePerf(perf);
        const winner = Challenges.runIndividual(chal, pool);
        setPlayerChallengePerf(null);
        return winner === P;
      },
      rate(runs, perf, field, ability) {
        let w = 0;
        for (let i = 0; i < runs; i++) if (this.round(90000 + i * 641, perf, field, ability)) w++;
        return w / runs;
      }
    };
    true;
  `);

  const RUNS = 500;
  const pct = v => (v * 100).toFixed(0).padStart(3) + '%';
  console.log(`\nspan=${await ev('CONFIG.challengeSkillSpan')} swing=${await ev('CONFIG.npcFormSwing')}`
    + ` randomWeight=${await ev('CONFIG.immunityRandomWeight')}`);
  console.log('\nP(player wins individual immunity) — field of 8, ' + RUNS + ' rounds');
  console.log('  stats   perf.25  perf.50  perf.75  FLAWLESS');
  for (const ability of [0.3, 0.5, 0.7, 0.9]) {
    const row = [];
    for (const perf of [0.25, 0.5, 0.75, 1.0]) row.push(await ev(`__cp.rate(${RUNS}, ${perf}, 8, ${ability})`));
    console.log('  ' + String(ability).padEnd(8) + row.map(pct).join('     '));
  }
  console.log('\nflawless play, average stats, by field size');
  const sizes = [];
  for (const f of [4, 5, 6, 8, 10]) sizes.push([f, await ev(`__cp.rate(${RUNS}, 1.0, ${f}, 0.5)`)]);
  console.log('  ' + sizes.map(([f, r]) => 'f' + f + ' ' + pct(r)).join('   '));
  ws.close(); ch.kill(); process.exit(0);
})();
