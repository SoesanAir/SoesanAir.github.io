/* Tribal council conversation — contract and behaviour.

   Two halves, because this feature can fail in two completely different ways.

   THE STATIC HALF checks the writing against docs/tribal-qa.md. Most of these
   rules exist because breaking them ships something visibly wrong to the player
   rather than crashing: a stray "(quietly)" reads as a script direction, an
   undeclared placeholder ships as literal {braces}, and a duplicate line is
   invisible to a writer working on one file but obvious to a player on their
   third council.

   THE LIVE HALF runs an actual council and checks the scene. The rule that
   matters most here is the one that cannot be checked by reading the files: every
   single line waits for a tap. That was an explicit requirement and it is the kind
   of thing that silently regresses the moment somebody adds an auto-advance.

   It also checks the thing this whole feature is built around: that Peff never
   says a word about an alliance, an idol or a whisper. TribalRead is written to
   make that structurally impossible by refusing to import those modules, and this
   asserts the refusal is still true.

   Run: node tools/tribalqa-test.js */
const http = require('http'), { spawn } = require('child_process'), os = require('os'), path = require('path'), fs = require('fs');
const WebSocket = require('ws');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const RUN_ID = process.pid.toString(36) + Math.floor(Math.random() * 1e6).toString(36);
const PORT = 9200 + Math.floor(Math.random() * 2000);
const NL = String.fromCharCode(10);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = p => new Promise((s, j) => http.get({ host: '127.0.0.1', port: PORT, path: p }, r => {
  let d = ''; r.on('data', c => d += c); r.on('end', () => s(JSON.parse(d)));
}).on('error', j));

const fails = [];
const check = (n, ok, d) => { console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + n + (d ? '  — ' + d : '')); if (!ok) fails.push(n); };

/* ---------- what each topic is allowed to interpolate ----------
   Mirrors the subs each reader in tribal-read.js actually builds. {who} is added
   by the engine for every topic, so it is always legal. */
const ALLOWED = {
  lostAgain: ['n'], blowout: ['chal'], wonImmunity: ['chal'], weakLink: ['chal'],
  carried: ['chal'], closeCall: ['chal'],
  noFood: [], fireOut: [], shelterBad: ['weather'], notPulling: ['days'],
  worker: [], worn: [],
  lastUnanimous: ['gone'], lastSplit: ['gone', 'margin'], lastTie: ['gone'],
  idolWasPlayed: [], repeatTarget: ['n'], firstTribal: [],
  publicFight: ['other'], toldToFace: ['other'], merged: [],
  juryForming: ['n'], quietOne: [], numbersAgainst: ['big', 'small', 'gap']
};
const STANCES = ['own', 'deflect', 'blame', 'defiant', 'wry', 'bleak'];
const BANNED_FOR_PEFF = ['alliance', 'pact', 'bloc', 'whisper', 'idol'];

(async () => {
  /* ============ STATIC ============ */
  console.log(NL + 'THE WRITING');
  const dir = 'C:/projects/Personal/Castaway/Castaway/WebGame';
  const files = ['a', 'b', 'c', 'd'].map(k => dir + '/js/tribal-qa-lines-' + k + '.js');
  const missing = files.filter(f => !fs.existsSync(f));
  check('all four lines files exist', !missing.length,
    missing.length ? 'missing ' + missing.map(f => path.basename(f)).join(', ') : '4 files');
  check('the welcome pool exists', fs.existsSync(dir + '/js/tribal-welcome.js'));

  /* Load them the way the browser will: concatenate and evaluate, so a syntax
     error or a duplicate const is caught here rather than at a real council. */
  let TOPICS = [], WELCOME = null;
  try {
    let src = '';
    for (const f of files) if (fs.existsSync(f)) src += fs.readFileSync(f, 'utf8') + NL;
    if (fs.existsSync(dir + '/js/tribal-welcome.js')) src += fs.readFileSync(dir + '/js/tribal-welcome.js', 'utf8') + NL;
    src += NL + 'return {' +
      ' A: typeof TRIBAL_TOPICS_A !== "undefined" ? TRIBAL_TOPICS_A : [],' +
      ' B: typeof TRIBAL_TOPICS_B !== "undefined" ? TRIBAL_TOPICS_B : [],' +
      ' C: typeof TRIBAL_TOPICS_C !== "undefined" ? TRIBAL_TOPICS_C : [],' +
      ' D: typeof TRIBAL_TOPICS_D !== "undefined" ? TRIBAL_TOPICS_D : [],' +
      ' W: typeof TRIBAL_WELCOME !== "undefined" ? TRIBAL_WELCOME : null };';
    const got = new Function(src)();
    TOPICS = [].concat(got.A, got.B, got.C, got.D);
    WELCOME = got.W;
  } catch (e) {
    check('the lines files load', false, String(e.message).split(NL)[0]);
  }
  check('the lines files load', TOPICS.length > 0, TOPICS.length + ' topics');

  /* Every line in the corpus, tagged by where it came from, so one pass can check
     all the text rules and the duplicate rule together. */
  const every = [];
  for (const t of TOPICS) {
    for (const l of (t.ask || [])) every.push({ t: t.id, kind: 'ask', peff: true, l });
    for (const l of (t.push || [])) every.push({ t: t.id, kind: 'push', peff: true, l });
    for (const s of STANCES) for (const l of ((t.answers || {})[s] || [])) every.push({ t: t.id, kind: 'answer:' + s, peff: false, l });
    for (const s in (t.chime || {})) for (const l of (t.chime[s] || [])) every.push({ t: t.id, kind: 'chime:' + s, peff: false, l });
    for (const s in (t.playerOpts || {})) every.push({ t: t.id, kind: 'opt:' + s, peff: false, l: t.playerOpts[s], opt: true });
  }
  if (WELCOME) for (const k in WELCOME) for (const l of (WELCOME[k] || [])) every.push({ t: 'welcome:' + k, kind: 'welcome', peff: true, l });

  console.log('  corpus: ' + every.length + ' lines across ' + TOPICS.length + ' topics + welcome');

  /* --- no brackets, no stage directions. The player asked for this directly. --- */
  const bracketed = every.filter(e => /[()*]/.test(e.l));
  check('no parentheses or asterisks anywhere', !bracketed.length,
    bracketed.length ? bracketed.length + ' e.g. ' + bracketed[0].t + ' ' + bracketed[0].kind : every.length + ' lines clean');

  /* --- Peff never reveals a secret --- */
  const leaks = every.filter(e => e.peff && BANNED_FOR_PEFF.some(w => e.l.toLowerCase().indexOf(w) >= 0));
  check('Peff never says alliance, pact, bloc, whisper or idol', !leaks.length,
    leaks.length ? leaks.length + ' e.g. ' + leaks[0].t + ': ' + leaks[0].l.slice(0, 50) : 'clean');

  /* --- length. Long lines overflow a 344px landscape phone. --- */
  const tooLong = every.filter(e => {
    const cap = e.opt ? 42 : (e.kind === 'welcome' ? 200 : (e.peff ? 140 : 160));
    return e.l.length > cap;
  });
  check('every line fits its length cap', !tooLong.length,
    tooLong.length ? tooLong.length + ' e.g. ' + tooLong[0].t + ' ' + tooLong[0].kind + ' at ' + tooLong[0].l.length : 'ok');

  /* --- placeholders must be declared, or they ship as literal braces --- */
  const badSub = [];
  for (const e of every) {
    if (e.kind === 'welcome') { if (e.l.indexOf('{') >= 0) badSub.push(e); continue; }
    const allowed = (ALLOWED[e.t] || []).concat(['who']);
    for (const m of (e.l.match(/\{([a-zA-Z]+)\}/g) || [])) {
      if (allowed.indexOf(m.slice(1, -1)) < 0) badSub.push(e);
    }
  }
  check('every placeholder is declared for its topic', !badSub.length,
    badSub.length ? badSub.length + ' e.g. ' + badSub[0].t + ': ' + badSub[0].l.slice(0, 60) : 'ok');

  /* --- no duplicates. Invisible per-file, obvious to a player. --- */
  const seen = new Map(), dupes = [];
  for (const e of every) {
    const k = e.l.trim().toLowerCase();
    if (seen.has(k)) dupes.push(e.t + '/' + e.kind + ' == ' + seen.get(k)); else seen.set(k, e.t + '/' + e.kind);
  }
  check('no duplicate lines anywhere in the corpus', !dupes.length,
    dupes.length ? dupes.length + ' e.g. ' + dupes[0] : every.length + ' unique');

  /* --- volume, per the contract --- */
  const thin = [];
  for (const t of TOPICS) {
    if ((t.ask || []).length < 5) thin.push(t.id + ' ask=' + (t.ask || []).length);
    for (const s of STANCES) {
      const n = ((t.answers || {})[s] || []).length;
      if (n < 4) thin.push(t.id + ' ' + s + '=' + n);
    }
    if (Object.keys(t.playerOpts || {}).length < 3) thin.push(t.id + ' playerOpts');
  }
  check('every topic has all six stances with real depth', !thin.length,
    thin.length ? thin.slice(0, 3).join(', ') : TOPICS.length + ' topics complete');

  /* --- the reader and the writing must agree, both directions --- */
  const readerSrc = fs.readFileSync(dir + '/js/tribal-read.js', 'utf8');
  const readerIds = (readerSrc.match(/id: '([a-zA-Z]+)'/g) || []).map(s => s.slice(5, -1));
  const topicIds = TOPICS.map(t => t.id);
  const noLines = readerIds.filter(i => topicIds.indexOf(i) < 0);
  const noFact = topicIds.filter(i => readerIds.indexOf(i) < 0);
  check('every fact the reader can emit has lines written for it', !noLines.length,
    noLines.length ? 'unwritten: ' + noLines.join(', ') : readerIds.length + ' facts covered');
  check('every written topic is reachable from the reader', !noFact.length,
    noFact.length ? 'unreachable: ' + noFact.join(', ') : 'all reachable');
  check('no duplicate topic ids', new Set(topicIds).size === topicIds.length,
    topicIds.length + ' ids');

  /* --- the structural guarantee: the reader cannot see secrets --- */
  const forbidden = ['Coalitions', 'PlayerAlliances', 'NpcBlocs', 'Idols', 'Whisper', 'Lying'];
  /* Strip comments before scanning. The first run of this check failed on the
     reader's own header, which lists these modules in prose to explain that it
     deliberately does NOT read them — and "...Whisper, Lying. If a future topic"
     matches /Lying\./ perfectly. The rule is about code, so only look at code. */
  const readerCode = readerSrc
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  const touched = forbidden.filter(m => new RegExp('\\b' + m + '\\.').test(readerCode));
  check('the reader never touches a secret-bearing module', !touched.length,
    touched.length ? 'reads ' + touched.join(', ') : 'reads only public sources');

  /* ============ LIVE ============ */
  console.log(NL + 'THE SCENE');
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT,
    '--no-first-run', '--window-size=900,430',
    '--user-data-dir=' + path.join(os.tmpdir(), 'cw-tqa-' + RUN_ID),
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
    if (r.result.exceptionDetails) throw new Error('threw: ' + ((r.result.exceptionDetails.exception || {}).description || '').split(NL)[0]);
    return r.result.result.value;
  };
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  const errs = [];
  const notFound = [];
  await send('Log.enable');
  ws.on('message', m => {
    const j = JSON.parse(m);
    if (j.method === 'Log.entryAdded' && j.params.entry.level === 'error') errs.push(j.params.entry.text);
    /* "Failed to load resource: 404" from the console does not say WHICH resource,
       which makes it useless to act on. Capture the URL from the network layer. */
    if (j.method === 'Network.responseReceived' && j.params.response.status === 404) {
      notFound.push(j.params.response.url);
    }
  });
  const waitFor = async s => {
    for (let i = 0; i < 120; i++) { if (await ev('!!document.querySelector(' + JSON.stringify(s) + ')')) return true; await sleep(250); }
    return false;
  };

  await waitFor('#screen-title.active');
  await ev('localStorage.clear()');
  await send('Page.reload', { ignoreCache: true });
  await waitFor('#screen-title.active'); await sleep(400);
  await ev("document.getElementById('btn-new-game').click()");
  await waitFor('#screen-create.active');
  await ev("GAME.fastMaroon=true;GAME.fastChallenge=true;document.getElementById('btn-create-go').click()");
  for (let i = 0; i < 400; i++) {
    if (await ev("!!document.querySelector('#screen-camp.active')")) break;
    await ev("(()=>{const b=document.querySelector('#maroon-choices button')||document.querySelector('.maroon-next');if(b&&!b.disabled)b.click();})()");
    await sleep(120);
  }
  check('a season starts', await ev("!!document.querySelector('#screen-camp.active')"));
  await ev('DBG.setEnabled(false); window.toast=()=>{}; Telemetry.cfg.auto=false; true;');
  /* Dismiss the onboarding tour by CLICKING Skip, not by calling forceComplete().
     Tutorial.step() is an await on a real click, so forcing the flag leaves the
     card on screen with a live promise behind it — which both covers the
     screenshot and can swallow taps meant for the council. */
  for (let i = 0; i < 8; i++) {
    const clicked = await ev(`(() => {
      const b = [...document.querySelectorAll('button')]
        .find(x => /skip tutorial/i.test(x.textContent) && x.offsetParent);
      if (b) { b.click(); return true; }
      return false;
    })()`);
    if (clicked) break;
    await sleep(150);
  }
  await ev('Tutorial.forceComplete(); true;');
  await sleep(200);
  check('the tutorial is out of the way',
    !(await ev("!!document.querySelector('.modal-veil.show, #tut-card')")));

  check('the conversation screen is in the document', await ev("!!document.getElementById('screen-tribalqa')"));
  check('TribalQA and TribalRead loaded',
    await ev("typeof TribalQA === 'object' && typeof TribalRead === 'object'"));
  check('all four topic batches reached the page',
    await ev("TribalQA.topics().size >= 20"), 'topics: ' + await ev('TribalQA.topics().size'));

  /* Give the reader something to find, then run a real council and step through
     it counting lines. The point is that the scene ADVANCES ONLY ON TAP: if any
     line auto-advances, the count of taps will not match the count of lines. */
  const scene = await ev(`(async () => {
    const pool = alive().slice(0, 8);
    /* Manufacture public history so the reader has facts to rank. All of these
       are things Peff is allowed to know. */
    Journal.challenges.push({ day: GAME.day, kind: 'tribal', chal: 'Ropes and Rails', cat: 'Physical',
      playerWon: false, weakest: pool[3].displayName, field: pool.length,
      field_scores: [pool[1].displayName + ' 0.91', pool[0].displayName + ' 0.62'] });
    GAME.campFire = 0.05;
    CampNeeds.set('food', 0.05);
    pool[2].slackRun = 4;
    pool[4].hunger = 0.9; pool[4].fatigue = 0.9;

    const facts = TribalRead.facts(pool);
    const budget = TribalRead.budget();

    /* Drive the scene, tapping Next for every line that appears. A cap well above
       any plausible council length so a bug cannot hang the harness. */
    let lines = 0, taps = 0, autoAdvanced = 0;
    const seenTexts = [], speakers = [];
    const done = TribalQA.run(pool);
    for (let guard = 0; guard < 60; guard++) {
      await new Promise(r => setTimeout(r, 40));
      const scr = document.getElementById('screen-tribalqa');
      if (!scr.classList.contains('active')) {
        /* Scene over, or between lines. Give it a beat and check again. */
        await new Promise(r => setTimeout(r, 60));
        if (!scr.classList.contains('active')) break;
      }
      const txt = document.getElementById('tqa-text').textContent || '';
      const who = document.getElementById('tqa-who').textContent || '';
      if (txt) { lines++; seenTexts.push(who + ' | ' + txt); if (who) speakers.push(who); }
      /* If a stance choice is up, take the first option. */
      const opt = document.querySelector('.tqa-opt');
      if (opt) { opt.click(); continue; }
      const btn = document.getElementById('btn-tqa-next');
      /* Wait a beat WITHOUT tapping and confirm the same line is still there.
         That is the actual test of "requires a tap". */
      const before = txt;
      await new Promise(r => setTimeout(r, 260));
      if ((document.getElementById('tqa-text').textContent || '') !== before
        && document.getElementById('screen-tribalqa').classList.contains('active')) autoAdvanced++;
      if (btn && !btn.classList.contains('hidden')) { btn.click(); taps++; }
    }
    await done;
    return {
      lines, taps, autoAdvanced, budget, factCount: facts.length,
      factIds: facts.slice(0, 6).map(f => f.id),
      texts: seenTexts, speakers,
      usedTopics: [...TribalQA.usedTopics]
    };
  })()`);

  console.log('  reader found ' + scene.factCount + ' facts, budget ' + scene.budget
    + ', asked about: ' + scene.usedTopics.join(', '));
  console.log('  scene ran ' + scene.lines + ' lines with ' + scene.taps + ' taps');
  console.log(NL + '  transcript:');
  for (const l of scene.texts.slice(0, 14)) console.log('    ' + l.slice(0, 150));

  check('the reader finds real facts from public history', scene.factCount >= 3, scene.factCount + ' facts');
  check('the council opens with a welcome and runs several beats',
    scene.lines >= 4, scene.lines + ' lines');
  check('no line advances without a tap', scene.autoAdvanced === 0,
    scene.autoAdvanced ? scene.autoAdvanced + ' auto-advanced' : 'all ' + scene.lines + ' waited');
  check('it asks about more than one thing', scene.usedTopics.length >= 2,
    scene.usedTopics.length + ' topics');
  check('castaways answer, not just Peff',
    scene.speakers.some(s => s && s !== 'Peff'), scene.speakers.slice(0, 5).join(', '));
  /* The whole premise: nothing Peff says may leak a secret. Checked against what
     actually rendered, not just against the source pools. */
  const peffLines = scene.texts.filter(t => t.indexOf('Peff |') === 0);
  const liveLeak = peffLines.filter(t => BANNED_FOR_PEFF.some(w => t.toLowerCase().indexOf(w) >= 0));
  check('nothing Peff actually said revealed a secret', !liveLeak.length,
    liveLeak.length ? liveLeak[0].slice(0, 60) : peffLines.length + ' Peff lines clean');
  const unfilled = scene.texts.filter(t => t.indexOf('{') >= 0);
  check('no unfilled placeholder reached the screen', !unfilled.length,
    unfilled.length ? unfilled[0].slice(0, 60) : 'clean');

  /* A second council must not repeat a topic. */
  const second = await ev(`(() => {
    const before = [...TribalQA.usedTopics];
    const facts = TribalRead.facts(alive().slice(0, 8));
    return { before, offered: facts.map(f => f.id) };
  })()`);
  const repeat = second.offered.filter(i => second.before.indexOf(i) >= 0);
  check('a spent topic is never offered again this season', !repeat.length,
    repeat.length ? 'would re-ask ' + repeat.join(', ') : 'no repeats offered');

  /* A 404 is reported separately with its URL, because "Failed to load resource"
     on its own is not something anybody can fix. */
  const realErrs = errs.filter(e => e.indexOf('404') < 0);
  check('no page errors during the council', realErrs.length === 0,
    realErrs.length ? realErrs[0].slice(0, 110) : 'clean');
  /* favicon.ico is requested by the browser itself whether or not the page asks for
     one, and this project has never shipped one. Not a game asset, not this
     feature's problem, and excluding it is what makes the check mean something. */
  const missingAssets = notFound.filter(u => u.indexOf('favicon.ico') < 0);
  check('no game asset 404s', missingAssets.length === 0,
    missingAssets.length ? missingAssets.map(u => u.replace(/^https?:\/\/[^/]+\//, '')).slice(0, 3).join(', ') : 'clean');

  await send('Emulation.setDeviceMetricsOverride', { width: 740, height: 344, deviceScaleFactor: 1, mobile: false });
  /* Close the onboarding modal, or the screenshot is a picture of the tutorial and
     nobody can judge the screen underneath it. */
  await ev("Tutorial.forceComplete(); Modal.close(); true;");
  await sleep(200);
  const fit = await ev(`(async () => {
    Screens.push('screen-tribalqa');
    document.getElementById('screen-tribalqa').classList.remove('is-peff');
    document.getElementById('tqa-who').textContent = 'Somebody With A Long Name';
    document.getElementById('tqa-text').textContent = 'I have not eaten in two days and I could not hold my own weight out there. That is what all of you watched happen to me today.';
    const p = document.getElementById('tqa-portrait'); p.innerHTML = '';
    const img = document.createElement('img'); img.src = GAME.player.spriteURL || ''; p.appendChild(img);
    await new Promise(r => setTimeout(r, 120));
    const scr = document.getElementById('screen-tribalqa');
    const btn = document.getElementById('btn-tqa-next').getBoundingClientRect();
    return { scroll: scr.scrollHeight, client: scr.clientHeight, btnBottom: Math.round(btn.bottom), btnH: Math.round(btn.height) };
  })()`);
  await send('Page.captureScreenshot', { format: 'png' }).then(r =>
    fs.writeFileSync(dir + '/tools/_look-tribalqa.png', Buffer.from(r.result.data, 'base64')));
  /* And Peff's side of it, which lays out completely differently — no portrait,
     centred text, full width. Two screenshots because one cannot show both. */
  await ev(`(() => {
    document.getElementById('screen-tribalqa').classList.add('is-peff');
    document.getElementById('tqa-who').textContent = 'Peff';
    document.getElementById('tqa-portrait').innerHTML = '';
    document.getElementById('tqa-text').textContent = TribalQA.welcomeLine();
    return true;
  })()`);
  await sleep(150);
  await send('Page.captureScreenshot', { format: 'png' }).then(r =>
    fs.writeFileSync(dir + '/tools/_look-tribalqa-peff.png', Buffer.from(r.result.data, 'base64')));
  console.log('  saved tools/_look-tribalqa.png and _look-tribalqa-peff.png');
  check('a long answer still fits a 344px landscape phone',
    fit.scroll <= fit.client + 2 && fit.btnBottom <= 344,
    fit.scroll + ' vs ' + fit.client + ', button bottom ' + fit.btnBottom);
  check('the Next button is a real tap target', fit.btnH >= 22, fit.btnH + 'px tall');

  const ok = !fails.length;
  if (fails.length) console.log(NL + 'failing checks: ' + fails.join(', '));
  console.log(ok ? NL + 'TRIBAL QA PASS' : NL + 'TRIBAL QA FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
