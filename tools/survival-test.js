/* Survival + camp + fire + tribal weighting.
   Run: node tools/survival-test.js */
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
    '--no-first-run', '--window-size=900,430', '--force-device-scale-factor=2',
    '--user-data-dir=' + os.tmpdir() + '\\cw-surv-' + RUN_ID, 'http://localhost:8099/index.html?no3d=1'], { stdio: 'ignore' });
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
  const waitFor = async s => { for (let i = 0; i < 80; i++) { if (await ev(`!!document.querySelector(${JSON.stringify(s)})`)) return; await sleep(250); } throw new Error('no ' + s); };

  await waitFor('#screen-title.active');
  await ev(`localStorage.clear()`);
  await send('Page.reload', { ignoreCache: true });
  await waitFor('#screen-title.active'); await sleep(300);
  await ev(`document.getElementById('btn-new-game').click()`);
  await waitFor('#screen-create.active');
  await ev(`GAME.fastMaroon = true; GAME.fastChallenge = true; document.getElementById('btn-create-go').click()`);
  for (let i = 0; i < 120; i++) {
    if (await ev(`!!document.querySelector('#screen-camp.active')`)) break;
    if (await ev(`(() => { const b = document.querySelector('#maroon-choices button'); if (b) { b.click(); return true; } return false; })()`)) await sleep(120);
    else await sleep(150);
  }
  await waitFor('#screen-camp.active'); await waitFor('#figures .bfig');
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>/skip tutorial/i.test(b.textContent));if(b)b.click();})()`);
  await sleep(500);

  /* 1. Fire skill: seeded, varies by temperament, hidden, and improves. */
  const fire = await ev(`(() => {
    const P = GAME.player;
    const spread = alive().map(c => ({ cl: c.cluster, f: +c.fireSkill.toFixed(3) }));
    const lo = Math.min(...spread.map(x => x.f)), hi = Math.max(...spread.map(x => x.f));
    const before = P.fireSkill;
    Fire.practise(P); Fire.practise(P); Fire.practise(P);
    return { seeded: spread.length, lo, hi, before: +before.toFixed(3),
             after3: +P.fireSkill.toFixed(3), fires: P.firesMade,
             described: Fire.describe(P), leaksNumber: /[0-9]/.test(Fire.describe(P)) };
  })()`);
  console.log(`fire skill: seeded ${fire.seeded}, spread ${fire.lo}..${fire.hi}`);
  console.log(`  practising 3x: ${fire.before} -> ${fire.after3} (fires=${fire.fires})`);
  console.log(`  hidden from player: "${fire.described}" (no digits: ${!fire.leaksNumber})`);

  /* 2. Fire challenges are gated. */
  const gate = await ev(`(() => {
    const out = { earlyFire: 0, tries: 400, finalFour: null, lateFire: 0 };
    Challenges.usedIdx.clear();
    for (let i = 0; i < out.tries; i++) {
      Challenges.usedIdx.clear();
      const c = Challenges.pickChallenge();
      if (c.fire) out.earlyFire++;
    }
    // with only 4 left, the game must force fire
    const keep = GAME.cast.filter(c => !c.eliminated).slice(0, 4).map(c => c.name);
    GAME.cast.forEach(c => { if (keep.indexOf(c.name) < 0) c.eliminated = true; });
    out.aliveNow = alive().length;
    out.finalFour = (alive().length <= 4 ? Challenges.finalFourFire() : Challenges.pickChallenge()).name;
    GAME.cast.forEach(c => c.eliminated = false);
    return out;
  })()`);
  console.log(`fire gating: appeared in ${gate.earlyFire}/${gate.tries} early picks (must be 0)`);
  console.log(`  at final ${gate.aliveNow}: "${gate.finalFour}"`);

  /* 3. Fire skill decides a fire challenge. */
  const fireScore = await ev(`(() => {
    const chal = Challenges.finalFourFire();
    const P = GAME.player;
    const keepH = P.hunger, keepF = P.fatigue; P.hunger = 0; P.fatigue = 0;
    setPlayerChallengePerf(null);
    P.fireSkill = 0.10; const lo = Challenges.score(P, chal);
    P.fireSkill = 0.95; const hi = Challenges.score(P, chal);
    P.hunger = keepH; P.fatigue = keepF;
    return { lo: +lo.toFixed(3), hi: +hi.toFixed(3) };
  })()`);
  console.log(`fire challenge score: skill 0.10 -> ${fireScore.lo}, skill 0.95 -> ${fireScore.hi}`);

  /* 4. Condition hurts performance — but only within its station.

     This check used to assert that a fresh castaway at 0.55 physicality beat a
     ruined one at 0.85, i.e. that being hungry and tired overturned a THIRD of
     the whole stat range. It did, because the penalty was up to 0.56, and that was
     the problem: condition was worth more than everybody's stats and was quietly
     deciding immunities.

     The design now is a plateau plus a tail (see docs/camp-economy.md). So there
     are two properties to test, and the second one is new:

       a) between comparable castaways, condition decides it;
       b) between very different ones, it does NOT — an elite physical player who
          is starving still beats a mediocre well-fed one, which is also what
          happens on the show. */
  const cond = await ev(`(() => {
    const chal = { name: 'x', cat: 'Physical', w: [0,0,0,0,0,1,0], desc: '' };
    const pool = alive().filter(c => !c.isPlayer);
    /* ONE castaway, scored twice — not two castaways with one stat matched.
       Challenges.score reads more than physicality (archetype leaning, morale, the
       form-on-the-day roll), so pool[0] and pool[1] are not comparable just because
       their physicality agrees. That is why the 'must be a coin flip' plateau case
       kept reporting 0.925 vs 0.812 and failing at random: it was measuring whichever
       two NPCs the season happened to generate, not condition.

       Scoring the same castaway under side A's and side B's settings, alternately,
       leaves the condition gap as the only difference — which is the whole point of
       the check. */
    const subject = pool[0];
    const N = 500;
    const duel = (aPhys, bPhys, aCond, bCond) => {
      let sa = 0, sb = 0, bWins = 0;
      const set = (phys, cond) => {
        subject.stats.physicality = phys;
        subject.hunger = cond; subject.fatigue = cond;
      };
      for (let i = 0; i < N; i++) {
        set(aPhys, aCond); const x = Challenges.score(subject, chal);
        set(bPhys, bCond); const y = Challenges.score(subject, chal);
        sa += x; sb += y;
        if (y > x) bWins++;
      }
      return { a: +(sa / N).toFixed(3), b: +(sb / N).toFixed(3), bWins: +(bWins / N).toFixed(2) };
    };
    return {
      /* Equal ability, one of them wrecked. */
      even: duel(0.65, 0.65, 0.95, 0.10),
      /* Big ability gap, the strong one wrecked. */
      gap: duel(0.85, 0.55, 0.95, 0.10),
      /* Both at the normal island plateau: condition must be a non-event. */
      plateau: duel(0.65, 0.65, CONFIG.hungerPlateau, CONFIG.hungerPlateau),
      samples: N
    };
  })()`);
  console.log(`condition (mean of ${cond.samples} rounds):`);
  console.log(`  equal ability, one wrecked : ${cond.even.a} vs ${cond.even.b}`
    + ` — the fresh one wins ${(cond.even.bWins * 100).toFixed(0)}%`);
  console.log(`  strong-but-wrecked vs weak : ${cond.gap.a} vs ${cond.gap.b}`
    + ` — the weak fresh one wins ${(cond.gap.bWins * 100).toFixed(0)}%`);
  console.log(`  both at the normal plateau : ${cond.plateau.a} vs ${cond.plateau.b}`
    + ` (should be a coin flip)`);

  /* 5. Tribal: the player pulls more than one, but cannot rule the result. */
  const tribal = await ev(`(() => {
    const chal = { name: 'x', cat: 'Physical', w: [0,0,0,0,0,1,0], desc: '' };
    const P = GAME.player;
    const mine = aliveTribe(P.tribeName), other = aliveTribe(P.tribeName === 'Tidal' ? 'Ember' : 'Tidal');
    alive().forEach(c => { c.hunger = 0; c.fatigue = 0; c.stats.physicality = 0.5; });
    // player perfect, own tribe average, other tribe average -> should still be close
    setPlayerChallengePerf(1);
    let winsWithHero = 0;
    for (let i = 0; i < 200; i++) if (Challenges.runTribal(chal, mine, other) === 'A') winsWithHero++;
    // now make the other tribe clearly stronger; a perfect player must NOT always save it
    other.forEach(c => c.stats.physicality = 0.95);
    let winsVsStrong = 0;
    for (let i = 0; i < 200; i++) if (Challenges.runTribal(chal, mine, other) === 'A') winsVsStrong++;
    // and a terrible player must not always lose it if the tribe is strong
    setPlayerChallengePerf(0);
    other.forEach(c => c.stats.physicality = 0.5);
    mine.forEach(c => { if (!c.isPlayer) c.stats.physicality = 0.95; });
    let winsDespiteFlop = 0;
    for (let i = 0; i < 200; i++) if (Challenges.runTribal(chal, mine, other) === 'A') winsDespiteFlop++;
    setPlayerChallengePerf(null);
    return { tribeSize: mine.length, winsWithHero, winsVsStrong, winsDespiteFlop };
  })()`);
  console.log(`tribal (tribe of ${tribal.tribeSize}, 200 runs each):`);
  console.log(`  perfect player, even tribes      : ${tribal.winsWithHero}/200 wins`);
  console.log(`  perfect player, other tribe strong: ${tribal.winsVsStrong}/200  (must NOT be 200)`);
  console.log(`  player flops, own tribe strong    : ${tribal.winsDespiteFlop}/200  (must NOT be 0)`);

  /* 6. Camp work: costs fatigue, gains relationship, admirers gain more. */
  const camp = await ev(`(() => {
    const P = GAME.player;
    P.fatigue = 0.2;
    const job = CAMP_JOBS.find(j => j.id === 'fire');
    const mates = aliveTribe(P.tribeName).filter(c => !c.isPlayer);
    /* The season seed is Date.now(), so a random tribe can legitimately contain
       zero admirers of a given job or nothing but admirers — which made this
       assertion flake rather than test anything. Force a known split instead. */
    const notAdmiring = TRAIT_CLUSTERS.map(c => c.name).find(n => job.admire.indexOf(n) < 0);
    mates.forEach((c, i) => { c.cluster = i % 2 ? job.admire[0] : notAdmiring; });
    const before = mates.map(c => c.getRel(P.name));
    const f0 = P.fatigue, fires0 = P.firesMade;
    Camp.doJob(job);
    const after = mates.map(c => c.getRel(P.name));
    const gains = after.map((v, i) => +(v - before[i]).toFixed(4));
    const admireGains = gains.filter((g, i) => job.admire.indexOf(mates[i].cluster) >= 0);
    const otherGains = gains.filter((g, i) => job.admire.indexOf(mates[i].cluster) < 0);
    const mean = a => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
    return { fatigueUp: +(P.fatigue - f0).toFixed(3), firesUp: P.firesMade - fires0,
             everyoneGained: gains.every(g => g > 0),
             maxGain: +mean(admireGains).toFixed(4), minGain: +mean(otherGains).toFixed(4),
             admirers: admireGains.length };
  })()`);
  console.log(`camp work: fatigue +${camp.fatigueUp}, fires +${camp.firesUp}`);
  console.log(`  rel gain for all: ${camp.everyoneGained}, admirers(${camp.admirers}) got up to ${camp.maxGain} vs ${camp.minGain}`);

  /* 7. Eat / nap. Nap must actually cost hours. */
  const rest = await ev(`(() => {
    const P = GAME.player;
    P.hunger = 0.8; P.fatigue = 0.8; GAME.foodStore = 0.4; GAME.hoursRemaining = 8;
    const e = Camp.eat();
    const afterEat = +P.hunger.toFixed(3);
    const h0 = GAME.hoursRemaining;
    const msg = Camp.nap(); consumeTime(CONFIG.napHours);
    return { ate: e.ok, hunger: afterEat, fatigueAfterNap: +P.fatigue.toFixed(3),
             hoursLost: +(h0 - GAME.hoursRemaining).toFixed(2), napMsg: msg.slice(0, 50),
             napHours: CONFIG.napHours };
  })()`);
  console.log(`eat: ok=${rest.ate}, hunger 0.80 -> ${rest.hunger}`);
  console.log(`nap: fatigue 0.80 -> ${rest.fatigueAfterNap}, cost ${rest.hoursLost}h of daylight`);

  /* 8. Morale is driven by many inputs and is legible. */
  const mor = await ev(`(() => {
    const P = GAME.player;
    P.hunger = 0.9; P.fatigue = 0.9;
    const bad = Morale.targetFor(P);
    P.hunger = 0.05; P.fatigue = 0.05;
    const good = Morale.targetFor(P);
    /* How many DISTINCT reasons can morale ever cite? Turn everything on. */
    const keepDay = GAME.day, keepMerged = GAME.merged, keepImm = GAME.todayImmune;
    GAME.day = 20; GAME.merged = true; GAME.todayImmune = P;
    GAME.lastVoteWentMyWay = true; GAME.gotVotesLastTribal = true;
    P.hunger = 0.5; P.fatigue = 0.5; P.lastChallengeScore = 0.9;
    Weather.today = 'Stormy';
    PlayerAlliances.align(alive().find(c => !c.isPlayer).name, 1);
    const wide = Morale.targetFor(P).parts.length;
    Weather.today = 'Sunny';
    const wide2 = new Set(Morale.targetFor(P).parts.map(x => x.why));
    Morale.targetFor(P).parts.forEach(x => wide2.add(x.why));
    GAME.day = keepDay; GAME.merged = keepMerged; GAME.todayImmune = keepImm;
    return { catalogue: Math.max(wide, wide2.size), inputs: good.parts.length, badTarget: +bad.target.toFixed(3),
             goodTarget: +good.target.toFixed(3),
             reasons: Morale.reasons(P, 3), label: Morale.label(good.target) };
  })()`);
  console.log(`morale: ${mor.inputs} active inputs now, ${mor.catalogue} distinct inputs available; ruined ${mor.badTarget} vs fresh ${mor.goodTarget}`);
  console.log(`  reads as "${mor.label}" because: ${mor.reasons.join(', ')}`);

  /* 9. The camp menu opens and offers the jobs. */
  const menu = await ev(`(() => {
    GAME.hoursRemaining = 9;
    openCampMenu();
    const body = document.getElementById('modal-body');
    const labels = [...body.querySelectorAll('button')].map(b => b.textContent.trim());
    const bars = body.querySelectorAll('.camp-cond .meter').length;
    Modal.close();
    return { labels, bars };
  })()`);
  console.log('camp menu:', JSON.stringify(menu.labels));
  console.log('  condition bars:', menu.bars);


  /* ---- balance audit (game-balance-analyst) ---- */
  const bal = await ev(`(() => {
    const P = GAME.player;
    const mates = aliveTribe(P.tribeName).filter(c => !c.isPlayer);
    /* rel per hour for each job, first job of the day, so no job is dominant */
    const perHour = {};
    for (const job of CAMP_JOBS) {
      GAME.choreDay = -1; GAME.choresToday = 0;
      const before = mates.map(c => c.getRel(P.name));
      Camp.doJob(job);
      const gained = mates.reduce((s, c, i) => s + (c.getRel(P.name) - before[i]), 0);
      perHour[job.id] = +(gained / job.hours).toFixed(4);
    }
    const vals = Object.values(perHour);
    const spread = Math.max(...vals) / Math.min(...vals);
    /* within-day decay: 1st vs 4th chore */
    GAME.choreDay = -1; GAME.choresToday = 0;
    const job = CAMP_JOBS[0];
    const g = [];
    for (let i = 0; i < 4; i++) {
      const b = mates.map(c => c.getRel(P.name));
      Camp.doJob(job);
      g.push(+mates.reduce((s, c, j) => s + (c.getRel(P.name) - b[j]), 0).toFixed(4));
    }
    /* one conversation for comparison */
    const npc = mates[0];
    const b2 = npc.getRel(P.name);
    npc.playerConvosThisPhase = 0;
    applyRelTrust(npc, 0.03, 0.01, true, 'test');
    const convo = +(npc.getRel(P.name) - b2).toFixed(4);
    /* nap value when fresh vs wrecked */
    P.fatigue = 0.1; const f0 = P.fatigue; Camp.nap(); const napFresh = +(f0 - P.fatigue).toFixed(3);
    P.fatigue = 0.9; const f1 = P.fatigue; Camp.nap(); const napWrecked = +(f1 - P.fatigue).toFixed(3);
    /* fire counter-play: do NPCs improve? */
    const fireBefore = mates.map(c => c.fireSkill);
    for (let d = 0; d < 12; d++) TribeWork.dailyTick(alive());
    const improved = mates.filter((c, i) => c.fireSkill > fireBefore[i] + 0.001).length;
    const bestNpc = Math.max(...mates.map(c => c.fireSkill));
    return { perHour, spread: +spread.toFixed(2), decay: g, convoPerHour: convo,
             napFresh, napWrecked, npcsImproved: improved, of: mates.length,
             bestNpcFire: +bestNpc.toFixed(3), foodStore: +GAME.foodStore.toFixed(2) };
  })()`);
  console.log('--- balance audit ---');
  console.log('rel/hour by job:', JSON.stringify(bal.perHour));
  console.log(`  efficiency spread ${bal.spread}x (skill flags a problem above ~1.4x)`);
  console.log(`within-day chore decay (same job x4): ${bal.decay.join(' -> ')}`);
  console.log(`one conversation, one person: ${bal.convoPerHour}`);
  console.log(`nap when fresh ${bal.napFresh} vs wrecked ${bal.napWrecked} fatigue recovered`);
  console.log(`fire counter-play: ${bal.npcsImproved}/${bal.of} NPCs improved over 12 days, best NPC ${bal.bestNpcFire}`);
  console.log(`tribe also fed the store: ${bal.foodStore}`);

  const checks = {
    fireSeeded: fire.seeded > 10,
    fireSpread: fire.hi - fire.lo > 0.15,
    firePractice: fire.after3 > fire.before,
    fireHidden: !fire.leaksNumber,
    gateEarly: gate.earlyFire === 0,
    gateFinal: /Fire/i.test(gate.finalFour),
    fireScoreSwing: fireScore.hi > fireScore.lo + 0.3,
    /* Between equals, being wrecked loses you the round. */
    conditionMatters: cond.even.b > cond.even.a,
    /* But it does not overturn a third of the stat range. */
    conditionKnowsItsPlace: cond.gap.a > cond.gap.b,
    /* And the normal island condition is not a penalty at all. */
    plateauIsFree: Math.abs(cond.plateau.bWins - 0.5) < 0.12,
    notAlways: tribal.winsVsStrong < 200,
    notNever: tribal.winsDespiteFlop > 0,
    choreFatigue: camp.fatigueUp > 0.05,
    choreFire: camp.firesUp === 1,
    choreAll: camp.everyoneGained,
    choreAdmire: camp.maxGain > camp.minGain,
    ate: rest.ate,
    hungerDown: rest.hunger < 0.8,
    fatigueDown: rest.fatigueAfterNap < 0.8,
    /* A nap must cost real daylight — read from CONFIG rather than hardcoded, so
       tuning napHours does not read as a broken game. It was 2.0 and is now 1.5,
       because out there they nap constantly and it is not a grand sacrifice. */
    napCost: rest.hoursLost >= rest.napHours,
    moraleActive: mor.inputs >= 6,
    moraleCatalogue: mor.catalogue >= 12,
    moraleReasons: mor.reasons.length === 3,
    menuBars: menu.bars === 3,
    menuLabels: menu.labels.length >= 7,
    noErrors: !errors.length,
    noDominantJob: bal.spread <= 1.5,
    choreDecays: bal.decay[3] < bal.decay[0] * 0.45,
    napHasNiche: bal.napWrecked > bal.napFresh * 1.8,
    fireContested: bal.npcsImproved >= 3 && bal.bestNpcFire > 0.35,
    tribeForages: bal.foodStore > 0
  };
  console.log('failing checks:', Object.entries(checks).filter(([,v])=>!v).map(([k])=>k).join(', ') || 'none');
  const ok = fire.seeded > 10 && fire.hi - fire.lo > 0.15 && fire.after3 > fire.before && !fire.leaksNumber
    && gate.earlyFire === 0 && /Fire/i.test(gate.finalFour)
    && fireScore.hi > fireScore.lo + 0.3
    && cond.even.b > cond.even.a && cond.gap.a > cond.gap.b
    && Math.abs(cond.plateau.bWins - 0.5) < 0.12
    && tribal.winsVsStrong < 200 && tribal.winsDespiteFlop > 0
    && camp.fatigueUp > 0.05 && camp.firesUp === 1 && camp.everyoneGained && camp.maxGain > camp.minGain
    && rest.ate && rest.hunger < 0.8 && rest.fatigueAfterNap < 0.8 && rest.hoursLost >= rest.napHours
    && mor.inputs >= 6 && mor.catalogue >= 12 && mor.goodTarget > mor.badTarget && mor.reasons.length === 3
    && menu.bars === 3 && menu.labels.length >= 7
    && !errors.length
    && bal.spread <= 1.5 && bal.decay[3] < bal.decay[0] * 0.45
    && bal.napWrecked > bal.napFresh * 1.8
    && bal.npcsImproved >= 3 && bal.bestNpcFire > 0.35 && bal.foodStore > 0;
  if (errors.length) console.log('!! errors:', errors.slice(0, 4));
  console.log(ok ? '\nSURVIVAL TEST PASS' : '\nSURVIVAL TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
