/* Does hunger and fatigue behave like a real Survivor season?

   The old model ramped hunger to the ceiling and then charged up to 0.56 off a
   challenge score for being hungry and tired — more than the entire stat
   contribution. Everyone was starving, everyone was penalised, and the penalty
   quietly decided immunities.

   The target now, taken from the show rather than from taste:

     1. Hunger and fatigue SETTLE. They climb hard in week one and then plateau at
        a high, uncomfortable, permanent level. They do not march to 1.0.
     2. At that settled level the challenge cost is about NOTHING. Everybody out
        there is hungry; it is not what decides who wins.
     3. The cost is still real for somebody genuinely breaking down, so a castaway
        in actual trouble does visibly struggle.
     4. Morale is dragged but not pinned — the cast should not all sit in
        "Struggling" from day ten with nothing else able to move them.

   Run: node tools/condition-test.js */
const http = require('http'), { spawn } = require('child_process'), os = require('os'), fs = require('fs');
const WebSocket = require('ws');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const RUN_ID = process.pid.toString(36) + Math.floor(Math.random() * 1e6).toString(36);
const PORT = 9200 + Math.floor(Math.random() * 2000);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = p => new Promise((s, j) => http.get({ host: '127.0.0.1', port: PORT, path: p }, r => {
  let d = ''; r.on('data', c => d += c); r.on('end', () => s(JSON.parse(d)));
}).on('error', j));

(async () => {
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT,
    '--no-first-run', '--window-size=900,430',
    '--user-data-dir=' + os.tmpdir() + '\\cw-cond-' + RUN_ID,
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
    if (r.result.exceptionDetails) throw new Error('threw: ' + ((r.result.exceptionDetails.exception || {}).description || '').split('\n')[0]);
    return r.result.result.value;
  };
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  const waitFor = async s => {
    for (let i = 0; i < 80; i++) { if (await ev(`!!document.querySelector(${JSON.stringify(s)})`)) return; await sleep(250); }
    throw new Error('no ' + s);
  };
  const fails = [];
  const check = (n, ok, d) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${n}${d ? '  — ' + d : ''}`); if (!ok) fails.push(n); };

  await waitFor('#screen-title.active');
  await ev(`localStorage.clear()`);
  await send('Page.reload', { ignoreCache: true });
  await waitFor('#screen-title.active'); await sleep(300);
  await ev(`document.getElementById('btn-new-game').click()`);
  await waitFor('#screen-create.active');
  await ev(`GAME.fastMaroon = true; GAME.fastChallenge = true; document.getElementById('btn-create-go').click()`);
  for (let i = 0; i < 400; i++) {
    if (await ev(`!!document.querySelector('#screen-camp.active')`)) break;
    await ev(`(() => { const b = document.querySelector('#maroon-choices button') || document.querySelector('.maroon-next'); if (b && !b.disabled) b.click(); })()`);
    await sleep(120);
  }
  await waitFor('#screen-camp.active');

  /* The season rig lives in camp-test.js. Reusing it rather than re-implementing
     it matters for one specific reason: rig.reset() RE-ROLLS the tribe's
     temperaments each season. A cast heavy on Camp Providers holds a camp
     together and one heavy on schemers lets it rot, so measuring the plateau
     against a single fixed cast would be measuring that cast, not the model. */
  const testSrc = fs.readFileSync(__dirname + '/camp-test.js', 'utf8');
  const rig = testSrc.slice(testSrc.indexOf('window.__rig = {'), testSrc.indexOf('__rig.quiet();'));
  await ev(rig + '\n__rig.quiet(); true;');

  /* ---- 1. the shape of the curve, over several re-rolled seasons ---- */
  const curve = await ev(`(() => {
    Telemetry.cfg.auto = false;
    const SEASONS = 8, DAYS = 24;
    const byDay = [], fatByDay = [], morByDay = [];
    for (let d = 0; d < DAYS; d++) { byDay.push([]); fatByDay.push([]); morByDay.push([]); }
    let peakHunger = 0, peakFatigue = 0;

    for (let s = 0; s < SEASONS; s++) {
      __rig.reset(7000 + s * 131);
      for (let d = 0; d < DAYS; d++) {
        /* One camp job a day: a player who is contributing but not grinding. */
        __rig.day(1);
        const live = alive();
        if (!live.length) break;
        const mean = f => live.reduce((a, c) => a + f(c), 0) / live.length;
        byDay[d].push(mean(c => c.hunger));
        fatByDay[d].push(mean(c => c.fatigue));
        morByDay[d].push(mean(c => c.morale));
        for (const c of live) {
          if (c.hunger > peakHunger) peakHunger = c.hunger;
          if (c.fatigue > peakFatigue) peakFatigue = c.fatigue;
        }
      }
    }
    const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
    return {
      hunger: byDay.map(mean), fatigue: fatByDay.map(mean), morale: morByDay.map(mean),
      peakHunger, peakFatigue
    };
  })()`);

  const at = (arr, d) => arr[d - 1];
  const DAYS = [3, 7, 12, 18, 24];
  console.log('\nmean across 8 re-rolled seasons (player doing one camp job a day):');
  console.log('  day       ' + DAYS.map(d => String(d).padStart(6)).join(''));
  console.log('  hunger    ' + DAYS.map(d => at(curve.hunger, d).toFixed(2).padStart(6)).join(''));
  console.log('  fatigue   ' + DAYS.map(d => at(curve.fatigue, d).toFixed(2).padStart(6)).join(''));
  console.log('  morale    ' + DAYS.map(d => at(curve.morale, d).toFixed(2).padStart(6)).join(''));
  console.log(`  worst individual: hunger ${curve.peakHunger.toFixed(2)} · fatigue ${curve.peakFatigue.toFixed(2)}`);

  /* Week one should bite; the back half should be flat. That is the plateau. */
  const early = at(curve.hunger, 7) - at(curve.hunger, 3);
  const late = at(curve.hunger, 24) - at(curve.hunger, 18);
  check('hunger climbs in the first week', early > 0.02, `+${early.toFixed(3)} d3->d7`);
  check('hunger has flattened by the back half', Math.abs(late) < 0.05, `${late >= 0 ? '+' : ''}${late.toFixed(3)} d18->d24`);
  check('hunger settles high but not pinned', at(curve.hunger, 24) > 0.30 && at(curve.hunger, 24) < 0.92,
    at(curve.hunger, 24).toFixed(2));
  check('fatigue settles too', at(curve.fatigue, 24) < 0.92, at(curve.fatigue, 24).toFixed(2));
  check('morale is not pinned in the basement', at(curve.morale, 24) > 0.30,
    `${at(curve.morale, 24).toFixed(2)} (below 0.30 is "Struggling" for the whole cast)`);

  /* ---- 2. what the condition actually COSTS at a challenge ---- */
  const cost = await ev(`(() => {
    const chal = CHALLENGES.find(c => c.cat === 'Physical') || CHALLENGES[0];
    const bite = (v, free) => condBite(v, free);
    const at = (h, f) => bite(h, CONFIG.hungerPainFree) * CONFIG.hungerChallengePenalty
                       + bite(f, CONFIG.fatiguePainFree) * CONFIG.fatigueChallengePenalty;
    /* For scale: how much a challenge score moves for stats alone, best to worst. */
    const statSpan = chal.w.reduce((a, b) => a + b, 0);
    return {
      fresh: at(0.20, 0.20),
      normal: at(CONFIG.hungerPlateau, CONFIG.fatiguePlateau),
      rough: at(0.85, 0.85),
      broken: at(1.0, 1.0),
      statSpan,
      formSwing: CONFIG.npcFormSwing
    };
  })()`);

  console.log(`\nchallenge cost of condition (a full stat range is worth ${cost.statSpan.toFixed(2)},`
    + ` a day's form swings +/-${cost.formSwing}):`);
  console.log(`  fresh (0.20/0.20)          -${cost.fresh.toFixed(3)}`);
  console.log(`  normal island (plateau)    -${cost.normal.toFixed(3)}`);
  console.log(`  rough (0.85/0.85)          -${cost.rough.toFixed(3)}`);
  console.log(`  breaking down (1.0/1.0)    -${cost.broken.toFixed(3)}`);

  check('being normally hungry and tired costs essentially nothing', cost.normal < 0.03,
    `-${cost.normal.toFixed(3)}`);
  check('condition never outweighs a day\'s form', cost.broken < cost.formSwing,
    `worst case -${cost.broken.toFixed(3)} vs form +/-${cost.formSwing}`);
  check('but breaking down still costs something real', cost.broken > 0.12,
    `-${cost.broken.toFixed(3)}`);
  check('the cost is in the tail, not the middle', cost.rough > cost.normal * 4,
    `rough -${cost.rough.toFixed(3)} vs normal -${cost.normal.toFixed(3)}`);

  const ok = !fails.length;
  if (fails.length) console.log('\nfailing checks: ' + fails.join(', '));
  console.log(ok ? '\nCONDITION TEST PASS' : '\nCONDITION TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
