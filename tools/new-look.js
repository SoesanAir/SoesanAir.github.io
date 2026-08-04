/* Screenshots of the new screens, so the look can be judged rather than assumed.

   Twenty minigames arrived in four separate stylesheets that had never been
   rendered in the same page, plus a new full-screen circle meeting. Every serious
   layout fault in this project so far has been invisible to the assertion-based
   harnesses and obvious in a screenshot — a title card trapped in a stacking
   context, an inherited text-shadow ghosting every child, names truncated to
   "COUR…". So: render each one and look.

   Also checks the two things that are cheap to assert and expensive to miss:
   nothing overflows the frame, and nothing is invisible.

   Run: node tools/new-look.js [gameId ...]        (default: a spread of the new 20) */
const http = require('http'), { spawn } = require('child_process'), os = require('os'), fs = require('fs');
const WebSocket = require('ws');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const RUN_ID = process.pid.toString(36) + Math.floor(Math.random() * 1e6).toString(36);
const PORT = 9200 + Math.floor(Math.random() * 2000);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = p => new Promise((s, j) => http.get({ host: '127.0.0.1', port: PORT, path: p }, r => {
  let d = ''; r.on('data', c => d += c); r.on('end', () => s(JSON.parse(d)));
}).on('error', j));

/* One from each new batch's most visual game, plus the two the user asked for by
   name so they get looked at every time. */
const DEFAULT = ['brace', 'simmo', 'perch', 'tide', 'rollerball', 'balldrop',
  'tipsy', 'maze', 'sling', 'sumo', 'knots', 'latin', 'gross', 'logcarry'];

(async () => {
  const want = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT;
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT,
    '--no-first-run', '--window-size=920,440', '--force-device-scale-factor=2',
    '--user-data-dir=' + os.tmpdir() + '\\cw-nlook-' + RUN_ID,
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
  await ev(`GAME.fastMaroon = true; GAME.fastChallenge = true; document.getElementById('btn-create-go').click()`);
  for (let i = 0; i < 400; i++) {
    if (await ev(`!!document.querySelector('#screen-camp.active')`)) break;
    await ev(`(() => { const b = document.querySelector('#maroon-choices button') || document.querySelector('.maroon-next'); if (b && !b.disabled) b.click(); })()`);
    await sleep(120);
  }
  await waitFor('#screen-camp.active');
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>/skip tutorial/i.test(b.textContent));if(b)b.click();})()`);
  await ev(`DBG.setEnabled(false); window.toast=()=>{}; Telemetry.cfg.auto=false; true;`);
  await sleep(300);

  const problems = [];

  /* ---- the minigames, each with the tribe rails behind them ---- */
  console.log('minigame                overflow  invisible  arenaKids  arenaH  railClash');
  for (const gid of want) {
    const info = await ev(`(() => {
      const g = MINIGAMES.find(x => x.id === ${JSON.stringify(gid)});
      if (!g) return { missing: true };
      const chal = CHALLENGES.find(c => Challenge.MAP[c.name] === g.id)
        || CHALLENGES.find(c => c.cat === 'Physical');
      /* #chal-game lives inside #screen-challenge. Without pushing that screen the
         whole subtree is display:none, every element measures 0x0, and the
         screenshots come out as the camp. Learned the hard way: the first run of
         this harness reported "0 overflow" for all fourteen games and was
         photographing nothing at all. */
      Screens.push('screen-challenge');
      document.getElementById('chal-title').textContent = 'Tribal Immunity';
      document.getElementById('chal-name').textContent = chal.name;
      document.getElementById('chal-desc').textContent = chal.desc;
      const field = aliveTribe('Tidal').concat(aliveTribe('Ember'));
      Challenges.prescore(chal, field);
      Challenge.setRoster(buildChallengeRoster(chal));
      const layer = document.getElementById('chal-game');
      layer.innerHTML = ''; layer.classList.remove('railed'); layer.classList.add('open');
      const st = Challenge.buildRails(layer, chal);
      window.__stopRails = Challenge.driveRails(st, chal);
      /* Build the frame the way play() does, then start the game directly so we
         skip the 3-2-1 and land on the arena itself. */
      const frame = document.createElement('div'); frame.className = 'cg-frame';
      const head = document.createElement('div'); head.className = 'cg-head';
      const nm = document.createElement('span'); nm.className = 'cg-name'; nm.textContent = g.name;
      const timer = document.createElement('div'); timer.className = 'cg-timer'; timer.appendChild(document.createElement('i'));
      const score = document.createElement('span'); score.className = 'cg-score'; score.textContent = '0';
      head.appendChild(nm); head.appendChild(timer); head.appendChild(score);
      const arena = document.createElement('div'); arena.className = 'cg-arena';
      const howto = document.createElement('div'); howto.className = 'cg-how'; howto.textContent = g.how;
      frame.appendChild(head); frame.appendChild(arena); frame.appendChild(howto);
      layer.appendChild(frame);
      Juice.attach(frame);
      const ctx = Challenge.makeCtx({ arena, frame, score, timer, game: g, howto, ease: 0.5, onDone: () => {} });
      /* Swallow done() so the arena stays on screen to be photographed. */
      ctx.done = () => {};
      try { g.start(ctx); } catch (e) { return { threw: String(e.message || e) }; }
      return { ok: true, name: g.name };
    })()`);
    if (info.missing) { console.log(`  ${gid.padEnd(22)} NOT FOUND`); problems.push(gid + ': not found'); continue; }
    if (info.threw) { console.log(`  ${gid.padEnd(22)} THREW ${info.threw}`); problems.push(gid + ': threw ' + info.threw); continue; }
    await sleep(700);
    const geo = await ev(`(() => {
      const frame = document.querySelector('.cg-frame');
      const arena = document.querySelector('.cg-arena');
      const fr = frame.getBoundingClientRect();
      const kids = [...arena.querySelectorAll('*')];
      /* Anything VISIBLY sticking out of the frame, and anything with no size.

         "Visibly" is load-bearing. A rotated element has a bounding box much
         larger than its drawn extent, and if an ancestor clips it the overspill is
         never on screen — Know Your Ropes drew two diagonal strands inside a
         border-radius board and was reported as overflowing when the screenshot
         showed it clipped perfectly. So walk up to the nearest clipping ancestor
         and intersect first. */
      const clipRect = el => {
        let p = el.parentElement, r = null;
        while (p) {
          const cs = getComputedStyle(p);
          if (cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
            const pr = p.getBoundingClientRect();
            r = r ? {
              left: Math.max(r.left, pr.left), right: Math.min(r.right, pr.right),
              top: Math.max(r.top, pr.top), bottom: Math.min(r.bottom, pr.bottom)
            } : { left: pr.left, right: pr.right, top: pr.top, bottom: pr.bottom };
          }
          if (p === document.body) break;
          p = p.parentElement;
        }
        return r;
      };
      let overflow = 0, invisible = 0;
      for (const k of kids) {
        const raw = k.getBoundingClientRect();
        if (raw.width === 0 && raw.height === 0) { invisible++; continue; }
        const clip = clipRect(k);
        const r = clip ? {
          left: Math.max(raw.left, clip.left), right: Math.min(raw.right, clip.right),
          top: Math.max(raw.top, clip.top), bottom: Math.min(raw.bottom, clip.bottom)
        } : raw;
        /* Fully clipped away is not overflow, it is just hidden. */
        if (r.right <= r.left || r.bottom <= r.top) continue;
        if (r.right > fr.right + 2 || r.left < fr.left - 2
          || r.bottom > fr.bottom + 2 || r.top < fr.top - 2) overflow++;
      }
      /* Rail chips must not sit on top of each other. Nine castaways with similar
         scores used to collide into an unreadable smear — found in a screenshot,
         not by any assertion, which is exactly why this check exists now. */
      let collisions = 0, dupNames = 0;
      const allNames = [];
      for (const rail of document.querySelectorAll('.cg-rail')) {
        const cs = [...rail.querySelectorAll('.cg-chip')]
          .map(c => c.getBoundingClientRect())
          .sort((a, b) => a.top - b.top);
        for (let i = 1; i < cs.length; i++) {
          if (cs[i].top < cs[i - 1].bottom - 1) collisions++;
        }
        /* And the top chip must not cover the tribe banner. */
        const tag = rail.querySelector('.cg-rail-tag');
        if (tag && cs.length) {
          const tr = tag.getBoundingClientRect();
          if (tr.height && cs[0].top < tr.bottom - 1) collisions++;
        }
        for (const c of rail.querySelectorAll('.cg-chip-name')) allNames.push(c.textContent.trim());
      }
      /* Two castaways rendering as the same name makes the rail a lie. */
      dupNames = allNames.length - new Set(allNames).size;
      return { overflow, invisible, kids: kids.length, collisions, dupNames,
               frameH: Math.round(fr.height),
               arenaH: Math.round(arena.getBoundingClientRect().height) };
    })()`);
    if (geo.collisions) problems.push(`${gid}: ${geo.collisions} overlapping rail chips`);
    if (geo.dupNames) problems.push(`${gid}: ${geo.dupNames} rail chips share a name`);
    /* A frame with no height means the screen is not actually being rendered, and
       every other number here is meaningless. Fail loudly rather than reporting a
       clean sweep of zeroes. */
    if (!geo.frameH) { problems.push(gid + ': frame has no height — nothing is rendering'); }
    await shot('g-' + gid);
    const flag = geo.overflow > 0 ? ' <-- OVERFLOWS'
      : geo.invisible === geo.kids && geo.kids > 0 ? ' <-- ALL INVISIBLE' : '';
    console.log(`  ${gid.padEnd(22)} ${String(geo.overflow).padStart(6)}  ${String(geo.invisible).padStart(9)}`
      + `  ${String(geo.kids).padStart(9)}  ${String(geo.arenaH).padStart(6)}`
      + `  ${String(geo.collisions).padStart(9)}${flag}`);
    if (geo.overflow > 0) problems.push(`${gid}: ${geo.overflow} elements outside the frame`);
    /* Some zero-size children are legitimate (a spacer, an unused slot). All of
       them being zero is not. */
    if (geo.kids > 0 && geo.invisible === geo.kids) problems.push(`${gid}: nothing in the arena has any size`);
    await ev(`(() => {
      if (window.__stopRails) window.__stopRails();
      Juice.detach(); Challenge.setRoster(null); Challenges.clearPrescore();
      const l = document.getElementById('chal-game');
      l.innerHTML = ''; l.classList.remove('open', 'railed');
      Screens.pop();
    })()`);
    await sleep(120);
  }

  /* ---- the circle meeting ---- */
  await ev(`(() => {
    const P = GAME.player;
    const mates = campmates(P).filter(c => !c.isPlayer).slice(0, 3);
    /* Deliberately uneven loyalty, so the screenshot shows all three bar states. */
    const levels = [0.9, 0.55, 0.18];
    mates.forEach((m, i) => {
      m.addTrust(P.name, levels[i]); m.addRel(P.name, levels[i]);
      for (const o of mates) if (o !== m) { m.addTrust(o.name, levels[i]); m.addRel(o.name, levels[i]); }
    });
    Coalitions.reset();
    Coalitions.form([P.name, ...mates.map(m => m.name)], GAME.day);
    const c = Coalitions.active(P.name);
    c.visibility = 0.55;          // so the SEEN meter and the warning both show
    CircleMeeting.start();
  })()`);
  await sleep(700);
  /* Advance to the choice menu, which is the busiest state. */
  for (let i = 0; i < 8; i++) {
    if (!(await ev(`!!document.querySelector('#ci-choices .ci-next')`))) break;
    await ev(`document.querySelector('#ci-choices .ci-next').click()`);
    await sleep(220);
  }
  await sleep(300);
  await shot('circle-menu');
  const circGeo = await ev(`(() => {
    const f = document.querySelector('.ci-frame').getBoundingClientRect();
    const app = document.getElementById('app').getBoundingClientRect();
    const mems = [...document.querySelectorAll('.ci-mem')];
    const reads = mems.map(m => m.querySelector('.ci-mem-read').textContent);
    const bars = mems.map(m => m.querySelector('.ci-mem-bar > i').className || 'mid');
    return {
      fitsX: f.left >= app.left - 1 && f.right <= app.right + 1,
      fitsY: f.top >= app.top - 1 && f.bottom <= app.bottom + 1,
      turns: document.querySelectorAll('#ci-convo .ci-turn').length,
      choices: document.querySelectorAll('#ci-choices .btn').length,
      reads, bars,
      cohesionW: document.getElementById('ci-cohesion').style.width,
      visibleW: document.getElementById('ci-visible').style.width
    };
  })()`);
  console.log(`\ncircle meeting: ${circGeo.turns} lines, ${circGeo.choices} choices`
    + ` · holding ${circGeo.cohesionW} · seen ${circGeo.visibleW}`);
  console.log(`  loyalty reads: ${circGeo.reads.join(' / ')}`);
  console.log(`  bar states:    ${circGeo.bars.join(' / ')}`);
  if (!circGeo.fitsX || !circGeo.fitsY) problems.push('circle frame does not fit the app box');
  if (new Set(circGeo.bars).size < 2) problems.push('circle loyalty bars all render the same state');

  /* ---- the idol silence ----
     The most repeated screen in the game now: Peff asks at every council and this
     is the answer. Worth looking at, because "one big ellipsis and a lot of empty
     space" is easy to get wrong in a way no assertion notices. */
  /* Close the pact overlay first. It is z-index 46 and sits above the screens, so
     leaving it open photographs the huddle instead — the geometry checks below still
     found the right elements underneath, which is exactly how a screenshot harness
     lies to you if you only read its numbers. */
  await ev(`CircleMeeting.close(); true;`);
  await sleep(200);
  await ev(`idolSilence(); true;`);
  await sleep(1500);
  await shot('idol-silence');
  const sil = await ev(`(() => {
    const dots = document.querySelector('.idol-dots');
    const line = document.querySelector('.idol-silence');
    const app = document.getElementById('app').getBoundingClientRect();
    const dr = dots ? dots.getBoundingClientRect() : null;
    const out = {
      hasDots: !!dots, dotsH: dr ? Math.round(dr.height) : 0,
      /* The Peff tag must be hidden — the silence is the room's, not his. */
      peffHidden: !document.querySelector('#screen-finale.silent-beat .peff-line')
        || getComputedStyle(document.querySelector('#screen-finale .peff-line')).display === 'none',
      line: line ? line.textContent : '',
      fits: dr ? (dr.left >= app.left - 1 && dr.right <= app.right + 1) : false
    };
    /* Close it the way the player would. */
    const b = document.getElementById('btn-finale-next'); if (b) b.click();
    out.classCleared = !document.getElementById('screen-finale').classList.contains('silent-beat');
    return out;
  })()`);
  console.log(`\nidol silence: dots ${sil.dotsH}px · "${sil.line}"`);
  if (!sil.hasDots) problems.push('the idol silence beat renders no ellipsis');
  if (sil.dotsH < 30) problems.push('the idol ellipsis is too small to read as a beat');
  if (!sil.peffHidden) problems.push('the idol silence still credits Peff for the silence');
  if (!sil.fits) problems.push('the idol ellipsis overflows the app box');
  if (!sil.line.trim()) problems.push('the idol silence has no room line');
  if (!sil.classCleared) problems.push('the silent-beat class is not cleared on the way out');

  /* ---- the challenge briefing, to check the attribute chip ---- */
  await ev(`CircleMeeting.close(); true;`);
  await sleep(200);
  const chip = await ev(`(() => {
    const chal = CHALLENGES.find(c => c.name === 'Sumo at Sea') || CHALLENGES[0];
    const row = document.getElementById('chal-stats');
    row.innerHTML = '';
    const lead = STAT_KEYS.map((k, i) => ({ k, w: chal.w[i] })).sort((a, b) => b.w - a.w);
    if (lead[0] && lead[0].w > 0) {
      row.appendChild(h('span', 'chip', STAT_LABELS[lead[0].k]));
      if (lead[1] && lead[1].w >= lead[0].w * 0.8) row.appendChild(h('span', 'chip', STAT_LABELS[lead[1].k]));
    }
    return { text: row.textContent, hasMultiplier: /[x×]\\s*0?\\./.test(row.textContent) };
  })()`);
  console.log(`\nchallenge attribute chip reads: "${chip.text}"`);
  if (chip.hasMultiplier) problems.push('the attribute chip still shows a multiplier');

  /* ---- the tribal ballot with somebody immune ----
     Reported as "one of the options disappears". The immune castaway is now shown
     but unselectable, and this is the screen where that has to read instantly. */
  await ev(`(() => {
    const pool = campmates(GAME.player);
    GAME.todayImmune = pool.find(c => !c.isPlayer);
    window.__ballot = tribalVoteScreen(pool);
  })()`);
  await sleep(500);
  await shot('tribal-ballot');
  const bal = await ev(`(() => {
    const cards = [...document.querySelectorAll('#tribal-grid .cast-card')];
    const ic = document.querySelector('#tribal-grid .cast-card.immune-card');
    const lab = ic ? ic.querySelector('.cc-immune') : null;
    const lr = lab ? lab.getBoundingClientRect() : null;
    const cr = ic ? ic.getBoundingClientRect() : null;
    const out = {
      cards: cards.length,
      hasImmune: !!ic,
      labelText: lab ? lab.textContent : '',
      /* The stamp must sit ON the card, not float off it. */
      labelInside: (lr && cr) ? (lr.left >= cr.left - 2 && lr.right <= cr.right + 2) : false,
      dimmed: ic ? parseFloat(getComputedStyle(ic).opacity) < 0.75 : false
    };
    const cf = document.getElementById('btn-vote-confirm');
    cf.disabled = false; cf.click();
    GAME.todayImmune = null;
    return out;
  })()`);
  await ev(`window.__ballot.then(() => {}); true;`);
  console.log(`\ntribal ballot: ${bal.cards} cards, immune stamp "${bal.labelText}"`
    + ` · inside the card: ${bal.labelInside} · dimmed: ${bal.dimmed}`);
  if (!bal.hasImmune) problems.push('the immune castaway is not shown on the ballot at all');
  if (!bal.labelInside) problems.push('the IMMUNE stamp hangs off the edge of its card');
  if (!bal.dimmed) problems.push('the immune card is not visibly dimmed, so it looks selectable');

  /* ---- the bonds menu, with somebody immune ----
     Same stamp, a different card layout and a light background — worth looking at,
     because a mark that reads well on the dark ballot can easily be invisible or
     misplaced here. */
  await ev(`(() => {
    const pool = campmates(GAME.player);
    GAME.todayImmune = pool.find(c => !c.isPlayer);
    document.getElementById('btn-relations').click();
  })()`);
  await sleep(400);
  await shot('bonds-immune');
  const bonds = await ev(`(() => {
    const body = document.getElementById('modal-body');
    const card = body.querySelector('.cast-card.has-immunity');
    const lab = card ? card.querySelector('.cc-immune') : null;
    const cr = card ? card.getBoundingClientRect() : null;
    const lr = lab ? lab.getBoundingClientRect() : null;
    const name = card ? card.querySelector('.cc-name') : null;
    const nr = name ? name.getBoundingClientRect() : null;
    const out = {
      found: !!card,
      inside: (lr && cr) ? (lr.left >= cr.left - 2 && lr.right <= cr.right + 2
        && lr.top >= cr.top - 2 && lr.bottom <= cr.bottom + 2) : false,
      /* The name must stay readable — the stamp sits over the portrait. */
      clearsName: (lr && nr) ? lr.bottom <= nr.top + 2 : false,
      readable: lr ? lr.height >= 8 : false
    };
    Modal.close();
    GAME.todayImmune = null;
    return out;
  })()`);
  console.log(`bonds menu: immune card found ${bonds.found}`
    + ` · stamp inside ${bonds.inside} · clears the name ${bonds.clearsName}`);
  if (!bonds.found) problems.push('the bonds menu does not mark who has immunity');
  if (!bonds.inside) problems.push('the bonds IMMUNE stamp hangs off its card');
  if (!bonds.clearsName) problems.push('the bonds IMMUNE stamp covers the castaway name');
  if (!bonds.readable) problems.push('the bonds IMMUNE stamp is too small to read');

  console.log('\nwrote ' + (want.length + 3) + ' screenshots to tools/_look-*.png');
  if (problems.length) {
    console.log('\nPROBLEMS:');
    for (const p of problems) console.log('  ! ' + p);
  }
  console.log(problems.length ? '\nNEW LOOK FAIL' : '\nNEW LOOK PASS');
  ws.close(); ch.kill(); process.exit(problems.length ? 1 : 0);
})();
