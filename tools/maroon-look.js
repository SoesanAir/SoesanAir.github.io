/* Screenshots of the marooning at three beats, so the look can be judged rather
   than assumed: the title card, the line-up with both tribes, and a mid-question
   exchange with the transcript.

   Run: node tools/maroon-look.js */
const http = require('http'), { spawn } = require('child_process'), os = require('os'), fs = require('fs');
const WebSocket = require('ws');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const RUN_ID = process.pid.toString(36) + Math.floor(Math.random() * 1e6).toString(36);
const PORT = 9200 + Math.floor(Math.random() * 2000);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = p => new Promise((s, j) => http.get({ host: '127.0.0.1', port: PORT, path: p }, r => {
  let d = ''; r.on('data', c => d += c); r.on('end', () => s(JSON.parse(d)));
}).on('error', j));

(async () => {
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT,
    '--no-first-run', '--window-size=920,440', '--force-device-scale-factor=2',
    '--user-data-dir=' + os.tmpdir() + '\\cw-look-' + RUN_ID,
    'http://localhost:8099/index.html?no3d=1'], { stdio: 'ignore' });
  let t = null;
  for (let i = 0; i < 40 && !t; i++) {
    await sleep(400);
    try { t = (await get('/json/list')).find(x => x.type === 'page' && x.url.includes('index.html')); } catch { }
  }
  if (!t) { console.log('no page'); process.exit(1); }
  const ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false });
  let id = 0; const pend = new Map();
  ws.on('message', m => { const j = JSON.parse(m); if (j.id && pend.has(j.id)) { pend.get(j.id)(j); pend.delete(j.id); } });
  await new Promise(r => ws.on('open', r));
  const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error('threw: ' + ((r.result.exceptionDetails.exception || {}).description || '').split('\n')[0]);
    return r.result.result.value;
  };
  const shot = async name => {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(__dirname + '/_look-' + name + '.png', Buffer.from(s.result.data, 'base64'));
    console.log('saved tools/_look-' + name + '.png');
  };
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  const waitFor = async s => {
    for (let i = 0; i < 80; i++) { if (await ev(`!!document.querySelector(${JSON.stringify(s)})`)) return; await sleep(250); }
    throw new Error('no ' + s);
  };

  await waitFor('#screen-title.active');
  await ev(`localStorage.clear()`);
  await send('Page.reload', { ignoreCache: true });
  await waitFor('#screen-title.active'); await sleep(300);
  await ev(`document.getElementById('btn-new-game').click()`);
  await waitFor('#screen-create.active');
  await ev(`document.getElementById('btn-create-go').click()`);
  await waitFor('#screen-maroon.active');

  /* 1. the title card, after the dip has lifted */
  await sleep(4200);   // let every title animation settle first
  await shot('1-title');

  /* 2. the line-up: click past the title and the intro */
  const nextBtn = async () => ev(`(()=>{const b=document.querySelector('#maroon-choices button');if(b){b.click();return true}return false})()`);
  await nextBtn(); await sleep(700);
  await shot('2-lineup');

  /* 3. an exchange in progress: advance until a reply is on screen */
  for (let i = 0; i < 8; i++) {
    const hasReply = await ev(`!!document.querySelector('#maroon-convo .mc-turn.reply')`);
    const choosing = await ev(`document.querySelectorAll('#maroon-choices .maroon-opt').length > 0`);
    if (hasReply && !choosing) break;
    if (choosing) {
      await ev(`(()=>{const b=document.querySelector('#maroon-choices .maroon-opt button');if(b)b.click();})()`);
    } else await nextBtn();
    await sleep(600);
  }
  await sleep(500);
  await shot('3-exchange');

  /* 4. the player's own choice list, which shows the thinking bubbles */
  for (let i = 0; i < 12; i++) {
    if (await ev(`document.querySelectorAll('#maroon-choices .maroon-opt').length > 0`)) break;
    await nextBtn(); await sleep(500);
  }
  if (await ev(`document.querySelectorAll('#maroon-choices .maroon-opt').length > 0`)) {
    await ev(`(()=>{const w=document.querySelector('#maroon-choices .maroon-opt');if(w)w.classList.add('show');})()`);
    await sleep(300);
    await shot('4-choices');
  }
  ws.close(); ch.kill(); process.exit(0);
})();
