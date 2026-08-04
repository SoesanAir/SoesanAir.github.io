/* The social layer added this pass: the expanded dilemma pool, the third-party
   cards, NPC blocs, and the graded bloc reads.

   Two requests drive this:

     "the pop-up events are AWESOME, however very repetitive (we need to have 5
      times options then what we currently have, and we need to watch for
      repetative things in a season) and sometimes unclear to the player (when one
      player approaches me, i don't know who the other one they are talking about
      is)"

     "the npc can say something like 'i think x, y, and z are getting close'"

   So: is the pool actually five times bigger, does a season stop repeating, does
   an event that names somebody SHOW them, and do NPC blocs exist to be talked
   about at all?

   Run: node tools/social-test.js */
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
    '--user-data-dir=' + path.join(os.tmpdir(), 'cw-soc-' + RUN_ID),
    'http://localhost:8099/index.html?no3d=1'], { stdio: 'ignore' });
  let t = null;
  for (let i = 0; i < 40 && !t; i++) {
    await sleep(400);
    try { t = (await get('/json/list')).find(x => x.type === 'page' && x.url.includes('index.html')); } catch { }
  }
  if (!t) { console.log('no page'); process.exit(1); }
  const ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false });
  let id = 0; const pend = new Map();
  const pageErrors = [];
  ws.on('message', m => {
    const j = JSON.parse(m);
    if (j.id && pend.has(j.id)) { pend.get(j.id)(j); pend.delete(j.id); }
    if (j.method === 'Runtime.exceptionThrown') {
      const d = j.params.exceptionDetails || {};
      pageErrors.push(String((d.exception && d.exception.description) || d.text || '').split(NL)[0]);
    }
  });
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
    for (let i = 0; i < 80; i++) { if (await ev('!!document.querySelector(' + JSON.stringify(s) + ')')) return; await sleep(250); }
    throw new Error('no ' + s);
  };
  const fails = [];
  const check = (n, ok, d) => { console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + n + (d ? '  — ' + d : '')); if (!ok) fails.push(n); };

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

  /* ---- 1. the pool is actually five times bigger ---- */
  const pool = await ev(`(() => {
    const all = Dilemmas.all();
    const ids = all.map(k => k.id);
    return {
      base: DILEMMA_KINDS.length,
      extra: (typeof DILEMMA_POOL !== 'undefined' ? DILEMMA_POOL.length : 0),
      total: all.length,
      unique: new Set(ids).size,
      dupes: ids.filter((x, i) => ids.indexOf(x) !== i)
    };
  })()`);
  console.log('dilemma pool: ' + pool.base + ' original + ' + pool.extra + ' new = ' + pool.total);
  check('the pool is about five times what it was', pool.total >= pool.base * 5,
    pool.total + ' vs ' + pool.base + ' before');
  check('no duplicate event ids', pool.dupes.length === 0, pool.dupes.join(', ') || 'none');

  /* ---- 2. a season stops repeating itself ----
     Fire as many as a long season would and count repeats. */
  const variety = await ev(`(() => {
    Dilemmas.resetSeason();
    const all = Dilemmas.all();
    /* Force every event eligible so this measures the SELECTOR, not which events
       happen to be possible on day two of one particular cast. */
    const realCan = all.map(k => k.can);
    all.forEach(k => { k.can = () => true; });
    const realRun = all.map(k => k.run);
    all.forEach(k => { k.run = () => {}; });
    const realChance = window.chance;
    window.chance = () => true;
    const fired = [];
    const realReady = Dilemmas.ready;
    Dilemmas.ready = () => true;
    for (let i = 0; i < 20; i++) {
      GAME.day = 3 + i;
      Dilemmas.firedToday = 0;
      const before = Dilemmas.history.length;
      Dilemmas.maybeFire();
      if (Dilemmas.history.length > before) fired.push(Dilemmas.history[Dilemmas.history.length - 1]);
    }
    all.forEach((k, i) => { k.can = realCan[i]; k.run = realRun[i]; });
    window.chance = realChance;
    Dilemmas.ready = realReady;
    Dilemmas.resetSeason();
    const uniq = new Set(fired).size;
    return { fired: fired.length, uniq, repeats: fired.length - uniq };
  })()`);
  console.log('20 firings produced ' + variety.uniq + ' distinct events ('
    + variety.repeats + ' repeats)');
  check('a season of firings does not repeat itself', variety.repeats === 0,
    variety.repeats + ' repeats in ' + variety.fired);

  /* ---- 3. an event that names somebody SHOWS them ---- */
  const shown = await ev(`(() => {
    const P = GAME.player;
    const mates = campmates(P).filter(c => !c.isPlayer);
    Dilemmas.open({
      id: 'test', npc: mates[0], truthful: true,
      title: 'Test', situation: 'Somebody is talking about other people.',
      claim: 'Ask them yourself.',
      about: [mates[1], mates[2], mates[3]],
      options: [{ text: 'Fine.', cost: 'Costs something.', go() {} }]
    });
    const body = document.getElementById('modal-body');
    const cards = body.querySelectorAll('.dab');
    const res = {
      cards: cards.length,
      names: [...body.querySelectorAll('.dab-name')].map(n => n.textContent),
      /* Each card must carry BOTH bars, or the player cannot weigh the claim. */
      relBars: body.querySelectorAll('.dab-bar.rel > i').length,
      trustBars: body.querySelectorAll('.dab-bar.trust > i').length,
      /* And a face or a fallback initial — never an empty box. */
      faces: body.querySelectorAll('.dab-pic img, .dab-initial').length,
      coloured: [...cards].filter(c => c.style.getPropertyValue('--t-color')).length,
      /* Single-castaway form must still work. */
      single: 0
    };
    Modal.close();
    Dilemmas.open({
      id: 'test2', npc: mates[0], truthful: false, title: 'T', situation: 's',
      about: mates[1], options: [{ text: 'x', cost: 'y', go() {} }]
    });
    res.single = document.getElementById('modal-body').querySelectorAll('.dab').length;
    Modal.close();
    return res;
  })()`);
  console.log('three-handed event showed ' + shown.cards + ' cards: ' + shown.names.join(', '));
  check('every named third party gets a card', shown.cards === 3, String(shown.cards));
  check('each card shows bond AND trust', shown.relBars === 3 && shown.trustBars === 3,
    shown.relBars + ' bond, ' + shown.trustBars + ' trust');
  check('each card shows a face or a fallback', shown.faces === 3, String(shown.faces));
  check('cards carry tribe colour', shown.coloured === 3, String(shown.coloured));
  check('one castaway still works, not just arrays', shown.single === 1, String(shown.single));

  /* ---- 4. the expanded events are genuinely multi-person ---- */
  const handed = await ev(`(() => {
    /* Count events that pass an ARRAY to about, by inspecting their source. */
    const src = DILEMMA_POOL.map(k => k.run.toString());
    const arrays = src.filter(s => /about:\\s*\\[/.test(s)).length;
    return { total: DILEMMA_POOL.length, arrays };
  })()`);
  console.log('of ' + handed.total + ' new events, ' + handed.arrays + ' name three or more people');
  check('a good share of events span several people', handed.arrays >= 8,
    handed.arrays + ' of ' + handed.total);

  /* ---- 5. NPC blocs form, and can be read ---- */
  const blocs = await ev(`(() => {
    NpcBlocs.reset();
    const P = GAME.player;
    const mates = campmates(P).filter(c => !c.isPlayer);
    /* Warm three of them to each other so a triangle is possible. */
    const trio = mates.slice(0, 3);
    for (const a of trio) for (const b of trio) {
      if (a !== b) { a.addTrust(b.name, 0.5); a.addRel(b.name, 0.5); }
    }
    GAME.day = 8;
    let formed = 0;
    for (let i = 0; i < 40 && !formed; i++) {
      NpcBlocs.dailyUpdate(GAME.cast, GAME.merged);
      formed = NpcBlocs.list.filter(b => !b.broken).length;
    }
    const live = NpcBlocs.list.filter(b => !b.broken);
    /* Do they actually shield each other and converge? */
    const before = live.length ? live[0].members.map(n => {
      const m = GAME.cast.find(c => c.name === n); return m ? m.getVW(live[0].members[0]) : 0;
    }) : [];
    NpcBlocs.seedEffects(GAME.cast, GAME.merged);
    const after = live.length ? live[0].members.map(n => {
      const m = GAME.cast.find(c => c.name === n); return m ? m.getVW(live[0].members[0]) : 0;
    }) : [];
    /* And the reads: sample many observers and see the spread of kinds. */
    const kinds = {};
    for (let i = 0; i < 600; i++) {
      const o = mates[i % mates.length];
      const r = NpcBlocs.readBy(o, GAME.cast, GAME.merged);
      kinds[r.kind] = (kinds[r.kind] || 0) + 1;
      /* Every read with a group must produce a line with no leftover placeholder. */
      if (r.group.length) {
        const line = NpcBlocs.lineFor(r, o);
        if (!line || /\\{[a-z]/.test(line)) return { badLine: line || '(empty)' };
      }
    }
    return {
      formed: live.length,
      size: live.length ? live[0].members.length : 0,
      shielded: after.length > 1 && after[1] < before[1],
      kinds
    };
  })()`);
  if (blocs.badLine) {
    check('bloc lines substitute cleanly', false, 'left a placeholder: ' + blocs.badLine);
  } else {
    console.log('NPC blocs: ' + blocs.formed + ' formed, size ' + blocs.size);
    console.log('  600 reads: ' + Object.entries(blocs.kinds).map(([k, v]) => k + ' ' + v).join(', '));
    check('NPCs form their own blocs', blocs.formed >= 1, String(blocs.formed));
    check('a bloc is three or more', blocs.size >= 3, String(blocs.size));
    check('bloc members shield each other at the vote', blocs.shielded);
    check('bloc lines substitute cleanly', true);
    /* The whole point: reads are graded AND sometimes wrong. */
    check('some reads are confident and correct', (blocs.kinds.sure3 || 0) + (blocs.kinds.sure2 || 0)
      + (blocs.kinds.sure4 || 0) > 0);
    check('some reads are confidently WRONG', (blocs.kinds.wrong || 0) > 0,
      String(blocs.kinds.wrong || 0));
    check('and some people have noticed nothing', (blocs.kinds.nothing || 0) > 0,
      String(blocs.kinds.nothing || 0));
  }

  /* ---- 6. bloc line pools are deep ---- */
  const lines = await ev(`(() => {
    const keys = Object.keys(BLOC_LINES);
    let total = 0;
    for (const k of keys) total += BLOC_LINES[k].length;
    return { keys: keys.length, total, sure3: BLOC_LINES.blocSure3.length };
  })()`);
  console.log('bloc pools: ' + lines.keys + ' keys, ' + lines.total + ' lines');
  check('at least 20 ways to say "those three are close"', lines.sure3 >= 20, String(lines.sure3));
  check('the bloc pools are deep overall', lines.total > 150, String(lines.total));

  check('no page errors throughout', pageErrors.length === 0,
    pageErrors.slice(0, 2).join(' | ') || 'none');

  const ok = !fails.length;
  if (fails.length) console.log(NL + 'failing checks: ' + fails.join(', '));
  console.log(ok ? NL + 'SOCIAL TEST PASS' : NL + 'SOCIAL TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
