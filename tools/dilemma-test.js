/* Dilemmas must arrive unasked, every option must cost something, and the claim
   may be false without the game revealing it.
   Run: node tools/dilemma-test.js */
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
    '--no-first-run', '--window-size=900,430', '--force-device-scale-factor=2.2',
    '--user-data-dir=' + os.tmpdir() + '\\cw-dil-' + RUN_ID, 'http://localhost:8099/index.html?no3d=1'], { stdio: 'ignore' });
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
  for (let i = 0; i < 120; i++) {
    if (await ev(`!!document.querySelector('#screen-camp.active')`)) break;
    if (await ev(`(() => { const b = document.querySelector('#maroon-choices button'); if (b) { b.click(); return true; } return false; })()`)) await sleep(120);
    else await sleep(150);
  }
  if (!await ev(`!!document.querySelector('#screen-camp.active')`)) {
    console.log('DIAG active =', await ev(`(document.querySelector('.screen.active')||{}).id`),
      '| maroon buttons =', await ev(`document.querySelectorAll('#maroon-choices button').length`),
      '| modal open =', await ev(`document.getElementById('modal-veil').classList.contains('open')`));
  }
  await waitFor('#screen-camp.active'); await waitFor('#figures .bfig');
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>/skip tutorial/i.test(b.textContent));if(b)b.click();})()`);
  await sleep(600);

  /* Give the world enough state that every dilemma can trigger. */
  await ev(`(() => {
    const P = GAME.player;
    GAME.day = 5;
    const pool = alive().filter(c => !c.isPlayer);
    pool.slice(0, 6).forEach(c => {
      c.relationships.get(P.name).trust = 0.65;
      c.relationships.get(P.name).rel = 0.65;
      c.relEntry(P.name).suspicion = 0.2;
    });
    PlayerAlliances.reset();
    PlayerAlliances.align(pool[0].name, 1); PlayerAlliances.promise(pool[0].name, 1);
    PlayerSecrets.list = [];
    PlayerSecrets.add('PushedVote', pool[3].name, 3);
    GAME.voteHistory = [{ day: 3, eliminated: pool[5].name, witnessed: true,
      votes: [[P.name, pool[5].name], [pool[0].name, P.name], [pool[1].name, pool[5].name]] }];
    return true;
  })()`);

  /* Which kinds can fire at all? */
  const usable = await ev(`DILEMMA_KINDS.filter(k => k.can()).map(k => k.id)`);
  console.log('dilemma kinds that can fire:', JSON.stringify(usable));

  /* Run each kind and check the shape: it opens unasked, has >=3 options, and
     every option shows a stated cost. */
  const shapes = [];
  for (const kindId of usable) {
    const r = await ev(`(() => {
      Modal.close();
      const k = DILEMMA_KINDS.find(x => x.id === ${JSON.stringify(kindId)});
      k.run();
      const body = document.getElementById('modal-body');
      const opts = [...body.querySelectorAll('.dilemma-opts .maroon-opt')];
      return {
        id: ${JSON.stringify(kindId)},
        open: document.getElementById('modal-veil').classList.contains('open'),
        title: document.getElementById('modal-title').textContent,
        portrait: !!body.querySelector('.cast-card .portrait img'),
        bars: body.querySelectorAll('.cast-card .cc-bars .meter').length,
        options: opts.length,
        allHaveCost: opts.every(o => { const t = o.querySelector('.maroon-think'); return t && t.textContent.trim().length > 6; }),
        warn: !!body.querySelector('.dilemma-warn'),
        claim: (body.querySelector('.probe-said') || {}).textContent || ''
      };
    })()`);
    shapes.push(r);
    console.log(`  ${r.id.padEnd(21)} opts=${r.options} costs=${r.allHaveCost} portrait=${r.portrait} bars=${r.bars}`);
    console.log(`     "${r.title}"`);
    if (r.claim) console.log(`     ${r.claim.slice(0, 96)}`);
  }

  /* Consequences: picking an option must actually move numbers. */
  const consequence = await ev(`(() => {
    Modal.close();
    const P = GAME.player;
    const before = alive().filter(c => !c.isPlayer)
      .map(c => c.getTrust(P.name) + c.getRel(P.name) + c.getVW(P.name));
    const k = DILEMMA_KINDS.find(x => x.id === 'rumour-about-you');
    k.run();
    document.querySelector('#modal-body .dilemma-opts button').click();
    const after = alive().filter(c => !c.isPlayer)
      .map(c => c.getTrust(P.name) + c.getRel(P.name) + c.getVW(P.name));
    const moved = before.filter((v, i) => Math.abs(v - after[i]) > 0.0001).length;
    return { moved, of: before.length };
  })()`);
  console.log(`\nchoosing an option moved ${consequence.moved}/${consequence.of} relationships`);

  /* The truth of a claim must vary — sometimes the rumour is real. */
  const truthMix = await ev(`(() => {
    let real = 0, fake = 0;
    for (let i = 0; i < 60; i++) {
      Modal.close();
      const before = DBG.count();
      DILEMMA_KINDS.find(x => x.id === 'rumour-about-you').run();
      const txt = DBG.text('sim');
      const last = txt.split('\\n').filter(l => l.indexOf('Dilemma rumour') >= 0).pop() || '';
      if (last.indexOf('"truthful":true') >= 0) real++; else fake++;
    }
    Modal.close();
    return { real, fake };
  })()`);
  console.log(`rumour truthfulness over 60 draws: real=${truthMix.real} invented=${truthMix.fake}`);

  /* Shocks: a big trust move the player did not cause must be reported. */
  const shock = await ev(`(() => {
    const P = GAME.player;
    const npc = alive().find(c => !c.isPlayer);
    Shocks.check();                                  // prime baseline
    npc.relationships.get(P.name).trust -= 0.25;     // the island moved it
    const before = document.querySelectorAll('#feed .feed-item').length;
    Shocks.check();
    const after = document.querySelectorAll('#feed .feed-item').length;
    const top = document.querySelector('#feed .feed-item');
    return { reported: after > before, text: top ? top.textContent.slice(0, 70) : '' };
  })()`);
  console.log('sudden trust drop reported:', shock.reported, '|', shock.text);

  /* And that it actually fires from the loop, unasked. */
  const fires = await ev(`(() => {
    Modal.close();
    let n = 0;
    for (let i = 0; i < 400; i++) {
      Dilemmas.firedToday = 0; Dilemmas.lastDay = GAME.day;
      if (Dilemmas.maybeFire()) { n++; Modal.close(); }
    }
    return n;
  })()`);
  console.log(`fired ${fires}/400 opportunities (~${Math.round(fires / 4)}% — capped per day in real play)`);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(__dirname + '/_dilemma.png', Buffer.from(shot.result.data, 'base64'));

  const ok = usable.length >= 5
    && shapes.every(s => s.open && s.options >= 3 && s.allHaveCost && s.portrait && s.bars === 2 && s.warn)
    && consequence.moved >= 1
    && truthMix.real > 0 && truthMix.fake > 0
    && shock.reported && /cooled on you/.test(shock.text)
    && fires > 20
    && !errors.length;
  if (errors.length) console.log('!! errors:', errors.slice(0, 3));
  console.log(ok ? '\nDILEMMA TEST PASS' : '\nDILEMMA TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
