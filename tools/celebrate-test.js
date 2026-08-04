/* "That vote worked": the action must only appear for a partner who wrote the
   same name on a vote that landed, must reward the shared win, must go stale,
   must not be repeatable, and must backfire when the partner liked the target.
   Run: node tools/celebrate-test.js */
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
    '--no-first-run', '--user-data-dir=' + os.tmpdir() + '\\cw-celeb-' + RUN_ID,
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
  const waitFor = async s => { for (let i = 0; i < 60; i++) { if (await ev(`!!document.querySelector(${JSON.stringify(s)})`)) return; await sleep(250); } console.log('!! page errors:', errors.slice(0,4)); throw new Error('no ' + s); };

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

  /* Run a real tribal where the player and one NPC both write the same name. */
  const setup = await ev(`(() => {
    const P = GAME.player;
    const pool = aliveTribe(P.tribeName).filter(c => !c.isPlayer);
    const partner = pool[0], sour = pool[1], victim = pool[2];
    partner.cluster = 'Loyal Follower';           // warm reactor
    sour.cluster = 'Loyal Follower';
    partner.relationships.get(victim.name).rel = 0.20;   // did not like the victim
    partner.relationships.get(P.name).trust = 0.52;      // enough to formalise on a win
    sour.relationships.get(victim.name).rel = 0.85;      // liked the victim a lot
    const votes = new Map();
    votes.set(P.name, victim);
    votes.set(partner.name, victim);
    votes.set(sour.name, victim);
    GAME.sharedWins = [];
    finishTribal(votes, victim, aliveTribe(P.tribeName), true);
    return { partner: partner.name, partnerDn: partner.displayName,
             sour: sour.name, sourDn: sour.displayName,
             victimDn: victim.displayName, wins: GAME.sharedWins.length };
  })()`);
  console.log('shared wins recorded:', setup.wins, `(partner=${setup.partnerDn}, sour=${setup.sourDn}, victim=${setup.victimDn})`);

  const menuHas = async name => await ev(`(() => {
    const npc = GAME.cast.find(c => c.name === ${JSON.stringify(name)});
    renderAllianceChoices(npc);
    return [...document.querySelectorAll('#dlg-choices button')].map(b => b.textContent).join(' | ');
  })()`);
  const m1 = await menuHas(setup.partner);
  console.log('menu offers celebrate:', /vote worked/.test(m1));

  // a castaway who did NOT share the vote must not see it
  const stranger = await ev(`(() => {
    const p = GAME.player;
    const other = alive().find(c => !c.isPlayer && !GAME.sharedWins.some(w => w.name === c.name));
    if (!other) return 'none';
    renderAllianceChoices(other);
    return [...document.querySelectorAll('#dlg-choices button')].map(b => b.textContent).join(' | ');
  })()`);
  console.log('non-partner offered it :', /vote worked/.test(stranger));

  /* Celebrate with the partner who disliked the victim -> should land. */
  const good = await ev(`(() => {
    const npc = GAME.cast.find(c => c.name === ${JSON.stringify(setup.partner)});
    const P = GAME.player;
    const before = { trust: npc.getTrust(P.name), rel: npc.getRel(P.name),
                     vw: npc.getVW(P.name), morale: npc.morale, lvl: PlayerAlliances.level(npc.name) };
    doCelebrateVote(npc);
    return { before, after: { trust: npc.getTrust(P.name), rel: npc.getRel(P.name),
             vw: npc.getVW(P.name), morale: npc.morale, lvl: PlayerAlliances.level(npc.name) },
             secrets: PlayerSecrets.list.filter(s => s.type === 'Blindside').length,
             mem: npc.memories.filter(m => typeof m === 'string' && m.startsWith('sharedwin:')).length };
  })()`);
  const f = n => n.toFixed(3);
  console.log(`landed  trust ${f(good.before.trust)}->${f(good.after.trust)}  bond ${f(good.before.rel)}->${f(good.after.rel)}`);
  console.log(`        voteWeight ${f(good.before.vw)}->${f(good.after.vw)}  morale ${f(good.before.morale)}->${f(good.after.morale)}`);
  console.log(`        alliance lvl ${good.before.lvl}->${good.after.lvl}  secret=${good.secrets} memory=${good.mem}`);

  // not repeatable
  const again = await menuHas(setup.partner);
  console.log('repeatable            :', /vote worked/.test(again));

  /* The partner who liked the victim should recoil instead. */
  const sour = await ev(`(() => {
    const npc = GAME.cast.find(c => c.name === ${JSON.stringify(setup.sour)});
    const P = GAME.player;
    const before = { trust: npc.getTrust(P.name), vw: npc.getVW(P.name) };
    doCelebrateVote(npc);
    return { before, after: { trust: npc.getTrust(P.name), vw: npc.getVW(P.name) } };
  })()`);
  console.log(`backfire trust ${f(sour.before.trust)}->${f(sour.after.trust)}  voteWeight ${f(sour.before.vw)}->${f(sour.after.vw)}`);

  // goes stale after a couple of days
  const stale = await ev(`(() => {
    GAME.sharedWins.forEach(w => w.celebrated = false);
    GAME.day += 3;
    const npc = GAME.cast.find(c => c.name === ${JSON.stringify(setup.partner)});
    renderAllianceChoices(npc);
    return [...document.querySelectorAll('#dlg-choices button')].map(b => b.textContent).join(' | ');
  })()`);
  console.log('still offered 3 days later:', /vote worked/.test(stale));

  const logTail = await ev(`DBG.text('alliance').split('\\n').filter(l=>/Celebrate|SharedWin/.test(l)).slice(-4).join('\\n')`);
  console.log('\n--- log ---\n' + logTail);

  const ok = setup.wins === 2
    && /vote worked/.test(m1) && !/vote worked/.test(stranger)
    && good.after.trust > good.before.trust && good.after.rel > good.before.rel
    && good.after.vw < good.before.vw && good.after.morale > good.before.morale
    && good.after.lvl > good.before.lvl && good.secrets === 1 && good.mem === 1
    && !/vote worked/.test(again)
    && sour.after.trust < sour.before.trust && sour.after.vw > sour.before.vw
    && !/vote worked/.test(stale)
    && !errors.length;
  if (errors.length) console.log('!! page errors:', errors.slice(0, 3));
  console.log(ok ? '\nCELEBRATE TEST PASS' : '\nCELEBRATE TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
