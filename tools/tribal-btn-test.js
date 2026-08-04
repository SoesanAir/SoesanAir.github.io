/* The end-of-day button must only say "Go to Tribal" when the PLAYER attends.
   Run: node tools/tribal-btn-test.js */
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
    '--no-first-run', '--user-data-dir=' + os.tmpdir() + '\\cw-trib-' + RUN_ID,
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
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>/skip tutorial/i.test(b.textContent));if(b)b.click();})()`);
  await sleep(700);

  /* Force night on a tribal day, then vary who lost the challenge. */
  const probe = async (losing, merged) => await ev(`(() => {
    GAME.day = CONFIG.tribalDays[0];
    GAME.hoursRemaining = 0.5;            // night
    GAME.merged = ${merged};
    GAME.stormDouble = false;
    GAME.todayLosingTribe = ${losing === null ? 'null' : JSON.stringify(losing)};
    renderHUD(); renderActions();
    const btns = [...document.querySelectorAll('#action-bar button')].map(b => b.textContent);
    return { faces: playerFacesTribal(), buttons: btns,
             hud: document.getElementById('hud-phase').textContent,
             myTribe: GAME.player.tribeName };
  })()`);

  const mine = await ev(`GAME.player.tribeName`);
  const other = mine === 'Tidal' ? 'Ember' : 'Tidal';

  const a = await probe(mine, false);
  console.log(`my tribe lost (${mine})   : faces=${a.faces} btn="${a.buttons[a.buttons.length - 1]}"`);
  console.log(`                          hud="${a.hud}"`);
  const b = await probe(other, false);
  console.log(`other tribe lost (${other}): faces=${b.faces} btn="${b.buttons[b.buttons.length - 1]}"`);
  console.log(`                          hud="${b.hud}"`);
  const c = await probe(null, false);
  console.log(`challenge not run yet     : faces=${c.faces} btn="${c.buttons[c.buttons.length - 1]}"`);
  const d = await probe(null, true);
  console.log(`merged                    : faces=${d.faces} btn="${d.buttons[d.buttons.length - 1]}"`);

  const lastOf = r => r.buttons[r.buttons.length - 1];
  const ok = a.faces === true && /Go to Tribal/.test(lastOf(a))
    && b.faces === false && !/Tribal/.test(lastOf(b)) && /Sleep/.test(lastOf(b))
    && b.hud.includes(other)
    && c.faces === null && /Tribal/.test(lastOf(c))
    && d.faces === true && /Go to Tribal/.test(lastOf(d));
  console.log(ok ? '\nTRIBAL BUTTON PASS' : '\nTRIBAL BUTTON FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
