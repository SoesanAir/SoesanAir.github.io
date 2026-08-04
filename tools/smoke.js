/* Headless smoke test: drive the real page in Chrome via CDP, start a season,
   and assert the rig actually built for every castaway on the beach.
   Run:  node tools/smoke.js   (expects a static server on :8099) */
const http = require('http');
const { spawn } = require('child_process');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
/* Unique per run: a fixed port + profile means a crashed harness leaves a
   Chrome holding both, and the next run attaches to that stale instance
   mid-test instead of booting a fresh page. */
const RUN_ID = process.pid.toString(36) + Math.floor(Math.random() * 1e6).toString(36);
const PORT = 9200 + Math.floor(Math.random() * 2000);

function get(path) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: PORT, path }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
    '--no-first-run', '--user-data-dir=' + require('os').tmpdir() + '\\castaway-smoke-' + RUN_ID,
    'http://localhost:8099/index.html?no3d=1'
  ], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(400);
    try {
      const list = await get('/json/list');
      target = list.find(t => t.type === 'page' && t.url.includes('index.html'));
    } catch { /* not up yet */ }
  }
  if (!target) { console.error('FAIL: could not attach to Chrome'); chrome.kill(); process.exit(1); }

  const WebSocket = await (async () => {
    try { return require('ws'); } catch { return null; }
  })();
  if (!WebSocket) {
    console.error('FAIL: needs `ws`. Run: npm i --no-save ws');
    chrome.kill(); process.exit(1);
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false });
  let id = 0;
  const pending = new Map();
  ws.on('message', m => {
    const msg = JSON.parse(m);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  });
  await new Promise(r => ws.on('open', r));
  const send = (method, params) => new Promise(r => {
    const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params }));
  });
  const evalJS = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
    return r.result.result.value;
  };

  await send('Runtime.enable');
  /* Reused --user-data-dir means a Chrome disk cache; without this a harness
     can quietly run an older copy of the JS than the one on disk. */
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Console.enable');
  const errors = [];
  ws.on('message', m => {
    const msg = JSON.parse(m);
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = (msg.params.exceptionDetails.exception || {}).description || '';
      if (d !== 'Event') errors.push(msg.params.exceptionDetails.text + ' ' + d);
    }
  });

  /* Wait for a selector rather than guessing at load time — fixed sleeps flake
     when the machine is busy and the click lands on a null element. */
  const waitFor = async (sel, tries = 40) => {
    for (let i = 0; i < tries; i++) {
      if (await evalJS(`!!document.querySelector(${JSON.stringify(sel)})`)) return true;
      await sleep(250);
    }
    throw new Error('timed out waiting for ' + sel);
  };

  await waitFor('#screen-title.active');
  await sleep(200);
  await evalJS(`document.getElementById('btn-new-game').click()`);
  await waitFor('#screen-create.active');
  await evalJS(`GAME.fastMaroon = true; document.getElementById('btn-create-go').click()`);
  // click through the marooning opener
  for (let i = 0; i < 100; i++) {
    if (await evalJS(`!!document.querySelector('#screen-camp.active')`)) break;
    if (await evalJS(`(() => { const b = document.querySelector('#maroon-choices button'); if (b) { b.click(); return true; } return false; })()`)) await sleep(120);
    else await sleep(150);
  }
  await waitFor('#screen-camp.active');
  await waitFor('#figures .bfig');
  await sleep(1200);   // let sprites finish tinting

  const report = await evalJS(`(() => {
    const figs = [...document.querySelectorAll('#figures .bfig')];
    const rigs = figs.map(f => {
      const rig = f.querySelector('.rig');
      const parts = rig ? [...rig.querySelectorAll('.part')] : [];
      const torso = parts.find(p => p.classList.contains('torso'));
      const box = rig ? rig.getBoundingClientRect() : null;
      return {
        parts: parts.length,
        hasSprite: !!(rig && rig.style.getPropertyValue('--sprite').includes('data:image')),
        clipped: !!(torso && torso.style.clipPath),
        w: box ? Math.round(box.width) : 0,
        h: box ? Math.round(box.height) : 0,
        fallbackImg: !!(rig && rig.querySelector('img'))
      };
    });
    return {
      screen: document.querySelector('.screen.active') ? document.querySelector('.screen.active').id : '?',
      castCount: (window.GAME && GAME.cast) ? GAME.cast.length : 0,
      figures: figs.length,
      rigs,
      names: (window.GAME && GAME.cast) ? GAME.cast.slice(0,4).map(c => c.gender + ':' + c.name + ':' + c.bodyKey) : []
    };
  })()`);

  console.log('screen        :', report.screen);
  console.log('cast          :', report.castCount);
  console.log('beach figures :', report.figures);
  const bad = report.rigs.filter(r => r.parts !== 6 || !r.hasSprite || !r.clipped || r.h < 10);
  const fallbacks = report.rigs.filter(r => r.fallbackImg);
  console.log('rigs with 6 parts + sprite + clip + size:', report.rigs.length - bad.length, '/', report.rigs.length);
  if (fallbacks.length) console.log('!! fell back to plain <img>:', fallbacks.length);
  if (bad.length) console.log('!! bad rigs:', JSON.stringify(bad.slice(0, 3)));
  console.log('sample rig box:', report.rigs[0] && (report.rigs[0].w + 'x' + report.rigs[0].h));
  console.log('sample cast   :', report.names.join('\n                '));
  if (errors.length) console.log('!! page errors:\n', errors.slice(0, 5).join('\n'));

  const ok = report.figures > 0 && bad.length === 0 && !fallbacks.length && !errors.length;
  console.log(ok ? '\nSMOKE PASS' : '\nSMOKE FAIL');
  ws.close(); chrome.kill();
  process.exit(ok ? 0 : 1);
})();
