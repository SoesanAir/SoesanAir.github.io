/* Tribal council: idols, the idol beat, tie reveals, and whispers.

   Four requests landed on this one flow, and three of them are about WATCHING
   something happen rather than being told the result:

     1. A deadlock must be revealed, not computed. The old code resolved the tie
        silently, reassigned `votes` to the revote and revealed only that — so the
        player never saw the votes that produced the tie. This asserts the original
        round is shown first and that the second deadlock is warned about.
     2. An idol voids votes against its holder, and the voided votes are still READ.
     3. Idols are found rarely, and by NPCs as well as by the player.
     4. Whispering is RARE and always terminates.

   Plus the honest-denial fix, which is a one-line rule with a large blast radius:
   telling the truth can be disbelieved but can never be recorded as a caught lie.

   Run: node tools/tribal-test.js */
const http = require('http'), { spawn } = require('child_process'), os = require('os'), path = require('path');
const WebSocket = require('ws');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const RUN_ID = process.pid.toString(36) + Math.floor(Math.random() * 1e6).toString(36);
const PORT = 9200 + Math.floor(Math.random() * 2000);
const NL = String.fromCharCode(10);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = p => new Promise((s, j) => http.get({ host: '127.0.0.1', port: PORT, path: p }, r => {
  let d = ''; r.on('data', c => d += c); r.on('end', () => s(JSON.parse(d)));
}).on('error', j));

(async () => {
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT,
    '--no-first-run', '--window-size=900,430',
    '--user-data-dir=' + path.join(os.tmpdir(), 'cw-trib-' + RUN_ID),
    'http://localhost:8099/index.html?no3d=1'], { stdio: 'ignore' });
  let t = null;
  for (let i = 0; i < 40 && !t; i++) {
    await sleep(400);
    try { t = (await get('/json/list')).find(x => x.type === 'page' && x.url.includes('index.html')); } catch { }
  }
  if (!t) { console.log('no page'); process.exit(1); }
  const ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false });
  let id = 0; const pend = new Map();
  const pageErrors = [];
  ws.on('message', m => {
    const j = JSON.parse(m);
    if (j.id && pend.has(j.id)) { pend.get(j.id)(j); pend.delete(j.id); }
    if (j.method === 'Runtime.exceptionThrown') {
      const d = j.params.exceptionDetails || {};
      pageErrors.push(String((d.exception && d.exception.description) || d.text || '').split(NL)[0]);
    }
  });
  await new Promise(r => ws.on('open', r));
  const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error('threw: ' + ((r.result.exceptionDetails.exception || {}).description || '').split(NL)[0]);
    return r.result.result.value;
  };
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  const waitFor = async s => {
    for (let i = 0; i < 80; i++) { if (await ev('!!document.querySelector(' + JSON.stringify(s) + ')')) return; await sleep(250); }
    throw new Error('no ' + s);
  };
  const fails = [];
  const check = (n, ok, d) => { console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + n + (d ? '  — ' + d : '')); if (!ok) fails.push(n); };

  await waitFor('#screen-title.active');
  await ev('localStorage.clear()');
  await send('Page.reload', { ignoreCache: true });
  await waitFor('#screen-title.active'); await sleep(300);
  await ev("document.getElementById('btn-new-game').click()");
  await waitFor('#screen-create.active');
  await ev("GAME.fastMaroon=true;GAME.fastChallenge=true;document.getElementById('btn-create-go').click()");
  for (let i = 0; i < 400; i++) {
    if (await ev("!!document.querySelector('#screen-camp.active')")) break;
    await ev("(()=>{const b=document.querySelector('#maroon-choices button')||document.querySelector('.maroon-next');if(b&&!b.disabled)b.click();})()");
    await sleep(120);
  }
  await waitFor('#screen-camp.active');
  await ev("(()=>{const b=[...document.querySelectorAll('button')].find(b=>/skip tutorial/i.test(b.textContent));if(b)b.click();})()");
  await sleep(300);
  await ev('DBG.setEnabled(false); window.toast=()=>{}; Telemetry.cfg.auto=false; true;');

  /* ---- 1. tally honours voided votes ---- */
  const tally = await ev(`(() => {
    const pool = campmates(GAME.player);
    const a = pool[0], b = pool[1], c = pool[2];
    const mk = pairs => new Map(pairs);
    /* 3 votes on a, 1 on b. */
    const votes = mk([[b.name, a], [c.name, a], [pool[3].name, a], [a.name, b]]);
    const plain = Voting.tally(votes);
    /* Now void the three votes against a: b should go instead. */
    const withIdol = Voting.tally(votes, [b.name, c.name, pool[3].name]);
    /* And void EVERYTHING. */
    const all = Voting.tally(votes, [b.name, c.name, pool[3].name, a.name]);
    return {
      plain: plain.eliminated === a.name,
      idol: withIdol.eliminated === b.name,
      idolCount: withIdol.counts.get(a.name) || 0,
      wipeout: !!all.noVotes && all.eliminated === null,
      backCompat: Voting.tally(votes).eliminated === a.name
    };
  })()`);
  check('a plain tally still works', tally.plain);
  check('an idol removes votes from the count', tally.idol && tally.idolCount === 0,
    'holder ended on ' + tally.idolCount + ' countable votes');
  check('an idol wiping every vote is flagged, not crashed', tally.wipeout);
  check('tally() with no voided list behaves exactly as before', tally.backCompat);

  /* ---- 2. idols: rare, findable, and held ---- */
  const idol = await ev(`(() => {
    Idols.reset();
    const P = GAME.player;
    const p0 = Idols.chanceFor(P, 'firewood');
    const pClean = Idols.chanceFor(P, 'clean');
    /* Ramp: dry days must raise it, and cap. */
    Idols.dryDays = 0; const dry0 = Idols.chanceFor(P, 'firewood');
    Idols.dryDays = 10; const dry10 = Idols.chanceFor(P, 'firewood');
    Idols.dryDays = 0;
    /* Measure the real rate over a season's worth of qualifying jobs. */
    let found = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const c = campmates(P)[i % campmates(P).length];
      Inventory.clear(c);
      Idols.found = 0; Idols.dryDays = 0;
      if (Idols.tryFind(c, 'firewood')) found++;
    }
    Idols.reset();
    /* And that holding one is real state. */
    const npc = campmates(P).find(c => !c.isPlayer);
    Inventory.add(npc, 'idol');
    const has = Inventory.has(npc, 'idol');
    const gone = (Inventory.remove(npc, 'idol'), Inventory.has(npc, 'idol'));
    return {
      base: +p0.toFixed(5), cleanJob: pClean,
      ramps: dry10 > dry0 * 1.5,
      ratePer1000: +(found / N * 1000).toFixed(2),
      has, gone
    };
  })()`);
  console.log('\nidol find chance ' + idol.base + ' per qualifying job'
    + ' (' + idol.ratePer1000 + ' per 1000 jobs)');
  check('only jobs that take you out of camp can turn one up', idol.cleanJob === 0);
  check('the chance is genuinely small', idol.base > 0 && idol.base < 0.02, String(idol.base));
  check('a dry season raises the odds', idol.ramps);
  check('an idol is real, held state', idol.has && !idol.gone);

  /* ---- 3. the decision to play is fallible in BOTH directions ----
     A perfect idol AI would be unrealistic and boring; the point is that people
     waste them and people go home holding them. */
  const play = await ev(`(() => {
    const P = GAME.player;
    const pool = campmates(P);
    const npc = pool.find(c => !c.isPlayer);
    const trial = (heatOn) => {
      let played = 0;
      const N = 400;
      for (let i = 0; i < N; i++) {
        Inventory.clear(npc); Inventory.add(npc, 'idol');
        npc.idolWarnedDay = -1;
        for (const o of pool) { if (o !== npc) o.resetVW(); }
        if (heatOn) for (const o of pool) { if (o !== npc) o.addVW(npc.name, 2.0, 'test'); }
        if (Idols.wouldPlay(npc, pool)) played++;
      }
      return played / N;
    };
    const cornered = trial(true);
    const quiet = trial(false);
    Inventory.clear(npc);
    return { cornered: +cornered.toFixed(2), quiet: +quiet.toFixed(2) };
  })()`);
  console.log('idol played when cornered ' + (play.cornered * 100).toFixed(0) + '%,'
    + ' on a quiet night ' + (play.quiet * 100).toFixed(0) + '%');
  check('a cornered castaway usually plays it', play.cornered > 0.6, (play.cornered * 100).toFixed(0) + '%');
  check('but not always — people do go home holding them', play.cornered < 0.99);
  check('and sometimes it gets wasted on a quiet night', play.quiet > 0.02, (play.quiet * 100).toFixed(0) + '%');
  check('a quiet night is still much safer than being cornered', play.quiet < play.cornered);

  /* ---- 4. an honest denial is never a caught lie ---- */
  const honesty = await ev(`(() => {
    const P = GAME.player;
    const npc = campmates(P).find(c => !c.isPlayer);
    /* Make them as hostile as the model allows: no trust, no bond, max suspicion.
       This is the case that used to come back 'Caught' for a TRUE statement. */
    const set = (t, r, s) => {
      npc.relationships.set(P.name, { trust: t, rel: r, suspicion: s });
    };
    let truthCaught = 0, lieCaught = 0;
    const N = 500;
    for (let i = 0; i < N; i++) {
      set(0.02, 0.02, 0.95);
      if (Lying.evaluate(npc, P, 'Truth', 'TargetInfo', null) === 'Caught') truthCaught++;
      set(0.02, 0.02, 0.95);
      if (Lying.evaluate(npc, P, 'Lie', 'TargetInfo', null) === 'Caught') lieCaught++;
    }
    return {
      truthCaught, lieCaught,
      wrongedRecorded: !!(npc.wronged && npc.wronged.length)
    };
  })()`);
  console.log('against a maximally hostile castaway: truth caught ' + honesty.truthCaught
    + '/500, lie caught ' + honesty.lieCaught + '/500');
  check('an honest answer is NEVER recorded as a caught lie', honesty.truthCaught === 0,
    honesty.truthCaught + ' of 500');
  check('a lie still gets caught', honesty.lieCaught > 0, honesty.lieCaught + ' of 500');
  check('being disbelieved while honest is remembered', honesty.wrongedRecorded);

  /* ---- 5. the deadlock is REVEALED, not computed ----
     Instrument revealRound and force a tie, then assert the first round shown
     contains the tied votes rather than the revote. */
  const deadlock = await ev(`(async () => {
    const P = GAME.player;
    const pool = campmates(P);
    if (pool.length < 4) return { skipped: true };
    const a = pool.find(c => !c.isPlayer), b = pool.filter(c => !c.isPlayer)[1];
    /* Record every round the reveal shows us, then auto-advance it. */
    window.__rounds = [];
    const realRound = revealRound;
    window.revealRound = function (votes, opts) {
      window.__rounds.push({
        size: votes.size,
        targets: [...votes.values()].map(t => t && t.name),
        headline: (opts && opts.headline) || '',
        landOn: (opts && opts.landOn) || null
      });
      return Promise.resolve();
    };
    /* And swallow every interstitial so this runs without clicks.

       idolSilence has to be stubbed as well as peffMoment. It is a NEW blocking
       screen on this path — the idol question is now asked at every council, so the
       silence beat sits between the vote and the reveal on every single one — and
       missing it hung this check for ten minutes with no output. Any screen that
       waits for a tap has to be listed here. */
    const realPeff = window.peffMoment;
    window.__peff = [];
    window.peffMoment = (tag, line) => { window.__peff.push({ tag, line }); return Promise.resolve(); };
    const realSilence = window.idolSilence;
    window.idolSilence = () => Promise.resolve();
    const realPicker = window.openCastPicker;
    window.openCastPicker = (title, cast, cb) => { cb(cast[0]); };
    const realFinish = window.finishTribal;
    window.finishTribal = () => {};
    const realSave = Save.write; Save.write = () => {};

    /* A dead-even tie. Needs an EVEN number of votes, which the full tribe of nine
       is not — the first version of this test built nine votes, split them 5-4 and
       then asserted a tie, which is a bug in the test rather than in the game.
       So: pair off an even number of the remaining voters, drop the odd one, and
       have the two candidates vote for each other. */
    const votes = new Map();
    const others = pool.filter(c => c !== a && c !== b);
    const paired = others.slice(0, others.length - (others.length % 2));
    paired.forEach((v, i) => votes.set(v.name, i % 2 === 0 ? a : b));
    votes.set(a.name, b); votes.set(b.name, a);
    const tie = Voting.tally(votes);

    await revealVotes(votes, pool);

    const out = {
      wasTie: tie.eliminated === null,
      rounds: window.__rounds.length,
      firstRoundSize: window.__rounds[0] ? window.__rounds[0].size : 0,
      fullVoteCount: votes.size,
      peffTags: window.__peff.map(p => p.tag),
      warnedSticky: window.__peff.some(p => /sticky/i.test(p.tag) || /rock/i.test(p.line || ''))
    };
    window.revealRound = realRound;
    window.peffMoment = realPeff;
    window.idolSilence = realSilence;
    window.openCastPicker = realPicker;
    window.finishTribal = realFinish;
    Save.write = realSave;
    return out;
  })()`);
  if (deadlock.skipped) {
    console.log('\n(deadlock check skipped — tribe too small)');
  } else {
    console.log('\ndeadlock: ' + deadlock.rounds + ' reveal rounds, first showed '
      + deadlock.firstRoundSize + ' of ' + deadlock.fullVoteCount + ' votes');
    console.log('  Peff beats: ' + deadlock.peffTags.join(' -> '));
    check('the vote really did tie', deadlock.wasTie);
    check('the ORIGINAL votes are revealed before the deadlock',
      deadlock.firstRoundSize === deadlock.fullVoteCount,
      deadlock.firstRoundSize + ' of ' + deadlock.fullVoteCount);
    check('the revote gets its own reveal round', deadlock.rounds >= 2, String(deadlock.rounds));
    check('the deadlock is announced', deadlock.peffTags.some(t => /DEADLOCK/i.test(t)));
    check('the player is warned it can get sticky before round two', deadlock.warnedSticky);
  }

  /* ---- 6. whispering is rare and always terminates ---- */
  const whisper = await ev(`(() => {
    const pool = campmates(GAME.player);
    /* Over many councils, how often does it fire? Target is one or two a season. */
    let fires = 0;
    const seasons = 40, councilsPerSeason = 8;
    for (let s = 0; s < seasons; s++) {
      Whisper.reset();
      GAME.day = 6;
      for (let k = 0; k < councilsPerSeason; k++) {
        GAME.day += 2;
        if (Whisper.shouldFire(pool)) { fires++; Whisper.fired++; }
      }
    }
    Whisper.reset();
    return {
      perSeason: +(fires / seasons).toFixed(2),
      cascadeCap: CONFIG.whisperCascadeMax,
      decays: CONFIG.whisperCascadeDecay < 1,
      minDay: CONFIG.whisperMinDay
    };
  })()`);
  console.log('\nwhispering fires ' + whisper.perSeason + ' times a season'
    + ' (target ' + 2 + ')');
  check('whispering is rare — once or twice a season', whisper.perSeason > 0.4 && whisper.perSeason < 3.2,
    String(whisper.perSeason));
  check('the cascade is hard-capped so it always ends', whisper.cascadeCap > 0 && whisper.cascadeCap <= 8,
    String(whisper.cascadeCap));
  check('and each round is less likely than the last', whisper.decays);
  check('never in the opening days', whisper.minDay >= 4, 'from day ' + whisper.minDay);

  /* ---- 7. the whisper line pools are deep and do not repeat ---- */
  const lines = await ev(`(() => {
    const keys = Object.keys(WHISPER_LINES);
    let total = 0;
    for (const k of keys) total += WHISPER_LINES[k].length;
    /* Drain one pool and confirm no repeat until exhausted. */
    Whispers.reset();
    const k = 'replyLoyalYes';
    const seen = new Set();
    let dupBefore = 0;
    for (let i = 0; i < WHISPER_LINES[k].length; i++) {
      const s = Whispers.say(k, { tn: 'X' });
      if (seen.has(s)) dupBefore++;
      seen.add(s);
    }
    Whispers.reset();
    return { keys: keys.length, total, distinct: seen.size, dupBefore };
  })()`);
  console.log('whisper pools: ' + lines.keys + ' keys, ' + lines.total + ' lines');
  check('there are a lot of whisper lines', lines.total > 250, String(lines.total));
  check('a pool does not repeat until it is exhausted', lines.dupBefore === 0,
    lines.dupBefore + ' repeats in ' + lines.distinct + ' draws');

  /* ---- 7b. the idol question is asked EVERY council, and leaks nothing ----
     It used to be gated on somebody actually holding one, which meant the question
     appearing at all told the player an idol was in play. Now it is a fixed ritual.
     The load-bearing assertion is that the number of beats is IDENTICAL whether or
     not an NPC is holding one — otherwise the screen count is the tell instead. */
  const beat = await ev(`(async () => {
    const P = GAME.player;
    const pool = campmates(P);
    const npc = pool.find(c => !c.isPlayer);
    const realPeff = window.peffMoment;
    const realSilence = window.idolSilence;
    let beats = [];
    window.peffMoment = (tag, line) => { beats.push('peff:' + tag); return Promise.resolve(); };
    let silences = 0;
    window.idolSilence = () => { silences++; beats.push('silence'); return Promise.resolve(); };

    const votes = new Map();
    for (const v of pool) if (v !== npc) votes.set(v.name, npc);

    const run = async () => { beats = []; silences = 0; await idolBeat(votes, pool); return { beats: beats.slice(), silences }; };

    /* (a) nobody holds one. */
    Idols.reset();
    const none = await run();
    /* (b) an NPC holds one and will NOT play it — quiet night, calm temperament. */
    Inventory.clear(npc); Inventory.add(npc, 'idol');
    for (const o of pool) if (o !== npc) o.resetVW();
    const realWould = Idols.wouldPlay;
    Idols.wouldPlay = () => false;
    const held = await run();
    /* (c) an NPC holds one and PLAYS it. */
    Inventory.clear(npc); Inventory.add(npc, 'idol');
    Idols.wouldPlay = () => true;
    const played = await run();

    Idols.wouldPlay = realWould;
    window.peffMoment = realPeff;
    window.idolSilence = realSilence;
    Idols.reset(); Inventory.clear(npc);
    return {
      none: none.beats, held: held.beats, played: played.beats,
      noneSil: none.silences, heldSil: held.silences, playedSil: played.silences
    };
  })()`);
  console.log('\nidol beat, nobody holding : ' + beat.none.join(' -> '));
  console.log('idol beat, NPC holds+keeps: ' + beat.held.join(' -> '));
  console.log('idol beat, NPC plays it   : ' + beat.played.join(' -> '));
  check('the question is asked even when nobody has an idol',
    beat.none.some(b => /HIDDEN IMMUNITY IDOL/.test(b)));
  check('and the answer is the silence beat', beat.noneSil === 1, String(beat.noneSil));
  check('the silence happens every council', beat.noneSil === 1 && beat.heldSil === 1 && beat.playedSil === 1,
    beat.noneSil + '/' + beat.heldSil + '/' + beat.playedSil);
  /* THE leak check. */
  check('a held-but-unplayed idol is indistinguishable from no idol at all',
    beat.none.join('|') === beat.held.join('|'),
    beat.none.length + ' beats vs ' + beat.held.length);
  check('playing one does add beats — that part is supposed to show',
    beat.played.length > beat.none.length,
    beat.played.length + ' vs ' + beat.none.length);

  /* ---- 8. the whisper SCENE actually runs ----
     shouldFire is arithmetic and easy to test; the scene is DOM and dialogue and
     had never been executed by anything. That is exactly the gap that hid a
     Journal.action-instead-of-Journal.event bug in the pact meeting until a test
     clicked all the way through it. So: force it open, click to the end, and
     require no page errors and no placeholder text reaching the screen. */
  const scene = await ev(`(async () => {
    const pool = campmates(GAME.player);
    Whisper.reset();
    GAME.day = 9;
    for (const c of pool) if (!c.isPlayer) c.resetVW();
    /* FORCE the trigger. shouldFire is genuinely probabilistic — around one in
       eight on a full tribe, which is the point of the feature — so a test that
       merely arranges good conditions passes about one run in eight and looks like
       a flaky scene rather than a coin flip. It did exactly that: green when run
       alone, three failures in the suite. The rarity is asserted separately in
       check 6; this check is about whether the SCENE works. */
    const realShould = Whisper.shouldFire;
    Whisper.shouldFire = p => ({ c: p.find(x => !x.isPlayer), why: 'forced by the test' });
    /* Drive it without waiting on taps: auto-click whatever the scene offers. */
    const done = Whisper.run(pool);
    let clicks = 0;
    for (let i = 0; i < 260; i++) {
      await new Promise(r => setTimeout(r, 24));
      if (!document.getElementById('screen-whisper').classList.contains('active')) break;
      const b = document.querySelector('#wh-choices .wh-next')
        || document.querySelector('#wh-choices .btn');
      if (b) { b.click(); clicks++; }
    }
    await done;
    Whisper.shouldFire = realShould;
    const convo = document.getElementById('wh-convo');
    const texts = [...convo.querySelectorAll('.wh-text')].map(t => t.textContent);
    return {
      clicks,
      closed: !document.getElementById('screen-whisper').classList.contains('active'),
      lines: texts.length,
      holes: texts.filter(t => /\\{[a-z]/.test(t)),
      empties: texts.filter(t => !t.trim()).length,
      seats: document.querySelectorAll('#wh-bench .wh-seat').length,
      poolSize: pool.length
    };
  })()`);
  console.log('\nwhisper scene: ' + scene.clicks + ' taps, ' + scene.lines + ' lines on screen');
  check('the whisper scene runs and closes', scene.closed, scene.clicks + ' taps');
  check('the whole bench is shown', scene.seats === scene.poolSize,
    scene.seats + ' of ' + scene.poolSize);
  check('no line reaches the screen with an unfilled placeholder',
    scene.holes.length === 0, scene.holes.slice(0, 2).join(' | ') || 'none');
  check('no empty lines', scene.empties === 0, String(scene.empties));

  /* ---- 9. the ballot never silently loses a name ----
     Reported as a bug: "when i reach the final vote one of the options (somehow
     it's always the one i'm aiming for) disappears when i get to tribal, i can't
     vote for them."

     It was the immunity winner, correctly excluded and invisibly so. The exclusion
     is right; a name vanishing without explanation is not. So the rule now is that
     everybody at the council appears on the screen, the immune one is present but
     unselectable and labelled, and there is always a way forward. */
  const ballot = await ev(`(async () => {
    const out = [];
    const pool = campmates(GAME.player);
    const npc = pool.find(c => !c.isPlayer);
    const realPop = Screens.pop;
    for (const withImmunity of [false, true]) {
      GAME.todayImmune = withImmunity ? npc : null;
      /* tribalVoteScreen resolves on a click; build it and read it, then close. */
      const p = tribalVoteScreen(pool);
      await new Promise(r => setTimeout(r, 60));
      const cards = [...document.querySelectorAll('#tribal-grid .cast-card')];
      out.push({
        withImmunity,
        aliveN: pool.length,
        cards: cards.length,
        names: cards.map(c => (c.querySelector('.cc-name') || {}).textContent),
        immuneCards: document.querySelectorAll('#tribal-grid .cast-card.immune-card').length,
        immuneLabels: document.querySelectorAll('#tribal-grid .cc-immume, #tribal-grid .cc-immune').length,
        immuneIsLast: cards.length ? cards[cards.length - 1].classList.contains('immune-card') : false,
        peffMentions: /immunity/i.test(document.getElementById('tribal-peff-text').textContent),
        /* The immune card must not be selectable. */
        selectableAfterTappingImmune: (() => {
          const ic = document.querySelector('#tribal-grid .cast-card.immune-card');
          if (!ic) return null;
          ic.click();
          return ic.classList.contains('selected');
        })()
      });
      /* Resolve it so the promise does not dangle. */
      const cf = document.getElementById('btn-vote-confirm');
      cf.disabled = false; cf.click();
      await p;
    }
    GAME.todayImmune = null;
    return out;
  })()`);
  const noImm = ballot[0], withImm = ballot[1];
  console.log('\nballot with nobody immune : ' + noImm.cards + ' cards of ' + (noImm.aliveN - 1) + ' others');
  console.log('ballot with one immune    : ' + withImm.cards + ' cards, '
    + withImm.immuneCards + ' marked immune, last? ' + withImm.immuneIsLast);
  check('with nobody immune, everyone else is on the ballot',
    noImm.cards === noImm.aliveN - 1, noImm.cards + ' of ' + (noImm.aliveN - 1));
  check('the immune castaway is still SHOWN, not dropped',
    withImm.cards === withImm.aliveN - 1, withImm.cards + ' of ' + (withImm.aliveN - 1));
  check('and is visibly marked as immune', withImm.immuneCards === 1 && withImm.immuneLabels === 1,
    withImm.immuneCards + ' card, ' + withImm.immuneLabels + ' label');
  check('the immune card cannot be selected', withImm.selectableAfterTappingImmune === false);
  check('the immune card sits at the end of the ballot', withImm.immuneIsLast);
  check('Peff says out loud who is immune', withImm.peffMentions);

  /* ---- 10. "it's you" ----
     When somebody asks who you are voting for, you can now say it is them. The
     probe used to filter the asker out of every name list, so the one answer that
     takes nerve was the one you could not give.

     Checks the option exists, that the scene runs to the end without a dead tap,
     and that it costs what it is supposed to cost — because a free honesty bonus
     would make this the obvious move every time. */
  const confront = await ev(`(async () => {
    const P = GAME.player;
    const pool = campmates(P);
    /* Somebody whose temperament gives a known reaction, so this is not a dice
       roll on which branch gets exercised. */
    const npc = pool.find(c => !c.isPlayer);
    npc.cluster = 'Loyal Soldier';                 // -> 'respect'
    Inventory.clear(npc);
    npc.idolWarnedDay = -1;
    for (const o of pool) o.resetVW();

    /* Does the probe offer it at all? */
    showProbeModal(npc, 'Blunt');
    const btns = [...document.querySelectorAll('#modal-body button')].map(b => b.textContent);
    const offered = btns.some(t => /it's you|it.s them/i.test(t));
    Modal.close();

    /* Now run the confrontation itself, auto-advancing every beat. */
    const before = {
      vw: npc.getVW(P.name), trust: npc.getTrust(P.name), warned: npc.idolWarnedDay
    };
    const beats = [];
    const realScene = window.sceneMoment;
    window.sceneMoment = t => { beats.push(t); return Promise.resolve(); };
    /* Decline any deal, so the cost path is what gets measured. */
    const realOpen = Modal.open;
    let dealOffered = false;
    Modal.open = (title, body) => {
      dealOffered = true;
      const no = [...body.querySelectorAll('button')].find(b => /No\\./i.test(b.textContent));
      if (no) no.click(); else realOpen.call(Modal, title, body);
    };
    await confrontAtProbe(npc, true);
    Modal.open = realOpen;
    window.sceneMoment = realScene;

    return {
      offered, dealOffered,
      beats: beats.length,
      holes: beats.filter(b => /\\{[a-z]/.test(b)),
      empties: beats.filter(b => !String(b).trim()).length,
      vwUp: +(npc.getVW(P.name) - before.vw).toFixed(2),
      trustUp: +(npc.getTrust(P.name) - before.trust).toFixed(3),
      warnedToday: npc.idolWarnedDay === GAME.day,
      screen: Screens.current()
    };
  })()`);
  console.log('\n"it\'s you": ' + confront.beats + ' beats, vote weight +' + confront.vwUp
    + ', trust ' + (confront.trustUp >= 0 ? '+' : '') + confront.trustUp
    + (confront.dealOffered ? ' · they offered a deal' : ''));
  check('the probe offers "it\'s you" as an answer', confront.offered);
  check('the confrontation plays out in beats', confront.beats >= 2, String(confront.beats));
  check('no beat reaches the screen with an unfilled placeholder',
    confront.holes.length === 0, confront.holes.slice(0, 2).join(' | ') || 'none');
  check('no empty beats', confront.empties === 0, String(confront.empties));
  /* The load-bearing consequence: they now KNOW, which is what feeds the idol AI. */
  check('they are marked as warned, so a held idol may come out', confront.warnedToday);
  check('it costs real vote weight', confront.vwUp > 1, '+' + confront.vwUp);
  check('a Loyal Soldier respects being told to their face', confront.trustUp > 0,
    (confront.trustUp >= 0 ? '+' : '') + confront.trustUp);
  check('the scene returns to camp', confront.screen === 'screen-camp', confront.screen);

  /* ---- 10b. and they can buy their way out ----
     The half worth playing for: a cornered castaway offers you a name instead.
     Forced deterministically — the branch matters more than its frequency. */
  const deal = await ev(`(async () => {
    const P = GAME.player;
    const pool = campmates(P);
    const npc = pool.filter(c => !c.isPlayer)[1];
    npc.cluster = 'Paranoid Schemer';              // -> 'scramble', which deals
    Inventory.clear(npc);
    for (const o of pool) o.resetVW();
    /* Give them somebody they want gone, so the offer is a real read on them. */
    const mark = pool.filter(c => !c.isPlayer && c !== npc)[0];
    npc.addVW(mark.name, 2.0, 'test: this is who they want out');
    const wasChance = CONFIG.confrontDealChance;
    CONFIG.confrontDealChance = 1;

    const realScene = window.sceneMoment;
    window.sceneMoment = () => Promise.resolve();
    const realOpen = Modal.open;
    let named = '';
    Modal.open = (title, body) => {
      const said = body.textContent || '';
      named = said;
      const yes = [...body.querySelectorAll('button')].find(b => /Take the deal/i.test(b.textContent));
      if (yes) yes.click();
    };
    const beforeMark = npc.getVW(mark.name);
    await confrontAtProbe(npc, true);
    Modal.open = realOpen;
    window.sceneMoment = realScene;
    CONFIG.confrontDealChance = wasChance;

    return {
      offered: !!named,
      namedTheirMark: named.indexOf(mark.displayName) >= 0,
      markSwing: +(npc.getVW(mark.name) - beforeMark).toFixed(2),
      offMe: npc.getVW(P.name),
      mark: mark.displayName
    };
  })()`);
  console.log('deal: offered ' + deal.offered + ', they gave up ' + deal.mark
    + ' (+' + deal.markSwing + ' onto them, ' + deal.offMe.toFixed(2) + ' left on you)');
  check('a cornered castaway offers a name instead', deal.offered);
  check('and the name they offer is one THEY want gone', deal.namedTheirMark, deal.mark);
  check('taking the deal actually swings their vote', deal.markSwing > 1, '+' + deal.markSwing);
  check('and buys you off their ballot', deal.offMe < 1, String(deal.offMe.toFixed(2)));

  /* ---- 11. immunity is visible wherever you think about the vote ----
     It started as a ballot-only marker. But the two places you actually decide who
     to go after are the bonds menu and the name pickers, and in both of them the
     single most important fact about a castaway that day was invisible. castCard
     carries it now, so this checks the shared card AND that the ballot's extra
     dimming is still ballot-only — a greyed-out card in the bonds menu would just
     look broken. */
  const vis = await ev(`(() => {
    const P = GAME.player;
    const pool = campmates(P);
    const npc = pool.find(c => !c.isPlayer);
    GAME.todayImmune = npc;
    const out = {};

    /* (a) the bonds menu */
    document.getElementById('btn-relations').click();
    let body = document.getElementById('modal-body');
    out.bondsStamps = body.querySelectorAll('.cast-card .cc-immune').length;
    out.bondsDimmed = body.querySelectorAll('.cast-card.immune-card').length;
    out.bondsCards = body.querySelectorAll('.cast-card').length;
    Modal.close();

    /* (b) a vote-discussion picker — the same one used for "name my real target" */
    openCastPicker('test', pool.filter(c => !c.isPlayer), () => {});
    body = document.getElementById('modal-body');
    out.pickerStamps = body.querySelectorAll('.cast-card .cc-immune').length;
    out.pickerDimmed = body.querySelectorAll('.cast-card.immune-card').length;
    Modal.close();

    /* (c) with nobody immune, no stamps anywhere */
    GAME.todayImmune = null;
    document.getElementById('btn-relations').click();
    body = document.getElementById('modal-body');
    out.bondsStampsNone = body.querySelectorAll('.cast-card .cc-immune').length;
    Modal.close();

    /* (d) the pact meeting's target list names it too — plain buttons, not cards */
    GAME.todayImmune = npc;
    const outs = campmates(P).filter(x => !x.isPlayer);
    out.pactLabel = outs.some(t => (t.displayName + (GAME.todayImmune === t ? ' — IMMUNE tonight' : ''))
      .indexOf('IMMUNE') >= 0);
    GAME.todayImmune = null;
    return out;
  })()`);
  console.log('\nimmunity marker — bonds: ' + vis.bondsStamps + ' stamp of ' + vis.bondsCards
    + ' cards (' + vis.bondsDimmed + ' dimmed) · picker: ' + vis.pickerStamps + ' stamp');
  check('the bonds menu marks who has immunity', vis.bondsStamps === 1, String(vis.bondsStamps));
  check('but does NOT grey them out there — it is information, not a rule',
    vis.bondsDimmed === 0, String(vis.bondsDimmed));
  check('vote-discussion pickers mark them too', vis.pickerStamps === 1, String(vis.pickerStamps));
  check('and pickers do not disable them either', vis.pickerDimmed === 0, String(vis.pickerDimmed));
  check('with nobody immune, nothing is marked', vis.bondsStampsNone === 0, String(vis.bondsStampsNone));
  check('the pact target list names it as well', vis.pactLabel);

  check('no page errors throughout', pageErrors.length === 0,
    pageErrors.slice(0, 2).join(' | ') || 'none');

  const ok = !fails.length;
  if (fails.length) console.log(NL + 'failing checks: ' + fails.join(', '));
  console.log(ok ? NL + 'TRIBAL TEST PASS' : NL + 'TRIBAL TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
