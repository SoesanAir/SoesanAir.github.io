/* How often does the player win individual immunity, and does playing well
   guarantee it?

   The complaint that produced this: "Challenges are way too easy to win. I won all
   of the individual ones. Make sure that even if I'm good, someone might be
   better."

   So the target is not "the player should lose" — it is that a PERFECT minigame
   should still lose sometimes, because somebody in a field of eight can be better
   on the day. And an average performance should mostly lose.

   Run: node tools/chal-sweep.js */
const http = require('http'), { spawn } = require('child_process'), os = require('os');
const WebSocket = require('ws');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const RUN_ID = process.pid.toString(36) + Math.floor(Math.random() * 1e6).toString(36);
const PORT = 9200 + Math.floor(Math.random() * 2000);
const get = p => new Promise((res, rej) =>
  http.get({ host: '127.0.0.1', port: PORT, path: p }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
  }).on('error', rej));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT,
    '--no-first-run', '--window-size=900,430',
    '--user-data-dir=' + os.tmpdir() + '\\cw-chalsweep-' + RUN_ID,
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

  await ev(`
    DBG.setEnabled(false);
    window.__cs = {
      /* One individual immunity round: field of N, the player performs at perf,
         everyone else rolls their form. Returns whether the player won. */
      round(seed, perf, field, playerAbility) {
        seedRng(seed);
        const pool = GAME.cast.slice(0, field);
        for (const c of pool) {
          c.eliminated = false;
          c.hunger = 0.2; c.fatigue = 0.2; c.morale = 0.62;
        }
        const P = GAME.player;
        if (pool.indexOf(P) < 0) pool[0] = P;
        /* Give the player a stated ability so the sweep is not measuring one roll
           of character creation. */
        if (playerAbility !== null) for (const k of STAT_KEYS) P.stats[k] = playerAbility;
        const chal = CHALLENGES.find(c => c.cat === 'Physical' && !c.fire);
        setPlayerChallengePerf(perf);
        const winner = Challenges.runIndividual(chal, pool);
        setPlayerChallengePerf(null);
        return { won: winner === P, winner: winner.displayName };
      },
      rate(runs, perf, field, playerAbility) {
        let w = 0;
        for (let i = 0; i < runs; i++) if (this.round(90000 + i * 641, perf, field, playerAbility).won) w++;
        return w / runs;
      }
    };
    true;
  `);

  const RUNS = 400;
  const pct = v => (v * 100).toFixed(0).padStart(3) + '%';

  console.log('\nP(player wins individual immunity), field of 8, ' + RUNS + ' rounds each');
  console.log('player stats  perf 0.25  perf 0.50  perf 0.75  perf 1.00 (flawless)');
  for (const ability of [0.3, 0.5, 0.7, 0.9]) {
    const row = [];
    for (const perf of [0.25, 0.5, 0.75, 1.0]) {
      row.push(await ev(`__cs.rate(${RUNS}, ${perf}, 8, ${ability})`));
    }
    console.log('  ' + String(ability).padEnd(13) + row.map(pct).join('      '));
  }

  console.log('\nsame, by field size, flawless play, average stats (0.5)');
  for (const field of [4, 5, 6, 8, 10]) {
    const r = await ev(`__cs.rate(${RUNS}, 1.0, ${field}, 0.5)`);
    console.log('  field of ' + String(field).padEnd(4) + pct(r));
  }

  console.log('\ncurrent levers: challengeSkillSpan=' + await ev('CONFIG.challengeSkillSpan')
    + ' immunityRandomWeight=' + await ev('CONFIG.immunityRandomWeight')
    + ' npcFormSwing=' + await ev('CONFIG.npcFormSwing')
    + ' chalDifficulty=' + await ev('CONFIG.chalDifficulty'));

  console.log('\nsweeping challengeSkillSpan (flawless play, average stats, field of 8)');
  for (const span of [0.20, 0.30, 0.40, 0.55]) {
    const r = await ev(`(() => { const o = CONFIG.challengeSkillSpan; CONFIG.challengeSkillSpan = ${span};
      const v = __cs.rate(${RUNS}, 1.0, 8, 0.5); CONFIG.challengeSkillSpan = o; return v; })()`);
    const avg = await ev(`(() => { const o = CONFIG.challengeSkillSpan; CONFIG.challengeSkillSpan = ${span};
      const v = __cs.rate(${RUNS}, 0.5, 8, 0.5); CONFIG.challengeSkillSpan = o; return v; })()`);
    console.log('  span ' + String(span).padEnd(6) + 'flawless ' + pct(r) + '   average ' + pct(avg));
  }

  console.log('\nsweeping npcFormSwing (flawless play, average stats, field of 8)');
  for (const sw of [0.34, 0.45, 0.55, 0.70]) {
    const r = await ev(`(() => { const o = CONFIG.npcFormSwing; CONFIG.npcFormSwing = ${sw};
      const v = __cs.rate(${RUNS}, 1.0, 8, 0.5); CONFIG.npcFormSwing = o; return v; })()`);
    console.log('  swing ' + String(sw).padEnd(6) + 'flawless ' + pct(r));
  }

  ws.close(); ch.kill(); process.exit(0);
})();
