/* Reproduce the reported bug and prove the fix:
   asking an ally to bring someone in produced "that mix doesn't work,
   <the speaker's own name> worries me", and vouching for the candidate did
   nothing because no player action moved NPC-to-NPC trust.

   Run: node tools/circle-test.js   (static server on :8099, `ws` installed) */
const http = require('http'), { spawn } = require('child_process'), os = require('os'), fs = require('fs');
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
    '--user-data-dir=' + os.tmpdir() + '\\cw-circle-' + RUN_ID, 'http://localhost:8099/index.html?no3d=1'], { stdio: 'ignore' });
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
  ws.on('message', m => { const j = JSON.parse(m); if (j.method === 'Runtime.exceptionThrown') { if (j.params.exceptionDetails.text !== 'Uncaught') errors.push(j.params.exceptionDetails.text); }; });

  const waitFor = async sel => { for (let i = 0; i < 60; i++) { if (await ev(`!!document.querySelector(${JSON.stringify(sel)})`)) return; await sleep(250); } throw new Error('no ' + sel); };
  await waitFor('#screen-title.active');
  await sleep(200);
  await ev(`document.getElementById('btn-new-game').click()`);
  await waitFor('#screen-create.active');
  await ev(`GAME.fastMaroon = true; document.getElementById('btn-create-go').click()`);
  // skip the marooning opener
  for (let i = 0; i < 80; i++) {
    if (await ev(`(() => { const b = document.querySelector('#maroon-choices button'); if (b) { b.click(); return true; } return false; })()`)) await sleep(120);
    else if (await ev(`!!document.querySelector('#screen-camp.active')`)) break;
    else await sleep(150);
  }
  await waitFor('#screen-camp.active');
  await waitFor('#figures .bfig');
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>/skip tutorial/i.test(b.textContent)); if(b)b.click();})()`);
  await sleep(800);

  /* Set up exactly the reported situation: an ally in a circle with the player,
     plus a candidate the ally is cold on. */
  const setup = await ev(`(() => {
    const P = GAME.player;
    const pool = alive().filter(c => !c.isPlayer && c.tribeName === P.tribeName);
    const ally = pool[0], cand = pool[1];
    // ally is a solid ally of the player
    ally.relationships.get(P.name).trust = 0.75;
    ally.relationships.get(P.name).rel = 0.75;
    cand.relationships.get(P.name).trust = 0.70;   // candidate trusts the player
    cand.relationships.get(P.name).rel = 0.70;
    // ally <-> cand deliberately cold, the state that blocks admission
    ally.relationships.get(cand.name).trust = 0.20;
    ally.relationships.get(cand.name).rel = 0.20;
    cand.relationships.get(ally.name).trust = 0.20;
    cand.relationships.get(ally.name).rel = 0.20;
    PlayerAlliances.reset();
    Coalitions.reset();
    Coalitions.form([P.name, ally.name], GAME.day);
    return { ally: ally.name, allyDn: ally.displayName, cand: cand.name, candDn: cand.displayName };
  })()`);
  console.log('setup      :', `ally=${setup.allyDn}  candidate=${setup.candDn}`);

  const invite = async () => { const r = await ev(`(() => {
    const ally = GAME.cast.find(c => c.name === ${JSON.stringify(setup.ally)});
    const cand = GAME.cast.find(c => c.name === ${JSON.stringify(setup.cand)});
    const circle = Coalitions.active(GAME.player.name);
    tryAddToCircle(ally, cand, circle);
    const inC = Coalitions.active(GAME.player.name).members.includes(cand.name);
    return { line: document.getElementById('dlg-text').textContent, joined: inC,
             allyToCand: +ally.getTrust(cand.name).toFixed(3),
             candToAlly: +cand.getTrust(ally.name).toFixed(3) };
  })()`); await sleep(1400);
    r.line = await ev(`document.getElementById('dlg-text').textContent`);
    return r; };

  const r1 = await invite();
  console.log('refusal    :', JSON.stringify(r1.line));
  console.log('            joined=' + r1.joined);

  // The bug: the speaker naming themselves, or naming the candidate as the objector.
  const namesSelf = new RegExp(setup.allyDn + "(?![a-z])").test(r1.line) &&
    /worries me|don.t trust them|hard pass|isn.t warm on|reads .* as a threat/i.test(r1.line);
  console.log('speaker names itself as the distrusted party :', namesSelf, namesSelf ? ' <-- BUG' : '');

  /* Vouch for the candidate to the ally a few times. This must actually move
     ally -> candidate trust, which is what was missing entirely before. */
  const vouch = async () => await ev(`(() => {
    const ally = GAME.cast.find(c => c.name === ${JSON.stringify(setup.ally)});
    const cand = GAME.cast.find(c => c.name === ${JSON.stringify(setup.cand)});
    const before = ally.getTrust(cand.name);
    doDefend(ally, cand);
    return { before: +before.toFixed(3), after: +ally.getTrust(cand.name).toFixed(3) };
  })()`);
  const v1 = await vouch();
  console.log('vouch #1   :', `ally->cand trust ${v1.before} -> ${v1.after} (moved=${v1.after > v1.before})`);
  for (let i = 0; i < 5; i++) await vouch();
  // and warm the candidate back toward the ally the same way
  await ev(`(() => {
    const ally = GAME.cast.find(c => c.name === ${JSON.stringify(setup.ally)});
    const cand = GAME.cast.find(c => c.name === ${JSON.stringify(setup.cand)});
    for (let i = 0; i < 6; i++) doDefend(cand, ally);
    return true;
  })()`);

  const r2 = await invite();
  console.log('after vouching:', `allyToCand=${r2.allyToCand} candToAlly=${r2.candToAlly} joined=${r2.joined}`);
  console.log('accept line  :', JSON.stringify(r2.line));

  const logSample = await ev(`DBG.text('alliance').split('\\n').slice(-6).join('\\n')`);
  console.log('\n--- log tail (alliance) ---\n' + logSample);
  const counts = await ev(`({ total: DBG.count(), text: DBG.text().length })`);
  console.log('\nlog lines:', counts.total, 'chars:', counts.text);

  const ok = !r1.joined && !namesSelf && r1.line.includes(setup.candDn)
    && v1.after > v1.before && r2.joined && !errors.length;
  if (errors.length) console.log('!! errors:', errors.slice(0, 3));
  console.log(ok ? '\nCIRCLE TEST PASS' : '\nCIRCLE TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
