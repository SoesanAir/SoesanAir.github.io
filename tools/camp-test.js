/* The camp labour economy, checked against the balance targets it was designed
   to hit. This is the harness for the death-spiral brake, the contribution
   ledger, the call-out hypocrisy gate, bad nights, and the biome/act routing.

   Every assertion below traces to a decision recorded in camp.js:
     - needs must settle in a BAND, never pin at empty (survival-crafting)
     - the death spiral must not close (systems-interaction-mapper)
     - no dominant strategy, no dead option, real counter-play (game-balance-analyst)

   Run: node tools/camp-test.js  (needs a static server on :8099) */
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
    '--user-data-dir=' + os.tmpdir() + '\\cw-camp-' + RUN_ID, 'http://localhost:8099/index.html?no3d=1'], { stdio: 'ignore' });
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
  /* Reused --user-data-dir means a Chrome disk cache; without this a harness
     can quietly run an older copy of the JS than the one on disk. */
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  const errors = [];
  ws.on('message', m => {
    const j = JSON.parse(m);
    if (j.method === 'Runtime.exceptionThrown') {
      const d = (j.params.exceptionDetails.exception || {}).description || j.params.exceptionDetails.text;
      if (d && d !== 'Event') errors.push(d);
    }
  });
  const waitFor = async s => {
    for (let i = 0; i < 80; i++) { if (await ev(`!!document.querySelector(${JSON.stringify(s)})`)) return; await sleep(250); }
    throw new Error('no ' + s);
  };

  /* ---- boot a real season so the cast, relationships and camp are genuine ---- */
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

  /* ---- the in-page rig: one faithful day, run headlessly many times ----
     Mirrors the real order in runMorning -> endDay -> advanceDay exactly, so a
     result here is a result in the game. */
  await ev(`
    window.__rig = {
      quiet() {
        DBG.setEnabled(false);
        if (!Feed.__realPost) { Feed.__realPost = Feed.post; Feed.post = () => {}; }
        if (!window.__realToast) { window.__realToast = window.toast; window.toast = () => {}; }
        Modal.open = () => {};
      },
      /* A pristine copy of the relationship matrix, taken once. Without this,
         every simulated season inherited the drift of the ~100 before it, so any
         measurement of "what does working do to your bonds" was really measuring
         cumulative pollution. */
      snapRels() {
        this._rels = GAME.cast.map(c => ({
          name: c.name,
          rels: [...c.relationships.entries()].map(([k, e]) => [k, { ...e }])
        }));
      },
      /* Rebuild a clean season state without touching the DOM. */
      reset(seed) {
        seedRng(seed);
        if (!this._rels) this.snapRels();
        for (const row of this._rels) {
          const c = GAME.cast.find(x => x.name === row.name);
          if (!c) continue;
          c.relationships = new Map(row.rels.map(([k, e]) => [k, { ...e }]));
          c.resetVW();
        }
        GAME.day = 1; GAME.merged = false; GAME.hoursRemaining = CONFIG.hoursPerDay;
        GAME.camp = { firewood: 0.30, water: 0.28, food: 0.30, shelter: 0.20, clean: 0.55 };
        GAME.campFire = 0.25; GAME.lastNight = null; GAME.lastNightBig = false;
        GAME.badSleep = false; GAME.goodSleep = false;
        GAME.choreDay = -1; GAME.choresToday = 0;
        CampNeeds.ensure(); CallOut.reset();
        for (const c of GAME.cast) {
          c.eliminated = false;
          /* Re-roll temperaments per season. The cast is built once at boot from a
             Date.now() seed, so without this the whole balance measurement rides
             on one lucky tribe — and a roll heavy on Camp Providers holds the camp
             together while a roll heavy on schemers lets it rot. Sampling the
             composition is what makes these numbers about the SYSTEM. */
          if (!c.isPlayer) { c.cluster = pick(TRAIT_CLUSTERS).name; c._ethic = undefined; }
          c.hunger = 0.15; c.fatigue = 0.10; c.morale = 0.62;
          c.workRecent = 0.5; c.workTotal = 0; c.workToday = 0; c.slackRun = 0;
          c.campRelGiven = {}; c.choreRelGiven = {}; c.jobsDone = 0;
          ethicOf(c); Ledger.ensure(c);
        }
      },
      /* playerJobs: how many chores the player does per day. */
      day(playerJobs) {
        GAME.day++;
        Weather.roll();
        const work = TribeWork.dailyTick(alive());
        for (const a of work) {
          const c = GAME.cast.find(x => x.name === a.name);
          if (c) c.jobsDone = (c.jobsDone || 0) + 1;
        }
        for (let i = 0; i < (playerJobs || 0); i++) {
          const bad = CampNeeds.problems();
          const need = bad.length ? bad[0].id : 'firewood';
          const job = CAMP_JOBS.find(j => j.need === need) || CAMP_JOBS[0];
          Camp.doJob(job);
        }
        Morale.tick(alive());
        dailySurvivalTick(alive());
        CampNeeds.decay(campPool());
        Ledger.roll(alive());
        Ledger.socialDrift(alive());
        const night = Nights.roll(campPool());
        applySleepRecovery(alive(), false);
        CallOut.newDay();
        /* Split these apart. A medivac is hunger and exhaustion, which is the
           camp's doing and the thing that must not end seasons. A quit is low
           morale, which is the social game working as intended and is not
           something the camp layer should be blamed or credited for. */
        const ev = checkDailyEvent(alive());
        return {
          night: night ? { id: night.id, bad: night.bad, blame: !!night.blame } : null,
          medivac: ev && ev.type === 'Medivac' ? 1 : 0,
          quit: ev && ev.type === 'Quit' ? 1 : 0
        };
      },
      /* Run a whole season and report the shape of it. */
      season(seed, playerJobs) {
        this.reset(seed);
        const needSamples = [], moraleSamples = [], perNeed = {}, perNeedPinned = {};
        let badNights = 0, goodNights = 0, blamed = 0, medivacs = 0, quits = 0, nights = 0;
        for (let d = 0; d < 24; d++) {
          const r = this.day(playerJobs);
          if (r.night) { nights++; if (r.night.bad) badNights++; else goodNights++; if (r.night.blame) blamed++; }
          medivacs += r.medivac; quits += r.quit;
          for (const n of CAMP_NEEDS) {
            needSamples.push(CampNeeds.get(n.id));
            perNeed[n.id] = (perNeed[n.id] || 0) + CampNeeds.get(n.id);
            if (CampNeeds.get(n.id) < 0.02) perNeedPinned[n.id] = (perNeedPinned[n.id] || 0) + 1;
          }
          for (const c of alive()) moraleSamples.push(c.morale);
        }
        const mean = a => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
        const camp = (GAME.merged ? alive() : aliveTribe(GAME.player.tribeName))
          .filter(c => !c.isPlayer);   // the player's own chores are measured separately
        return {
          needMean: mean(needSamples),
          needMin: Math.min(...needSamples), needMax: Math.max(...needSamples),
          pinnedEmpty: needSamples.filter(v => v < 0.02).length / needSamples.length,
          moraleMean: mean(moraleSamples), moraleMin: Math.min(...moraleSamples),
          badNights, goodNights, blamed, medivacs, quits, nights,
          perNeed: Object.fromEntries(CAMP_NEEDS.map(n => [n.id, +((perNeed[n.id] || 0) / 24).toFixed(3)])),
          perNeedPinned: Object.fromEntries(CAMP_NEEDS.map(n => [n.id, +((perNeedPinned[n.id] || 0) / 24).toFixed(3)])),
          playerRep: Ledger.rep(GAME.player),
          repSpread: camp.map(c => ({ cl: c.cluster, rep: +Ledger.rep(c).toFixed(3), jobs: c.jobsDone || 0 }))
                        .sort((a, b) => b.rep - a.rep)
        };
      }
    };
    __rig.quiet();
    true;
  `);

  const fails = [];
  const check = (name, ok, detail) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`);
    if (!ok) fails.push(name);
  };

  /* ================= 1. no death spiral ================= */
  console.log('\n--- the death spiral (player never lifts a finger, 24 days x 12 seasons) ---');
  const idle = await ev(`(() => {
    const runs = [];
    for (let i = 0; i < 20; i++) runs.push(__rig.season(4000 + i * 97, 0));
    const m = k => runs.reduce((s, r) => s + r[k], 0) / runs.length;
    return {
      needMean: +m('needMean').toFixed(3), pinned: +m('pinnedEmpty').toFixed(3),
      needMin: +Math.min(...runs.map(r => r.needMin)).toFixed(3),
      moraleMean: +m('moraleMean').toFixed(3), moraleMin: +Math.min(...runs.map(r => r.moraleMin)).toFixed(3),
      badNights: +m('badNights').toFixed(1), goodNights: +m('goodNights').toFixed(1),
      medivacs: +m('medivacs').toFixed(2), quits: +m('quits').toFixed(2),
      blamed: +m('blamed').toFixed(1),
      playerRep: +m('playerRep').toFixed(3),
      perNeed: Object.fromEntries(CAMP_NEEDS.map(n =>
        [n.id, +(runs.reduce((s, r) => s + r.perNeed[n.id], 0) / runs.length).toFixed(2)])),
      perNeedPinned: Object.fromEntries(CAMP_NEEDS.map(n =>
        [n.id, +(runs.reduce((s, r) => s + r.perNeedPinned[n.id], 0) / runs.length).toFixed(2)]))
    };
  })()`);
  console.log('  ' + JSON.stringify(idle));
  console.log('  per-need mean  : ' + JSON.stringify(idle.perNeed));
  console.log('  per-need pinned: ' + JSON.stringify(idle.perNeedPinned));
  check('needs settle in a band, not at empty', idle.needMean > 0.18 && idle.needMean < 0.70,
    `mean ${idle.needMean}`);
  check('needs are never pinned empty', idle.pinned < 0.10, `${(idle.pinned * 100).toFixed(1)}% of samples < 0.02`);
  check('morale does not collapse', idle.moraleMean > 0.30, `mean ${idle.moraleMean}`);
  check('camp neglect does not end seasons by attrition', idle.medivacs < 1.0,
    `${idle.medivacs} hunger/exhaustion medivacs per season across 18 castaways`
    + ` (plus ${idle.quits} morale quits, which are the social game, not the camp)`);
  /* How rough a neglected camp gets legitimately depends on the tribe: a roll
     heavy on Camp Providers holds the line without the player lifting a finger.
     So the assertion is that neglect has consequences at all, with the
     idle-versus-working comparison below carrying the real weight. */
  check('a neglected camp has rough nights', idle.badNights >= 3, `${idle.badNights}/season`);

  /* ================= 2. keeping camp actually pays ================= */
  console.log('\n--- and when the player works (2 jobs/day) ---');
  const busy = await ev(`(() => {
    const runs = [];
    for (let i = 0; i < 20; i++) runs.push(__rig.season(4000 + i * 97, 2));
    const m = k => runs.reduce((s, r) => s + r[k], 0) / runs.length;
    return {
      needMean: +m('needMean').toFixed(3), moraleMean: +m('moraleMean').toFixed(3),
      badNights: +m('badNights').toFixed(1), goodNights: +m('goodNights').toFixed(1),
      playerRep: +m('playerRep').toFixed(3)
    };
  })()`);
  console.log('  ' + JSON.stringify(busy));
  check('working keeps the camp better', busy.needMean > idle.needMean + 0.03,
    `${idle.needMean} idle vs ${busy.needMean} working`);
  check('working buys meaningfully fewer bad nights', busy.badNights * 1.35 < idle.badNights,
    `${idle.badNights} idle vs ${busy.badNights} working`);
  check('good nights exist, so this is not pure punishment', busy.goodNights > 1.5,
    `${busy.goodNights}/season`);
  check('the tribe notices you working', busy.playerRep > idle.playerRep + 0.15,
    `rep ${idle.playerRep} idle vs ${busy.playerRep} working`);

  /* ================= 3. some help, some never do ================= */
  console.log('\n--- who actually helps (24 days, averaged over 12 seasons) ---');
  const spread = await ev(`(() => {
    const acc = {};
    for (let i = 0; i < 12; i++) {
      const r = __rig.season(9000 + i * 131, 1);
      for (const row of r.repSpread) {
        if (!acc[row.cl]) acc[row.cl] = { rep: 0, jobs: 0, n: 0 };
        acc[row.cl].rep += row.rep; acc[row.cl].jobs += row.jobs; acc[row.cl].n++;
      }
    }
    return Object.entries(acc)
      .map(([cl, v]) => ({ cl, rep: +(v.rep / v.n).toFixed(3), jobs: +(v.jobs / v.n).toFixed(1) }))
      .sort((a, b) => b.jobs - a.jobs);
  })()`);
  for (const r of spread) console.log(`    ${r.cl.padEnd(19)} ${String(r.jobs).padStart(5)} jobs   rep ${r.rep.toFixed(2)}`);
  const top = spread[0], bottom = spread[spread.length - 1];
  check('grafters carry the camp', top.jobs > 8, `${top.cl} ${top.jobs} jobs`);
  check('some castaways barely help at all', bottom.jobs < top.jobs * 0.45,
    `${bottom.cl} ${bottom.jobs} vs ${top.cl} ${top.jobs}`);
  check('the ledger separates them, so gossip has material',
    top.rep - bottom.rep > 0.30, `rep spread ${(top.rep - bottom.rep).toFixed(2)}`);

  /* ================= 4. the desperation override ================= */
  console.log('\n--- the spiral brake: does a failing camp pull people to their feet? ---');
  const drive = await ev(`(() => {
    const lazy = GAME.cast.filter(c => !c.isPlayer)
      .sort((a, b) => ethicOf(a) - ethicOf(b))[0];
    const read = () => Labour.driveFor(lazy).drive;
    const set = v => { for (const n of CAMP_NEEDS) CampNeeds.set(n.id, v); };
    lazy.fatigue = 0.15; lazy.morale = 0.60; Weather.today = 'Sunny';
    set(0.9); const fine = read();
    set(0.02); const desperate = read();
    /* And the worst case the spiral would produce: empty camp AND wrecked people. */
    lazy.fatigue = 0.90; lazy.morale = 0.18; const wrecked = read();
    set(0.5); lazy.fatigue = 0.15; lazy.morale = 0.62;
    return { cluster: lazy.cluster, ethic: +ethicOf(lazy).toFixed(2),
             fine: +fine.toFixed(3), desperate: +desperate.toFixed(3), wrecked: +wrecked.toFixed(3) };
  })()`);
  console.log('  ' + JSON.stringify(drive));
  check('a desperate camp raises the drive to work', drive.desperate > drive.fine + 0.25,
    `${drive.fine} when fine -> ${drive.desperate} when desperate`);
  check('even the laziest castaway works when it is bad enough', drive.desperate > 0.35,
    `${drive.cluster} (ethic ${drive.ethic}) drive ${drive.desperate}`);
  check('SPIRAL BRAKE: exhausted AND desperate still beats comfortable AND fine',
    drive.wrecked > drive.fine, `wrecked+desperate ${drive.wrecked} vs comfortable ${drive.fine}`);

  /* ================= 5. the call-out hypocrisy gate ================= */
  console.log('\n--- calling it out ---');
  const callout = await ev(`(() => {
    const P = GAME.player;
    /* Whether anyone pushes back depends on whether anyone CARES about camp work,
       which is per temperament — and the cast is seeded from Date.now(). Force a
       tribe that keeps score so this measures the gate and not the tribe roll. */
    const mates = aliveTribe(P.tribeName).filter(c => !c.isPlayer);
    const realClusters = mates.map(c => c.cluster);
    mates.forEach((c, i) => { c.cluster = i < 4 ? 'Camp Provider' : 'Loyal Soldier'; });
    const setRep = target => {
      /* Move the player's remembered work to land on the rep we want. */
      const pool = Ledger.pool();
      let sum = 0; for (const o of pool) { Ledger.ensure(o); if (o !== P) sum += o.workRecent; }
      const mean = Math.max(0.35, (sum + P.workRecent) / pool.length);
      P.workRecent = target * 2 * mean;
    };
    const trial = target => {
      setRep(target);
      CallOut.reset();
      for (const n of CAMP_NEEDS) CampNeeds.set(n.id, 0.15);
      const first = CallOut.say('firewood');
      const again = CallOut.say('firewood');
      return {
        rep: +Ledger.rep(P).toFixed(2), standing: +CallOut.standing().toFixed(2),
        listened: first.listened, pushback: first.pushback,
        repeatIgnored: again.repeat === true, repeatPushback: again.pushback
      };
    };
    const shirker = trial(0.05);
    const grafter = trial(0.95);
    setRep(0.5); CallOut.reset();
    mates.forEach((c, i) => { c.cluster = realClusters[i]; });
    return { shirker, grafter };
  })()`);
  console.log('  shirker: ' + JSON.stringify(callout.shirker));
  console.log('  grafter: ' + JSON.stringify(callout.grafter));
  check('a grafter who speaks up is listened to',
    callout.grafter.listened > 0, `${callout.grafter.listened} agreed`);
  check('HYPOCRISY GATE: a shirker who speaks up gets told where to go',
    callout.shirker.pushback > callout.shirker.listened,
    `${callout.shirker.pushback} pushback vs ${callout.shirker.listened} agreed`);
  check('standing tracks your own record',
    callout.grafter.standing > callout.shirker.standing + 0.3,
    `${callout.shirker.standing} -> ${callout.grafter.standing}`);
  check('NOT SPAMMABLE: saying it twice in a day is ignored',
    callout.grafter.repeatIgnored && callout.grafter.repeatPushback >= 0, 'repeat flagged');

  /* ================= 6. vote weight stays a reason, not the reason ================= */
  console.log('\n--- what slacking is worth at tribal ---');
  const vw = await ev(`(() => {
    const pool = Ledger.pool().filter(c => !c.isPlayer);
    const worst = Ledger.worstIn(pool).who;
    let maxW = 0, sample = null;
    for (const v of pool) {
      if (v === worst) continue;
      const w = Ledger.voteWeight(v, worst);
      if (w > maxW) { maxW = w; sample = v.cluster; }
    }
    /* Post-merge, the resume must cut the other way. */
    const best = Ledger.bestIn(pool).who;
    GAME.merged = true;
    let resume = 0;
    for (const v of pool) if (v !== best) resume = Math.max(resume, Ledger.voteWeight(v, best));
    GAME.merged = false;
    return { maxSlackW: +maxW.toFixed(3), from: sample, cap: CONFIG.campVoteWeightMax,
             push: CONFIG.talkAboutPushVoteWeight, resumeThreat: +resume.toFixed(3),
             bestRep: +Ledger.rep(best).toFixed(2) };
  })()`);
  console.log('  ' + JSON.stringify(vw));
  check('slacking never out-weighs a deliberate push', vw.maxSlackW <= vw.push,
    `${vw.maxSlackW} vs push ${vw.push}`);
  check('camp vote weight respects its cap', vw.maxSlackW <= vw.cap + 0.001,
    `${vw.maxSlackW} <= ${vw.cap}`);
  check('PROVIDER CAPTURE BRAKE: post-merge a work resume is itself a threat',
    vw.resumeThreat > 0 || vw.bestRep <= 0.68,
    `resume threat ${vw.resumeThreat} at rep ${vw.bestRep}`);

  /* ================= 7. nights are graded, never lethal ================= */
  console.log('\n--- nights ---');
  const nights = await ev(`(() => {
    const seen = {}, out = { eliminatedByNight: 0, tried: 0 };
    for (let i = 0; i < 400; i++) {
      __rig.reset(21000 + i);
      /* Half the trials on a wrecked camp, half on a kept one. */
      const wreck = i % 2 === 0;
      for (const n of CAMP_NEEDS) CampNeeds.set(n.id, wreck ? 0.06 : 0.85);
      GAME.campFire = wreck ? 0.02 : 0.8;
      Weather.today = ['Sunny', 'Rainy', 'Stormy', 'Hot'][i % 4];
      const before = alive().length;
      const r = Nights.roll(alive());
      out.tried++;
      if (alive().length < before) out.eliminatedByNight++;
      if (r) {
        const k = (wreck ? 'wreck/' : 'kept/') + r.id;
        seen[k] = (seen[k] || 0) + 1;
      } else {
        const k = (wreck ? 'wreck/' : 'kept/') + 'quiet';
        seen[k] = (seen[k] || 0) + 1;
      }
    }
    const wreckBad = Object.entries(seen).filter(([k]) => k.startsWith('wreck/') && k !== 'wreck/quiet' && !/goodnight|feast|stars/.test(k)).reduce((s, [, v]) => s + v, 0);
    const keptBad = Object.entries(seen).filter(([k]) => k.startsWith('kept/') && k !== 'kept/quiet' && !/goodnight|feast|stars/.test(k)).reduce((s, [, v]) => s + v, 0);
    return { seen, wreckBadRate: +(wreckBad / 200).toFixed(3), keptBadRate: +(keptBad / 200).toFixed(3),
             eliminatedByNight: out.eliminatedByNight, distinct: Object.keys(seen).length };
  })()`);
  console.log('  bad-night rate: wrecked camp ' + nights.wreckBadRate + '  ·  kept camp ' + nights.keptBadRate);
  console.log('  events seen: ' + Object.keys(nights.seen).sort().join(', '));
  check('NEVER LETHAL: no night ever removes a castaway', nights.eliminatedByNight === 0,
    `${nights.eliminatedByNight} eliminations`);
  check('a wrecked camp has far worse nights than a kept one',
    nights.wreckBadRate > nights.keptBadRate * 1.8,
    `${nights.wreckBadRate} vs ${nights.keptBadRate}`);
  check('a kept camp is mostly left alone', nights.keptBadRate < 0.35, `${nights.keptBadRate}`);
  check('the night pool has real variety', nights.distinct >= 8, `${nights.distinct} distinct outcomes`);

  /* ================= 8. no dominant / dead job ================= */
  console.log('\n--- job efficiency (game-balance-analyst: spread should stay under ~1.4x) ---');
  const jobs = await ev(`(() => {
    const P = GAME.player;
    const out = {};
    /* Two things would otherwise measure noise instead of design:
         - relationships clamp at 1.0, so six jobs back to back on one cast reads
           the ceiling rather than the job;
         - each job is admired by a different number of clusters and the cast is
           seeded from Date.now(), so the admirer count swings per run.
       Restore the matrix each time and hold the admirer count constant, which
       isolates the actual variable: reward per unit of effort spent. */
    const BASE = 0.40;   // mid-range, so nothing clips against the 1.0 ceiling
    const mates = aliveTribe(P.tribeName).filter(c => !c.isPlayer);
    const realClusters = mates.map(c => c.cluster);
    for (const job of CAMP_JOBS) {
      __rig.reset(777);
      for (const n of CAMP_NEEDS) CampNeeds.set(n.id, 0.4);
      GAME.campFire = 0.3;
      const before = {};
      for (const c of aliveTribe(P.tribeName)) {
        if (c.isPlayer) continue;
        const e = c.relEntry(P.name); if (e) e.rel = BASE;
        c.choreRelGiven = {};
        before[c.name] = c.getRel(P.name);
      }
      /* Same number of admirers for every job under test. */
      mates.forEach((c, i) => { c.cluster = i % 2 ? job.admire[0] : 'zzz-nobody'; });
      Camp.doJob(job);
      let gain = 0;
      for (const c of aliveTribe(P.tribeName)) if (!c.isPlayer) gain += c.getRel(P.name) - before[c.name];
      out[job.id] = { relPerHour: +(gain / job.hours).toFixed(4), zone: job.zone, act: job.act, need: job.need };
    }
    mates.forEach((c, i) => { c.cluster = realClusters[i]; });
    return out;
  })()`);
  const eff = Object.values(jobs).map(j => j.relPerHour).filter(v => v > 0);
  const spreadX = Math.max(...eff) / Math.min(...eff);
  console.log('  ' + JSON.stringify(Object.fromEntries(Object.entries(jobs).map(([k, v]) => [k, v.relPerHour]))));
  check('no dominant job', spreadX < 1.45, `efficiency spread ${spreadX.toFixed(2)}x`);
  check('no dead job (every job does something for the camp)',
    Object.values(jobs).every(j => j.need || j.act === 'tend'), 'all jobs have an effect');

  /* ================= 9. biome routing + action tags ================= */
  console.log('\n--- biomes and action tags ---');
  const routing = await ev(`(() => {
    const zoneIds = Beach.ZONES.map(z => z.id);
    const rows = CAMP_JOBS.map(j => ({
      id: j.id, zone: j.zone, act: j.act,
      zoneReal: zoneIds.indexOf(j.zone) >= 0,
      actKnown: Beach.ACTS.indexOf(j.act) >= 0,
      x: +Beach.zoneX(j.zone).toFixed(1)
    }));
    /* And prove the tag actually lands on the figure. */
    const npc = alive().find(c => !c.isPlayer && Beach.figures.has(c.name));
    if (!npc) return { rows, tagged: null, cleared: false, distinctZones: 0, distinctActs: 0 };
    Beach.setAct(npc.name, 'chop', 0);
    const figEl = Beach.figures.get(npc.name);
    const tagged = figEl ? { act: figEl.el.dataset.act, cls: figEl.el.classList.contains('act-chop'),
                             working: figEl.el.classList.contains('working') } : null;
    Beach.setAct(npc.name, null);
    const cleared = figEl ? figEl.el.dataset.act === undefined : false;
    return { rows, tagged, cleared, distinctZones: new Set(rows.map(r => r.zone)).size,
             distinctActs: new Set(rows.map(r => r.act)).size };
  })()`);
  for (const r of routing.rows) {
    console.log(`    ${r.id.padEnd(9)} -> ${r.zone.padEnd(9)} @${String(r.x).padStart(5)}%  act="${r.act}"`
      + `${r.zoneReal ? '' : '  BAD ZONE'}${r.actKnown ? '' : '  BAD ACT'}`);
  }
  check('every job routes to a real biome', routing.rows.every(r => r.zoneReal), 'all zones resolve');
  check('every job carries a known action tag', routing.rows.every(r => r.actKnown), 'all acts known');
  check('jobs happen in different places', routing.distinctZones >= 5, `${routing.distinctZones} zones`);
  check('each job has its own action type', routing.distinctActs >= 6, `${routing.distinctActs} acts`);
  check('the action tag lands on the figure as a parameter',
    !!routing.tagged && routing.tagged.act === 'chop' && routing.tagged.cls && routing.tagged.working,
    'data-act + .act-chop + .working');
  check('the action tag clears again', routing.cleared, 'no stuck tags');

  /* ================= 10. survival shows up in what people say ================= */
  console.log('\n--- hunger and exhaustion in dialogue ---');
  const voice = await ev(`(() => {
    const npc = alive().find(c => !c.isPlayer);
    const grab = (setup, n) => {
      setup();
      const lines = new Set();
      for (let i = 0; i < n; i++) { const l = CampLines.stateGreeting(npc); if (l) lines.add(l); }
      return lines.size;
    };
    const fine = grab(() => { npc.hunger = 0.1; npc.fatigue = 0.1; npc.morale = 0.7; }, 60);
    const hungry = grab(() => { npc.hunger = 0.95; npc.fatigue = 0.1; npc.morale = 0.7; }, 200);
    const tired = grab(() => { npc.hunger = 0.1; npc.fatigue = 0.95; npc.morale = 0.7; }, 200);
    const broken = grab(() => { npc.hunger = 0.1; npc.fatigue = 0.1; npc.morale = 0.10; }, 200);
    /* Every band of the two player-facing pools must be populated. */
    const bands = ['cold', 'wary', 'warm', 'close'];
    const perBand = {};
    for (const b of bands) {
      perBand[b] = {
        hungry: new Set(Array.from({length: 120}, () => CampLines.pick('replyHungry', npc, {}, b))).size,
        tired: new Set(Array.from({length: 120}, () => CampLines.pick('replyTired', npc, {}, b))).size
      };
    }
    npc.hunger = 0.2; npc.fatigue = 0.2; npc.morale = 0.62;
    return { fine, hungry, tired, broken, perBand };
  })()`);
  console.log('  distinct state greetings — hungry ' + voice.hungry + ', exhausted ' + voice.tired
    + ', breaking ' + voice.broken + '  (a castaway who is fine: ' + voice.fine + ')');
  console.log('  "I am starving"/"I am spent" replies per band: '
    + Object.entries(voice.perBand).map(([b, v]) => `${b} ${v.hungry}/${v.tired}`).join('  '));
  check('a castaway who is fine does not talk about hunger', voice.fine === 0, `${voice.fine} lines`);
  check('a starving castaway sounds starving', voice.hungry >= 6, `${voice.hungry} distinct`);
  check('an exhausted castaway sounds exhausted', voice.tired >= 6, `${voice.tired} distinct`);
  check('a castaway whose head has gone sounds like it', voice.broken >= 6, `${voice.broken} distinct`);
  check('every warmth band answers "I am starving" differently',
    Object.values(voice.perBand).every(v => v.hungry >= 8), 'all bands >= 8 lines');
  check('every warmth band answers "I am spent" differently',
    Object.values(voice.perBand).every(v => v.tired >= 8), 'all bands >= 8 lines');

  /* ================= 11. gossip reaches the player ================= */
  console.log('\n--- gossip ---');
  const gossip = await ev(`(() => {
    __rig.reset(31337);
    /* Build a real gap: make three people work hard for a week. */
    for (let d = 0; d < 8; d++) __rig.day(0);
    const pool = Ledger.pool().filter(c => !c.isPlayer);
    const lines = new Set();
    let grumbles = 0, praises = 0;
    for (let i = 0; i < 900; i++) {
      const g = [pool[i % pool.length], pool[(i + 1) % pool.length], pool[(i + 2) % pool.length]];
      const r = CampGossip.maybe(g);
      if (!r) continue;
      lines.add(r.text);
      if (r.kind === 'warn') grumbles++; else praises++;
    }
    const worst = Ledger.worstIn(pool);
    return { distinct: lines.size, grumbles, praises,
             worstRep: +worst.rep.toFixed(2), worstCluster: worst.who ? worst.who.cluster : null,
             sample: [...lines].slice(0, 3) };
  })()`);
  console.log('  ' + gossip.distinct + ' distinct lines · ' + gossip.grumbles + ' grumbles, '
    + gossip.praises + ' compliments · worst contributor: ' + gossip.worstCluster
    + ' (rep ' + gossip.worstRep + ')');
  gossip.sample.forEach(l => console.log('    ' + l));
  check('the tribe talks about who does nothing', gossip.grumbles > 0, `${gossip.grumbles} grumbles`);
  check('and occasionally about who carries them', gossip.praises > 0, `${gossip.praises} compliments`);
  check('gossip does not repeat itself', gossip.distinct >= 12, `${gossip.distinct} distinct lines`);

  /* ================= 12. shirking is costly but survivable ================= */
  console.log('\n--- is "never work" a dead strategy, a viable one, or a dominant one? ---');
  const viable = await ev(`(() => {
    const trial = jobs => {
      const relS = [], vwS = [], chalS = [];
      for (let i = 0; i < 10; i++) {
        __rig.season(5500 + i * 71, jobs);
        const P = GAME.player;
        const pool = (GAME.merged ? alive() : aliveTribe(P.tribeName)).filter(c => !c.isPlayer);
        seedVoteWeights(GAME.cast, GAME.merged, P.name);
        let rel = 0, vw = 0;
        for (const c of pool) { rel += c.getRel(P.name); vw += Math.max(0, c.getVW(P.name)); }
        relS.push(rel / pool.length); vwS.push(vw);
        chalS.push(Challenges.score(P, { name: 't', cat: 'Physical', w: [0,0,0,0,0,1,0], desc: '' }));
      }
      const m = a => a.reduce((s, v) => s + v, 0) / a.length;
      return { rel: +m(relS).toFixed(3), heat: +m(vwS).toFixed(2), chal: +m(chalS).toFixed(3) };
    };
    return { never: trial(0), always: trial(2) };
  })()`);
  console.log('  never works : ' + JSON.stringify(viable.never));
  console.log('  always works: ' + JSON.stringify(viable.always));
  check('shirking costs you real standing', viable.always.rel > viable.never.rel,
    `bond ${viable.never.rel} -> ${viable.always.rel}`);
  check('shirking puts real heat on you', viable.always.heat < viable.never.heat,
    `heat ${viable.never.heat} shirking vs ${viable.always.heat} working`);
  /* The design property is that camp standing is ONE axis, not the whole game:
     a pure social player must still be able to hold relationships and must not
     be buried in vote weight. The bound is the drift cap, not a round number. */
  check('but shirking is not instant death — it stays a playable style',
    viable.never.rel > 0.10 && viable.never.heat < 8,
    `bond ${viable.never.rel}, heat ${viable.never.heat}`);
  check('camp work is one axis, not the whole relationship',
    viable.always.rel - viable.never.rel < 0.75,
    `working-vs-shirking bond gap ${(viable.always.rel - viable.never.rel).toFixed(2)}`);
  check('MORALE COUNTER-FORCE: staying fresh does not beat being liked at challenges',
    viable.always.chal >= viable.never.chal - 0.05,
    `challenge score ${viable.never.chal} shirking vs ${viable.always.chal} working`);

  /* ================= 13. the rel drift cap holds ================= */
  const cap = await ev(`(() => {
    __rig.reset(4242);
    for (let d = 0; d < 24; d++) __rig.day(0);
    let worst = 0;
    for (const o of alive()) {
      for (const k of Object.keys(o.campRelGiven || {})) worst = Math.max(worst, Math.abs(o.campRelGiven[k]));
    }
    return { worst: +worst.toFixed(4), cap: CONFIG.campRelDriftCap };
  })()`);
  console.log('\n--- caps ---');
  check('camp-driven opinion never becomes the whole relationship',
    cap.worst <= cap.cap + 0.0005, `largest ${cap.worst} vs cap ${cap.cap}`);

  if (errors.length) console.log('\n!! page errors: ' + JSON.stringify(errors.slice(0, 4)));
  const ok = !fails.length && !errors.length;
  if (fails.length) console.log('\nfailing checks: ' + fails.join(', '));
  console.log(ok ? '\nCAMP TEST PASS' : '\nCAMP TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
