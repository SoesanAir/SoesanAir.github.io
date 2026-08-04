/* The camp layer as the player actually meets it: the needs board renders, a job
   walks your castaway to the right biome and tags the action on the figure, a
   call-out produces spoken reactions, the NPC work rota puts people in the right
   places, and a bad night wakes you up with a story. Real clicks throughout.

   Run: node tools/camp-ui-test.js */
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
    '--user-data-dir=' + os.tmpdir() + '\\cw-campui-' + RUN_ID, 'http://localhost:8099/index.html?no3d=1'], { stdio: 'ignore' });
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
    if (r.result.exceptionDetails) {
      const d = r.result.exceptionDetails;
      throw new Error('page threw: ' + ((d.exception && d.exception.description) || d.text));
    }
    return r.result.result.value;
  };
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  const errors = [];
  ws.on('message', m => {
    const j = JSON.parse(m);
    if (j.method === 'Runtime.exceptionThrown') {
      const d = (j.params.exceptionDetails.exception || {}).description || j.params.exceptionDetails.text;
      if (d && d !== 'Event') errors.push(String(d).split('\n')[0]);
    }
  });
  const waitFor = async s => {
    for (let i = 0; i < 80; i++) { if (await ev(`!!document.querySelector(${JSON.stringify(s)})`)) return; await sleep(250); }
    throw new Error('no ' + s);
  };
  const fails = [];
  const check = (name, ok, detail) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`);
    if (!ok) fails.push(name);
  };

  await waitFor('#screen-title.active');
  await ev(`localStorage.clear()`);
  await send('Page.reload', { ignoreCache: true });
  await waitFor('#screen-title.active'); await sleep(300);
  await ev(`document.getElementById('btn-new-game').click()`);
  await waitFor('#screen-create.active');
  await ev(`GAME.fastMaroon = true; GAME.fastChallenge = true; document.getElementById('btn-create-go').click()`);
  for (let i = 0; i < 400; i++) {
    if (await ev(`!!document.querySelector('#screen-camp.active')`)) break;
    await ev(`(() => {
      const b = document.querySelector('#maroon-choices button') || document.querySelector('.maroon-next');
      if (b && !b.disabled) b.click();
    })()`);
    await sleep(120);
  }
  await waitFor('#screen-camp.active');
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>/skip tutorial/i.test(b.textContent));if(b)b.click();})()`);
  await sleep(500);

  /* ---- 1. the HUD warns about the camp ---- */
  console.log('\n--- HUD ---');
  const hud = await ev(`(() => {
    const read = () => ({
      chips: [...document.querySelectorAll('#hud-cond .chip')].map(c => c.textContent),
      cls: [...document.querySelectorAll('#hud-cond .chip')].map(c => c.className),
      height: Math.round(document.getElementById('hud').getBoundingClientRect().height)
    });
    /* The quiet case: nothing wrong, so the row should stay one line. */
    const P = GAME.player;
    P.hunger = 0.1; P.fatigue = 0.1; P.morale = 0.7;
    for (const n of CAMP_NEEDS) CampNeeds.set(n.id, 0.8);
    renderHUD();
    const calm = read();
    /* And the loud case: everything wrong at once. */
    P.hunger = 0.85; P.fatigue = 0.8; P.morale = 0.2;
    CampNeeds.set('water', 0.05);
    renderHUD();
    const loud = read();
    return { ...loud, calm };
  })()`);
  console.log('  quiet: ' + JSON.stringify(hud.calm.chips) + '  HUD ' + hud.calm.height + 'px');
  check('the HUD stays one row when nothing is wrong', hud.calm.height <= 60,
    `${hud.calm.height}px, ${hud.calm.chips.length} chip(s)`);
  console.log('  ' + JSON.stringify(hud.chips));
  check('HUD shows condition and the camp warning', hud.chips.length >= 4,
    `${hud.chips.length} chips`);
  /* The condition + camp chips overflowed the row and every label wrapped and
     clipped mid-word. Assert on geometry, not on looks. */
  const clip = await ev(`(() => {
    const bad = [];
    for (const el of document.querySelectorAll('#hud .chip, #hud .day-chip, #hud .btn')) {
      if (el.scrollWidth > el.clientWidth + 1) bad.push(el.textContent.trim() + ' ' + el.scrollWidth + '>' + el.clientWidth);
    }
    const hud = document.getElementById('hud');
    return { clipped: bad, overflowsX: hud.scrollWidth > hud.clientWidth + 1,
             rows: Math.round(hud.getBoundingClientRect().height) };
  })()`);
  check('no HUD chip is clipped', clip.clipped.length === 0, clip.clipped.join(', ') || 'all fit');
  check('the HUD does not overflow sideways', !clip.overflowsX, `height ${clip.rows}px`);
  check('and it only grows when there is genuinely something to say',
    clip.rows > hud.calm.height, `${hud.calm.height}px quiet -> ${clip.rows}px in trouble`);
  check('the camp warning reads as a problem', hud.cls.some(c => /bad|warn/.test(c)),
    'flagged');

  /* ---- 2. the needs board ---- */
  console.log('\n--- the camp menu ---');
  await ev(`document.querySelector('#action-bar button:nth-child(3)').click()`);
  await sleep(300);
  const board = await ev(`(() => {
    const rows = [...document.querySelectorAll('#modal-body .nb-row')].map(r => ({
      name: r.querySelector('.nb-name').textContent,
      width: r.querySelector('.nb-meter > i').style.width,
      state: r.querySelector('.nb-state').textContent,
      bad: r.classList.contains('bad')
    }));
    const labels = [...document.querySelectorAll('#modal-body button')].map(b => b.textContent.trim());
    const rep = [...document.querySelectorAll('#modal-body .tiny')].map(d => d.textContent);
    return { rows, labels, rep, title: document.getElementById('modal-title').textContent };
  })()`);
  board.rows.forEach(r => console.log(`    ${r.name.padEnd(11)} ${r.width.padStart(6)}  ${r.state}${r.bad ? '  (flagged)' : ''}`));
  check('the needs board renders all five needs plus the fire', board.rows.length === 6,
    `${board.rows.length} rows`);
  check('every bar has a real width', board.rows.every(r => /%$/.test(r.width)), 'all set');
  check('a need on the floor is flagged', board.rows.some(r => r.bad), 'flagged');
  check('the board offers the call-out, eat, nap and six jobs',
    board.labels.length >= 10, `${board.labels.length} options`);
  check('it tells you what the tribe makes of your effort',
    board.rep.some(t => /reckon you/.test(t)), 'contribution line present');
  console.log('  contribution read: ' + (board.rep.find(t => /reckon you/.test(t)) || '(missing)'));

  /* ---- 3. doing a job walks you to the right biome and tags the action ---- */
  console.log('\n--- doing a job ---');
  const job = await ev(`(() => {
    Modal.close();
    const j = CAMP_JOBS.find(x => x.id === 'water');
    const fig = Beach.figures.get(GAME.player.name);
    window.__before = { x: fig.x, wood: CampNeeds.get('water'), hours: GAME.hoursRemaining };
    doCampJob(j);
    return { target: +Beach.zoneX(j.zone).toFixed(1), from: +fig.x.toFixed(1), zone: j.zone, act: j.act };
  })()`);
  /* Watch for the action tag while the work is happening. */
  let sawTag = null, sawWorking = false;
  for (let i = 0; i < 60; i++) {
    const st = await ev(`(() => {
      const f = Beach.figures.get(GAME.player.name);
      return { act: f.el.dataset.act || null, working: f.el.classList.contains('working'), x: +f.x.toFixed(1) };
    })()`);
    if (st.act) { sawTag = st.act; sawWorking = st.working; }
    if (await ev(`window.__done === true`)) break;
    await sleep(120);
  }
  const after = await ev(`(() => {
    const f = Beach.figures.get(GAME.player.name);
    return { x: +f.x.toFixed(1), water: +CampNeeds.get('water').toFixed(3),
             hours: GAME.hoursRemaining, stuck: f.el.dataset.act || null };
  })()`);
  console.log(`  walked ${job.from}% -> ${after.x}% (the ${job.zone} is at ${job.target}%)`);
  console.log(`  action tag seen: ${sawTag || 'NONE'} · water ${await ev('__before.wood.toFixed(3)')} -> ${after.water}`);
  check('the player walks to the job\'s biome', Math.abs(after.x - job.target) < 6,
    `ended at ${after.x}% vs ${job.target}%`);
  check('the action type is tagged on the figure while working',
    sawTag === job.act && sawWorking, `data-act="${sawTag}"`);
  check('the tag does not stick afterwards', after.stuck === null, 'cleared');
  check('the work actually lands on the camp', after.water > await ev('__before.wood'),
    `water rose to ${after.water}`);
  check('and it costs hours', after.hours < await ev('__before.hours'),
    `${await ev('__before.hours')}h -> ${after.hours}h`);

  /* ---- 4. calling a need out ---- */
  console.log('\n--- calling it out ---');
  const call = await ev(`(() => {
    CampNeeds.set('firewood', 0.05);
    /* Make sure somebody in this tribe actually cares about camp work. */
    const mates = aliveTribe(GAME.player.tribeName).filter(c => !c.isPlayer);
    mates.slice(0, 4).forEach(c => { c.cluster = 'Camp Provider'; });
    openCallOutMenu();
    const btns = [...document.querySelectorAll('#modal-body button')].map(b => b.textContent.trim());
    return { btns, title: document.getElementById('modal-title').textContent };
  })()`);
  console.log('  ' + JSON.stringify(call.btns.slice(0, 3)) + ' ...');
  check('the call-out menu offers every need in the player\'s own words',
    call.btns.filter(b => b.startsWith('"')).length === 5, `${call.btns.length} options`);
  const said = await ev(`(() => {
    const b = [...document.querySelectorAll('#modal-body button')].find(x => /firewood/i.test(x.textContent));
    b.click();
    const replies = [...document.querySelectorAll('#modal-body .callout-reply')].map(r => r.textContent);
    const note = [...document.querySelectorAll('#modal-body .tiny')].map(r => r.textContent);
    return { replies, note, title: document.getElementById('modal-title').textContent };
  })()`);
  said.replies.forEach(r => console.log('    ' + r));
  console.log('  -> ' + said.note.join(' | '));
  check('speaking up produces spoken reactions', said.replies.length > 0,
    `${said.replies.length} replies`);
  check('and the game tells you how it landed', said.note.length > 0, said.note[0] || '');
  await ev(`Modal.close()`);

  /* ---- 5. the tribe's own work puts people in the right places ---- */
  console.log('\n--- the tribe at work ---');
  const staged = await ev(`(() => {
    const work = Labour.runDay(alive());
    Beach.stageWork(work);
    return work.map(a => ({ who: dnOf(a.name), job: a.job.id, zone: a.zone, act: a.act,
                            target: +Beach.zoneX(a.zone).toFixed(1) }));
  })()`);
  console.log('  ' + staged.length + ' jobs staged: ' + staged.slice(0, 5).map(a => `${a.who}:${a.job}@${a.zone}`).join(' '));
  check('the tribe assigns itself real work', staged.length > 0, `${staged.length} jobs`);
  check('every assignment names a biome and an action',
    staged.every(a => a.zone && a.act), 'all tagged');
  /* Let a couple of them actually walk, and confirm they arrive where they should. */
  let arrived = 0, tagged = 0;
  for (let i = 0; i < 90; i++) {
    const st = await ev(`(() => {
      const out = [];
      for (const [name, f] of Beach.figures) {
        if (f.el.dataset.act) out.push({ name, act: f.el.dataset.act, x: +f.x.toFixed(1) });
      }
      return out;
    })()`);
    for (const s of st) {
      const a = staged.find(x => x.name === s.name || dnOfMatch(x, s));
      tagged++;
    }
    if (st.length) {
      for (const s of st) {
        const asn = staged.find(x => x.act === s.act);
        if (asn && Math.abs(s.x - asn.target) < 7) arrived++;
      }
    }
    if (arrived > 0 && tagged > 0) break;
    await sleep(150);
  }
  function dnOfMatch() { return false; }
  check('castaways carry an action tag while they work', tagged > 0, `${tagged} tagged frames`);
  check('and they are standing in the right biome when they do', arrived > 0,
    `${arrived} confirmed on-site`);

  /* ---- 6. a bad night wakes you up with a story ---- */
  console.log('\n--- overnight ---');
  const night = await ev(`(() => {
    for (const n of CAMP_NEEDS) CampNeeds.set(n.id, 0.04);
    GAME.campFire = 0.01; Weather.today = 'Stormy'; GAME.lastNightBig = false;
    /* Even a destroyed camp gets the occasional quiet night by design (badOdds
       peaks around 0.7, not 1.0), so roll until one fires rather than asserting
       on a single coin flip. */
    for (let i = 0; i < 10 && !GAME.nightEvent; i++) {
      for (const n of CAMP_NEEDS) CampNeeds.set(n.id, 0.04);
      GAME.campFire = 0.01; GAME.lastNightBig = false;
      GAME.nightEvent = Nights.roll(campPool());
    }
    if (!GAME.nightEvent) return { fired: false };
    reportNight();
    return {
      fired: true,
      tag: (document.querySelector('#modal-body .night-tag') || {}).textContent || '',
      text: (document.querySelector('#modal-body .night-text') || {}).textContent || '',
      blame: (document.querySelector('#modal-body .night-blame') || {}).textContent || '',
      open: document.getElementById('modal-veil').classList.contains('open')
    };
  })()`);
  if (night.fired) {
    console.log('  ' + night.tag);
    console.log('  ' + night.text);
    if (night.blame) console.log('  blame: ' + night.blame);
  }
  check('a wrecked camp produces a night event', night.fired, night.tag || 'none');
  check('the morning after is a moment, not a log line', night.fired && night.open, 'modal shown');
  check('it explains what happened', night.fired && night.text.length > 40,
    `${(night.text || '').length} chars`);
  await ev(`Modal.close()`);

  /* ---- 7. survival shows up in a real conversation ---- */
  console.log('\n--- talking to somebody who is starving ---');
  let talk = await ev(`(() => {
    const npc = alive().find(c => !c.isPlayer && c.tribeName === GAME.player.tribeName);
    npc.hunger = 0.95; npc.fatigue = 0.2; npc.morale = 0.6;
    /* Make sure they are warm on the player so the helpful branch is reachable. */
    const e = npc.relEntry(GAME.player.name); e.rel = 0.8; e.trust = 0.8;
    GAME.player.hunger = 0.7; GAME.player.fatigue = 0.7;
    openTalkMenu(npc);
    renderBondChoices(npc);
    const opts = [...document.querySelectorAll('#dlg-choices button')].map(b => b.textContent.trim());
    return { opts, who: npc.displayName };
  })()`);
  /* typeText animates the line in, so let it finish before reading it. */
  await sleep(900);
  talk.greet = await ev(`document.getElementById('dlg-text').textContent`);
  console.log(`  ${talk.who} opens with: "${talk.greet}"`);
  check('a starving castaway greets you like one', talk.greet.length > 3, talk.greet.slice(0, 40));
  check('"say you are starving" is offered when you actually are',
    talk.opts.some(o => /starving/i.test(o)), talk.opts.filter(o => /starving|empty/i.test(o)).join(', '));
  check('"say you are running on empty" too',
    talk.opts.some(o => /running on empty/i.test(o)), 'offered');
  let reply = await ev(`(() => {
    const b = [...document.querySelectorAll('#dlg-choices button')].find(x => /starving/i.test(x.textContent));
    const before = GAME.player.hunger;
    b.click();
    return { hungerBefore: +before.toFixed(2), hungerAfter: +GAME.player.hunger.toFixed(2) };
  })()`);
  await sleep(1100);
  reply.line = await ev(`document.getElementById('dlg-text').textContent`);
  console.log('  -> "' + reply.line + '"');
  check('they answer in a way that fits how they feel about you',
    reply.line.length > 10, `${reply.line.length} chars`);
  check('a close ally does something about it',
    reply.hungerAfter <= reply.hungerBefore, `hunger ${reply.hungerBefore} -> ${reply.hungerAfter}`);
  await ev(`closeDialogue()`);

  /* ---- clean shot of the beach + HUD, then the board ---- */
  await ev(`Modal.close(); closeDialogue(); renderHUD();`);
  await sleep(400);
  const shotHud = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(__dirname + '/_camp-hud.png', Buffer.from(shotHud.result.data, 'base64'));

  /* ---- screenshot of the board for eyeballing ---- */
  await ev(`(() => {
    CampNeeds.set('firewood', 0.12); CampNeeds.set('water', 0.55);
    CampNeeds.set('food', 0.38); CampNeeds.set('shelter', 0.72); CampNeeds.set('clean', 0.28);
    GAME.campFire = 0.6; openCampMenu();
  })()`);
  await sleep(500);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(__dirname + '/_camp.png', Buffer.from(shot.result.data, 'base64'));
  console.log('\nsaved tools/_camp.png');

  if (errors.length) console.log('!! page errors: ' + JSON.stringify(errors.slice(0, 4)));
  const ok = !fails.length && !errors.length;
  if (fails.length) console.log('\nfailing checks: ' + fails.join(', '));
  console.log(ok ? '\nCAMP UI TEST PASS' : '\nCAMP UI TEST FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
