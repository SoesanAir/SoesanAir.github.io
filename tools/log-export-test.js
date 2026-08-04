/* Does a season's log actually get off the device?

   Plays several real days, then checks: the trace filled in, the report contains
   what an analysis needs, the flags fire on genuinely broken states, the census
   catches a repeated line, and the report really does reach ntfy.sh and come back
   out again over the network. That last one is the whole point — everything else
   was already true of the old clipboard-only version.

   Run: node tools/log-export-test.js */
const http = require('http'), https = require('https'), { spawn } = require('child_process'), os = require('os');
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
const fetchText = url => new Promise((res, rej) => {
  https.get(url, { headers: { 'User-Agent': 'castaway-test' } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
  }).on('error', rej);
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT,
    '--no-first-run', '--window-size=900,430',
    '--user-data-dir=' + os.tmpdir() + '\\cw-logexp-' + RUN_ID, 'http://localhost:8099/index.html?no3d=1'], { stdio: 'ignore' });
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
    /* Say what WAS on screen and what the page complained about — a bare
       "no #screen-x" sends you hunting for a page bug that is not there. */
    const seen = await ev(`[...document.querySelectorAll('.screen')].map(x => x.id + (x.classList.contains('active') ? '*' : '')).join(' ')`);
    const url = await ev(`location.href`);
    throw new Error(`no ${s}
   screens: ${seen}
   url: ${url}
   page errors: ${JSON.stringify(errors.slice(0, 3))}`);
  };
  const fails = [];
  const check = (name, ok, detail) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`);
    if (!ok) fails.push(name);
  };

  await waitFor('#screen-title.active');
  await ev(`localStorage.clear()`);
  await send('Page.reload', { ignoreCache: true });
  await waitFor('#screen-title.active'); await sleep(300);
  await ev(`document.getElementById('btn-new-game').click()`);
  await waitFor('#screen-create.active');
  /* A distinctive topic so this test never reads another run's messages. */
  const topic = 'castaway-selftest-' + Date.now().toString(36);
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

  /* ---- 1. logging is on and cannot be silently off ---- */
  console.log('\n--- logging ---');
  const on = await ev(`(() => ({
    entries: DBG.count(),
    auto: Telemetry.cfg.auto,
    ntfy: Telemetry.cfg.ntfy,
    tokenStored: !!Telemetry.cfg.token,
    tokenInSource: false
  }))()`);
  console.log('  ' + JSON.stringify(on));
  check('the design log is recording from the first day', on.entries > 20, `${on.entries} entries`);
  check('auto-upload is on by default', on.auto === true, 'on');
  check('the zero-setup channel is on by default', on.ntfy === true, 'ntfy on');
  check('no token is baked into the build', on.tokenStored === false, 'device-only by design');

  /* ---- 2a. ONE real day through the real UI ----
     Driving many days through the live screens turned out to re-enter endDay()
     while a tribal was still in flight, which produced five councils on day two.
     So: one honest day through the UI, which is all that is needed to prove the
     Trace and Telemetry hooks are actually wired into the day loop, and then
     synthesise the rest below to give the report something to describe. */
  console.log('\n--- one real day through the UI ---');
  await ev(`(() => {
    const j = CAMP_JOBS.find(x => x.id === 'clean');
    doCampJob(j);
    return true;
  })()`);
  await sleep(500);
  await ev(`(() => {
    window.__pings = [];
    const real = Telemetry.push.bind(Telemetry);
    Telemetry.push = async (kind) => { window.__pings.push(kind); return real(kind); };
    const npc = alive().find(c => !c.isPlayer && c.tribeName === GAME.player.tribeName);
    if (npc) { openTalkMenu(npc); doSmallTalk(npc); closeDialogue(); }
    return true;
  })()`);
  await sleep(300);
  const dayBefore = await ev(`GAME.day`);
  await ev(`endDay(); true`);
  /* Wait for the day to genuinely land back on camp, patiently. */
  for (let i = 0; i < 80; i++) {
    const st = await ev(`(() => ({
      screen: [...document.querySelectorAll('.screen.active')].map(s => s.id).join(),
      modal: document.getElementById('modal-veil').classList.contains('open'),
      day: GAME.day
    }))()`);
    if (st.screen === 'screen-camp' && !st.modal && st.day > dayBefore) break;
    await ev(`(() => {
      const conf = document.getElementById('btn-vote-confirm');
      if (document.querySelector('#screen-tribal.active')) {
        if (conf && conf.disabled) { const c = document.querySelector('#tribal-grid .cast-card'); if (c) c.click(); }
        else if (conf) conf.click();
        return;
      }
      const b = document.querySelector('#modal-body button')
        || document.querySelector('#btn-chal-go:not(.hidden)')
        || document.querySelector('#btn-chal-done:not(.hidden)')
        || document.querySelector('#btn-reveal-next')
        || document.querySelector('#btn-finale-next');
      if (b) b.click();
      else if (document.getElementById('modal-veil').classList.contains('open')) Modal.close();
    })()`);
    await sleep(250);
  }
  const realDay = await ev(`(() => ({
    day: GAME.day,
    pings: window.__pings || [],
    traced: Trace.days.filter(d => d.needs && Object.keys(d.needs).length).length,
    lastRow: Trace.days.filter(d => d.needs && Object.keys(d.needs).length).slice(-1)[0] || null
  }))()`);
  console.log(`  day ${dayBefore} -> ${realDay.day} · telemetry fired: ${JSON.stringify(realDay.pings)}`);
  console.log('  trace row: ' + JSON.stringify(realDay.lastRow));
  check('ending a day fires the upload automatically', realDay.pings.length > 0,
    JSON.stringify(realDay.pings));
  check('and it records a trace row for the day', realDay.traced >= 1,
    `${realDay.traced} row(s)`);
  check('the row captured the camp, the player and the pressure',
    !!realDay.lastRow && realDay.lastRow.morale !== null && realDay.lastRow.heat !== null
    && Object.keys(realDay.lastRow.needs).length === 5,
    'needs + morale + heat present');
  check('the player job it did is on the row',
    !!realDay.lastRow && (realDay.lastRow.playerJobs || []).length > 0,
    JSON.stringify(realDay.lastRow && realDay.lastRow.playerJobs));

  /* ---- 2b. synthesise a fortnight so the report has a season in it ---- */
  console.log('\n--- then ten more days, simulated ---');
  await ev(`(() => {
    Telemetry.cfg.auto = false;                 // do not spam ntfy from a loop
    for (let i = 0; i < 10; i++) {
      GAME.day++;
      Weather.roll();
      const work = TribeWork.dailyTick(alive());
      Trace.mark('jobs', work.length);
      if (i % 3 === 0) {
        const j = CAMP_JOBS.find(x => x.id === 'water');
        Camp.doJob(j);
        Trace.mark('playerJobs', [j.id]);
      }
      Morale.tick(alive());
      dailySurvivalTick(alive());
      CampNeeds.decay(campPool());
      Ledger.roll(alive());
      Ledger.socialDrift(alive());
      const n = Nights.roll(campPool());
      if (n) Trace.mark('night', { tag: n.tag, bad: n.bad, id: n.id });
      applySleepRecovery(alive(), false);
      Trace.close();
    }
    Telemetry.cfg.auto = true;
    return GAME.day;
  })()`);

  /* ---- 3. the trace and the report ---- */
  console.log('\n--- the report ---');
  const rep = await ev(`(() => {
    const brief = Report.brief(), full = Report.full();
    return {
      traceDays: Trace.days.filter(d => d.needs && Object.keys(d.needs).length).length,
      briefLen: brief.length, fullLen: full.length,
      hasOutcome: /OUTCOME/.test(brief), hasCamp: /^CAMP /m.test(brief),
      hasEffort: /^EFFORT/m.test(brief), hasVoice: /^VOICE/m.test(brief),
      hasFlags: /^FLAGS/m.test(brief),
      hasTimeline: /DAY BY DAY/.test(full), hasCast: /=+ CAST =+/.test(full),
      hasPools: /DIALOGUE POOLS USED/.test(full), hasRaw: /RAW LOG/.test(full),
      timelineRows: full.split(String.fromCharCode(10)).filter(l => /^[0-9]+ +(Sunny|Rainy|Stormy|Hot)/.test(l)).length,
      lines: LineCensus.total(), distinct: LineCensus.distinct(),
      brief: brief
    };
  })()`);
  console.log(`  brief ${rep.briefLen}B · full ${(rep.fullLen / 1024).toFixed(0)}KB · ${rep.traceDays} days traced · ${rep.timelineRows} timeline rows`);
  check('the day-by-day trace filled in', rep.traceDays >= 4, `${rep.traceDays} days`);
  check('the brief fits in a single ntfy message', rep.briefLen < 3900, `${rep.briefLen} bytes`);
  check('the brief carries the outcome, camp, effort, voice and flags',
    rep.hasOutcome && rep.hasCamp && rep.hasEffort && rep.hasVoice && rep.hasFlags, 'all sections');
  check('the full report carries the timeline, cast, pools and raw log',
    rep.hasTimeline && rep.hasCast && rep.hasPools && rep.hasRaw, 'all sections');
  check('the timeline has a row per day', rep.timelineRows >= 4, `${rep.timelineRows} rows`);
  /* Exercise both line engines directly — the census has to hook Voice AND
     CampLines, and a census that only sees greetings would not catch the kind of
     repetition this project keeps running into. */
  const census = await ev(`(() => {
    const npc = alive().find(c => !c.isPlayer);
    const before = LineCensus.total();
    for (let i = 0; i < 60; i++) {
      Voice.line('greet', npc, {});
      Voice.line('confrontVote', npc, {});
      CampLines.pick('calloutAgree', npc);
      CampLines.pick('gossipGrumble', npc, { tn: 'Somebody' });
      CampLines.stateGreeting(npc);
    }
    return {
      added: LineCensus.total() - before,
      distinct: LineCensus.distinct(),
      pools: [...LineCensus.pools.keys()],
      voicePools: [...LineCensus.pools.keys()].filter(k => /^greet|^confrontVote/.test(k)).length,
      campPools: [...LineCensus.pools.keys()].filter(k => /^callout|^gossip|^state/.test(k)).length,
      worst: LineCensus.repeats(2).slice(0, 2).map(r => r.n)
    };
  })()`);
  console.log(`  census: +${census.added} lines, ${census.distinct} distinct across ${census.pools.length} pools`);
  console.log(`  pools: ${census.pools.slice(0, 8).join(', ')}`);
  check('the census counts lines from the main dialogue engine', census.voicePools >= 2,
    `${census.voicePools} Voice pools seen`);
  check('and from the camp dialogue engine', census.campPools >= 2,
    `${census.campPools} camp pools seen`);
  check('it can tell how often a single line came up', census.worst.length > 0 && census.worst[0] > 1,
    `most-repeated line seen ${census.worst[0]}x`);

  console.log('\n  ---- the brief, as it will arrive ----');
  console.log(rep.brief.split('\n').map(l => '  | ' + l).join('\n'));

  /* ---- 4. the flags must fire on genuinely broken states ---- */
  console.log('\n--- flags ---');
  const flags = await ev(`(() => {
    /* Force three states that ARE bugs and check each is named. */
    const before = Report.flags().length;
    for (const d of Trace.days) { for (const n of CAMP_NEEDS) d.needs[n.short] = 0.0; }
    const pinned = Report.flags();
    for (let i = 0; i < 9; i++) LineCensus.note('selftest:1', 'the exact same line every single time');
    const repeated = Report.flags();
    for (const d of Trace.days) { for (const n of CAMP_NEEDS) d.needs[n.short] = 0.95; }
    const tooEasy = Report.flags();
    return {
      before,
      pinned: pinned.filter(f => /NEED PINNED/.test(f)).length,
      repeated: repeated.filter(f => /LINE REPEAT/.test(f)).length,
      repeatedText: (repeated.find(f => /LINE REPEAT/.test(f)) || ''),
      tooEasy: tooEasy.filter(f => /TOO EASY/.test(f)).length
    };
  })()`);
  console.log('  ' + JSON.stringify({ pinned: flags.pinned, repeated: flags.repeated, tooEasy: flags.tooEasy }));
  console.log('  sample: ' + flags.repeatedText);
  check('a need parked at empty gets flagged', flags.pinned >= 3, `${flags.pinned} needs named`);
  check('a line heard nine times gets flagged', flags.repeated >= 1, flags.repeatedText.slice(0, 60));
  check('a camp that never bites gets flagged', flags.tooEasy >= 1, 'flagged');

  /* ---- 4b. the playthrough journal: actions, offers, ballots, interest ---- */
  console.log('\n--- the playthrough journal ---');
  const jr = await ev(`(() => {
    /* Drive a spread of real actions through the wrapped functions. */
    const mates = aliveTribe(GAME.player.tribeName).filter(c => !c.isPlayer);
    for (let i = 0; i < 14; i++) {
      const npc = mates[i % mates.length];
      openTalkMenu(npc);
      if (i % 3 === 0) doBond(npc);
      else if (i % 3 === 1) doSmallTalk(npc);
      else doJoke(npc);
      closeDialogue();
    }
    /* And a lopsided run at one person, which is what a dominant pattern looks like. */
    for (let i = 0; i < 22; i++) { openTalkMenu(mates[0]); doBond(mates[0]); closeDialogue(); }
    return {
      actions: Journal.actions.length,
      stats: Journal.actionStats().slice(0, 4),
      offers: Journal.offers.size,
      offeredSample: [...Journal.offers.entries()].slice(0, 3).map(([k, v]) => k + ' ' + v.offered + '/' + v.taken),
      seen: Journal.seen.length,
      seenKinds: [...new Set(Journal.seen.map(s => s.kind))],
      screens: Journal.screens.length,
      dominance: Journal.dominance(),
      spread: Journal.targetSpread().topShare,
      interest: Journal.interest(),
      dead: Journal.deadOptions(20).length
    };
  })()`);
  console.log(`  ${jr.actions} actions logged · ${jr.offers} distinct options offered · ${jr.seen} things shown`);
  console.log('  top actions: ' + JSON.stringify(jr.stats));
  console.log('  shown kinds: ' + JSON.stringify(jr.seenKinds));
  console.log('  offers (offered/taken): ' + JSON.stringify(jr.offeredSample));
  console.log('  dominance: ' + JSON.stringify(jr.dominance));
  console.log('  interest: ' + (jr.interest.score * 100).toFixed(0) + '/100 weakest ' + JSON.stringify(jr.interest.weakest));
  check('every player action is logged', jr.actions >= 36, `${jr.actions} actions`);
  check('the options the player was OFFERED are logged, taken or not',
    jr.offers >= 6, `${jr.offers} distinct options`);
  check('what the player was shown is logged, across channels',
    jr.seen > 20 && jr.seenKinds.length >= 2, `${jr.seen} items, kinds ${jr.seenKinds.join('/')}`);
  check('screens the player passed through are logged', jr.screens >= 1, `${jr.screens}`);
  check('a lopsided action pattern is detected as an easy path',
    !!jr.dominance, jr.dominance ? jr.dominance.verdict : 'not detected');
  check('working one person to death is detected', jr.spread > 0.4,
    `top target got ${(jr.spread * 100).toFixed(0)}% of targeted actions`);
  check('the interest profile computes every axis',
    Object.keys(jr.interest.parts).length >= 8, Object.keys(jr.interest.parts).join(','));
  check('and it names the weakest axes', jr.interest.weakest.length === 3, jr.interest.weakest.join(','));

  /* ---- 4c. ballots carry the reasoning ---- */
  console.log('\n--- ballots ---');
  const bal = await ev(`(() => {
    /* Run a council through the real path so the ballot hook fires. */
    const pool = aliveTribe(GAME.player.tribeName);
    seedVoteWeights(GAME.cast, GAME.merged, GAME.player.name);
    const votes = new Map();
    for (const v of pool) {
      const t = Voting.calculateVote(v, pool, null, GAME.merged, GAME.day, GAME.player.name);
      if (t) votes.set(v, t);
    }
    const tally = Voting.tally(new Map([...votes.entries()].map(([v, t]) => [v.name, t.name])));
    const elim = tally.eliminated || [...votes.values()][0];
    finishTribal(votes, elim, pool, false);
    const b = Journal.ballots[Journal.ballots.length - 1];
    return b ? {
      day: b.day, out: b.eliminated, voters: b.rows.length, margin: b.margin,
      withReasons: b.rows.filter(r => r.why.length > 0).length,
      withWeights: b.rows.filter(r => r.top.length > 0).length,
      sample: b.rows.slice(0, 3),
      expectation: Journal.events.filter(e => e.kind === 'expectation').length
    } : null;
  })()`);
  if (bal) {
    console.log(`  day ${bal.day} · out ${bal.out} · ${bal.voters} ballots · margin ${bal.margin}`);
    bal.sample.forEach(r => console.log(`    ${r.voter} -> ${r.target}  because: ${r.why.join(', ') || '(none)'}`));
  }
  check('every council records a full ballot', !!bal && bal.voters >= 4, bal ? `${bal.voters} voters` : 'none');
  check('each vote records WHY, not just who', !!bal && bal.withReasons > 0,
    bal ? `${bal.withReasons}/${bal.voters} with reasons` : '-');
  check("each vote records the voter weights on everyone",
    !!bal && bal.withWeights === bal.voters, bal ? `${bal.withWeights}/${bal.voters}` : '-');
  check('whether the player read the room right is recorded',
    !!bal && bal.expectation > 0, bal ? `${bal.expectation} recorded` : '-');

  /* ---- 5. THE POINT: does it leave the device and come back? ---- */
  console.log('\n--- the round trip ---');
  const sent = await ev(`(async () => {
    /* Point at a throwaway topic so this test cannot read another run's traffic. */
    const real = Telemetry.ntfyUrl;
    Telemetry.ntfyUrl = () => 'https://ntfy.sh/${topic}';
    const r = await Telemetry.toNtfy('SELFTEST ' + Report.brief(), 'castaway selftest');
    Telemetry.ntfyUrl = real;
    return { ok: r.ok, msg: r.msg || '', status: Telemetry.status.ntfy };
  })()`);
  console.log('  publish: ' + JSON.stringify(sent));
  check('the report POSTs to ntfy.sh from the page', sent.ok === true, sent.msg || sent.status);

  let back = '';
  if (sent.ok) {
    for (let i = 0; i < 6 && !/SELFTEST/.test(back); i++) {
      await sleep(1200);
      try { back = await fetchText(`https://ntfy.sh/${topic}/json?poll=1`); } catch (e) { back = 'ERR ' + e.message; }
    }
  }
  const gotOutcome = /OUTCOME/.test(back) || /CASTAWAY SEASON REPORT/.test(back);
  console.log(`  read back ${back.length} bytes from outside the browser`);
  check('and I can read it back over plain HTTP with no credentials',
    /SELFTEST/.test(back), `${back.length} bytes, recognisable: ${gotOutcome}`);
  check('the round trip preserves the report contents', gotOutcome, 'report body present');

  /* ---- 5b. a finished season survives ntfy forgetting it ---- */
  console.log('\n--- the archive ---');
  const archive = await ev(`(async () => {
    /* Archive the season as the real season-end path does. */
    localStorage.removeItem(Telemetry.AKEY);
    Telemetry.archive(Report.brief(), Report.full());
    const list = Telemetry.archived();
    /* And prove it can be resent afterwards, which is the whole point: ntfy holds
       a message for about twelve hours, so a season played last night and asked
       about this morning used to be unrecoverable. */
    const real = Telemetry.ntfyUrl;
    Telemetry.ntfyUrl = () => 'https://ntfy.sh/${topic}-arch';
    const r = list.length ? await Telemetry.resend(list[0].seed) : { ok: false };
    Telemetry.ntfyUrl = real;
    /* It must also survive the archive being over-full. */
    for (let i = 0; i < 6; i++) { GAME.seasonSeed = 1000 + i; Telemetry.archive('brief ' + i, 'full ' + i); }
    const capped = Telemetry.archived();
    return {
      kept: list.length,
      hasBrief: !!(list[0] && list[0].brief && list[0].brief.length > 200),
      hasFull: !!(list[0] && list[0].full && list[0].full.length > 1000),
      labelled: !!(list[0] && list[0].outcome && list[0].who && list[0].at),
      resent: r.ok === true,
      cappedAt: capped.length, keep: Telemetry.KEEP
    };
  })()`);
  console.log('  ' + JSON.stringify(archive));
  check('a finished season is kept on the device', archive.kept >= 1, `${archive.kept} archived`);
  check('the archive holds the brief and the full report',
    archive.hasBrief && archive.hasFull, 'both present');
  check('and enough labelling to tell seasons apart', archive.labelled, 'who/outcome/date');
  check('an archived season can be resent after ntfy has forgotten it',
    archive.resent, 'resent ok');
  check('the archive does not grow without limit',
    archive.cappedAt === archive.keep, `${archive.cappedAt} kept, cap ${archive.keep}`);

  /* ---- 6. the gist path fails cleanly without a token ---- */
  console.log('\n--- the durable path ---');
  const gist = await ev(`(async () => {
    const noTok = await Telemetry.toGist('x', 'y');
    Telemetry.setToken('ghp_definitelynotarealtoken000000000000');
    const badTok = await Telemetry.toGist('x', 'y');
    const status = Telemetry.status.gist;
    Telemetry.forget();
    return { noTok: noTok.ok, noTokMsg: noTok.msg, badTok: badTok.ok, status };
  })()`);
  console.log('  ' + JSON.stringify(gist));
  check('no token is a clean no-op, not a crash', gist.noTok === false && /no token/.test(gist.noTokMsg), gist.noTokMsg);
  check('a bad token reports itself instead of failing silently',
    gist.badTok === false && /401|token rejected|HTTP/.test(gist.status), gist.status);
  check('the token is forgotten on request', await ev(`!Telemetry.cfg.token`), 'cleared');

  /* ---- 7. the log viewer renders all of it ---- */
  console.log('\n--- the screen ---');
  const ui = await ev(`(() => {
    openDesignLog();
    const btns = [...document.querySelectorAll('#modal-body button')].map(b => b.textContent.trim());
    return {
      btns,
      hasStatus: !!document.querySelector('#modal-body .tel-panel'),
      hasUrl: !!document.querySelector('#modal-body .tel-url'),
      hasInput: !!document.querySelector('#modal-body .tel-input'),
      dump: (document.querySelector('#modal-body .dbg-dump') || {}).value ? true : false
    };
  })()`);
  console.log('  buttons: ' + JSON.stringify(ui.btns.slice(0, 8)) + ` (+${Math.max(0, ui.btns.length - 8)} more)`);
  check('the screen shows where the log went', ui.hasStatus && ui.hasUrl, 'status + links');
  check('it offers Send now', ui.btns.some(b => /Send now/.test(b)), 'present');
  check('it offers the one-time token setup', ui.hasInput, 'input present');
  check('the report is shown by default, not the firehose', ui.dump, 'rendered');
  await ev(`Modal.close()`);

  if (errors.length) console.log('\n!! page errors: ' + JSON.stringify(errors.slice(0, 4)));
  const ok = !fails.length && !errors.length;
  if (fails.length) console.log('\nfailing checks: ' + fails.join(', '));
  console.log(ok ? '\nLOG EXPORT TEST PASS' : '\nLOG EXPORT TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
