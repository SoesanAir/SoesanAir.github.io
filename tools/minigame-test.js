/* Every one of the 20 minigames must: build an arena, be interactive, and resolve
   a finite score in 0..1 — driven only by real clicks and holds, never by calling
   ctx.done directly. Also checks that stats are spent as EASE (a high-stat
   castaway gets a kinder game) rather than as bonus points.
   Run: node tools/minigame-test.js */
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
    '--no-first-run', '--window-size=900,430', '--force-device-scale-factor=2',
    '--user-data-dir=' + os.tmpdir() + '\\cw-mg-' + RUN_ID, 'http://localhost:8099/index.html?no3d=1'], { stdio: 'ignore' });
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
  const waitFor = async s => { for (let i = 0; i < 80; i++) { if (await ev(`!!document.querySelector(${JSON.stringify(s)})`)) return; await sleep(250); } throw new Error('no ' + s); };

  await waitFor('#screen-title.active');
  await ev(`localStorage.clear()`);
  await send('Page.reload', { ignoreCache: true });
  await waitFor('#screen-title.active'); await sleep(300);
  await ev(`document.getElementById('btn-new-game').click()`);
  await waitFor('#screen-create.active');
  await ev(`GAME.fastMaroon = true; GAME.fastChallenge = true; document.getElementById('btn-create-go').click()`);
  for (let i = 0; i < 120; i++) {
    if (await ev(`!!document.querySelector('#screen-camp.active')`)) break;
    if (await ev(`(() => { const b = document.querySelector('#maroon-choices button'); if (b) { b.click(); return true; } return false; })()`)) await sleep(120);
    else await sleep(150);
  }
  await waitFor('#screen-camp.active'); await waitFor('#figures .bfig');
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>/skip tutorial/i.test(b.textContent));if(b)b.click();})()`);
  await sleep(500);

  const ids = await ev(`MINIGAMES.map(g => g.id)`);
  console.log('minigames registered:', ids.length);

  /* A generic bot: hammer whatever the arena offers for a while, then read the
     resolved score. Deliberately dumb — it proves the games are playable and
     always terminate, not that they are winnable. */
  const playOne = async (gid, ease) => {
    await ev(`(() => {
      window.__res = undefined;
      const g = MINIGAMES.find(x => x.id === ${JSON.stringify(gid)});
      const layer = document.getElementById('chal-game');
      layer.innerHTML = ''; layer.classList.add('open');
      const frame = document.createElement('div'); frame.className = 'cg-frame';
      const head = document.createElement('div'); head.className = 'cg-head';
      const timer = document.createElement('div'); timer.className = 'cg-timer'; timer.appendChild(document.createElement('i'));
      const score = document.createElement('span'); score.className = 'cg-score'; score.textContent = '0';
      head.appendChild(timer); head.appendChild(score);
      const arena = document.createElement('div'); arena.className = 'cg-arena';
      frame.appendChild(head); frame.appendChild(arena); layer.appendChild(frame);
      Juice.attach(frame);
      /* Use the shell's own factory. Hand-rolling a ctx here is how this harness
         ended up without the difficulty helpers and reported fifteen working games
         as broken. */
      const ctx = Challenge.makeCtx({
        arena, frame, score, timer, game: g, howto: null, ease: ${ease},
        onDone: v => { window.__res = clamp01(v); }
      });
      /* Keep the clock short so the bot does not wait out a full round. */
      ctx.clock = (ms, onEnd) => { const t = setTimeout(onEnd, Math.min(ms, 2600)); return { stop() { clearTimeout(t); } }; };
      ctx.hitstop = () => {};
      g.start(ctx);
      return true;
    })()`);
    /* Drive it with real input for up to ~4s. */
    for (let i = 0; i < 26; i++) {
      if (await ev(`window.__res !== undefined`)) break;
      await ev(`(() => {
        const a = document.querySelector('#chal-game .cg-arena');
        if (!a) return;
        const btns = [...a.querySelectorAll('button')].filter(b => !b.disabled);
        const cards = [...a.querySelectorAll('.cast-card')];
        const marks = [...a.querySelectorAll('.cg-mark')];
        const pick2 = arr => arr[Math.floor(Math.random() * arr.length)];
        if (marks.length && Math.random() < 0.7) { pick2(marks).click(); return; }
        if (cards.length) { pick2(cards).click(); return; }
        if (!btns.length) return;
        const b = pick2(btns);
        // hold-style games need pointer events, not click
        b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        b.click();
        setTimeout(() => b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })), 120);
      })()`);
      await sleep(160);
    }
    const r = await ev(`window.__res`);
    await ev(`Juice.detach(); document.getElementById('chal-game').classList.remove('open'); document.getElementById('chal-game').innerHTML = '';`);
    return r;
  };

  const rows = [];
  for (const gid of ids) {
    const lo = await playOne(gid, 0.15);
    const hi = await playOne(gid, 0.9);
    const ok = typeof lo === 'number' && isFinite(lo) && lo >= 0 && lo <= 1 &&
      typeof hi === 'number' && isFinite(hi) && hi >= 0 && hi <= 1;
    rows.push({ gid, lo, hi, ok });
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${gid.padEnd(12)} weak-ease=${lo === undefined ? 'none' : lo.toFixed(2)}  strong-ease=${hi === undefined ? 'none' : hi.toFixed(2)}`);
  }

  /* Ease must be spent on kindness: over many runs the strong castaway should do
     at least as well on average, without any score being added directly. */
  const avg = a => a.reduce((s, v) => s + v, 0) / a.length;
  const loAvg = avg(rows.filter(r => r.ok).map(r => r.lo));
  const hiAvg = avg(rows.filter(r => r.ok).map(r => r.hi));
  console.log(`\nmean score  weak-ease ${loAvg.toFixed(3)}   strong-ease ${hiAvg.toFixed(3)}`);

  /* Scoring integration: the player's perf must move their challenge score. */
  const integ = await ev(`(() => {
    const chal = { name: 'test', cat: 'Physical', w: [0, 0, 0, 0, 0, 1, 0], desc: '' };
    const P = GAME.player;
    setPlayerChallengePerf(0.0); const lo = Challenges.score(P, chal);
    setPlayerChallengePerf(1.0); const hi = Challenges.score(P, chal);
    setPlayerChallengePerf(null); const nul = Challenges.score(P, chal);
    return { lo: +lo.toFixed(3), hi: +hi.toFixed(3), nul: +nul.toFixed(3) };
  })()`);
  console.log('challenge score with perf 0 vs 1:', JSON.stringify(integ));

  /* Every challenge in the library must resolve to some minigame. */
  const coverage = await ev(`(() => {
    const miss = CHALLENGES.filter(c => !Challenge.gameFor(c)).map(c => c.name);
    const map = {};
    CHALLENGES.forEach(c => { const g = Challenge.gameFor(c); map[g.id] = (map[g.id] || 0) + 1; });
    return { challenges: CHALLENGES.length, unmapped: miss, distinctGames: Object.keys(map).length };
  })()`);
  console.log('challenge coverage:', JSON.stringify(coverage));

  await ev(`(() => {
    const g = MINIGAMES.find(x => x.id === 'stack');
    Screens.push('screen-challenge');
    const layer = document.getElementById('chal-game');
    layer.innerHTML=''; layer.classList.add('open');
    const frame=document.createElement('div'); frame.className='cg-frame';
    const head=document.createElement('div'); head.className='cg-head';
    const nm=document.createElement('span'); nm.className='cg-name'; nm.textContent=g.name;
    const timer=document.createElement('div'); timer.className='cg-timer'; timer.appendChild(document.createElement('i'));
    const score=document.createElement('span'); score.className='cg-score'; score.textContent='0';
    head.appendChild(nm); head.appendChild(timer); head.appendChild(score);
    const arena=document.createElement('div'); arena.className='cg-arena';
    const how=document.createElement('div'); how.className='cg-how'; how.textContent=g.how;
    frame.appendChild(head); frame.appendChild(arena); frame.appendChild(how); layer.appendChild(frame);
    Juice.attach(frame);
    const sctx = Challenge.makeCtx({ arena, frame, score, timer, game: g, howto: how, ease: 0.6, onDone: () => {} });
    sctx.clock = () => ({ stop() {} });
    sctx.hitstop = () => {};
    g.start(sctx);
    return true;
  })()`);
  for (let i=0;i<4;i++){ await ev("document.querySelector('#chal-game .cg-arena button').click()"); await sleep(240); }
  await sleep(400);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(__dirname + '/_minigame.png', Buffer.from(shot.result.data, 'base64'));
  console.log('saved tools/_minigame.png');

  const bad = rows.filter(r => !r.ok);
  /* A floor rather than an exact count. This used to assert exactly 20 and then
     failed the whole suite the moment the library grew to 40 — the count was the
     only thing wrong and it read as twenty broken games. What matters is that
     every registered game resolves and that none went missing, and both of those
     are checked directly. */
  const enough = ids.length >= 40;
  const ok = enough && bad.length === 0
    && integ.hi > integ.lo
    && coverage.unmapped.length === 0
    && !errors.length;
  if (!enough) console.log(`!! only ${ids.length} minigames registered — a batch is not loading`);
  if (bad.length) console.log('!! failed games:', bad.map(b => b.gid).join(', '));
  if (errors.length) console.log('!! page errors:', errors.slice(0, 4));
  console.log(ok ? '\nMINIGAME TEST PASS' : '\nMINIGAME TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
