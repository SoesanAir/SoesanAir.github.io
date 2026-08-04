/* Responding when YOUR name was read out at tribal — five routes:
   ask why / confront / absolve / mark / lean on an ally for protection.
   Run: node tools/named-test.js */
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
    '--no-first-run', '--user-data-dir=' + os.tmpdir() + '\\cw-named-' + RUN_ID,
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

  const cast = await ev(`(() => {
    const pool = aliveTribe(GAME.player.tribeName).filter(c => !c.isPlayer);
    return { v1: pool[0].name, v1Dn: pool[0].displayName, v2: pool[1].name, v2Dn: pool[1].displayName,
             v3: pool[2].name, v3Dn: pool[2].displayName, ally: pool[3].name, allyDn: pool[3].displayName,
             victim: pool[4].name, friend: pool[5].name };
  })()`);

  const noVotes = await ev(`(() => {
    GAME.voteHistory = []; GAME.namedResponses = [];
    const npc = GAME.cast.find(c => c.name === ${JSON.stringify(cast.v1)});
    DLG.npc = npc; renderTalkChoices(npc);
    return [...document.querySelectorAll('#dlg-choices button')].map(b => b.textContent.trim());
  })()`);
  console.log('talk menu with NO votes against you:', noVotes.some(x => /wrote my name/.test(x)) ? 'shows (BAD)' : 'hidden (correct)');

  /* A council the player sat through where three people wrote their name. */
  const setup = await ev(`(() => {
    const P = GAME.player;
    const V1 = GAME.cast.find(c => c.name === ${JSON.stringify(cast.v1)});
    const V2 = GAME.cast.find(c => c.name === ${JSON.stringify(cast.v2)});
    const V3 = GAME.cast.find(c => c.name === ${JSON.stringify(cast.v3)});
    const ally = GAME.cast.find(c => c.name === ${JSON.stringify(cast.ally)});
    const victim = GAME.cast.find(c => c.name === ${JSON.stringify(cast.victim)});
    GAME.namedResponses = []; GAME.voteHistory = [];
    const votes = new Map();
    votes.set(P.name, victim); votes.set(ally.name, victim);
    votes.set(V1.name, P); votes.set(V2.name, P); votes.set(V3.name, P);
    finishTribal(votes, victim, aliveTribe(P.tribeName), true);
    // the real instigator: biggest vote weight on the player
    V3.addVW(P.name, 3.0);
    return { voters: votesAgainstPlayer().voters.length };
  })()`);
  console.log('votes against you recorded:', setup.voters);

  const menu = await ev(`(() => {
    const npc = GAME.cast.find(c => c.name === ${JSON.stringify(cast.v1)});
    DLG.npc = npc; renderTalkChoices(npc);
    const top = [...document.querySelectorAll('#dlg-choices button')].map(b => b.textContent.trim());
    renderNamedChoices(npc);
    return { top, sub: [...document.querySelectorAll('#dlg-choices button')].map(b => b.textContent.trim()) };
  })()`);
  console.log('talk menu now flags it:', menu.top.some(x => /wrote my name/.test(x)));
  console.log('five responses:'); menu.sub.forEach(x => console.log('   ' + x));

  const probe = async (label, js) => {
    const r = await ev(`(() => { ${js} })()`);
    await sleep(900);
    const line = await ev(`document.getElementById('dlg-text').textContent`);
    console.log(`\n${label}`);
    Object.entries(r).forEach(([k, val]) => console.log(`  ${k}: ${typeof val === 'number' ? val.toFixed(3) : JSON.stringify(val)}`));
    console.log(`  "${line.slice(0, 100)}"`);
    return r;
  };

  const why = await probe('1. ASK WHY (forced truthful)', `
    const npc = GAME.cast.find(c => c.name === ${JSON.stringify(cast.v1)});
    npc.relationships.get(GAME.player.name).trust = 0.95;
    npc.cluster = 'Loyal Follower'; npc.stats.emotional = 0.9;
    const before = GAME.intel.length;
    doAskWhyMe(npc, votesAgainstPlayer());
    const e = GAME.intel[GAME.intel.length - 1];
    return { intelKind: e.kind, pointedAt: e.target ? dnOf(e.target) : null, note: e.note || '' };`);

  const fold = await probe('2. CONFRONT a soft ally (should fold)', `
    const npc = GAME.cast.find(c => c.name === ${JSON.stringify(cast.v1)});
    const P = GAME.player;
    npc.relationships.get(P.name).trust = 0.7; npc.stats.emotional = 0.8;
    npc.resetVW();
    const b = { trust: npc.getTrust(P.name), vw: npc.getVW(P.name) };
    doConfrontVote(npc, votesAgainstPlayer());
    return { trustBefore: b.trust, trustAfter: npc.getTrust(P.name),
             vwBefore: b.vw, vwAfter: npc.getVW(P.name) };`);

  const own = await probe('2b. CONFRONT a hostile hardliner (should own it)', `
    const npc = GAME.cast.find(c => c.name === ${JSON.stringify(cast.v2)});
    const P = GAME.player;
    npc.relationships.get(P.name).trust = 0.2; npc.stats.emotional = 0.2;
    npc.cluster = 'Physical Threat'; npc.resetVW();
    const b = { trust: npc.getTrust(P.name), vw: npc.getVW(P.name) };
    doConfrontVote(npc, votesAgainstPlayer());
    return { trustBefore: b.trust, trustAfter: npc.getTrust(P.name),
             vwBefore: b.vw, vwAfter: npc.getVW(P.name),
             grudge: npc.relEntry(P.name).grudge };`);

  const absolve = await probe('3. ABSOLVE a decent voter', `
    const npc = GAME.cast.find(c => c.name === ${JSON.stringify(cast.v3)});
    const P = GAME.player;
    npc.cluster = 'Camp Provider';
    npc.relationships.get(P.name).trust = 0.55; npc.resetVW();
    const b = { trust: npc.getTrust(P.name), vw: npc.getVW(P.name), morale: npc.morale };
    doAbsolveVoter(npc, votesAgainstPlayer());
    return { trustBefore: b.trust, trustAfter: npc.getTrust(P.name),
             vwBefore: b.vw, vwAfter: npc.getVW(P.name),
             moraleUp: npc.morale > b.morale };`);

  const mark = await probe('4. MARK a voter (vendetta)', `
    const npc = GAME.cast.find(c => c.name === ${JSON.stringify(cast.v2)});
    const P = GAME.player;
    GAME.namedResponses = GAME.namedResponses.filter(k => !k.includes('|mark'));
    // give the tribe clear opinions of them so both reactions can fire
    aliveTribe(P.tribeName).forEach((c, i) => {
      if (c.isPlayer || c === npc) return;
      c.relationships.get(npc.name).rel = i % 2 ? 0.2 : 0.8;
      c.relationships.get(P.name).trust = 0.6;
    });
    const others = aliveTribe(P.tribeName).filter(c => !c.isPlayer && c !== npc);
    const vwBefore = others.map(c => c.getVW(npc.name));
    doMarkVoter(npc, votesAgainstPlayer());
    const joined = others.filter((c, i) => c.getVW(npc.name) > vwBefore[i]).length;
    const closedRanks = others.filter(c => c.getVW(P.name) > 0).length;
    return { joined, closedRanks, theirVwOnYou: npc.getVW(P.name), grudge: npc.relEntry(P.name).grudge };`);

  const protect = await probe('5. LEAN ON AN ALLY who did not vote you', `
    const npc = GAME.cast.find(c => c.name === ${JSON.stringify(cast.ally)});
    const P = GAME.player;
    npc.relationships.get(P.name).trust = 0.7; npc.resetVW();
    PlayerAlliances.reset(); PlayerAlliances.align(npc.name, GAME.day);
    const v = votesAgainstPlayer();
    const before = { lvl: PlayerAlliances.level(npc.name), onVoter: npc.getVW(v.voters[0]) };
    doDemandProtection(npc);
    return { lvlBefore: before.lvl, lvlAfter: PlayerAlliances.level(npc.name),
             vwOnVoterBefore: before.onVoter, vwOnVoterAfter: npc.getVW(v.voters[0]) };`);

  const betrayal = await probe('5b. LEAN ON AN "ALLY" WHO WROTE YOUR NAME', `
    const npc = GAME.cast.find(c => c.name === ${JSON.stringify(cast.v1)});
    const P = GAME.player;
    GAME.namedResponses = GAME.namedResponses.filter(k => !k.includes('|protect'));
    PlayerAlliances.reset(); PlayerAlliances.align(npc.name, GAME.day); PlayerAlliances.promise(npc.name, GAME.day);
    const before = { lvl: PlayerAlliances.level(npc.name), trust: npc.getTrust(P.name) };
    doDemandProtection(npc);
    return { lvlBefore: before.lvl, lvlAfter: PlayerAlliances.level(npc.name),
             trustBefore: before.trust, trustAfter: npc.getTrust(P.name) };`);

  const once = await ev(`(() => {
    const npc = GAME.cast.find(c => c.name === ${JSON.stringify(cast.v3)});
    renderNamedChoices(npc);
    const btns = [...document.querySelectorAll('#dlg-choices button')];
    return btns.filter(b => b.disabled).map(b => b.textContent.trim());
  })()`);
  console.log('\nalready-used responses disabled:', JSON.stringify(once));

  const stale = await ev(`(() => { GAME.day += 3; return !!votesAgainstPlayer(); })()`);
  console.log('still offered 3 days later:', stale);

  const log = await ev(`DBG.text('alliance').split('\\n').filter(l=>/NamedResponse/.test(l)).slice(-7).join('\\n')`);
  console.log('\n--- log ---\n' + log);

  const ok = !noVotes.some(x => /wrote my name/.test(x))
    && setup.voters === 3
    && menu.top.some(x => /wrote my name/.test(x)) && menu.sub.length === 5
    && why.intelKind === 'heat' && why.pointedAt
    && fold.trustAfter > fold.trustBefore && fold.vwAfter < fold.vwBefore
    && own.trustAfter < own.trustBefore && own.vwAfter > own.vwBefore && own.grudge > 0
    && absolve.trustAfter > absolve.trustBefore && absolve.vwAfter < absolve.vwBefore && absolve.moraleUp
    && mark.joined > 0 && mark.closedRanks > 0 && mark.theirVwOnYou > 0 && mark.grudge > 0
    && protect.lvlAfter > protect.lvlBefore && protect.vwOnVoterAfter > protect.vwOnVoterBefore
    && betrayal.lvlAfter === 0 && betrayal.trustAfter < betrayal.trustBefore
    && once.length > 0 && stale === false
    && !errors.length;
  if (errors.length) console.log('!! errors:', errors.slice(0, 3));
  console.log(ok ? '\nNAMED TEST PASS' : '\nNAMED TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
