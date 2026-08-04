/* The vote-ask popup must show WHO is asking (portrait + bond/trust bars) and
   frame the ask by how well the player knows them: a stranger coming out of the
   blue must read differently from a locked ally.
   Run: node tools/probe-test.js */
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
    '--user-data-dir=' + os.tmpdir() + '\\cw-probe-' + RUN_ID, 'http://localhost:8099/index.html?no3d=1'], { stdio: 'ignore' });
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

  const probe = async (label, prep) => {
    const r = await ev(`(() => {
      const P = GAME.player;
      const npc = alive().find(c => !c.isPlayer);
      PlayerAlliances.reset();
      ${prep}
      showProbeModal(npc, 'Coded');
      const body = document.getElementById('modal-body');
      const frame = body.querySelector('.probe-frame');
      return {
        fam: probeFamiliarity(npc),
        title: document.getElementById('modal-title').textContent,
        hasPortrait: !!body.querySelector('.cast-card .portrait img'),
        bars: body.querySelectorAll('.cast-card .cc-bars .meter').length,
        barLabels: [...body.querySelectorAll('.cast-card .cc-bar-label')].map(e => e.textContent).join('/'),
        frameClass: frame ? frame.className : '',
        frame: frame ? frame.textContent : '',
        said: !!body.querySelector('.probe-said'),
        buttons: body.querySelectorAll('button').length
      };
    })()`);
    console.log('\n' + label);
    console.log(`  familiarity=${r.fam}  portrait=${r.hasPortrait}  bars=${r.bars} (${r.barLabels})  buttons=${r.buttons}`);
    console.log(`  title : "${r.title}"`);
    console.log(`  frame : "${r.frame.slice(0, 92)}"`);
    return r;
  };

  const stranger = await probe('STRANGER - no alliance, cold',
    `npc.relationships.get(P.name).trust = 0.12; npc.relationships.get(P.name).rel = 0.12;`);
  const known = await probe('ACQUAINTANCE - warm and aligned',
    `npc.relationships.get(P.name).trust = 0.55; npc.relationships.get(P.name).rel = 0.55;
     PlayerAlliances.align(npc.name, GAME.day);`);
  const ally = await probe('LOCKED ALLY - promised',
    `npc.relationships.get(P.name).trust = 0.8; npc.relationships.get(P.name).rel = 0.8;
     PlayerAlliances.align(npc.name, GAME.day); PlayerAlliances.promise(npc.name, GAME.day);`);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(__dirname + '/_probe.png', Buffer.from(shot.result.data, 'base64'));
  console.log('\nsaved tools/_probe.png');

  const ok = stranger.fam === 'stranger' && known.fam === 'known' && ally.fam === 'ally'
    && [stranger, known, ally].every(x => x.hasPortrait && x.bars === 2 && x.said && x.buttons >= 3)
    && /out of nowhere/i.test(stranger.title) && /numbers/i.test(ally.title)
    && stranger.frameClass.indexOf('stranger') >= 0 && ally.frameClass.indexOf('ally') >= 0
    && stranger.frame !== known.frame && known.frame !== ally.frame
    && !errors.length;
  if (errors.length) console.log('!! errors:', errors.slice(0, 3));
  console.log(ok ? '\nPROBE TEST PASS' : '\nPROBE TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
