/* Full log access, and resetting the season history.

   Both of these are the kind of feature that looks fine and does nothing: a reset
   button that clears the wrong localStorage key, or a log that claims to be whole
   while quietly holding only its tail. So this clicks them and checks the storage
   underneath rather than checking that a button exists.

   Run: node tools/logaccess-test.js */
const http = require('http'), { spawn } = require('child_process'), os = require('os'), path = require('path');
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
    '--no-first-run', '--window-size=900,430',
    '--user-data-dir=' + path.join(os.tmpdir(), 'cw-loga-' + RUN_ID),
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
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  const waitFor = async s => {
    for (let i = 0; i < 120; i++) { if (await ev('!!document.querySelector(' + JSON.stringify(s) + ')')) return; await sleep(250); }
    throw new Error('no ' + s);
  };
  const fails = [];
  const check = (n, ok, d) => { console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + n + (d ? '  — ' + d : '')); if (!ok) fails.push(n); };

  await waitFor('#screen-title.active');
  await ev('localStorage.clear()');
  await send('Page.reload', { ignoreCache: true });
  await waitFor('#screen-title.active'); await sleep(400);
  await ev("document.getElementById('btn-new-game').click()");
  await waitFor('#screen-create.active');
  await ev("GAME.fastMaroon=true;GAME.fastChallenge=true;document.getElementById('btn-create-go').click()");
  for (let i = 0; i < 400; i++) {
    if (await ev("!!document.querySelector('#screen-camp.active')")) break;
    await ev("(()=>{const b=document.querySelector('#maroon-choices button')||document.querySelector('.maroon-next');if(b&&!b.disabled)b.click();})()");
    await sleep(120);
  }
  await waitFor('#screen-camp.active');
  await ev('window.toast=()=>{}; Telemetry.cfg.auto=false; true;');

  console.log(NL + 'LOG COMPLETENESS');
  const st = await ev('JSON.stringify(DBG.stats())').then(JSON.parse);
  check('the log reports what it holds', typeof st.kept === 'number' && typeof st.dropped === 'number',
    st.kept + ' kept, ' + st.dropped + ' dropped, ' + st.total + ' total');
  check('a fresh season is complete, not a tail', st.whole && st.dropped === 0);
  check('the memory cap is far above one season',
    await ev('DBG.stats().kept < 120000'), 'season so far: ' + st.kept + ' lines');

  /* The real bug this replaced: memory and localStorage shared one 4000 cap, so the
     log itself was truncated to fit storage. They must now be independent. */
  const persisted = await ev("(()=>{try{return (JSON.parse(localStorage.getItem('castaway_dbg'))||[]).length}catch{return -1}})()");
  check('localStorage holds only a tail, and that no longer caps the log',
    persisted >= 0 && persisted <= 3000, 'persisted ' + persisted + ' lines');

  /* Push past the old 4000 limit and confirm nothing is lost. */
  await ev("for(let i=0;i<6000;i++) DBG.system('bulk '+i);");
  const st2 = await ev('JSON.stringify(DBG.stats())').then(JSON.parse);
  check('6000 extra lines are all still there', st2.dropped === 0 && st2.kept > 6000,
    st2.kept + ' kept, ' + st2.dropped + ' dropped');
  const txt = await ev('DBG.text(null).length');
  check('the full text renders all of them', txt > 200000, txt + ' characters');
  check('the header states completeness',
    await ev("DBG.text(null).indexOf('complete: this is the whole season') >= 0"));

  console.log(NL + 'THE MENU BUTTON');
  await ev("document.getElementById('btn-menu').click()");
  await sleep(250);
  check('menu offers a reset',
    await ev("[...document.querySelectorAll('button')].some(b=>/Reset all season counts/.test(b.textContent))"));
  await ev("[...document.querySelectorAll('button')].find(b=>/Reset all season counts/.test(b.textContent)).click()");
  await sleep(200);
  check('it confirms before wiping anything',
    await ev("[...document.querySelectorAll('button')].some(b=>/Reset everything/.test(b.textContent))"));
  /* [0-9] not \d on purpose: a backslash inside these evaluate strings does not
     survive to the browser, so /\d/ silently becomes "literal backslash then d",
     matches nothing, and the check fails for a reason that has nothing to do with
     the feature. Cost me a debugging round the first time. */
  check('the confirmation names the current season',
    await ev("/currently on season [0-9]+/.test(document.body.textContent)"),
    await ev("(document.body.textContent.match(/currently on season [0-9]+/)||['not shown'])[0]"));

  /* Seed every key the reset claims to clear, then check each one actually goes. */
  await ev(`
    localStorage.setItem('castaway_season_no','7');
    localStorage.setItem(Returning.KEY, JSON.stringify([{name:'Ghost'}]));
    localStorage.setItem(Marooning.KEY, JSON.stringify(['a|b']));
    localStorage.setItem(Telemetry.AKEY, JSON.stringify([{seed:1,who:'x'}]));
    Marooning.used = new Set(['a|b']);
    true;`);
  const before = await ev('Season.keys().filter(k=>localStorage.getItem(k)!==null).length');
  check('all four history keys are present before the reset', before === 4, before + ' of 4');

  const cleared = await ev('Season.resetCounts()');
  const after = await ev("JSON.stringify(Season.keys().filter(k=>localStorage.getItem(k)!==null))");
  check('the reset clears every one of them', cleared === 4 && after === '[]',
    'cleared ' + cleared + ', left ' + after);
  check('the season counter really is back to 1',
    await ev('Marooning.currentSeasonNo()') === 1);
  check('the in-memory used-lines set was cleared too, so it cannot write itself back',
    await ev('Marooning.used.size') === 0);

  /* The keys it must NOT touch. Clearing a season counter should not cost the user
     their GitHub token. */
  await ev("localStorage.setItem('castaway_motion','full'); localStorage.setItem('castaway_telemetry_v1','{}'); true;");
  await ev('Season.resetCounts()');
  check('device settings survive a reset',
    await ev("localStorage.getItem('castaway_motion')") === 'full'
    && await ev("localStorage.getItem('castaway_telemetry_v1')") === '{}');

  console.log(NL + 'READING THE WHOLE LOG');
  await ev("Modal.close && Modal.close(); document.getElementById('btn-menu').click()");
  await sleep(200);
  await ev("[...document.querySelectorAll('button')].find(b=>/Design log/.test(b.textContent)).click()");
  await sleep(300);
  check('the design log offers a full-log tab',
    await ev("[...document.querySelectorAll('button')].some(b=>b.textContent==='Open full log')"));
  check('it states how complete the log is',
    await ev("/Log holds all [0-9]+ lines|Log is truncated/.test(document.body.textContent)"),
    await ev("(document.body.textContent.match(/Log (holds all [0-9]+ lines|is truncated[^.]*)/)||['not shown'])[0]"));

  /* Click it for real: a Blob URL that fails to build is the likely failure, and
     window.open returning null in headless is not that. */
  const opened = await ev(`(() => {
    let url = null;
    const realOpen = window.open;
    window.open = u => { url = u; return { closed: false }; };
    try {
      [...document.querySelectorAll('button')].find(b => b.textContent === 'Open full log').click();
    } finally { window.open = realOpen; }
    return url;
  })()`);
  check('it builds a real blob url', /^blob:/.test(opened || ''), opened || 'none');
  const body = await ev(`fetch(${JSON.stringify(opened)}).then(r => r.text()).then(t => t.length)`);
  check('the tab contains the whole log, not a summary', body > 200000, body + ' characters');
  check('and it says whether anything was dropped',
    await ev(`fetch(${JSON.stringify(opened)}).then(r=>r.text()).then(t=>/LOG COMPLETENESS/.test(t))`));

  const ok = !fails.length;
  if (fails.length) console.log(NL + 'failing checks: ' + fails.join(', '));
  console.log(ok ? NL + 'LOG ACCESS TEST PASS' : NL + 'LOG ACCESS TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
