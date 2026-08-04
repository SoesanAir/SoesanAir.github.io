/* Past-ballot mechanics:
   - "Who did you vote for last tribal?" only appears after a council
   - lying to the player about a council the player WITNESSED is flagged
   - the player can share their own ballot truthfully or falsely
   - lying to someone who sat at the same council is always busted
   - "I've been pushing votes onto X" retires once X leaves the game
   Run: node tools/pastvote-test.js */
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
    '--no-first-run', '--user-data-dir=' + os.tmpdir() + '\\cw-pv-' + RUN_ID,
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

  const askMenu = async name => await ev(`(() => {
    const npc = GAME.cast.find(c => c.name === ${JSON.stringify(name)});
    DLG.npc = npc; renderAskChoices(npc);
    return [...document.querySelectorAll('#dlg-choices button')].map(b => b.textContent.trim());
  })()`);

  const who = await ev(`(() => {
    const pool = aliveTribe(GAME.player.tribeName).filter(c => !c.isPlayer);
    return { a: pool[0].name, aDn: pool[0].displayName, b: pool[1].name, bDn: pool[1].displayName,
             victim: pool[2].name, victimDn: pool[2].displayName };
  })()`);

  const before = await askMenu(who.a);
  console.log('ask menu BEFORE any tribal :', before.some(x => /last tribal/i.test(x)) ? 'shows it (BAD)' : 'hidden (correct)');

  /* Run a council the player attends: A votes the victim, B votes A. */
  const tribal = await ev(`(() => {
    const P = GAME.player;
    const A = GAME.cast.find(c => c.name === ${JSON.stringify(who.a)});
    const B = GAME.cast.find(c => c.name === ${JSON.stringify(who.b)});
    const V = GAME.cast.find(c => c.name === ${JSON.stringify(who.victim)});
    const votes = new Map();
    votes.set(P.name, V); votes.set(A.name, V); votes.set(B.name, A);
    GAME.voteHistory = [];
    finishTribal(votes, V, aliveTribe(P.tribeName), true);   // interactive = witnessed
    return { hist: GAME.voteHistory.length, witnessed: GAME.voteHistory[0].witnessed,
             myVote: lastVoteOf(P.name).target, aVote: lastVoteOf(A.name).target };
  })()`);
  console.log(`council recorded: entries=${tribal.hist} witnessed=${tribal.witnessed} myVote=${tribal.myVote} A voted=${tribal.aVote}`);

  const after = await askMenu(who.a);
  console.log('ask menu AFTER a tribal    :', after.some(x => /last tribal/i.test(x)) ? 'shows it (correct)' : 'hidden (BAD)');

  /* Force the NPC to lie about a council the player watched. */
  const lieCaught = await ev(`(() => {
    const npc = GAME.cast.find(c => c.name === ${JSON.stringify(who.a)});
    const P = GAME.player;
    npc.relationships.get(P.name).trust = 0.0;   // pushes npcTruthfulness to Lie
    npc.cluster = 'Paranoid Schemer';
    npc.stats.emotional = 0.1;
    const trustBefore = P.getTrust(npc.name);
    let tries = 0, caught = false;
    while (tries++ < 40 && !caught) {
      doAskLastVote(npc);
      caught = GAME.intel.some(e => e.who === npc.name && e.note === 'contradicts the reveal');
    }
    return { caught, tries, playerTrustBefore: trustBefore, playerTrustAfter: P.getTrust(npc.name) };
  })()`);
  await sleep(900);
  const lieLine = await ev(`document.getElementById('dlg-text').textContent`);
  console.log(`witnessed lie flagged: ${lieCaught.caught} (after ${lieCaught.tries} asks)`);
  console.log(`  your trust in them ${lieCaught.playerTrustBefore.toFixed(3)} -> ${lieCaught.playerTrustAfter.toFixed(3)}`);
  console.log(`  line: "${lieLine.slice(0, 110)}"`);

  /* Share own vote: picker must mark the truth, and warn when they were there. */
  const picker = await ev(`(() => {
    const npc = GAME.cast.find(c => c.name === ${JSON.stringify(who.b)});
    shareMyVoteMenu(npc);
    return { note: document.querySelector('#modal-body .tiny').textContent,
             cards: [...document.querySelectorAll('#modal-body .cast-card')].map(c => ({
               name: c.querySelector('.cc-name').textContent,
               sub: c.querySelector('.cc-sub').textContent })) };
  })()`);
  console.log('share-vote note :', JSON.stringify(picker.note.slice(0, 70)));
  picker.cards.forEach(c => console.log(`   ${c.name} -> ${c.sub}`));

  /* Lying to a witness must always bust. */
  const busted = await ev(`(() => {
    Modal.close();
    const npc = GAME.cast.find(c => c.name === ${JSON.stringify(who.b)});
    const wrong = GAME.cast.find(c => c.name === ${JSON.stringify(who.a)});
    const mine = lastVoteOf(GAME.player.name);
    const before = { trust: npc.getTrust(GAME.player.name), vw: npc.getVW(GAME.player.name) };
    doShareMyVote(npc, wrong, mine);
    return { before, after: { trust: npc.getTrust(GAME.player.name), vw: npc.getVW(GAME.player.name) } };
  })()`);
  console.log(`lie to witness  : trust ${busted.before.trust.toFixed(3)}->${busted.after.trust.toFixed(3)}` +
    `  vw ${busted.before.vw.toFixed(3)}->${busted.after.vw.toFixed(3)}`);

  /* Honest matching vote should pay well. */
  const aligned = await ev(`(() => {
    const npc = GAME.cast.find(c => c.name === ${JSON.stringify(who.a)});
    const V = GAME.cast.find(c => c.name === ${JSON.stringify(who.victim)});
    const mine = lastVoteOf(GAME.player.name);
    npc.relationships.get(GAME.player.name).trust = 0.5;
    const before = npc.getTrust(GAME.player.name);
    doShareMyVote(npc, V, mine);
    return { before, after: npc.getTrust(GAME.player.name) };
  })()`);
  console.log(`honest aligned  : trust ${aligned.before.toFixed(3)}->${aligned.after.toFixed(3)}`);

  /* A pushed-vote secret about someone eliminated must drop off the list. */
  const secrets = await ev(`(() => {
    const npc = GAME.cast.find(c => c.name === ${JSON.stringify(who.b)});
    const V = GAME.cast.find(c => c.name === ${JSON.stringify(who.victim)});
    PlayerSecrets.list = [];
    PlayerSecrets.add('PushedVote', V.name, 1);              // V is eliminated
    PlayerSecrets.add('PushedVote', ${JSON.stringify(who.a)}, 1);  // still in the game
    const all = PlayerSecrets.unknownTo(npc.name).length;
    const live = liveSecrets(PlayerSecrets.unknownTo(npc.name)).map(s => dnOf(s.subject));
    return { eliminated: V.eliminated, all, live };
  })()`);
  console.log(`secrets: victim eliminated=${secrets.eliminated} total=${secrets.all} offered=${JSON.stringify(secrets.live)}`);

  const logTail = await ev(`DBG.text('alliance').split('\\n').filter(l=>/PastVote|ShareOwnVote/.test(l)).slice(-4).join('\\n')`);
  console.log('\n--- log ---\n' + logTail);

  const ok = !before.some(x => /last tribal/i.test(x))
    && after.some(x => /last tribal/i.test(x))
    && lieCaught.caught && lieCaught.playerTrustAfter < lieCaught.playerTrustBefore
    && /sat at that council|saw the reveal/i.test(picker.note)
    && picker.cards.some(c => /the truth/.test(c.sub))
    && picker.cards.some(c => /they were there/.test(c.sub))
    && busted.after.trust < busted.before.trust && busted.after.vw > busted.before.vw
    && aligned.after > aligned.before
    && secrets.all === 2 && secrets.live.length === 1 && !secrets.live.includes(who.victimDn)
    && !errors.length;
  if (errors.length) console.log('!! errors:', errors.slice(0, 3));
  console.log(ok ? '\nPASTVOTE TEST PASS' : '\nPASTVOTE TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
