/* The post-challenge screen: does it fit, and can you reach the bottom?

   Reported: "Post challenge screen is full of things and unscrollable. Too much
   data. Narrow it down."

   Two separate faults hide behind that one sentence and both need measuring:

     1. TOO MUCH — the standings block lists the entire field, which pre-merge is
        eighteen rows of bar chart on top of three lines of verdict.
     2. UNREACHABLE — nothing on that screen scrolls, so anything past the fold is
        not merely ugly, it is gone. Including, potentially, the Continue button.

   Checks both states, because pre-merge (18 castaways) and post-merge (a shrinking
   field) fail differently and a fix that only suits one is not a fix.

   Run: node tools/chal-result-look.js */
const http = require('http'), { spawn } = require('child_process'), os = require('os'), fs = require('fs'), path = require('path');
const WebSocket = require('ws');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const RUN_ID = process.pid.toString(36) + Math.floor(Math.random() * 1e6).toString(36);
const PORT = 9200 + Math.floor(Math.random() * 2000);
const NL = String.fromCharCode(10);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = p => new Promise((s, j) => http.get({ host: '127.0.0.1', port: PORT, path: p }, r => {
  let d = ''; r.on('data', c => d += c); r.on('end', () => s(JSON.parse(d)));
}).on('error', j));

(async () => {
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT,
    '--no-first-run', '--window-size=920,440', '--force-device-scale-factor=2',
    '--user-data-dir=' + path.join(os.tmpdir(), 'cw-cres-' + RUN_ID),
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
    if (r.result.exceptionDetails) throw new Error('threw: ' + ((r.result.exceptionDetails.exception || {}).description || '').split(NL)[0]);
    return r.result.result.value;
  };
  const shot = async name => {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, '_look-' + name + '.png'), Buffer.from(s.result.data, 'base64'));
  };
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  const waitFor = async s => {
    for (let i = 0; i < 80; i++) { if (await ev('!!document.querySelector(' + JSON.stringify(s) + ')')) return; await sleep(250); }
    throw new Error('no ' + s);
  };
  const problems = [];

  await waitFor('#screen-title.active');
  await ev('localStorage.clear()');
  await send('Page.reload', { ignoreCache: true });
  await waitFor('#screen-title.active'); await sleep(300);
  await ev("document.getElementById('btn-new-game').click()");
  await waitFor('#screen-create.active');
  await ev("GAME.fastMaroon=true;GAME.fastChallenge=true;document.getElementById('btn-create-go').click()");
  for (let i = 0; i < 400; i++) {
    if (await ev("!!document.querySelector('#screen-camp.active')")) break;
    await ev("(()=>{const b=document.querySelector('#maroon-choices button')||document.querySelector('.maroon-next');if(b&&!b.disabled)b.click();})()");
    await sleep(120);
  }
  await waitFor('#screen-camp.active');
  await ev("(()=>{const b=[...document.querySelectorAll('button')].find(b=>/skip tutorial/i.test(b.textContent));if(b)b.click();})()");
  await sleep(300);
  await ev('DBG.setEnabled(false); window.toast=()=>{}; Telemetry.cfg.auto=false; true;');

  /* Build the post-challenge state directly. Playing a real minigame here would
     add nothing — the fault is in what gets rendered afterwards. */
  const build = async merged => {
    return ev(`(() => {
      GAME.merged = ${merged ? 'true' : 'false'};
      const chal = CHALLENGES.find(c => c.cat === 'Physical') || CHALLENGES[0];
      const field = GAME.merged ? alive() : aliveTribe('Tidal').concat(aliveTribe('Ember'));
      Challenges.prescore(chal, field);
      Challenges.score(GAME.player, chal);
      Screens.push('screen-challenge');
      document.getElementById('chal-title').textContent = GAME.merged ? 'Individual Immunity' : 'Tribal Immunity';
      document.getElementById('chal-name').textContent = chal.name;
      document.getElementById('chal-desc').textContent = chal.desc
        + '  —  Hold the Rope: HOLD to grip. Tap LEFT / RIGHT to stay centred. Drift out and you drop.';
      const sr = document.getElementById('chal-stats'); sr.innerHTML = '';
      sr.appendChild(h('span', 'chip', 'Physicality'));
      const res = document.getElementById('chal-result');
      res.innerHTML = '';
      if (!GAME.merged) {
        /* Mirrors the pre-merge branch of runChallengeScreen: the player's own
           tribe only, and the weak link named as a line only when it is somebody
           else's tribe. Deliberately reproduces the WORST case — the player's tribe
           lost, so their own weak link is in the list AND is the tagged one. */
        const mine = aliveTribe(GAME.player.tribeName);
        const weakest = mine.reduce((a, b) => a.lastChallengeScore < b.lastChallengeScore ? a : b);
        res.appendChild(h('div', 'display', 'Ember wins immunity'));
        res.appendChild(h('div', '', GAME.player.tribeName + ' goes to tribal council tonight.'));
        renderChallengeStandings(res, mine, {
          title: GAME.player.tribeName + ': who carried it',
          mark: c => (c === weakest ? 'dead weight' : '')
        });
      } else {
        const pool = alive();
        const winner = pool.reduce((a, b) => a.lastChallengeScore > b.lastChallengeScore ? a : b);
        res.appendChild(h('div', 'display', winner.displayName + ' wins individual immunity'));
        renderChallengeStandings(res, pool, {
          title: 'Final standings', mark: c => (c === winner ? 'IMMUNE' : '')
        });
      }
      document.getElementById('btn-chal-go').classList.add('hidden');
      document.getElementById('btn-chal-done').classList.remove('hidden');
      /* The real flow sets this once the result is in; it collapses the briefing. */
      document.getElementById('screen-challenge').classList.add('resulting');
      return { field: field.length };
    })()`);
  };

  const measure = async label => {
    const m = await ev(`(() => {
      const app = document.getElementById('app');
      /* The scroll container by CLASS, not '> div'. Positional selectors break the
         moment anything is inserted above them, and adding the 3D backdrop host as
         the screen's first child silently repointed this at a div with
         overflow:hidden — so the harness reported 'nothing scrolls' on a screen whose
         scroll container was still perfectly present. */
      const wrap = document.querySelector('#screen-challenge > .scroll-y')
        || document.querySelector('#screen-challenge > div:not(.gl-host)');
      const done = document.getElementById('btn-chal-done');
      const panel = document.querySelector('#screen-challenge .panel');
      const ar = app.getBoundingClientRect();
      const wr = wrap.getBoundingClientRect();
      const dr = done.getBoundingClientRect();
      /* Can the player actually get to the bottom? Two ways it can be fine:
         everything fits, or something scrolls. */
      /* Is a scroll container PRESENT? Not "is it currently scrolling" — when the
         content fits there is nothing to scroll and scrollHeight equals
         clientHeight, which the first version of this check read as "no safety
         net" and reported as a fault on the screen that was behaving best. */
      const scrollableEl = [wrap, panel, document.getElementById('chal-result')]
        .find(e => e && ['auto', 'scroll'].indexOf(getComputedStyle(e).overflowY) >= 0);
      return {
        appH: Math.round(ar.height),
        contentH: Math.round(wrap.scrollHeight),
        overflowBy: Math.round(wrap.scrollHeight - ar.height),
        doneVisible: dr.bottom <= ar.bottom + 1 && dr.top >= ar.top - 1 && dr.height > 0,
        scrolls: !!scrollableEl,
        scrollsWhich: scrollableEl ? (scrollableEl.id || scrollableEl.className) : '(nothing)',
        rows: document.querySelectorAll('#chal-result .cs-row').length,
        blocks: document.querySelectorAll('#chal-result > *').length
      };
    })()`);
    console.log(label.padEnd(12)
      + ' field content ' + m.contentH + 'px in ' + m.appH + 'px'
      + (m.overflowBy > 0 ? '  OVER by ' + m.overflowBy : '  fits')
      + ' · standings rows ' + m.rows
      + ' · Continue ' + (m.doneVisible ? 'reachable' : 'OFF SCREEN')
      + ' · scrolls: ' + m.scrollsWhich);
    /* The bar is FITS, not "scrolls". Scrolling is the safety net that stops the
       player being trapped; needing to use it on a summary screen is still the
       reported fault ("full of things"). */
    if (m.overflowBy > 0) problems.push(label + ': overflows by ' + m.overflowBy + 'px — still too much on screen');
    if (!m.doneVisible) problems.push(label + ': the Continue button is not visible without scrolling');
    if (!m.scrolls) problems.push(label + ': nothing scrolls, so any future overflow traps the player');
    if (m.rows > 6) problems.push(label + ': ' + m.rows + ' standings rows is too much data');
    return m;
  };

  await build(false);
  await sleep(400);
  await shot('chalres-premerge');
  await measure('pre-merge');
  await ev("Screens.pop(); Challenges.clearPrescore(); true;");
  await sleep(200);

  await build(true);
  await sleep(400);
  await shot('chalres-merged');
  await measure('post-merge');
  await ev("Screens.pop(); Challenges.clearPrescore(); GAME.merged = false; true;");

  console.log(NL + 'wrote tools/_look-chalres-*.png');
  if (problems.length) {
    console.log(NL + 'PROBLEMS:');
    for (const p of problems) console.log('  ! ' + p);
  }
  console.log(problems.length ? NL + 'CHAL RESULT LOOK FAIL' : NL + 'CHAL RESULT LOOK PASS');
  ws.close(); ch.kill(); process.exit(problems.length ? 1 : 0);
})();
