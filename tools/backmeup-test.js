/* "Back me up tonight" must react to the actual state, not return one canned
   line. Drives the same ask across engineered situations and checks the stance,
   the stated reason, the vote weight actually moved, and that a false promise is
   declared as a lie so tribal exposes it.
   Run: node tools/backmeup-test.js */
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
    '--no-first-run', '--user-data-dir=' + os.tmpdir() + '\\cw-bmu-' + RUN_ID,
    'http://localhost:8099/index.html?no3d=1'], { stdio: 'ignore' });
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
  ws.on('message', m => { const j = JSON.parse(m); if (j.method === 'Runtime.exceptionThrown') { const d = (j.params.exceptionDetails.exception || {}).description || j.params.exceptionDetails.text; if (d && d !== 'Event') errors.push(d); }; });
  const waitFor = async s => { for (let i = 0; i < 60; i++) { if (await ev(`!!document.querySelector(${JSON.stringify(s)})`)) return; await sleep(250); } console.log('!! errors:', errors.slice(0, 3)); throw new Error('no ' + s); };

  await waitFor('#screen-title.active');
  await ev(`localStorage.clear()`);
  await send('Page.reload', { ignoreCache: true });
  await waitFor('#screen-title.active'); await sleep(300);
  await ev(`document.getElementById('btn-new-game').click()`);
  await waitFor('#screen-create.active');
  await ev(`GAME.fastMaroon = true; document.getElementById('btn-create-go').click()`);
  // skip the marooning opener
  for (let i = 0; i < 80; i++) {
    if (await ev(`(() => { const b = document.querySelector('#maroon-choices button'); if (b) { b.click(); return true; } return false; })()`)) await sleep(120);
    else if (await ev(`!!document.querySelector('#screen-camp.active')`)) break;
    else await sleep(150);
  }
  await waitFor('#screen-camp.active'); await waitFor('#figures .bfig');
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>/skip tutorial/i.test(b.textContent));if(b)b.click();})()`);
  await sleep(700);

  /* Engineer a situation, ask, and report what came back. */
  const probe = async (label, setupJS) => {
    const r = await ev(`(() => {
      const P = GAME.player;
      const pool = alive().filter(c => !c.isPlayer);
      const npc = pool[0], target = pool[1];
      // clean slate each time
      PlayerAlliances.reset(); Coalitions.reset(); NpcAlliances.reset(); Lying.reset();
      npc.resetVW(); npc.cluster = 'Camp Provider'; npc.morale = 0.7;
      npc.relationships.get(P.name).trust = 0.45;
      npc.relationships.get(P.name).rel = 0.45;
      npc.relationships.get(target.name).rel = 0.40;
      npc.relationships.get(target.name).trust = 0.40;
      pool.slice(1).forEach(c => npc.addVW(c.name, 0.3));
      ${setupJS}
      const ap = backMeUpAppraisal(npc, target);
      const vwBefore = npc.getVW(target.name);
      doBackMeUp(npc, target);
      const declared = [...Lying.declared.entries()].find(([k]) => k === npc.name + '|' + P.name);
      return { stance: ap.stance, reason: ap.reason, score: ap.score, honesty: ap.honesty,
               rank: ap.rank + '/' + ap.of, appetite: ap.ownAppetite,
               vwMoved: +(npc.getVW(target.name) - vwBefore).toFixed(2),
               declaredTruth: declared ? declared[1].truth : null,
               lvl: PlayerAlliances.level(npc.name),
               npcDn: npc.displayName, targetDn: target.displayName };
    })()`);
    await sleep(1000);
    const line = await ev(`document.getElementById('dlg-text').textContent`);
    console.log(`\n${label}`);
    console.log(`  stance=${r.stance} reason=${r.reason} score=${r.score} honesty=${r.honesty} rank=${r.rank} appetite=${r.appetite}`);
    console.log(`  vote weight moved ${r.vwMoved >= 0 ? '+' : ''}${r.vwMoved}  declared=${r.declaredTruth}  alliance=${r.lvl}`);
    console.log(`  "${line}"`);
    return r;
  };

  const trusted = await probe('TRUSTED ALLY, target already their top pick',
    `npc.relationships.get(P.name).trust = 0.85;
     npc.relationships.get(P.name).rel = 0.8;
     PlayerAlliances.align(npc.name, 1); PlayerAlliances.promise(npc.name, 1);
     npc.resetVW(); npc.addVW(target.name, 2.0);
     npc.cluster = 'Loyal Follower';`);

  const likesTarget = await probe('TARGET IS THEIR FRIEND',
    `npc.relationships.get(P.name).trust = 0.7;
     npc.relationships.get(target.name).rel = 0.9;
     npc.relationships.get(target.name).trust = 0.9;`);

  const bound = await probe('TARGET IS THEIR SWORN ALLY',
    `npc.relationships.get(P.name).trust = 0.75;
     NpcAlliances.list.push({ a: npc.name, b: target.name, day: 1, broken: false });
     npc.relationships.get(target.name).rel = 0.7;`);

  const stranger = await probe('BARELY TRUSTS YOU',
    `npc.relationships.get(P.name).trust = 0.12;
     npc.relationships.get(P.name).rel = 0.15;`);

  const harmless = await probe('TARGET IS BOTTOM OF THEIR LIST',
    `npc.relationships.get(P.name).trust = 0.6;
     npc.resetVW();
     alive().filter(c => c !== npc && c !== target).forEach(c => npc.addVW(c.name, 1.5));
     npc.addVW(target.name, 0.01);`);

  const threat = await probe('THEY THINK YOU ARE THE THREAT',
    `npc.relationships.get(P.name).trust = 0.4;
     npc.addVW(P.name, 2.0);
     npc.cluster = 'Strategic Veteran';`);

  /* A schemer who distrusts you should sometimes agree and NOT mean it. */
  const falsePromises = await ev(`(() => {
    const P = GAME.player;
    const pool = alive().filter(c => !c.isPlayer);
    const npc = pool[0], target = pool[1];
    let lies = 0, truths = 0, refused = 0;
    for (let i = 0; i < 60; i++) {
      PlayerAlliances.reset(); Lying.reset(); npc.resetVW();
      npc.cluster = 'Paranoid Schemer';
      npc.relationships.get(P.name).trust = 0.52;
      npc.relationships.get(target.name).rel = 0.3;
      npc.addVW(target.name, 1.2);
      doBackMeUp(npc, target);
      const d = [...Lying.declared.entries()].find(([k]) => k === npc.name + '|' + P.name);
      if (!d) refused++;
      else if (d[1].truth === 'Lie') lies++;
      else if (d[1].truth === 'Truth') truths++;
    }
    return { lies, truths, refused };
  })()`);
  console.log(`\nFALSE PROMISES over 60 asks (schemer, trust 0.52): sincere=${falsePromises.truths} lying=${falsePromises.lies} other=${falsePromises.refused}`);

  /* Variety: ask the same question in the same state many times and count how
     many distinct answers come back. Also assert no internal stance label ever
     reaches the player. */
  const variety = await ev(`(async () => {
    const P = GAME.player;
    const pool = alive().filter(c => !c.isPlayer);
    const npc = pool[0], target = pool[1];
    const seen = new Set(); const leaks = [];
    const BAD = /committed|noncommittal|non-committal|uncommitted|refused|leaning|stance/i;
    for (let i = 0; i < 60; i++) {
      PlayerAlliances.reset(); Lying.reset(); npc.resetVW();
      npc.cluster = 'Camp Provider';
      npc.relationships.get(P.name).trust = 0.85;
      npc.relationships.get(P.name).rel = 0.8;
      npc.relationships.get(target.name).rel = 0.3;
      npc.addVW(target.name, 2.0);
      const ap = backMeUpAppraisal(npc, target);
      const line = backMeUpLine(ap, target.displayName, npc, true);
      seen.add(line);
      if (BAD.test(line)) leaks.push(line);
    }
    return { distinct: seen.size, leaks: leaks.slice(0, 3), sample: [...seen].slice(0, 4) };
  })()`);
  console.log(`
VARIETY over 60 identical asks: ${variety.distinct} distinct answers`);
  variety.sample.forEach(l => console.log('   ' + l));
  console.log('internal labels leaked to the player:', variety.leaks.length);

  const logTail = await ev(`DBG.text('alliance').split('\\n').filter(l=>/BackMeUp/.test(l)).slice(-3).join('\\n')`);
  console.log('\n--- log ---\n' + logTail);

  const stances = [trusted, likesTarget, bound, stranger, harmless, threat].map(r => r.stance);
  const reasons = [trusted, likesTarget, bound, stranger, harmless, threat].map(r => r.reason);
  const ok = trusted.stance === 'Committed' && trusted.vwMoved > 0.5
    && bound.reason === 'bound' && (bound.stance === 'Refused' || bound.stance === 'Noncommittal')
    && likesTarget.reason === 'likesTarget'
    && stranger.reason === 'distrustsYou'
    && harmless.reason === 'targetHarmless'
    && threat.reason === 'youAreTheThreat'
    && trusted.reason === 'alreadyWanted'
    && new Set(stances).size >= 3 && new Set(reasons).size === 6
    && falsePromises.lies > 0 && falsePromises.truths > 0
    && variety.distinct >= 25 && variety.leaks.length === 0
    && !errors.length;
  if (errors.length) console.log('!! errors:', errors.slice(0, 3));
  console.log(ok ? '\nBACKMEUP TEST PASS' : '\nBACKMEUP TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
