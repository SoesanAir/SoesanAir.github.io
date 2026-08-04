/* The character's answer must stay pinned and visible at the top of the chat
   window; only the choices below it scroll. Checks geometry, not appearance:
   the answer's box must sit inside the panel even after scrolling the choices
   to the bottom.
   Run: node tools/dialogue-test.js */
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
    '--user-data-dir=' + os.tmpdir() + '\\cw-dlg-' + RUN_ID,
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

  /* Open a dialogue with a deliberately long answer and a long choice list. */
  await ev(`(() => {
    const npc = alive().find(c => !c.isPlayer);
    openTalkMenu(npc);
    document.getElementById('dlg-text').textContent =
      'That is a long answer on purpose, because a castaway explaining themselves ' +
      'can run on for a while and the player still has to be able to read it after ' +
      'scrolling down to the option they actually want to pick. It should stay put.';
    const box = document.getElementById('dlg-choices');
    box.innerHTML = '';
    for (let i = 1; i <= 14; i++) {
      const b = document.createElement('button');
      b.className = 'btn'; b.textContent = 'Option number ' + i;
      box.appendChild(b);
    }
    return true;
  })()`);
  await sleep(400);

  const geom = async () => await ev(`(() => {
    const content = document.getElementById('dlg-content');
    const text = document.getElementById('dlg-text');
    const choices = document.getElementById('dlg-choices');
    const layer = document.getElementById('dialogue-layer');
    const cb = content.getBoundingClientRect(), tb = text.getBoundingClientRect(),
          chb = choices.getBoundingClientRect(), lb = layer.getBoundingClientRect();
    return {
      textVisible: tb.top >= cb.top - 1 && tb.bottom <= cb.bottom + 1 && tb.height > 4,
      textTop: Math.round(tb.top - cb.top),
      textH: Math.round(tb.height),
      choicesScrolls: choices.scrollHeight > choices.clientHeight + 2,
      contentScrolls: content.scrollHeight > content.clientHeight + 2,
      choicesTop: Math.round(chb.top - cb.top),
      panelH: Math.round(cb.height),
      withinScreen: cb.top >= lb.top - 1 && cb.bottom <= lb.bottom + 1,
      scrollTop: choices.scrollTop, scrollMax: choices.scrollHeight - choices.clientHeight
    };
  })()`);

  const before = await geom();
  console.log('before scrolling:');
  console.log(`  answer visible=${before.textVisible} (top ${before.textTop}px, height ${before.textH}px)`);
  console.log(`  choices scroll=${before.choicesScrolls}  panel scrolls=${before.contentScrolls} (should be false)`);
  console.log(`  panel height=${before.panelH}px  fits on screen=${before.withinScreen}`);

  /* Scroll the choices to the very bottom — the answer must not move. */
  await ev(`(() => { const c = document.getElementById('dlg-choices'); c.scrollTop = c.scrollHeight; return true; })()`);
  await sleep(250);
  const after = await geom();
  console.log('after scrolling choices to the bottom:');
  console.log(`  answer STILL visible=${after.textVisible} (top ${after.textTop}px)`);
  console.log(`  scrolled ${Math.round(after.scrollTop)}/${Math.round(after.scrollMax)}px`);
  const lastBtnVisible = await ev(`(() => {
    const c = document.getElementById('dlg-choices');
    const b = c.lastElementChild.getBoundingClientRect(), cb = c.getBoundingClientRect();
    return b.bottom <= cb.bottom + 2 && b.top >= cb.top - 2;
  })()`);
  console.log(`  last option reachable=${lastBtnVisible}`);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(__dirname + '/_dialogue.png', Buffer.from(shot.result.data, 'base64'));
  console.log('saved tools/_dialogue.png');

  const ok = before.textVisible && after.textVisible
    && before.textTop === after.textTop           // the answer did not move
    && before.choicesScrolls && !before.contentScrolls
    && after.scrollTop > 10 && lastBtnVisible
    && before.withinScreen
    && !errors.length;
  if (errors.length) console.log('!! errors:', errors.slice(0, 3));
  console.log(ok ? '\nDIALOGUE TEST PASS' : '\nDIALOGUE TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
