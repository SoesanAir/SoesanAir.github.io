/* Risky -> Share a secret must offer truth / lie / "I heard your name come up",
   and the warning picker must mark which accusations real intel backs.
   Run: node tools/warn-test.js */
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
    '--no-first-run', '--user-data-dir=' + os.tmpdir() + '\\cw-warn-' + RUN_ID,
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

  /* The reported flow: ask A about their vote (they name B), then go and warn B. */
  const setup = await ev(`(() => {
    const P = GAME.player;
    const pool = (GAME.merged ? alive() : aliveTribe(P.tribeName)).filter(c => !c.isPlayer);
    const accuser = pool[0], warned = pool[1], innocent = pool[2];
    GAME.intel = [];
    addIntel(accuser.name, 'claim', warned.name, 'sounded honest');   // you HEARD this
    warned.relationships.get(P.name).trust = 0.7;                     // will believe you
    warned.stats.gameAwareness = 0.25;
    return { accuser: accuser.name, accuserDn: accuser.displayName,
             warned: warned.name, warnedDn: warned.displayName,
             innocent: innocent.name, innocentDn: innocent.displayName };
  })()`);
  console.log(`flow: ${setup.accuserDn} named ${setup.warnedDn}; going to warn ${setup.warnedDn}`);

  const menu = await ev(`(() => {
    const npc = GAME.cast.find(c => c.name === ${JSON.stringify(setup.warned)});
    DLG.npc = npc; doShareSecret(npc);
    return [...document.querySelectorAll('#dlg-choices button')].map(b => b.textContent.trim());
  })()`);
  console.log('share menu :', JSON.stringify(menu));

  const picker = await ev(`(() => {
    const npc = GAME.cast.find(c => c.name === ${JSON.stringify(setup.warned)});
    warnNameMenu(npc);
    return [...document.querySelectorAll('#modal-body .cast-card')].map(c => ({
      name: c.querySelector('.cc-name').textContent,
      sub: c.querySelector('.cc-sub').textContent,
      cls: c.querySelector('.cc-sub').className
    }));
  })()`);
  const acc = picker.find(p => p.name === setup.accuserDn);
  const inn = picker.find(p => p.name === setup.innocentDn);
  console.log(`picker: ${acc.name} -> "${acc.sub}" [${acc.cls}]`);
  console.log(`        ${inn.name} -> "${inn.sub}" [${inn.cls}]`);

  /* Warning with real intel behind it. */
  const trueWarn = await ev(`(() => {
    Modal.close();
    const npc = GAME.cast.find(c => c.name === ${JSON.stringify(setup.warned)});
    const src = GAME.cast.find(c => c.name === ${JSON.stringify(setup.accuser)});
    const before = { trust: npc.getTrust(GAME.player.name), vwOnSrc: npc.getVW(src.name),
                     vwOnMe: npc.getVW(GAME.player.name) };
    doWarnName(npc, src);
    return { before, after: { trust: npc.getTrust(GAME.player.name), vwOnSrc: npc.getVW(src.name),
             vwOnMe: npc.getVW(GAME.player.name) } };
  })()`);
  const f = n => n.toFixed(3);
  console.log(`TRUE warn : trust ${f(trueWarn.before.trust)}->${f(trueWarn.after.trust)}` +
    `  vw on accuser ${f(trueWarn.before.vwOnSrc)}->${f(trueWarn.after.vwOnSrc)}` +
    `  vw on you ${f(trueWarn.before.vwOnMe)}->${f(trueWarn.after.vwOnMe)}`);

  /* Bluffing to a sharp, distrustful listener should get caught. */
  const bluff = await ev(`(() => {
    const npc = GAME.cast.find(c => c.name === ${JSON.stringify(setup.warned)});
    const src = GAME.cast.find(c => c.name === ${JSON.stringify(setup.innocent)});
    npc.relationships.get(GAME.player.name).trust = 0.05;
    npc.relationships.get(GAME.player.name).rel = 0.05;
    npc.stats.gameAwareness = 0.95;
    const before = { trust: npc.getTrust(GAME.player.name), vwOnMe: npc.getVW(GAME.player.name) };
    doWarnName(npc, src);
    return { before, after: { trust: npc.getTrust(GAME.player.name), vwOnMe: npc.getVW(GAME.player.name) },
             line: document.getElementById('dlg-text').textContent };
  })()`);
  await sleep(1200);
  const bluffLine = await ev(`document.getElementById('dlg-text').textContent`);
  console.log(`BLUFF     : trust ${f(bluff.before.trust)}->${f(bluff.after.trust)}` +
    `  vw on you ${f(bluff.before.vwOnMe)}->${f(bluff.after.vwOnMe)}` +
    `  (no reward for an unbacked warning)`);
  console.log(`            "${bluffLine}"`);

  /* With real secrets on the books the truth option must enable and list them. */
  const truth = await ev(`(() => {
    Modal.close();
    const npc = GAME.cast.find(c => c.name === ${JSON.stringify(setup.warned)});
    PlayerSecrets.add('PushedVote', ${JSON.stringify(setup.innocent)}, GAME.day);
    doShareSecret(npc);
    const btn = [...document.querySelectorAll('#dlg-choices button')][0];
    const label = btn.textContent.trim(), disabled = btn.disabled;
    btn.click();
    const items = [...document.querySelectorAll('#modal-body button')].map(b => b.textContent.trim());
    return { label, disabled, items };
  })()`);
  console.log('truth menu :', JSON.stringify(truth.items), ' enabled:', !truth.disabled);

  const lie = await ev(`(() => {
    const npc = GAME.cast.find(c => c.name === ${JSON.stringify(setup.warned)});
    shareLieMenu(npc);
    return [...document.querySelectorAll('#modal-body button')].map(b => b.textContent.trim()).slice(0, 3);
  })()`);
  console.log('lie menu  :', JSON.stringify(lie));

  const logTail = await ev(`DBG.text('alliance').split('\\n').filter(l=>/WarnName|FalseSecret/.test(l)).slice(-3).join('\\n')`);
  console.log('\n--- log ---\n' + logTail);

  const ok = menu.length === 4
    && /true/i.test(menu[0]) && /false/i.test(menu[1]) && /name come up/i.test(menu[2])
    && /you heard this/.test(acc.sub) && acc.cls.includes('intel')
    && /inventing/.test(inn.sub) && inn.cls.includes('invented')
    && trueWarn.after.trust > trueWarn.before.trust
    && trueWarn.after.vwOnSrc > trueWarn.before.vwOnSrc
    && trueWarn.after.vwOnMe < trueWarn.before.vwOnMe
    && bluff.after.vwOnMe >= bluff.before.vwOnMe
    && bluff.after.trust <= bluff.before.trust
    && lie.length >= 2
    && !truth.disabled && truth.items.length >= 1 && /pushing votes/.test(truth.items.join(' '))
    && !errors.length;
  if (errors.length) console.log('!! errors:', errors.slice(0, 3));
  console.log(ok ? '\nWARN TEST PASS' : '\nWARN TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
