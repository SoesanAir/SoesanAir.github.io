/* Does the alliance circle actually DO anything the player can see?

   Distinct from circle-test.js, which covers the older vouching bug. This one is
   about the MEETING: the feature added after the verdict "the circle is unclear —
   how do I talk to all of them at once? how does it actually help?" So the checks
   are about legibility and payoff rather than internal consistency:

     1. There is a way to address the whole group, and it opens.
     2. Lines arrive ONE AT A TIME. Two people talking at once has been the most
        reported readability fault in this game and it does not get to come back in
        a new screen.
     3. An agreed plan measurably moves the members' votes toward the target —
        much harder than the passive drift, or the meeting was pointless.
     4. Meeting has a price: visibility rises, and a visible bloc draws real heat.
     5. A wobbly member can leak; a solid circle does not.
     6. After the vote, the player is TOLD whether the circle held.

   Run: node tools/circle-meeting-test.js */
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
    '--user-data-dir=' + os.tmpdir() + '\\cw-cmeet-' + RUN_ID,
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
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>/skip tutorial/i.test(b.textContent));if(b)b.click();})()`);
  await sleep(300);
  await ev(`DBG.setEnabled(false); window.toast=()=>{}; Telemetry.cfg.auto=false; true;`);

  /* ---- 1. a circle exists and can be addressed ---- */
  const made = await ev(`(() => {
    const P = GAME.player;
    const mates = campmates(P).filter(c => !c.isPlayer).slice(0, 3);
    /* Warm everyone to everyone, so the circle starts solid and the leak trial
       later has somewhere to fall FROM. */
    for (const a of [P, ...mates]) {
      if (a.isPlayer) continue;
      for (const b of [P, ...mates]) {
        if (a === b) continue;
        a.addTrust(b.name, 0.5); a.addRel(b.name, 0.5);
      }
    }
    Coalitions.reset();
    Coalitions.form([P.name, ...mates.map(m => m.name)], GAME.day);
    const c = Coalitions.active(P.name);
    const coh = Coalitions.cohesion(c, GAME.cast);
    return { members: c.members.length, cohesion: +coh.toFixed(3), label: Coalitions.label(coh) };
  })()`);
  await ev(`renderActions(); true;`);
  const btn = await ev(`[...document.querySelectorAll('#action-bar button')].some(b => /pact/i.test(b.textContent))`);
  console.log(`\ncircle of ${made.members}, cohesion ${made.cohesion} (${made.label})`);
  check('a circle produces a way to address the whole group', btn, 'Pact button in the action bar');
  check('cohesion is a real reading, not a constant', made.cohesion > 0 && made.cohesion < 1, String(made.cohesion));

  /* ---- 2. the meeting opens, and delivers one line per tap ---- */
  await ev(`CircleMeeting.start(); true;`);
  await sleep(450);
  check('the meeting opens', await ev(`document.getElementById('pact-layer').classList.contains('open')`));
  const memCards = await ev(`document.querySelectorAll('#ci-members .ci-mem').length`);
  check('every member is shown with a loyalty read', memCards === made.members - 1,
    `${memCards} cards for ${made.members - 1} others`);

  let bursts = 0, taps = 0;
  let prev = await ev(`document.querySelectorAll('#ci-convo .ci-turn').length`);
  for (let i = 0; i < 10; i++) {
    if (!(await ev(`!!document.querySelector('#ci-choices .ci-next')`))) break;
    await ev(`document.querySelector('#ci-choices .ci-next').click()`);
    await sleep(190);
    taps++;
    const now = await ev(`document.querySelectorAll('#ci-convo .ci-turn').length`);
    /* The transcript trims itself at 7, so count ADDED lines, not the total. */
    if (now - prev > 1) bursts++;
    prev = Math.min(now, 7);
  }
  check('lines arrive one at a time', bursts === 0, `${taps} advances, ${bursts} delivered more than one`);
  check('the huddle then offers real choices', await ev(`document.querySelectorAll('#ci-choices .btn').length >= 3`));

  /* ---- 2b. drive a name all the way through ----
     Stopping at the menu is not enough. The first version of this test did, and
     the whole putNameUp path was calling a Journal method that does not exist
     (Journal.action instead of Journal.event) — it would have thrown the moment
     anybody actually put a name up in a real season. Click all the way to the end
     and require the layer to close cleanly with no page errors. */
  const pageErrors = [];
  ws.on('message', m => {
    const j = JSON.parse(m);
    if (j.method === 'Runtime.exceptionThrown') {
      const d = j.params.exceptionDetails || {};
      pageErrors.push(String((d.exception && d.exception.description) || d.text || '').split('\n')[0]);
    }
  });
  await ev(`(() => { const b = [...document.querySelectorAll('#ci-choices .btn')]
      .find(x => /put a name up/i.test(x.textContent)); if (b) b.click(); })()`);
  await sleep(250);
  const gotTargets = await ev(`document.querySelectorAll('#ci-choices .btn').length > 1`);
  check('putting a name up offers targets', gotTargets);
  await ev(`(() => { const b = [...document.querySelectorAll('#ci-choices .btn')]
      .find(x => !/not yet/i.test(x.textContent)); if (b) b.click(); })()`);
  /* Now tap through every reaction to the end of the scene. */
  for (let i = 0; i < 20; i++) {
    await sleep(200);
    if (!(await ev(`document.getElementById('pact-layer').classList.contains('open')`))) break;
    const n = await ev(`(() => { const b = document.querySelector('#ci-choices .ci-next')
        || document.querySelector('#ci-choices .btn'); if (b) { b.click(); return true; } return false; })()`);
    if (!n) break;
  }
  await sleep(400);
  const closed = await ev(`!document.getElementById('pact-layer').classList.contains('open')`);
  check('a name can be put up and the scene finishes', closed, 'layer closed');
  check('no page errors while putting a name up', pageErrors.length === 0,
    pageErrors.slice(0, 2).join(' | ') || 'none');
  const planned = await ev(`(() => {
    const c = Coalitions.active(GAME.player.name);
    return c && c.plan ? { target: dnOf(c.plan.target), firm: +c.plan.firm.toFixed(2) } : null;
  })()`);
  console.log(planned ? `  the room agreed on ${planned.target} (firmness ${planned.firm})`
    : '  the room agreed nothing (a legitimate outcome)');

  /* ---- 3. an agreed plan moves votes ----
     Measured against the SAME circle with no plan, so this isolates the plan from
     the shielding and drift the circle already provided. */
  const plan = await ev(`(() => {
    CircleMeeting.close();
    const P = GAME.player;
    const c = Coalitions.active(P.name);
    const npcs = Coalitions.npcMembers(c, GAME.cast);
    const outs = campmates(P).filter(x => !c.members.includes(x.name) && !x.isPlayer);
    const target = outs[0];
    const measure = () => {
      seedVoteWeights(GAME.cast, GAME.merged, P.name);
      return npcs.reduce((s, m) => s + m.getVW(target.name), 0) / npcs.length;
    };
    c.plan = null; c.visibility = 0;
    const without = measure();
    Coalitions.setPlan(c, target.name, npcs.map(m => m.name), GAME.cast);
    const withPlan = measure();
    return {
      target: target.displayName, without: +without.toFixed(3), withPlan: +withPlan.toFixed(3),
      gain: +(withPlan - without).toFixed(3), visibility: +c.visibility.toFixed(2)
    };
  })()`);
  console.log(`\nmean vote weight toward ${plan.target}: ${plan.without} with no plan,`
    + ` ${plan.withPlan} once agreed (+${plan.gain})`);
  check('an agreed plan measurably moves the circle\'s votes', plan.gain > 0.5, `+${plan.gain}`);
  check('holding a meeting makes the bloc more visible', plan.visibility > 0, String(plan.visibility));

  /* ---- 4. a visible bloc draws heat from outsiders ---- */
  const heat = await ev(`(() => {
    const P = GAME.player;
    const c = Coalitions.active(P.name);
    const outs = campmates(P).filter(x => !c.members.includes(x.name) && !x.isPlayer);
    const sum = () => outs.reduce((s, o) => s + c.members.reduce((t, n) => t + Math.max(0, o.getVW(n)), 0), 0);
    /* Noticing a bloc is gated on game awareness, so on a cast that happens to roll
       oblivious outsiders the heat is legitimately zero — which made this check
       flake at 0 once. Pin awareness: the mechanism is what is under test, not
       whether this particular tribe contains anybody paying attention. */
    for (const o of outs) o.stats.gameAwareness = 0.7;
    for (const o of outs) o.resetVW();
    c.visibility = 0;
    Coalitions.applyVisibility(GAME.cast, GAME.merged);
    const hidden = sum();
    for (const o of outs) o.resetVW();
    c.visibility = 1;
    Coalitions.applyVisibility(GAME.cast, GAME.merged);
    const seen = sum();
    /* Diagnostics, because this check went from 5.39 to 0 after an earlier step in
       this same test started actually playing the scene — so the state it depends
       on is worth reporting rather than guessing at. */
    return {
      hidden: +hidden.toFixed(2), seen: +seen.toFixed(2),
      broken: !!c.broken, breakReason: c.breakReason || '',
      members: c.members.length, outs: outs.length,
      sharpEnough: outs.filter(o => o.stats.gameAwareness > 0.38).length
    };
  })()`);
  if (heat.broken) console.log(`  (the circle is broken: ${heat.breakReason})`);
  console.log(`  ${heat.members} members, ${heat.outs} outsiders,`
    + ` ${heat.sharpEnough} of them sharp enough to notice`);
  console.log(`heat on the circle: ${heat.hidden} while unnoticed, ${heat.seen} once obvious`);
  check('an unnoticed circle is not punished', heat.hidden < 0.01, String(heat.hidden));
  check('an obvious bloc gets written down', heat.seen > 0.5, String(heat.seen));

  /* ---- 5. leaks: loyalty is the whole risk ---- */
  const leak = await ev(`(() => {
    const P = GAME.player;
    const c = Coalitions.active(P.name);
    const npcs = Coalitions.npcMembers(c, GAME.cast);
    const outs = campmates(P).filter(x => !c.members.includes(x.name) && !x.isPlayer);
    const target = outs[0];
    const set = (m, who, v) => {
      const e = m.relationships.get(who) || {};
      m.relationships.set(who, Object.assign({}, e, { trust: v, rel: v }));
    };
    const trial = loyal => {
      let leaks = 0;
      const N = 200;
      for (let i = 0; i < N; i++) {
        for (const m of npcs) {
          set(m, P.name, loyal ? 0.92 : 0.10);
          for (const o of npcs) if (o !== m) set(m, o.name, loyal ? 0.90 : 0.10);
          set(m, target.name, loyal ? 0.10 : 0.90);
        }
        c.plan = { target: target.name, day: GAME.day, agreed: npcs.map(m => m.name), firm: 1, resolved: false };
        c.leaked = null;
        if (Coalitions.rollLeak(c, GAME.cast)) leaks++;
      }
      return leaks / N;
    };
    return { solid: +trial(true).toFixed(3), wobbly: +trial(false).toFixed(3) };
  })()`);
  console.log(`leak rate: ${(leak.solid * 100).toFixed(0)}% from a solid circle,`
    + ` ${(leak.wobbly * 100).toFixed(0)}% from a wobbly one`);
  check('a solid circle does not leak', leak.solid < 0.06, `${(leak.solid * 100).toFixed(0)}%`);
  check('a wobbly circle leaks', leak.wobbly > 0.25, `${(leak.wobbly * 100).toFixed(0)}%`);

  /* ---- 6. the player is told whether the plan held ---- */
  const review = await ev(`(() => {
    const P = GAME.player;
    const c = Coalitions.active(P.name);
    const npcs = Coalitions.npcMembers(c, GAME.cast);
    const outs = campmates(P).filter(x => !c.members.includes(x.name) && !x.isPlayer);
    const target = outs[0];
    c.plan = { target: target.name, day: GAME.day, agreed: npcs.map(m => m.name), firm: 1, resolved: false };
    const votes = new Map();
    npcs.forEach((m, i) => votes.set(m.name, i === npcs.length - 1 ? P.name : target.name));
    const r = Coalitions.reviewPlan(c, votes, GAME.cast);
    return r ? {
      kept: r.kept.length, broke: r.broke.length,
      twice: !!Coalitions.reviewPlan(c, votes, GAME.cast), npcs: npcs.length
    } : null;
  })()`);
  check('the review counts who kept the plan and who did not',
    !!review && review.broke === 1 && review.kept === review.npcs - 1,
    review ? `${review.kept} kept, ${review.broke} broke, of ${review.npcs}` : 'no review returned');
  check('a plan is only reviewed once', !!review && !review.twice);

  const ok = !fails.length;
  if (fails.length) console.log('\nfailing checks: ' + fails.join(', '));
  console.log(ok ? '\nCIRCLE MEETING TEST PASS' : '\nCIRCLE MEETING TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
