/* Nothing may reach across the tribe line.

   Reported from real play: "cross tribe interactions are still happening, like
   'who are you voting for' past tribe swap will still yield people from the old
   tribe. And some other places."

   Two separate causes, so two separate things to prove:

     1. every pool that produces a NAME is scoped to the speaker's current tribe
     2. vote weights do not survive a swap — an NPC carrying weight on an old
        tribemate will name them however well the pools are scoped

   The test hammers each name-producing path a few hundred times after a swap and
   fails on a single leak, because one leak is the bug.

   Run: node tools/tribe-test.js */
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
    '--user-data-dir=' + os.tmpdir() + '\\cw-tribe-' + RUN_ID,
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

  /* ---- build the exact situation: real relationships, real weights, then a swap ---- */
  console.log('\n--- running to a swap with weights and alliances in place ---');
  const setup = await ev(`(() => {
    DBG.setEnabled(false);
    if (!Feed.__realPost) { Feed.__realPost = Feed.post; Feed.post = () => {}; }
    window.toast = () => {};
    Modal.open = () => {};
    /* Play some social time so trust, weights and pairs are genuine rather than
       seeded zeros — the bug only shows when there IS weight to leak. */
    GAME.day = 7;
    for (let d = 0; d < 6; d++) {
      advanceSocialTime(6, GAME.cast, GAME.merged);
      NpcAlliances.dailyUpdate(GAME.cast, GAME.day);
    }
    seedVoteWeights(GAME.cast, GAME.merged, GAME.player.name);
    const beforeTribes = Object.fromEntries(alive().map(c => [c.name, c.tribeName]));
    const weightsBefore = alive().reduce((n, c) => n + c.voteWeights.size, 0);
    const pairsBefore = NpcAlliances.list.filter(a => !a.broken).length;
    doTribeSwap();
    const moved = alive().filter(c => beforeTribes[c.name] !== c.tribeName).length;
    return {
      moved, weightsBefore,
      weightsAfter: alive().reduce((n, c) => n + c.voteWeights.size, 0),
      pairsBefore, pairsAfter: NpcAlliances.list.filter(a => !a.broken).length,
      tribes: [...new Set(alive().map(c => c.tribeName))]
    };
  })()`);
  console.log('  ' + JSON.stringify(setup));
  check('the swap actually moves people', setup.moved > 2, `${setup.moved} changed tribe`);
  check('there were weights to leak in the first place', setup.weightsBefore > 10,
    `${setup.weightsBefore} weights before`);

  /* ---- 1. no vote weight points across the line ---- */
  console.log('\n--- vote weights ---');
  const w = await ev(`(() => {
    const bad = [];
    for (const c of alive()) {
      for (const [name] of c.voteWeights) {
        const o = GAME.cast.find(x => x.name === name);
        if (!o || o.eliminated) continue;
        if (o.tribeName !== c.tribeName) bad.push(c.displayName + ' -> ' + o.displayName);
      }
    }
    return { bad, total: alive().reduce((n, c) => n + c.voteWeights.size, 0) };
  })()`);
  console.log('  ' + w.total + ' weights remain, ' + w.bad.length + ' cross-tribe'
    + (w.bad.length ? ': ' + w.bad.slice(0, 5).join(', ') : ''));
  check('no vote weight survives the swap pointing at another tribe', w.bad.length === 0,
    `${w.bad.length} leaks`);

  /* ---- 2. no working alliance or circle spans the line ---- */
  console.log('\n--- alliances and circles ---');
  const al = await ev(`(() => {
    const bad = [];
    for (const a of NpcAlliances.list) {
      if (a.broken) continue;
      const A = GAME.cast.find(x => x.name === a.a), B = GAME.cast.find(x => x.name === a.b);
      if (A && B && !A.eliminated && !B.eliminated && A.tribeName !== B.tribeName) bad.push(A.displayName + '+' + B.displayName);
    }
    /* And none may FORM across the line on a later day either. */
    for (let d = 0; d < 6; d++) NpcAlliances.dailyUpdate(GAME.cast, GAME.day + d);
    const formed = [];
    for (const a of NpcAlliances.list) {
      if (a.broken) continue;
      const A = GAME.cast.find(x => x.name === a.a), B = GAME.cast.find(x => x.name === a.b);
      if (A && B && !A.eliminated && !B.eliminated && A.tribeName !== B.tribeName) formed.push(A.displayName + '+' + B.displayName);
    }
    const circle = Coalitions.active(GAME.player.name);
    let circleSpans = false;
    if (circle && !circle.broken) {
      const ts = new Set(circle.members.map(n => GAME.cast.find(x => x.name === n))
        .filter(c => c && !c.eliminated).map(c => c.tribeName));
      circleSpans = ts.size > 1;
    }
    return { bad, formed, circleSpans, live: NpcAlliances.list.filter(a => !a.broken).length };
  })()`);
  console.log('  ' + al.live + ' live pairs · split-by-swap survivors ' + al.bad.length
    + ' · newly formed across the line ' + al.formed.length);
  check('the swap breaks pairs it separated', al.bad.length === 0, `${al.bad.length} survived`);
  check('and no new pair forms across tribes', al.formed.length === 0,
    al.formed.length ? al.formed.slice(0, 4).join(', ') : 'none');
  check('no circle spans the line', al.circleSpans === false, 'ok');

  /* ---- 3. THE reported symptom: who they say they are voting for ---- */
  console.log('\n--- "who are you voting for" x600 ---');
  const lean = await ev(`(() => {
    const bad = [];
    let asked = 0, named = 0;
    for (let i = 0; i < 600; i++) {
      const pool = alive().filter(c => !c.isPlayer);
      const npc = pool[i % pool.length];
      const r = npcLeanTarget(npc);
      asked++;
      if (!r || !r.target) continue;
      named++;
      if (r.target.tribeName !== npc.tribeName) bad.push(npc.displayName + ' named ' + r.target.displayName);
      if (r.target === npc) bad.push(npc.displayName + ' named THEMSELVES');
    }
    return { asked, named, bad };
  })()`);
  console.log(`  ${lean.named}/${lean.asked} produced a name · ${lean.bad.length} cross-tribe`
    + (lean.bad.length ? ': ' + lean.bad.slice(0, 4).join(', ') : ''));
  check('a vote lean always names somebody at that speaker own council',
    lean.bad.length === 0, `${lean.bad.length} leaks in ${lean.named} answers`);
  check('and they still answer most of the time', lean.named > lean.asked * 0.8,
    `${lean.named}/${lean.asked}`);

  /* ---- 4. every other name-producing path ---- */
  console.log('\n--- the other name-producing paths ---');
  const paths = await ev(`(() => {
    const out = {};
    const npcs = alive().filter(c => !c.isPlayer);
    const P = GAME.player;
    const sameTribeAs = (c, other) => !other || other.tribeName === c.tribeName;

    /* topPressureSubject: whose name is circulating at the player's camp. */
    let bad = 0, got = 0;
    for (let i = 0; i < 200; i++) {
      const n = topPressureSubject();
      if (!n) continue;
      got++;
      const c = GAME.cast.find(x => x.name === n);
      if (!sameTribeAs(P, c)) bad++;
    }
    out.pressure = { got, bad };

    /* pickTarget / openCastPicker pools, read without opening a modal. */
    const realPicker = window.openCastPicker;
    let pickerBad = 0, pickerPools = 0;
    window.openCastPicker = (title, pool) => {
      pickerPools++;
      for (const c of pool) if (!sameTribeAs(GAME.player, c)) pickerBad++;
    };
    /* Only NPCs the player could actually be talking to. The beach renders one
       camp, so a conversation with somebody on the other tribe cannot happen —
       feeding those in here measured pickTarget correctly scoping to THEIR tribe
       and called it a leak. */
    const talkable = campmates(P).filter(c => !c.isPlayer);
    for (const npc of talkable.slice(0, 8)) {
      pickTarget(npc, () => {});
      try { shareMyVoteMenu(npc); } catch (e) { }
      try { warnNameMenu(npc); } catch (e) { }
      try { pickSomeoneToTalk(); } catch (e) { }
      try { pickSomeoneToObserve(); } catch (e) { }
    }
    window.openCastPicker = realPicker;
    out.pickers = { pools: pickerPools, bad: pickerBad };

    /* campmates itself, for every castaway. */
    let cmBad = 0;
    for (const c of alive()) for (const o of campmates(c)) if (o.tribeName !== c.tribeName) cmBad++;
    out.campmates = cmBad;
    out.talkable = talkable.length;
    out.aliveN = alive().length;

    /* The beach only ever renders one camp. */
    out.visibleBad = 0;
    for (const c of (typeof Beach !== 'undefined' ? [] : [])) out.visibleBad++;
    return out;
  })()`);
  console.log('  ' + JSON.stringify(paths));
  check('the circulating-name read stays inside the camp', paths.pressure.bad === 0,
    `${paths.pressure.got} reads, ${paths.pressure.bad} leaks`);
  check('every cast picker offers only current tribemates',
    paths.pickers.bad === 0 && paths.pickers.pools > 0,
    `${paths.pickers.pools} pools, ${paths.pickers.bad} off-tribe entries`);
  check('and the pickers only ever open for somebody you can reach',
    paths.talkable > 0 && paths.talkable < paths.aliveN,
    `${paths.talkable} reachable of ${paths.aliveN} alive`);
  check('campmates() never returns somebody from another tribe', paths.campmates === 0,
    `${paths.campmates} leaks`);

  /* ---- 5. and the merge puts everyone back together ---- */
  console.log('\n--- after the merge ---');
  const merged = await ev(`(() => {
    doMerge();
    const tribes = [...new Set(alive().map(c => c.tribeName))];
    let cm = 0;
    for (const c of alive()) cm = Math.max(cm, campmates(c).length);
    let leanOk = true;
    for (let i = 0; i < 100; i++) {
      const pool = alive().filter(c => !c.isPlayer);
      const npc = pool[i % pool.length];
      const r = npcLeanTarget(npc);
      if (r && r.target === npc) leanOk = false;
    }
    return { tribes, campmatesMax: cm, aliveN: alive().length, leanOk };
  })()`);
  console.log('  ' + JSON.stringify(merged));
  check('the merge is one tribe', merged.tribes.length === 1, merged.tribes.join(','));
  check('and campmates opens up to everybody', merged.campmatesMax === merged.aliveN,
    `${merged.campmatesMax} of ${merged.aliveN}`);
  check('nobody ever names themselves', merged.leanOk === true, 'ok');

  if (errors.length) console.log('\n!! page errors: ' + JSON.stringify(errors.slice(0, 3)));
  const ok = !fails.length && !errors.length;
  if (fails.length) console.log('\nfailing checks: ' + fails.join(', '));
  console.log(ok ? '\nTRIBE TEST PASS' : '\nTRIBE TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
