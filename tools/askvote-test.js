/* "Who are you thinking of voting?" must usually produce a NAME. Measures the
   real distribution across the whole cast on a non-tribal day (the case that was
   broken: vote weights are only seeded on tribal mornings).
   Run: node tools/askvote-test.js */
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
    '--no-first-run', '--user-data-dir=' + os.tmpdir() + '\\cw-av-' + RUN_ID,
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
  ws.on('message', m => { const j = JSON.parse(m); if (j.method === 'Runtime.exceptionThrown') { const d = (j.params.exceptionDetails.exception || {}).description || j.params.exceptionDetails.text; if (d && d !== 'Event') errors.push(d); } });
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

  /* Day 1, no seeding has run — exactly the situation that always dodged. */
  const run = async (label, prep) => {
    const r = await ev(`(() => {
      ${prep || ''}
      const pool = (GAME.merged ? alive() : aliveTribe(GAME.player.tribeName)).filter(c => !c.isPlayer);
      let named = 0, dodged = 0, lies = 0, truths = 0, leansFound = 0;
      const samples = [];
      for (let round = 0; round < 30; round++) {
        for (const npc of pool) {
          const lean = npcLeanTarget(npc);
          if (lean) leansFound++;
          const before = GAME.intel.length;
          doAskThinking(npc);
          const e = GAME.intel[GAME.intel.length - 1];
          if (e && e.kind === 'claim' && e.target) {
            named++;
            const truthful = lean && e.target === lean.target.name;
            if (truthful) truths++; else lies++;
            if (samples.length < 5) samples.push(npc.displayName + ' -> ' + dnOf(e.target) + (truthful ? '' : ' (lying)'));
          } else {
            dodged++;
            if (samples.length < 5) samples.push(npc.displayName + ' -> dodged');
          }
        }
      }
      const total = named + dodged;
      return { total, named, dodged, lies, truths, leansFound,
               pctNamed: Math.round(named / total * 100), samples };
    })()`);
    console.log(`\n${label}`);
    console.log(`  asks=${r.total}  gave a name=${r.named} (${r.pctNamed}%)  dodged=${r.dodged} (${100 - r.pctNamed}%)`);
    console.log(`  of the names: truthful=${r.truths} lying=${r.lies}   leans computed=${r.leansFound}/${r.total}`);
    r.samples.forEach(s => console.log('   ' + s));
    return r;
  };

  const day1 = await run('DAY 1, no vote seeding (the broken case)');
  const tribal = await run('TRIBAL DAY, after seeding',
    `GAME.day = CONFIG.tribalDays[0]; seedVoteWeights(GAME.cast, GAME.merged, GAME.player.name);`);
  const trusted = await run('AS A TRUSTED ALLY OF EVERYONE',
    `const P = GAME.player;
     (GAME.merged ? alive() : aliveTribe(P.tribeName)).forEach(c => {
       if (c.isPlayer) return;
       c.relationships.get(P.name).trust = 0.8;
       c.relationships.get(P.name).rel = 0.8;
       PlayerAlliances.align(c.name, 1); PlayerAlliances.promise(c.name, 1);
     });`);

  const log = await ev(`DBG.text('action').split('\\n').filter(l=>/Ask who they are voting/.test(l)).slice(-3).join('\\n')`);
  console.log('\n--- log ---\n' + log);

  /* Names should be the norm, dodging the exception — but never zero, and
     trusted allies should open up more than strangers. */
  const ok = day1.pctNamed >= 60 && day1.pctNamed <= 93
    && day1.dodged > 0
    && day1.leansFound === day1.total
    && tribal.pctNamed >= 60
    && trusted.pctNamed >= day1.pctNamed
    && day1.truths > 0 && day1.lies > 0
    && !errors.length;
  if (errors.length) console.log('!! errors:', errors.slice(0, 3));
  console.log(ok ? '\nASKVOTE TEST PASS' : '\nASKVOTE TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
