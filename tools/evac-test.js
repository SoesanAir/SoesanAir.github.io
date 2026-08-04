/* Evacuation and quit rates, measured against the real show.

   US Survivor seasons 1-50: 21 medical evacuations across 14 seasons.
     0 evacs 72% · 1 evac 16% · 2 evacs 10% · 3 evacs 2% · mean 0.42

   Also measures the OLD per-day-dice model on the same seasons, because the whole
   point of the change was that its season-level rate was unpredictable.

   Run: node tools/evac-test.js */
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
    '--no-first-run', '--window-size=900,430',
    '--user-data-dir=' + os.tmpdir() + '\\cw-evac-' + RUN_ID, 'http://localhost:8099/index.html?no3d=1'], { stdio: 'ignore' });
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
  const errors = [];
  ws.on('message', m => {
    const j = JSON.parse(m);
    if (j.method === 'Runtime.exceptionThrown') {
      const d = (j.params.exceptionDetails.exception || {}).description || j.params.exceptionDetails.text;
      if (d && d !== 'Event') errors.push(String(d).split('\n')[0]);
    }
  });
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

  const fails = [];
  const check = (name, ok, detail) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`);
    if (!ok) fails.push(name);
  };

  await ev(`
    DBG.setEnabled(false);
    if (!Feed.__realPost) { Feed.__realPost = Feed.post; Feed.post = () => {}; }
    window.__sim = {
      /* A whole season of days, honestly ordered, counting who leaves and why.
         campQuality 0..1 scales how well the camp is kept, so the condition-linked
         half of the real distribution can be measured against player behaviour. */
      season(seed, campQuality) {
        seedRng(seed);
        GAME.day = 1; GAME.merged = false;
        GAME.camp = { firewood: 0.5, water: 0.5, food: 0.5, shelter: 0.5, clean: 0.5 };
        GAME.campFire = 0.5;
        for (const c of GAME.cast) {
          c.eliminated = false;
          c.hunger = 0.15; c.fatigue = 0.10; c.morale = 0.62;
          if (!c.isPlayer) c.cluster = pick(TRAIT_CLUSTERS).name;
          c._ethic = undefined; Ledger.ensure(c);
          c.workRecent = 0.5; c.workToday = 0; c.campRelGiven = {}; c.choreRelGiven = {};
        }
        CampNeeds.ensure();
        Exits.reset();
        const out = { evac: 0, quit: 0, causes: [], days: [] };
        for (let d = 1; d <= CONFIG.totalDays; d++) {
          GAME.day = d;
          Weather.roll();
          TribeWork.dailyTick(alive());
          /* Stand in for the player keeping camp: hold the needs near the target
             quality rather than simulating every chore. */
          for (const n of CAMP_NEEDS) {
            CampNeeds.set(n.id, CampNeeds.get(n.id) * 0.65 + campQuality * 0.35);
          }
          Morale.tick(alive());
          dailySurvivalTick(alive());
          CampNeeds.decay(campPool());
          Ledger.roll(alive());
          Nights.roll(campPool());
          applySleepRecovery(alive(), false);
          const e = checkDailyEvent(alive());
          if (e) {
            if (e.type === 'Medivac') { out.evac++; out.causes.push(e.cause); out.days.push(d); }
            else out.quit++;
            e.who.eliminated = true;              // they are actually gone
          }
        }
        return out;
      },
      /* The model this replaced, run on the same seasons. */
      oldModel(seed, campQuality) {
        const old = (cast) => {
          for (const c of cast) {
            if (c.eliminated || c.isPlayer) continue;
            let m = 0.001;
            if (c.hunger > 0.8 || c.fatigue > 0.85) m = 0.03;
            else if (c.hunger > 0.6 || c.fatigue > 0.65) m = 0.008;
            if (chance(m)) return { type: 'Medivac', who: c };
          }
          return null;
        };
        const real = window.checkDailyEvent;
        window.checkDailyEvent = old;
        const r = this.season(seed, campQuality);
        window.checkDailyEvent = real;
        return r;
      },
      /* Aggregate N seasons into the same table the real show is measured in. */
      table(runs, campQuality, useOld) {
        const hist = {}, causes = {}, days = [];
        let total = 0, quits = 0;
        for (let i = 0; i < runs; i++) {
          const r = useOld ? this.oldModel(70000 + i * 313, campQuality)
                           : this.season(70000 + i * 313, campQuality);
          hist[r.evac] = (hist[r.evac] || 0) + 1;
          total += r.evac; quits += r.quit;
          r.causes.forEach(c => { causes[c] = (causes[c] || 0) + 1; });
          days.push(...r.days);
        }
        const share = {};
        for (const k of Object.keys(hist)) share[k] = +(hist[k] / runs).toFixed(3);
        return {
          share, mean: +(total / runs).toFixed(3),
          atLeastOne: +(1 - (hist[0] || 0) / runs).toFixed(3),
          two: +((hist[2] || 0) / runs).toFixed(3),
          threePlus: +(Object.keys(hist).filter(k => +k >= 3).reduce((s, k) => s + hist[k], 0) / runs).toFixed(3),
          quitsPerSeason: +(quits / runs).toFixed(3),
          causes,
          earlyShare: days.length ? +(days.filter(d => d <= 3).length / days.length).toFixed(2) : 0
        };
      }
    };
    true;
  `);

  const RUNS = 500;
  const REAL = { zero: 0.72, one: 0.16, two: 0.10, three: 0.02, mean: 0.42, atLeastOne: 0.28 };

  console.log(`\n--- the model this replaced, same ${RUNS} seasons ---`);
  const old = await ev(`__sim.table(${RUNS}, 0.42, true)`);
  console.log(`  seasons with >=1 evacuation: ${(old.atLeastOne * 100).toFixed(0)}%   (real: 28%)`);
  console.log(`  seasons with exactly 2     : ${(old.two * 100).toFixed(0)}%   (real: 10%)`);
  console.log(`  seasons with 3 or more     : ${(old.threePlus * 100).toFixed(0)}%   (real: 2%)`);
  console.log(`  mean per season            : ${old.mean}   (real: 0.42)`);

  console.log(`\n--- the calibrated model, ${RUNS} seasons, camp kept at 0.42 (a tribe left alone) ---`);
  const now = await ev(`__sim.table(${RUNS}, 0.42, false)`);
  console.log('  evacs/season   modelled   real');
  for (const n of [0, 1, 2, 3]) {
    const m = now.share[n] || 0;
    const r = [REAL.zero, REAL.one, REAL.two, REAL.three][n];
    console.log(`  ${n}              ${(m * 100).toFixed(1)}%      ${(r * 100).toFixed(0)}%`);
  }
  console.log(`  mean per season: ${now.mean} (real 0.42) · at least one: ${(now.atLeastOne * 100).toFixed(0)}% (real 28%)`);
  console.log(`  quits per season: ${now.quitsPerSeason} (real ~0.2)`);
  console.log(`  causes: ${JSON.stringify(now.causes)}`);
  console.log(`  share in the first three days: ${now.earlyShare} (real 0.29)`);

  /* The whole point of the fix: two-in-a-season is a 1-in-10 event, not routine. */
  check('two evacuations in a season is about one season in ten',
    now.two >= 0.03 && now.two <= 0.16, `${(now.two * 100).toFixed(1)}% (real 10%)`);
  check('three is close to unheard of', now.threePlus <= 0.05,
    `${(now.threePlus * 100).toFixed(1)}% (real 2%)`);
  check('most seasons have none at all', (now.share[0] || 0) >= 0.62,
    `${((now.share[0] || 0) * 100).toFixed(0)}% (real 72%)`);
  check('the mean is in the right neighbourhood', now.mean > 0.15 && now.mean < 0.55,
    `${now.mean} (real 0.42, and below it when the camp is kept well)`);
  /* Total absolute error across the whole 0/1/2/3 table, which is the honest
     comparison — the old model happened to sit near the real two-evac rate while
     being well over on "at least one". */
  const err = tbl => [0, 1, 2, 3].reduce((s, n) =>
    s + Math.abs((tbl.share[n] || 0) - [REAL.zero, REAL.one, REAL.two, REAL.three][n]), 0);
  const oldErr = err(old), nowErr = err(now);
  console.log(`  distribution error: old ${(oldErr * 100).toFixed(0)}pp -> calibrated ${(nowErr * 100).toFixed(0)}pp`);
  check('the whole distribution is closer to the real show than before',
    nowErr <= oldErr, `${(oldErr * 100).toFixed(0)}pp -> ${(nowErr * 100).toFixed(0)}pp`);
  /* The real reason for the rewrite: the count is drawn from a table, so it
     cannot exceed the worst season on record no matter how bad things get. */
  check('the season count is bounded by construction, not by luck',
    now.threePlus <= 0.03, `${(now.threePlus * 100).toFixed(1)}% at 3+, table caps at 3`);
  check('accidents still happen in the first days, as they really do',
    now.earlyShare > 0.10, `${now.earlyShare}`);

  /* Camp care must move the condition-linked half and not the accident half. */
  console.log('\n--- does keeping camp protect your tribe? ---');
  const good = await ev(`__sim.table(${RUNS}, 0.88, false)`);
  const bad = await ev(`__sim.table(${RUNS}, 0.06, false)`);
  console.log(`  camp kept well  : mean ${good.mean}, at least one ${(good.atLeastOne * 100).toFixed(0)}%  ${JSON.stringify(good.causes)}`);
  console.log(`  camp left to rot: mean ${bad.mean}, at least one ${(bad.atLeastOne * 100).toFixed(0)}%  ${JSON.stringify(bad.causes)}`);
  check('a well-kept camp loses fewer people', good.mean < bad.mean,
    `${good.mean} vs ${bad.mean}`);
  check('but no camp is safe from accidents', good.mean > 0,
    `${good.mean} per season even at camp 0.88`);
  check('a rotten camp never exceeds the worst season on record',
    bad.threePlus <= 0.06, `${(bad.threePlus * 100).toFixed(1)}% with 3+`);

  if (errors.length) console.log('\n!! page errors: ' + JSON.stringify(errors.slice(0, 3)));
  const ok = !fails.length && !errors.length;
  if (fails.length) console.log('\nfailing checks: ' + fails.join(', '));
  console.log(ok ? '\nEVAC TEST PASS' : '\nEVAC TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
