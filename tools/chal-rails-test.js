/* The tribe rails: can you see who is carrying the challenge?

   On the show you always know who is winning a challenge and who is losing it for
   their tribe. This game used to play a minigame in a box and then print a tribe
   name — everything the sim knew about who carried it was thrown away.

   The rails only mean something if they are driven by the REAL result, so the
   load-bearing check here is the pre-scoring: NPC form must be rolled once, before
   the player plays, and must not change when it is read again. score() contains an
   rr() call, so without the cache every read returns a different number and the
   rails would be animation rather than information.

   Run: node tools/chal-rails-test.js */
const http = require('http'), { spawn } = require('child_process'), os = require('os');
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
    '--no-first-run', '--window-size=900,430',
    '--user-data-dir=' + os.tmpdir() + '\\cw-rails-' + RUN_ID,
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
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  const waitFor = async s => {
    for (let i = 0; i < 80; i++) { if (await ev(`!!document.querySelector(${JSON.stringify(s)})`)) return; await sleep(250); }
    throw new Error('no ' + s);
  };
  const fails = [];
  const check = (n, ok, d) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${n}${d ? '  — ' + d : ''}`); if (!ok) fails.push(n); };

  await waitFor('#screen-title.active');
  await ev(`localStorage.clear()`);
  await send('Page.reload', { ignoreCache: true });
  await waitFor('#screen-title.active'); await sleep(300);
  await ev(`document.getElementById('btn-new-game').click()`);
  await waitFor('#screen-create.active');
  await ev(`GAME.fastMaroon = true; GAME.fastChallenge = true; document.getElementById('btn-create-go').click()`);
  for (let i = 0; i < 400; i++) {
    if (await ev(`!!document.querySelector('#screen-camp.active')`)) break;
    await ev(`(() => { const b = document.querySelector('#maroon-choices button') || document.querySelector('.maroon-next'); if (b && !b.disabled) b.click(); })()`);
    await sleep(120);
  }
  await waitFor('#screen-camp.active');
  await ev(`DBG.setEnabled(false); window.toast=()=>{}; Telemetry.cfg.auto=false; true;`);

  /* ---- 1. pre-scoring is stable ----
     The whole feature rests on this. If a second read re-rolls, the rails lie. */
  const stable = await ev(`(() => {
    const chal = CHALLENGES.find(c => c.cat === 'Physical') || CHALLENGES[0];
    const field = aliveTribe('Tidal').concat(aliveTribe('Ember'));
    Challenges.prescore(chal, field);
    const first = field.filter(c => !c.isPlayer).map(c => c.lastChallengeScore);
    /* Read every one again, the way runTribal will. */
    const second = field.filter(c => !c.isPlayer).map(c => Challenges.score(c, chal));
    const drift = first.reduce((s, v, i) => s + Math.abs(v - second[i]), 0);
    /* And a DIFFERENT challenge must not be served from the cache. */
    const other = CHALLENGES.find(c => c !== chal);
    const npc = field.find(c => !c.isPlayer);
    const a = Challenges.score(npc, other), b = Challenges.score(npc, other);
    Challenges.clearPrescore();
    /* Once cleared, re-reading the original SHOULD roll fresh again. */
    const afterClear = Challenges.score(npc, chal);
    return {
      n: first.length, drift: +drift.toFixed(6),
      spread: +(Math.max(...first) - Math.min(...first)).toFixed(3),
      otherRerolls: Math.abs(a - b) > 0.000001,
      clearedRerolls: Math.abs(afterClear - first[0]) > 0.000001
    };
  })()`);
  console.log(`\npre-scored ${stable.n} NPCs, score spread ${stable.spread}`);
  check('re-reading a pre-scored castaway returns the SAME number', stable.drift < 0.000001,
    `total drift ${stable.drift}`);
  check('the field has real spread to show on a rail', stable.spread > 0.1, String(stable.spread));
  check('an unrelated challenge is not served from the cache', stable.otherRerolls);
  check('clearing the cache restores fresh rolls', stable.clearedRerolls);

  /* ---- 2. the player's projection uses the same formula and commits nothing ---- */
  const proj = await ev(`(() => {
    const chal = CHALLENGES.find(c => c.cat === 'Physical') || CHALLENGES[0];
    const P = GAME.player;
    const before = GAME.playerPerf;
    const weak = Challenges.projectPlayer(chal, 0.05);
    const strong = Challenges.projectPlayer(chal, 0.95);
    return {
      weak: +weak.toFixed(3), strong: +strong.toFixed(3),
      rises: strong > weak,
      perfUntouched: GAME.playerPerf === before
    };
  })()`);
  console.log(`player projection: ${proj.weak} at a fumbled round, ${proj.strong} at a flawless one`);
  check('playing better raises the player\'s rail position', proj.rises,
    `${proj.weak} -> ${proj.strong}`);
  check('projecting does not leak into GAME.playerPerf', proj.perfUntouched);

  /* ---- 3. the rails render, both tribes, everyone on them ---- */
  const rails = await ev(`(() => {
    const chal = CHALLENGES.find(c => c.cat === 'Physical') || CHALLENGES[0];
    const field = aliveTribe('Tidal').concat(aliveTribe('Ember'));
    Challenges.prescore(chal, field);
    Challenge.setRoster(buildChallengeRoster(chal));
    const layer = document.getElementById('chal-game');
    layer.innerHTML = ''; layer.classList.remove('railed');
    const st = Challenge.buildRails(layer, chal);
    const stop = Challenge.driveRails(st, chal);
    const chips = layer.querySelectorAll('.cg-chip');
    const res = {
      railed: layer.classList.contains('railed'),
      railCount: layer.querySelectorAll('.cg-rail').length,
      chips: chips.length,
      field: field.length,
      me: layer.querySelectorAll('.cg-chip.me').length,
      /* Tribes.mark paints --t-color; without it every chip is the same colour. */
      coloured: [...chips].filter(c => c.style.getPropertyValue('--t-color')).length,
      /* Names must be readable, not truncated to nothing. */
      emptyNames: [...layer.querySelectorAll('.cg-chip-name')].filter(n => !n.textContent.trim()).length,
      longNames: [...layer.querySelectorAll('.cg-chip-name')].filter(n => n.textContent.length > 10).length
    };
    stop();
    Challenge.setRoster(null);
    Challenges.clearPrescore();
    layer.innerHTML = ''; layer.classList.remove('railed');
    return res;
  })()`);
  console.log(`rails: ${rails.railCount} columns, ${rails.chips} chips for a field of ${rails.field}`);
  check('two rails are built', rails.railCount === 2, String(rails.railCount));
  check('the layer knows it is railed (so the arena narrows)', rails.railed);
  check('every castaway in the field is on a rail', rails.chips === rails.field,
    `${rails.chips} of ${rails.field}`);
  check('the player is marked on their own rail', rails.me === 1, String(rails.me));
  check('chips carry their tribe colour', rails.coloured === rails.chips,
    `${rails.coloured} of ${rails.chips}`);
  check('no chip name is blank', rails.emptyNames === 0, String(rails.emptyNames));
  check('no chip name overflows the rail', rails.longNames === 0, `${rails.longNames} over 10 chars`);

  /* ---- 4. chips actually MOVE, and settle in the true order ---- */
  const moved = await ev(`(async () => {
    const chal = CHALLENGES.find(c => c.cat === 'Physical') || CHALLENGES[0];
    const field = aliveTribe('Tidal').concat(aliveTribe('Ember'));
    Challenges.prescore(chal, field);
    Challenge.setRoster(buildChallengeRoster(chal));
    const layer = document.getElementById('chal-game');
    layer.innerHTML = ''; layer.classList.remove('railed');
    const st = Challenge.buildRails(layer, chal);
    const stop = Challenge.driveRails(st, chal);
    const snap = () => st.chips.map(x => x.pos);
    const t0 = snap();
    await new Promise(r => setTimeout(r, 900));
    const t1 = snap();
    /* Let it settle, then check the ORDER agrees with the real scores.
       Exact positional match is the wrong property to assert with eighteen
       castaways: adjacent ranks are a twentieth of the rail apart, so any jitter
       at all reshuffles neighbours, and a rail that never reshuffles neighbours
       is not showing a contest. Rank CORRELATION is the honest measure — the rail
       must broadly agree with the result, not be a sorted list. */
    await new Promise(r => setTimeout(r, 5200));
    const t2 = snap();
    const n = st.chips.length;
    const rank = vals => {
      const order = vals.map((v, i) => ({ i, v })).sort((a, b) => b.v - a.v);
      const r = new Array(n);
      order.forEach((o, k) => { r[o.i] = k; });
      return r;
    };
    const rPos = rank(t2);
    const rSc = rank(st.chips.map(x => x.c.lastChallengeScore));
    /* Spearman's rho. */
    let d2 = 0;
    for (let i = 0; i < n; i++) d2 += (rPos[i] - rSc[i]) ** 2;
    const rho = 1 - (6 * d2) / (n * (n * n - 1));
    const drift = t0.reduce((s, v, i) => s + Math.abs(v - t1[i]), 0);
    /* And it must actually have gone quiet, or the order on screen at the moment
       the score is read is still a coin flip. */
    const a = snap();
    await new Promise(r => setTimeout(r, 500));
    const b = snap();
    const lateJitter = a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0);
    stop();
    Challenge.setRoster(null); Challenges.clearPrescore();
    layer.innerHTML = ''; layer.classList.remove('railed');
    return {
      drift: +drift.toFixed(3), lateJitter: +lateJitter.toFixed(3),
      rho: +rho.toFixed(3), of: n,
      /* The true leader must END UP AT THE TOP OF THE RAIL — but "top" has to mean
         top-two, not exactly first. Scores cluster, and when the best two are
         within the jitter the rail legitimately shows them swapped; demanding an
         exact match asserts that a near-tie resolves the same way every time,
         which is not a property this system has or should have. rho below already
         covers whether the order as a whole is right. */
      leaderRailRank: rPos[rSc.indexOf(0)]
    };
  })()`);
  console.log(`chips moved ${moved.drift} in the first second, ${moved.lateJitter} once settled;`
    + ` final order vs true scores: rho ${moved.rho} over ${moved.of} castaways`);
  check('the rails animate rather than sitting still', moved.drift > 0.05, String(moved.drift));
  check('the rails go quiet before the result is read', moved.lateJitter < moved.drift * 0.25,
    `${moved.lateJitter} late vs ${moved.drift} early`);
  check('the strongest performer ends up at the top of the rail', moved.leaderRailRank <= 1,
    `the best score sits ${moved.leaderRailRank === 0 ? '1st' : moved.leaderRailRank === 1 ? '2nd' : (moved.leaderRailRank + 1) + 'th'} on the rail`);
  check('the settled order agrees with the real result', moved.rho > 0.9, `rho ${moved.rho}`);

  /* ---- 5. the standings survive onto the summary screen ---- */
  const summary = await ev(`(() => {
    const chal = CHALLENGES.find(c => c.cat === 'Physical') || CHALLENGES[0];
    const field = aliveTribe('Tidal').concat(aliveTribe('Ember'));
    Challenges.prescore(chal, field);
    const host = document.createElement('div');
    renderChallengeStandings(host, field, { title: 'Who carried it', mark: c => c.isPlayer ? 'YOU' : '' });
    const rows = host.querySelectorAll('.cs-row');
    const widths = [...host.querySelectorAll('.cs-bar > i')].map(i => parseFloat(i.style.width) || 0);
    /* Positions shown, and how many rows the gap markers claim were skipped. */
    const pos = [...host.querySelectorAll('.cs-pos')].map(p => parseInt(p.textContent, 10));
    /* [0-9] not \\d: this whole block is injected through a JS template literal,
       where \\d is an invalid escape that silently collapses to a bare "d". The
       regex became /d+/, matched nothing in "+2 more", and reported 0 rows
       skipped — which read as the gap markers being absent when they were there.
       A character class cannot be mangled that way. */
    const gaps = [...host.querySelectorAll('.cs-gap')]
      .map(g => parseInt((g.textContent.match(/[0-9]+/) || [0])[0], 10));
    const skipped = gaps.reduce((a, b) => a + b, 0);
    Challenges.clearPrescore();
    return {
      rows: rows.length, field: field.length,
      descending: widths.every((w, i) => i === 0 || w <= widths[i - 1] + 0.01),
      topFull: widths[0] === 100,
      tagged: host.querySelectorAll('.cs-tag').length,
      pos, skipped,
      hasRankNote: !!host.querySelector('.cs-rank-note'),
      rankNote: (host.querySelector('.cs-rank-note') || {}).textContent || ''
    };
  })()`);
  /* This used to assert the summary listed the WHOLE field, which is exactly the
     behaviour that was removed: eighteen rows overflowed a 344px screen by 158px
     with nothing scrollable and put the Continue button out of reach. The property
     now is that it shows a useful FEW and is honest about what it left out. */
  check('the summary is compact, not the whole field', summary.rows <= 6 && summary.rows >= 3,
    `${summary.rows} rows for a field of ${summary.field}`);
  check('every row it does show is accounted for',
    summary.rows + summary.skipped === summary.field,
    `${summary.rows} shown + ${summary.skipped} marked skipped = ${summary.rows + summary.skipped} of ${summary.field}`);
  check('rows carry their finishing position', summary.pos.length === summary.rows
    && summary.pos.every((p, i) => i === 0 || p > summary.pos[i - 1]),
    summary.pos.join(', '));
  check('the player is told where they actually finished', summary.hasRankNote,
    summary.rankNote);
  check('the summary is ordered best to worst', summary.descending);
  check('the bars are scaled to the field', summary.topFull);
  check('the player is tagged on the summary', summary.tagged === 1, String(summary.tagged));

  const ok = !fails.length;
  if (fails.length) console.log('\nfailing checks: ' + fails.join(', '));
  console.log(ok ? '\nCHALLENGE RAILS TEST PASS' : '\nCHALLENGE RAILS TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
