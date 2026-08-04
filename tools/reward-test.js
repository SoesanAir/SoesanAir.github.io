/* Reward challenges: does the prize round behave like a prize round?

   The dangerous thing about this feature is not that it might be boring, it is
   that it shares a screen and a challenge library with immunity. So the checks
   that matter are the separations:

     A reward never grants immunity, never sets a losing tribe, never eliminates
     anybody, and never leaves a value behind for tonight's council to read.

     A reward never lands on a council day, and never lands every day.

     No minigame is played twice in a season by ANY challenge, reward or immunity,
     until the library is genuinely spent.

     Pre-merge, effects never cross tribes.

     Nothing on a reward screen says the word immunity.

   The multi-day effects get their own block, because "the tarp keeps paying" is
   the design claim and an effects list that pays once, twice per day, or forever
   would all look the same from the outside.

   This harness injects js/reward.js and css/reward.css itself if index.html has
   not been wired up yet, so it runs before and after the hooks land.

   Run: node tools/reward-test.js   (expects a static server on :8099) */
const http = require('http'), { spawn } = require('child_process'), os = require('os');
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
    '--user-data-dir=' + os.tmpdir() + '\\cw-reward-' + RUN_ID,
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
  /* Without this the harness silently tests whatever reward.js looked like the
     last time Chrome cached it. */
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

  /* ---- 0. the system loads at all, and survives having no season ----
     Everything in Rewards has to tolerate a half-built GAME, because this is
     exactly the state a harness runs it in. */
  const loaded = await ev(`(async () => {
    let how = 'already';
    if (typeof Rewards === 'undefined') {
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = 'css/reward.css?cb=' + Date.now();
      document.head.appendChild(link);
      const src = await (await fetch('js/reward.js?cb=' + Date.now())).text();
      const s = document.createElement('script');
      s.textContent = src;
      document.head.appendChild(s);
      how = 'injected';
    }
    return { how, ok: typeof Rewards !== 'undefined' && typeof REWARD_CONFIG !== 'undefined' };
  })()`);
  console.log(`\nreward.js ${loaded.how}`);
  check('js/reward.js loads and exposes Rewards + REWARD_CONFIG', !!loaded.ok);

  const preseason = await ev(`(() => {
    const out = { threw: '' };
    try {
      Rewards.reset();
      out.day = Rewards.isRewardDay(5);
      out.tick = Rewards.tickDay().length;
      out.sched = Rewards.scheduleFor(26).length;
      out.active = Rewards.active().length;
      out.prize = Rewards.pickPrize().id;
      out.chips = Rewards.chipsFor(REWARD_PRIZES[0]).length;
      Rewards.reset();
    } catch (e) { out.threw = String(e && e.message || e); }
    return out;
  })()`);
  check('reset / isRewardDay / tickDay / pickPrize are safe with no season',
    !preseason.threw, preseason.threw || 'no throw');
  check('isRewardDay answers with a boolean before a season exists',
    typeof preseason.day === 'boolean', String(preseason.day));
  check('there are no active effects before a season', preseason.active === 0);

  /* The tunables live in the browser; the assertions live here. */
  const CFG = await ev(`(() => ({
    minGap: REWARD_CONFIG.minGap, firstDay: REWARD_CONFIG.firstDay,
    dayChance: REWARD_CONFIG.dayChance, timeCost: REWARD_CONFIG.timeCost,
    maxActive: REWARD_CONFIG.maxActive
  }))()`);

  /* ---- boot a real season ---- */
  await ev(`document.getElementById('btn-new-game').click()`);
  await waitFor('#screen-create.active');
  await ev(`GAME.fastMaroon = true; GAME.fastChallenge = true; document.getElementById('btn-create-go').click()`);
  for (let i = 0; i < 400; i++) {
    if (await ev(`!!document.querySelector('#screen-camp.active')`)) break;
    await ev(`(() => { const b = document.querySelector('#maroon-choices button') || document.querySelector('.maroon-next'); if (b && !b.disabled) b.click(); })()`);
    await sleep(120);
  }
  await waitFor('#screen-camp.active');
  await ev(`DBG.setEnabled(false); window.toast=()=>{}; Telemetry.cfg.auto=false; Rewards.reset(); true;`);

  /* ---- 1. the schedule: different days from immunity, and not every day ---- */
  const sched = await ev(`(() => {
    const days = Rewards.scheduleFor(CONFIG.totalDays);
    const again = Rewards.scheduleFor(CONFIG.totalDays);
    const clash = days.filter(d => CONFIG.tribalDays.indexOf(d) >= 0);
    /* And against the LIVE predicate, endgame clause included. */
    const liveClash = [];
    for (let d = 1; d <= CONFIG.totalDays; d++) {
      if (isTribalDay(d) && Rewards.isRewardDay(d)) liveClash.push(d);
    }
    let minGap = 99;
    for (let i = 1; i < days.length; i++) minGap = Math.min(minGap, days[i] - days[i - 1]);
    /* Rate across many seasons, so a lucky seed cannot pass this on its own. */
    const seedWas = GAME.seasonSeed;
    let total = 0, none = 0, every = 0;
    const eligible = [];
    for (let d = 1; d <= CONFIG.totalDays; d++) if (CONFIG.tribalDays.indexOf(d) < 0 && d >= REWARD_CONFIG.firstDay) eligible.push(d);
    for (let s = 0; s < 200; s++) {
      GAME.seasonSeed = 1000 + s * 7919;
      const n = eligible.filter(d => Rewards.isRewardDay(d)).length;
      total += n;
      if (n === 0) none++;
      if (n === eligible.length) every++;
    }
    GAME.seasonSeed = seedWas;
    return {
      days, same: JSON.stringify(days) === JSON.stringify(again),
      clash: clash.length, liveClash: liveClash.length,
      minGap: days.length > 1 ? minGap : 99,
      eligible: eligible.length,
      mean: +(total / 200).toFixed(2), none, every,
      firstOk: days.every(d => d >= REWARD_CONFIG.firstDay)
    };
  })()`);
  console.log(`\nreward days this season: ${sched.days.join(', ') || 'none'}`
    + ` · ${sched.mean} per season over 200 seeds (${sched.eligible} eligible days)`);
  check('no reward day is a scheduled council day', sched.clash === 0, String(sched.clash));
  check('no reward day is a tribal day by the live predicate', sched.liveClash === 0, String(sched.liveClash));
  check('the schedule is stable when asked twice', sched.same);
  check('rewards are spaced at least REWARD_CONFIG.minGap apart',
    sched.minGap >= CFG.minGap || sched.days.length < 2, `min gap ${sched.minGap}`);
  check('no reward before REWARD_CONFIG.firstDay', sched.firstOk);
  check('roughly one eligible day in three is a reward day',
    sched.mean > sched.eligible * 0.20 && sched.mean < sched.eligible * 0.45,
    `${sched.mean} of ${sched.eligible}`);
  check('it is never every day', sched.every === 0, String(sched.every));
  check('a season nearly always gets at least one', sched.none < 30, `${sched.none}/200 seasons had none`);

  /* ---- 2. no minigame twice in a season, reward or immunity ---- */
  const games = await ev(`(() => {
    const idxWas = [...Challenges.usedIdx], puzWas = Challenges.puzzlesUsed;
    const restore = () => { Challenges.usedIdx = new Set(idxWas); Challenges.puzzlesUsed = puzWas; };

    Rewards.reset(); Challenges.reset();
    const ids = [];
    for (let i = 0; i < 8; i++) ids.push(Challenge.gameFor(Rewards.pickChallenge()).id);
    const distinct = new Set(ids).size;

    /* An immunity challenge tells us what it played. A reward must respect that. */
    Rewards.reset(); Challenges.reset();
    Rewards.noteMinigame('brace'); Rewards.noteMinigame('bucket'); Rewards.noteMinigame('sling');
    const after = [];
    for (let i = 0; i < 10; i++) after.push(Challenge.gameFor(Rewards.pickChallenge()).id);
    const stolen = after.filter(g => g === 'brace' || g === 'bucket' || g === 'sling').length;

    /* Exhaust the library and confirm it reuses rather than throwing — and says so. */
    Rewards.reset(); Challenges.reset();
    for (const g of MINIGAMES) Rewards.noteMinigame(g.id);
    const forced = Challenge.gameFor(Rewards.pickChallenge()).id;
    const flagged = Rewards.reusedGames;

    /* A Bit Tipsy spells a word inside its own arena, and it used to be hardcoded
       to IMMUNITY — so the game was excluded from rewards outright. That was a
       workaround; the word is a shell value now (Challenge.word), so the game is
       back in the pool and spells REWARD instead. What matters is no longer
       "is tipsy excluded" but "does the word follow the challenge", which is
       checked directly below. */
    Rewards.reset(); Challenges.reset();
    let sawTipsy = false;
    for (let i = 0; i < 30; i++) if (Challenge.gameFor(Rewards.pickChallenge()).id === 'tipsy') sawTipsy = true;
    /* Drive the spelling game with the reward word set, and read what it drew. */
    Challenge.word = REWARD_CONFIG.spellWord;
    const tipsy = MINIGAMES.find(g => g.id === 'tipsy');
    const arena = document.createElement('div');
    const spellCtx = Challenge.makeCtx({
      arena, frame: arena, score: document.createElement('span'),
      timer: (() => { const t = document.createElement('div'); t.appendChild(document.createElement('i')); return t; })(),
      game: tipsy, howto: document.createElement('div'), ease: 0.5, onDone: () => {}
    });
    spellCtx.done = () => {};
    tipsy.start(spellCtx);
    const spelled = arena.textContent || '';
    Challenge.word = null;
    const saysReward = /REWARD/.test(spelled);
    const saysImmunity = /IMMUNITY/.test(spelled);

    Rewards.reset(); Challenges.reset(); restore();
    return {
      ids, distinct, stolen, forced: !!forced, flagged, sawTipsy, saysReward, saysImmunity,
      library: MINIGAMES.length
    };
  })()`);
  console.log(`8 reward draws: ${games.ids.join(' ')} (${games.distinct} distinct of ${games.library} in the library)`);
  check('eight reward challenges play eight different minigames', games.distinct === 8, String(games.distinct));
  check('a reward will not replay a minigame immunity already used', games.stolen === 0, String(games.stolen));
  check('an exhausted library still returns a challenge', games.forced);
  check('and it records that it had to reuse one', games.flagged >= 1, String(games.flagged));
  /* The spelling game is now IN the reward pool, and the word follows the
     challenge instead of being hardcoded. Both halves matter: the game being
     available, and it never saying "immunity" on a reward screen. */
  check('the spelling game is available to rewards again', games.sawTipsy);
  check('and on a reward screen it spells REWARD', games.saysReward);
  check('never IMMUNITY', !games.saysImmunity);

  /* ---- 3. the prize table is differentiated and none of it is a punishment ---- */
  const table = await ev(`(() => {
    const rows = REWARD_PRIZES.map(p => {
      const ins = p.instant || {}, camp = p.camp || {}, l = p.lasting || null;
      return {
        id: p.id, share: p.share || 1,
        hunger: ins.hunger || 0, fatigue: ins.fatigue || 0, morale: ins.morale || 0,
        camp: Object.keys(camp).length, days: l ? l.days : 0,
        chips: Rewards.chipsFor(p).length,
        text: !!(p.name && p.prize && p.peff),
        /* Nothing here may make anybody worse off. Losing is the punishment. */
        harmful: (ins.hunger || 0) > 0 || (ins.fatigue || 0) > 0 || (ins.morale || 0) < 0
          || Object.keys(camp).some(k => camp[k] < 0)
          || (l && ((l.camp && Object.keys(l.camp).some(k => l.camp[k] < 0))
                 || (l.self && ((l.self.hunger || 0) > 0 || (l.self.fatigue || 0) > 0 || (l.self.morale || 0) < 0))))
      };
    });
    const j = JSON.stringify(REWARD_PRIZES) + JSON.stringify(REWARD_PEFF);
    return {
      rows, n: rows.length,
      lasting: rows.filter(r => r.days > 0).length,
      seconds: rows.filter(r => r.share > 1).length,
      harmful: rows.filter(r => r.harmful).map(r => r.id),
      noText: rows.filter(r => !r.text).map(r => r.id),
      noChips: rows.filter(r => !r.chips).map(r => r.id),
      biggestMorale: rows.slice().sort((a, b) => b.morale - a.morale)[0].id,
      biggestFood: rows.slice().sort((a, b) => a.hunger - b.hunger)[0].id,
      immunityWord: /immunity/i.test(j),
      shareRange: rows.every(r => r.share === 1 || r.share === 2)
    };
  })()`);
  console.log(`\nprize table: ${table.n} rewards, ${table.lasting} multi-day, ${table.seconds} that take a second pick`);
  for (const r of table.rows) {
    console.log(`  ${r.id.padEnd(9)} hunger ${r.hunger.toFixed(2)} fatigue ${r.fatigue.toFixed(2)}`
      + ` morale ${r.morale >= 0 ? '+' : ''}${r.morale.toFixed(2)} camp ${r.camp}`
      + ` lasting ${r.days ? r.days + 'd' : '-'} share ${r.share}`);
  }
  check('the table has all nine rewards', table.n >= 9, String(table.n));
  check('several rewards keep paying over multiple days', table.lasting >= 3, String(table.lasting));
  check('at least one reward makes Peff ask for a second pick', table.seconds >= 1, String(table.seconds));
  check('no reward harms anybody', table.harmful.length === 0, table.harmful.join(','));
  check('every reward has a name, a prize line and a Peff line', table.noText.length === 0, table.noText.join(','));
  check('every reward derives at least one effect chip', table.noChips.length === 0, table.noChips.join(','));
  check('the letter from home is the biggest morale reward', table.biggestMorale === 'letter', table.biggestMorale);
  check('the barbecue is the biggest hunger relief', table.biggestFood === 'barbecue', table.biggestFood);
  check('share counts are 1 or 2', table.shareRange);
  check('no reward text says immunity', !table.immunityWord);

  /* ---- 4. pre-merge the camp eats, and the other tribe does not ---- */
  const tribal = await ev(`(() => {
    Rewards.reset();
    /* Day one of a season starts everybody at hunger 0 and fatigue 0, so relief
       clamps to nothing and every assertion below would pass vacuously. Put the
       cast in the condition a reward actually gets won in. */
    for (const c of alive()) { c.hunger = 0.72; c.fatigue = 0.62; c.morale = 0.55; }
    const mine = GAME.player.tribeName, theirs = mine === 'Tidal' ? 'Ember' : 'Tidal';
    const fruit = REWARD_PRIZES.find(p => p.id === 'fruit');
    const before = {};
    for (const c of alive()) before[c.name] = c.hunger;
    const foodBefore = CampNeeds.get('food');
    const res = Rewards.grant(fruit, aliveTribe(mine), { toCamp: true });
    let fed = 0, crossed = 0;
    for (const c of aliveTribe(mine)) if (c.hunger < before[c.name] - 0.0001) fed++;
    for (const c of aliveTribe(theirs)) if (Math.abs(c.hunger - before[c.name]) > 0.0001) crossed++;
    const foodAfter = CampNeeds.get('food');

    /* And when the OTHER tribe wins it, our woodpile must not move. */
    const shelterBefore = CampNeeds.get('shelter');
    const tarp = REWARD_PRIZES.find(p => p.id === 'tarp');
    Rewards.grant(tarp, aliveTribe(theirs), { toCamp: false });
    const shelterAfter = CampNeeds.get('shelter');
    let theirsFed = 0;
    for (const c of aliveTribe(theirs)) if (c.morale > 0) theirsFed++;

    return {
      fed, of: aliveTribe(mine).length, crossed,
      food: +(foodAfter - foodBefore).toFixed(3),
      shelterMoved: Math.abs(shelterAfter - shelterBefore) > 0.0001,
      theirsFed, granted: !!res
    };
  })()`);
  console.log(`\npre-merge grant: ${tribal.fed}/${tribal.of} of my tribe fed, camp food +${tribal.food}`);
  check('the whole winning tribe gets the reward', tribal.fed === tribal.of, `${tribal.fed}/${tribal.of}`);
  check('the losing tribe is untouched — no tribe mixing', tribal.crossed === 0, String(tribal.crossed));
  check('a camp prize raises the camp board', tribal.food > 0.05, String(tribal.food));
  check('the other tribe winning does NOT move our camp', !tribal.shelterMoved);

  /* ---- 5. a multi-day reward keeps paying, once a day, then stops ---- */
  const lasting = await ev(`(() => {
    Rewards.reset();
    const dayWas = GAME.day;
    /* Empty the basket first. CampNeeds clamps at 1, and the earlier grants in
       this harness left the store near full — six days of fishing gear then hit
       the ceiling on the last one and the effect looked like it had stopped early
       when it had not. In a real season the nightly decay does this job. */
    CampNeeds.set('food', 0.15);
    const fishing = REWARD_PRIZES.find(p => p.id === 'fishing');
    Rewards.grant(fishing, aliveTribe(GAME.player.tribeName), { toCamp: true });
    const live = Rewards.active().length;
    const days = Rewards.active()[0] ? Rewards.active()[0].daysLeft : 0;
    const gains = [];
    for (let i = 0; i < 8; i++) {
      GAME.day++;
      /* Leave room in the need before measuring.

         CampNeeds.set clamps at 1, so a food store that has already filled up
         absorbs further payments invisibly and the delta reads as zero. The first
         version of this check measured that and reported a six-day reward as
         paying twice — which was the test looking at a saturated need, not the
         reward failing. A real day drains the store between ticks; this stands in
         for that so the check is about the reward and nothing else. */
      CampNeeds.set('food', 0.3);
      const b = CampNeeds.get('food');
      Rewards.tickDay();
      /* Twice on the same morning must pay once — a double-applied tarp is a
         silent balance bug rather than a visible one. */
      Rewards.tickDay();
      gains.push(+(CampNeeds.get('food') - b).toFixed(4));
    }
    const stillLive = Rewards.active().length;
    GAME.day = dayWas;
    Rewards.reset();
    return { live, days, gains, stillLive };
  })()`);
  console.log(`fishing gear paid: ${lasting.gains.join(' ')} (declared ${lasting.days} days)`);
  check('winning a multi-day reward creates exactly one active effect', lasting.live === 1, String(lasting.live));
  check('it pays on each of its declared days',
    lasting.gains.slice(0, lasting.days).every(g => g > 0.001), lasting.gains.slice(0, lasting.days).join(' '));
  check('it pays once a day, not twice',
    lasting.gains.slice(0, lasting.days).every(g => g < 0.09), lasting.gains.slice(0, lasting.days).join(' '));
  check('it stops the day after it expires',
    lasting.gains.slice(lasting.days).every(g => Math.abs(g) < 0.0001), lasting.gains.slice(lasting.days).join(' '));
  check('the effect is gone once it is spent', lasting.stillLive === 0, String(lasting.stillLive));

  /* ---- 6. bedding reaches the sleep model without editing the sleep model ---- */
  const sleepy = await ev(`(() => {
    Rewards.reset();
    const dayWas = GAME.day;
    GAME.goodSleep = false;
    const bedding = REWARD_PRIZES.find(p => p.id === 'bedding');
    const P = GAME.player;
    P.fatigue = 0.62;
    const fatBefore = P.fatigue;
    Rewards.grant(bedding, [P], { toCamp: false });
    const instant = P.fatigue < fatBefore - 0.0001;
    GAME.day++;
    const nightBefore = P.fatigue;
    Rewards.tickDay();
    const flagged = GAME.goodSleep === true;
    const nightly = P.fatigue < nightBefore - 0.0001;
    GAME.goodSleep = false;
    GAME.day = dayWas;
    Rewards.reset();
    return { instant, flagged, nightly };
  })()`);
  check('blankets relieve fatigue the day you win them', sleepy.instant);
  check('and set the good-night flag applySleepRecovery already reads', sleepy.flagged);
  check('and refund fatigue again on each of the following nights', sleepy.nightly);

  /* ---- 7. a reward touches nothing the council reads ---- */
  const clean = await ev(`(() => {
    Rewards.reset();
    GAME.todayImmune = null; GAME.todayLosingTribe = null;
    const aliveBefore = alive().length;
    const P = GAME.player;
    const bbq = REWARD_PRIZES.find(p => p.id === 'barbecue');
    Rewards.grant(bbq, aliveTribe(P.tribeName), { toCamp: true });
    return {
      immune: GAME.todayImmune === null,
      losing: GAME.todayLosingTribe === null,
      aliveSame: alive().length === aliveBefore,
      noneEliminated: alive().every(c => !c.eliminated),
      /* Nothing in the module writes an immunity flag under another name. */
      keys: Object.keys(Rewards).filter(k => /immun/i.test(k)).length
    };
  })()`);
  check('no immunity is granted', clean.immune);
  check('no losing tribe is set', clean.losing);
  check('nobody is eliminated', clean.aliveSame && clean.noneEliminated);
  check('the module has no immunity-shaped state', clean.keys === 0, String(clean.keys));

  /* ---- 8. the reward chrome is visibly not the immunity screen ----
     Built into the live screen and measured there: anything built into a screen
     that is not .active measures 0x0, which is how a banner can pass a text check
     and still be invisible. */
  const look = await ev(`(() => {
    const prize = REWARD_PRIZES.find(p => p.id === 'letter');
    const chal = CHALLENGES.find(c => c.cat === 'Physical') || CHALLENGES[0];
    const screen = document.getElementById('screen-challenge');
    Screens.push('screen-challenge');
    const go = document.getElementById('btn-chal-go');
    const plainBtn = getComputedStyle(go).backgroundColor;
    const titleWas = document.getElementById('chal-title').textContent;
    /* Dressed by the same call the game uses, so this cannot pass on a screen the
       game would have dressed differently. */
    const res = Rewards.dressScreen(chal, prize);
    const banner = document.getElementById('rw-banner');
    const card = res.querySelector('.rw-card');
    const rewardBtn = getComputedStyle(go).backgroundColor;
    const bs = banner.getBoundingClientRect(), cs = card.getBoundingClientRect();
    /* Everything the reward screen puts in front of the player before a second of
       it is played: banner, heading, challenge name, briefing, prize card. */
    const chrome = [banner, document.getElementById('chal-title'), document.getElementById('chal-name'),
      document.getElementById('chal-desc'), card].map(el => el.textContent).join(' ');
    const out = {
      bannerW: Math.round(bs.width), bannerH: Math.round(bs.height),
      cardW: Math.round(cs.width), cardH: Math.round(cs.height),
      saysReward: /REWARD/.test(banner.textContent),
      saysImmunity: /immunity/i.test(chrome),
      striped: getComputedStyle(banner).backgroundImage.indexOf('gradient') >= 0,
      prizeNamed: card.textContent.indexOf(prize.name) >= 0,
      prizeLine: card.textContent.indexOf(prize.prize) >= 0,
      peffQuoted: card.querySelectorAll('.rw-peff').length === 1,
      chips: card.querySelectorAll('.rw-chip').length,
      buttonRecoloured: plainBtn !== rewardBtn,
      prefixed: [...card.querySelectorAll('*'), banner, ...banner.querySelectorAll('*')]
        .filter(el => el.className && typeof el.className === 'string')
        .every(el => el.className.split(/\\s+/).filter(Boolean).every(c => c.indexOf('rw-') === 0 || c === 'chip' || c === 'display' || c === 'btn' || c === 'small'))
    };
    Rewards.undressScreen();
    res.innerHTML = '';
    document.getElementById('chal-title').textContent = titleWas;
    out.undressed = !document.getElementById('rw-banner') && !screen.classList.contains('rw-on');
    Screens.pop();
    return out;
  })()`);
  console.log(`\nbanner ${look.bannerW}x${look.bannerH}, prize card ${look.cardW}x${look.cardH},`
    + ` ${look.chips} effect chips`);
  check('the REWARD banner renders with real size on the live screen',
    look.bannerW > 100 && look.bannerH > 10, `${look.bannerW}x${look.bannerH}`);
  check('the banner says REWARD', look.saysReward);
  check('the banner is striped, so it cannot be mistaken for a panel', look.striped);
  check('the prize card renders with real size', look.cardW > 100 && look.cardH > 20,
    `${look.cardW}x${look.cardH}`);
  check('the card names the prize and says what it is', look.prizeNamed && look.prizeLine);
  check('Peff introduces the prize on the card', look.peffQuoted);
  check('the card shows what the prize actually does', look.chips >= 2, String(look.chips));
  check('the accent is repainted — the go button is not immunity-coloured', look.buttonRecoloured);
  check('nothing on the reward chrome says immunity', !look.saysImmunity);
  check('every class the reward introduces is rw- prefixed', look.prefixed);
  check('undressing puts the shared screen back', look.undressed);

  /* ---- 9. the stylesheet obeys the two rules this codebase keeps breaking ---- */
  const css = await ev(`(async () => {
    const txt = await (await fetch('css/reward.css?cb=' + Date.now())).text();
    const bare = txt.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '');
    return {
      bytes: txt.length,
      vh: (bare.match(/[0-9.]+vh\\b/g) || []),
      unprefixed: (bare.match(/^\\.[a-z-]+/gm) || []).filter(s => s.indexOf('.rw-') !== 0),
      linked: [...document.styleSheets].some(s => (s.href || '').indexOf('reward.css') >= 0)
    };
  })()`);
  check('css/reward.css uses vmin, never vh', css.vh.length === 0, css.vh.join(' '));
  check('every class selector in it is rw- prefixed',
    css.unprefixed.length === 0, css.unprefixed.join(' '));
  check('the stylesheet is actually attached to the document', css.linked);

  /* ---- 10. end to end, on the real screen ----
     watchMode means the player sits the minigame out, so this exercises the whole
     flow — pick, prize, rails, result, grant, standings, close — without needing
     synthetic input for whichever of forty minigames got drawn. */
  await ev(`(() => {
    Rewards.reset();
    GAME.watchMode = true;
    GAME.todayImmune = null; GAME.todayLosingTribe = null;
    window.__hoursBefore = GAME.hoursRemaining;
    window.__rwDone = false;
    window.__rw = Rewards.runScreen().then(r => { window.__rwDone = true; return r; });
    return true;
  })()`);
  await waitFor('#screen-challenge.active.rw-on');
  const before = await ev(`(() => ({
    banner: !!document.getElementById('rw-banner'),
    card: document.querySelectorAll('#chal-result .rw-card').length,
    goLabel: document.getElementById('btn-chal-go').textContent,
    doneHidden: document.getElementById('btn-chal-done').classList.contains('hidden'),
    resultEmpty: document.querySelectorAll('#chal-result .rw-out').length === 0
  }))()`);
  check('the prize is on screen BEFORE the challenge is played',
    before.card === 1 && before.resultEmpty, `card ${before.card}`);
  check('the banner is up before play', before.banner);
  check('the button does not say Compete', before.goLabel !== 'Compete', before.goLabel);
  check('no result is shown yet', before.doneHidden);

  /* Stub the minigame out for the flow test.

     This is about the REWARD, not about the game library. The first version waited
     thirty seconds for whichever minigame the season drew to time itself out, which
     worked for a fourteen-second game and not a forty-five-second one — so the
     result depended on which game got picked, and it started failing the moment the
     pool changed size and the deterministic pick landed elsewhere. Driving it with
     synthetic clicks did not fix that either: some games legitimately do not
     resolve to random input inside a fixed budget.

     tools/minigame-test.js already asserts that all forty games build an arena,
     take input and resolve. Re-testing that here bought nothing and made the reward
     flow's own checks hostage to it. So: a fixed performance, deterministically. */
  await ev(`(() => {
    /* Pin the weather. A storm makes runScreen return immediately — "the weather
       takes the reward challenge with it" — which is correct behaviour and looked
       exactly like a broken flow here: no result, no hours spent, no journal entry,
       and the Continue button never appearing. The weather roll is random, so this
       check failed on roughly one run in five for a reason that had nothing to do
       with rewards. */
    Weather.today = 'Sunny';
    window.__realPlay = Challenge.play;
    Challenge.play = () => Promise.resolve(0.72);
  })()`);
  await ev(`document.getElementById('btn-chal-go').click()`);
  let played = false;
  for (let i = 0; i < 80; i++) {
    if (await ev(`!document.getElementById('btn-chal-done').classList.contains('hidden')`)) { played = true; break; }
    await sleep(150);
  }
  await ev(`Challenge.play = window.__realPlay; true;`);
  check('a reward challenge runs to a result', played);
  const after = await ev(`(() => {
    const res = document.getElementById('chal-result');
    return {
      out: res.querySelectorAll('.rw-out').length,
      cardKept: res.querySelectorAll('.rw-card').length,
      standings: res.querySelectorAll('.chal-standings .cs-row').length,
      field: GAME.merged ? alive().length : aliveTribe('Tidal').length + aliveTribe('Ember').length,
      saysImmunity: /immunity/i.test(res.textContent + document.getElementById('chal-title').textContent),
      immune: GAME.todayImmune === null,
      losing: GAME.todayLosingTribe === null,
      hoursSpent: +(window.__hoursBefore - GAME.hoursRemaining).toFixed(2),
      logged: (Journal.challenges || []).filter(r => r.kind === 'reward').length,
      lastReward: GAME.lastReward ? GAME.lastReward.prize : ''
    };
  })()`);
  console.log(`\nran the reward for "${after.lastReward}": ${after.standings} standings rows,`
    + ` ${after.hoursSpent}h spent`);
  check('the result is written into the reward block', after.out === 1, String(after.out));
  check('the prize card is still there when you learn the outcome', after.cardKept === 1);
  /* Compact, not complete. Listing the whole field pushed the Continue button off
     a 344px screen with nothing scrollable — see docs and chal-result-look.js. */
  check('the standings are compact rather than the whole field',
    after.standings >= 2 && after.standings <= 6,
    `${after.standings} rows for a field of ${after.field}`);
  check('the result never mentions immunity', !after.saysImmunity);
  check('running a whole reward grants no immunity', after.immune && after.losing);
  check('a reward costs hours', after.hoursSpent === CFG.timeCost, String(after.hoursSpent));
  check('the reward is recorded in the journal', after.logged >= 1, String(after.logged));

  await ev(`document.getElementById('btn-chal-done').click()`);
  const closed = await ev(`(async () => {
    const r = await window.__rw;
    return {
      done: window.__rwDone,
      screen: Screens.current(),
      bannerGone: !document.getElementById('rw-banner'),
      classGone: !document.getElementById('screen-challenge').classList.contains('rw-on'),
      goRestored: document.getElementById('btn-chal-go').textContent === 'Compete',
      perfCleared: GAME.playerPerf === null,
      rosterCleared: Challenge.roster === null,
      prize: r ? r.prize : ''
    };
  })()`);
  check('closing the reward returns to camp', closed.screen === 'screen-camp', String(closed.screen));
  check('the banner is removed on the way out', closed.bannerGone);
  check('the reward theme is removed, so immunity looks like immunity again',
    closed.classGone && closed.goRestored);
  check('no challenge state is left behind', closed.perfCleared && closed.rosterCleared);
  check('runScreen resolves with what was won', !!closed.prize, closed.prize);

  /* ---- 11. post-merge: the pick is a gift, the snub is a grudge ---- */
  const social = await ev(`(() => {
    const mergedWas = GAME.merged;
    GAME.merged = true;
    Rewards.reset();
    const pool = alive();
    const winner = GAME.player;
    const others = pool.filter(c => c !== winner);
    /* Make the beach genuinely hungry, or nobody has a reason to mind. */
    for (const c of others) c.hunger = 0.86;
    const chosen = others[0];
    const vwBefore = {}, relBefore = {};
    for (const c of others) { vwBefore[c.name] = c.getVW(winner.name); relBefore[c.name] = c.getRel(winner.name); }
    Rewards.applyPickSocial(winner, [chosen]);
    const stung = Rewards.snub(winner, [chosen], pool);
    let hardest = 0, minded = 0;
    for (const c of others) {
      if (c === chosen) continue;
      const d = c.getVW(winner.name) - vwBefore[c.name];
      if (d > hardest) hardest = d;
      if (d > 0.0001) minded++;
    }
    const out = {
      chosenRel: +(chosen.getRel(winner.name) - relBefore[chosen.name]).toFixed(4),
      chosenVW: +(chosen.getVW(winner.name) - vwBefore[chosen.name]).toFixed(4),
      stung: stung ? stung.displayName : '',
      stungVW: stung ? +(stung.getVW(winner.name) - vwBefore[stung.name]).toFixed(3) : 0,
      hardest: +hardest.toFixed(3), minded, others: others.length - 1,
      /* And none of it may become a bigger force than a deliberate push (1.5). */
      underPush: hardest < 1.5
    };
    GAME.merged = mergedWas;
    Rewards.reset();
    return out;
  })()`);
  console.log(`\nsnub: ${social.stung} minded most (+${social.stungVW} vote weight),`
    + ` ${social.minded} of ${social.others} minded at all`);
  check('the castaway you took gains relationship toward you', social.chosenRel > 0.02,
    String(social.chosenRel));
  check('and it buys them off you at the vote', social.chosenVW < 0, String(social.chosenVW));
  check('somebody left behind minds properly', !!social.stung && social.stungVW > 0.2,
    `${social.stung} +${social.stungVW}`);
  check('the rest of the hungry ones mind a little', social.minded > 1,
    `${social.minded} of ${social.others}`);
  check('the snub is never bigger than a deliberate push', social.underPush, String(social.hardest));

  /* ---- 12. reset clears the season ---- */
  const wiped = await ev(`(() => {
    Rewards.noteMinigame('brace');
    Rewards.grant(REWARD_PRIZES.find(p => p.id === 'tarp'), [GAME.player], { toCamp: true });
    const dirty = { games: Rewards.usedGames.length, active: Rewards.active().length };
    Rewards.reset();
    const state = Rewards.saveState();
    Rewards.loadState({ games: ['brace', 'bucket'], prizes: ['tarp'], last: 9 });
    const loaded = { games: Rewards.usedGames.length, used: Rewards.gameUsed('bucket'), last: Rewards.lastRewardDay };
    Rewards.reset();
    return {
      dirty, cleanGames: Rewards.usedGames.length, cleanActive: Rewards.active().length,
      cleanPrizes: Rewards.usedPrizes.length, savedShape: Array.isArray(state.games), loaded
    };
  })()`);
  check('reset clears used minigames, prizes and active effects',
    wiped.cleanGames === 0 && wiped.cleanActive === 0 && wiped.cleanPrizes === 0,
    `${wiped.cleanGames}/${wiped.cleanActive}/${wiped.cleanPrizes} after ${wiped.dirty.games}/${wiped.dirty.active}`);
  check('saveState / loadState round-trip the season record',
    wiped.savedShape && wiped.loaded.games === 2 && wiped.loaded.used && wiped.loaded.last === 9);

  const ok = !fails.length;
  if (fails.length) console.log('\nfailing checks: ' + fails.join(', '));
  console.log(ok ? '\nREWARD TEST PASS' : '\nREWARD TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
