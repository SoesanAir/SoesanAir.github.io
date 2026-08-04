/* The how-to card, checked against the thing it is replacing.

   The card exists because one line of grey prose was not teaching anybody forty
   minigames. Replacing it with a diagram only helps if the diagram is (a) there
   for every game, (b) truthful about the failure condition, and (c) small enough
   to actually fit — this screen has overflowed a 344px viewport once already and
   trapped the player behind an unreachable Continue button, and a full-frame
   overlay is exactly the shape of thing that does that again.

   So:
     1. all forty games in MINIGAMES produce a card, none falls through
     2. every card has a headline, a glyph and a failure line
     3. no card has more than three panels, no caption more than four words
     4. rendered into the LIVE arena, nothing spills outside #app
     5. GAME.fastChallenge makes show() resolve instantly and render nothing,
        which is the flag every other harness relies on to run games headlessly
     6. screenshots of six visually different cards, to look at

   Note on (4): an element inside a screen that is not `.active` measures 0x0, so
   the measurement is worthless unless the challenge screen is pushed first. That
   is not hypothetical — measuring a hidden overlay and reporting "fits" is how a
   layout fault survives a green harness.

   The card is not linked from index.html yet, so this injects the stylesheet and
   the script itself. Once the tags are added the injection is harmless — the
   second copy of a `const` at top level would throw, so it checks first.

   Run: node tools/howto-test.js   (needs a static server on :8099 and `ws`) */
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

/* Six cards that exercise six different builds: a two-panel card with a lane
   diagram, a three-panel card with four falling meters, a card that is all
   symbols, a three-panel balance card, a card riding its VERB entry rather than
   its own, and a three-panel card mixing a shape with a stack. */
const SHOTS = ['rope', 'brace', 'sumo', 'tipsy', 'latin', 'coins', 'tide'];

(async () => {
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT,
    /* 900x430 is the small-phone case the rest of the challenge harnesses use;
       it lands #app at 344px tall, which is the height this card has to survive. */
    '--no-first-run', '--window-size=900,430', '--force-device-scale-factor=2',
    '--user-data-dir=' + path.join(os.tmpdir(), 'cw-howto-' + RUN_ID),
    'http://localhost:8099/index.html?no3d=1'], { stdio: 'ignore' });
  let t = null;
  for (let i = 0; i < 40 && !t; i++) {
    await sleep(400);
    try { t = (await get('/json/list')).find(x => x.type === 'page' && x.url.includes('index.html')); } catch { }
  }
  if (!t) { console.log('no page — is there a static server on :8099?'); process.exit(1); }
  const ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false });
  let id = 0; const pend = new Map();
  const pageErrors = [];
  ws.on('message', m => {
    const j = JSON.parse(m);
    if (j.id && pend.has(j.id)) { pend.get(j.id)(j); pend.delete(j.id); }
    if (j.method === 'Runtime.exceptionThrown') {
      const d = (j.params.exceptionDetails.exception || {}).description || j.params.exceptionDetails.text;
      if (d && d !== 'Event') pageErrors.push(String(d).split(NL)[0]);
    }
  });
  await new Promise(r => ws.on('open', r));
  const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) {
      throw new Error('threw: ' + ((r.result.exceptionDetails.exception || {}).description || '').split(NL)[0]);
    }
    return r.result.result.value;
  };
  const shot = async name => {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, '_look-howto-' + name + '.png'), Buffer.from(s.result.data, 'base64'));
  };
  await send('Runtime.enable');
  await send('Network.enable');
  /* A reused profile means a disk cache, and a cached copy of chal-howto.js is a
     harness testing yesterday's card. */
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  const waitFor = async s => {
    for (let i = 0; i < 80; i++) { if (await ev('!!document.querySelector(' + JSON.stringify(s) + ')')) return; await sleep(250); }
    throw new Error('no ' + s);
  };

  const problems = [];
  const check = (ok, msg) => { if (!ok) problems.push(msg); return !!ok; };

  /* ---- boot a season, because the arena only exists inside one ---- */
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

  /* ---- load the card, which index.html does not link yet ---- */
  const loaded = await ev(`(() => new Promise(res => {
    if (typeof Howto !== 'undefined') return res('already');
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = 'css/chal-howto.css?t=' + Date.now();
    document.head.appendChild(l);
    const s = document.createElement('script');
    s.src = 'js/chal-howto.js?t=' + Date.now();
    s.onload = () => res(typeof Howto !== 'undefined' ? 'ok' : 'no Howto');
    s.onerror = () => res('404');
    document.head.appendChild(s);
  }))()`);
  if (!check(loaded === 'ok' || loaded === 'already', 'chal-howto.js did not load: ' + loaded)) {
    console.log(NL + 'HOWTO TEST FAIL'); ws.close(); ch.kill(); process.exit(1);
  }
  /* Boot set this to skip the maroon challenges. Everything from here on is
     about the card actually rendering, so it has to come off. */
  await ev('GAME.fastChallenge = false; true;');

  /* ---- 1, 2, 3: content, over all forty ---- */
  const audit = await ev(`(() => {
    const rows = [];
    for (const g of MINIGAMES) {
      let card = null, err = null;
      try { card = Howto.build(g); } catch (e) { err = String(e && e.message || e); }
      if (!card) { rows.push({ id: g.id, verb: g.verb, err: err || 'no element' }); continue; }
      /* Which table answered. A game with neither is the coverage hole this
         whole check exists to catch. */
      const src = (HOWTO.byId && HOWTO.byId[g.id]) ? 'id'
        : (HOWTO.byVerb && HOWTO.byVerb[g.verb]) ? 'verb' : 'generic';
      const caps = [...card.querySelectorAll('.hw-cap')].map(e => e.textContent.trim());
      rows.push({
        id: g.id, verb: g.verb, src, err: null,
        head: (card.querySelector('.hw-verb') || {}).textContent || '',
        glyphs: card.querySelectorAll('.hw-glyph').length,
        panels: card.querySelectorAll('.hw-panel').length,
        fail: ((card.querySelector('.hw-fail-txt') || {}).textContent || '').trim(),
        tag: ((card.querySelector('.hw-fail-tag') || {}).textContent || '').trim(),
        caps,
        worst: caps.reduce((m, c) => Math.max(m, c.split(/\\s+/).filter(Boolean).length), 0)
      });
    }
    return { total: MINIGAMES.length, rows };
  })()`);

  check(audit.total === 40, 'MINIGAMES has ' + audit.total + ' entries, expected 40');
  let byId = 0, byVerb = 0, generic = 0;
  for (const r of audit.rows) {
    if (r.err) { problems.push(r.id + ': build threw or produced nothing — ' + r.err); continue; }
    if (r.src === 'id') byId++; else if (r.src === 'verb') byVerb++; else generic++;
    check(!!r.head, r.id + ': no headline verb');
    check(r.glyphs >= 1, r.id + ': no glyph on any panel');
    check(!!r.fail, r.id + ': no failure line');
    check(!!r.tag, r.id + ': failure line has no tag');
    check(r.panels >= 1 && r.panels <= 3, r.id + ': ' + r.panels + ' panels (max 3)');
    check(r.glyphs === r.panels, r.id + ': ' + r.glyphs + ' glyphs for ' + r.panels + ' panels');
    check(r.worst <= 4, r.id + ': a caption runs to ' + r.worst + ' words — ' +
      JSON.stringify(r.caps.find(c => c.split(/\s+/).filter(Boolean).length > 4) || ''));
  }
  check(generic === 0, generic + ' game(s) fell through to the generic card');
  console.log('cards built    ' + audit.rows.filter(r => !r.err).length + ' of ' + audit.total
    + '   ·   by id ' + byId + '   ·   by verb ' + byVerb + '   ·   generic ' + generic);

  /* ---- 4: measured in the live arena ---- */
  await ev(`(() => {
    Screens.push('screen-challenge');
    document.getElementById('btn-chal-go').classList.add('hidden');
    return true;
  })()`);
  await sleep(250);

  /* Build the frame the shell builds, so the card is measured against the real
     thing it will live inside rather than a bare div. */
  const openFrame = gid => ev(`(() => {
    const g = MINIGAMES.find(x => x.id === ${JSON.stringify(gid)});
    const layer = document.getElementById('chal-game');
    layer.innerHTML = ''; layer.classList.remove('railed'); layer.classList.add('open');
    const frame = h('div', 'cg-frame');
    const head = h('div', 'cg-head');
    head.appendChild(h('span', 'cg-name', g.name));
    const timer = h('div', 'cg-timer'); timer.appendChild(h('i'));
    head.appendChild(timer);
    head.appendChild(h('span', 'cg-score', '0'));
    const arena = h('div', 'cg-arena');
    frame.appendChild(head); frame.appendChild(arena);
    frame.appendChild(h('div', 'cg-how', g.how));
    /* The empty countdown is on screen at this point in the real flow, veil and
       all, so it is on screen here too — the card has to cover it. */
    frame.appendChild(h('div', 'cg-countdown'));
    layer.appendChild(frame);
    window.__hwDone = null;
    /* The LAYER, not the frame — same host the hook in Challenge.play() uses.
       Hosting on the frame clipped 42 to 48px off every card, because the arena
       has no content yet and the frame is sized by its content. */
    Howto.show(g, layer).then(v => { window.__hwDone = v; });
    return true;
  })()`);

  const measure = gid => ev(`(() => {
    const app = document.getElementById('app').getBoundingClientRect();
    const card = document.querySelector('#chal-game .hw-card');
    if (!card) return { missing: true };
    const cr = card.getBoundingClientRect();
    /* Measure the CONTENT, not the box. The card is inset:0 on a frame with
       overflow:hidden, so the box always "fits" — what escapes is the children,
       and a flex column centred on an over-tall stack spills out of both ends. */
    let top = Infinity, bot = -Infinity, left = Infinity, right = -Infinity;
    for (const c of card.children) {
      const r = c.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      top = Math.min(top, r.top); bot = Math.max(bot, r.bottom);
      left = Math.min(left, r.left); right = Math.max(right, r.right);
    }
    const fail = card.querySelector('.hw-fail');
    const tap = card.querySelector('.hw-tap');
    const inApp = e => {
      const r = e.getBoundingClientRect();
      return r.height > 0 && r.top >= app.top - 1 && r.bottom <= app.bottom + 1
        && r.left >= app.left - 1 && r.right <= app.right + 1;
    };
    return {
      id: ${JSON.stringify(gid)},
      appH: Math.round(app.height), appW: Math.round(app.width),
      cardH: Math.round(cr.height),
      contentH: Math.round(bot - top), contentW: Math.round(right - left),
      scrollOver: Math.max(0, card.scrollHeight - card.clientHeight),
      spillTop: Math.round(Math.max(0, app.top - top)),
      spillBot: Math.round(Math.max(0, bot - app.bottom)),
      spillLeft: Math.round(Math.max(0, app.left - left)),
      spillRight: Math.round(Math.max(0, right - app.right)),
      failVisible: !!fail && inApp(fail),
      tapVisible: !!tap && inApp(tap)
    };
  })()`);

  console.log(NL + 'measured in the live arena (#app is ' + '344px' + ' tall on this window):');
  let tallest = 0, tallestId = '';
  for (const g of audit.rows) {
    if (g.err) continue;
    await openFrame(g.id);
    await sleep(90);
    const m = await measure(g.id);
    if (m.missing) { problems.push(g.id + ': show() rendered no card'); continue; }
    const spill = m.spillTop + m.spillBot + m.spillLeft + m.spillRight;
    if (m.contentH > tallest) { tallest = m.contentH; tallestId = g.id; }
    check(spill === 0, g.id + ': card content spills outside #app by '
      + [m.spillTop && 'top ' + m.spillTop, m.spillBot && 'bottom ' + m.spillBot,
      m.spillLeft && 'left ' + m.spillLeft, m.spillRight && 'right ' + m.spillRight]
        .filter(Boolean).join(', '));
    check(m.scrollOver === 0, g.id + ': card content is ' + m.scrollOver + 'px taller than the card');
    check(m.failVisible, g.id + ': the failure strip is not fully on screen');
    check(m.tapVisible, g.id + ': the TAP TO START hint is not fully on screen');
    /* "Room to spare" is the brief, not merely "fits". 40px is about one more
       line of caption, which is the change most likely to be made next. */
    check(m.contentH <= m.appH - 40, g.id + ': ' + m.contentH + 'px of content in a '
      + m.appH + 'px app leaves no room to spare');

    if (SHOTS.indexOf(g.id) >= 0) {
      await sleep(180);
      await shot(g.id);
    }
    /* A tap anywhere must resolve it, and it must resolve exactly once. */
    await ev("(() => { const c = document.querySelector('#chal-game .hw-card'); if (c) c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return true; })()");
    await sleep(60);
    const after = await ev('({ done: window.__hwDone, still: !!document.querySelector("#chal-game .hw-card") })');
    check(after.done === true, g.id + ': a tap on the card did not resolve show()');
    check(after.still === false, g.id + ': the card is still in the DOM after a tap');
    await ev("document.getElementById('chal-game').innerHTML=''; document.getElementById('chal-game').classList.remove('open'); true;");
  }
  console.log('  tallest card   ' + tallest + 'px  (' + tallestId + ')  in a 344px app');
  console.log('  spill outside #app: ' + (problems.length ? 'see below' : 'none, all 40'));

  /* ---- 5: the flag the other harnesses depend on ---- */
  const fast = await ev(`(() => {
    GAME.fastChallenge = true;
    const layer = document.getElementById('chal-game');
    layer.innerHTML = ''; layer.classList.add('open');
    const t0 = performance.now();
    return Howto.show(MINIGAMES[0], layer).then(v => ({
      ms: Math.round(performance.now() - t0),
      value: v,
      rendered: !!layer.querySelector('.hw-card')
    }));
  })()`);
  check(fast.ms < 60, 'fastChallenge: show() took ' + fast.ms + 'ms, it must resolve immediately');
  check(fast.rendered === false, 'fastChallenge: a card was rendered anyway');
  check(fast.value === false, 'fastChallenge: show() should resolve false when it skips');
  await ev('GAME.fastChallenge = false; true;');
  console.log(NL + 'fastChallenge  resolved in ' + fast.ms + 'ms, rendered nothing: ' + !fast.rendered);

  /* ---- and the other side of it: no season at all ----
     `GAME` is a top-level `const`, so it cannot be unbound from the page that
     declared it — assigning window.GAME does nothing to the identifier and the
     first version of this check silently tested the live season instead. The
     only honest way to run this code with no GAME in scope is a document that
     never loaded game.js, so: an iframe with a stub h() and nothing else.
     Top-level const is not a property of the global object either, hence the
     eval() to reach Howto inside it. */
  await ev(`(() => {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:absolute; left:-9999px; top:0; width:600px; height:344px; border:0';
    document.body.appendChild(f);
    const d = f.contentDocument;
    d.open();
    d.write('<!doctype html><html><head>'
      + '<link rel="stylesheet" href="css/style.css">'
      + '<link rel="stylesheet" href="css/chal-howto.css"></head>'
      + '<body><div id="host" style="position:absolute;inset:0"></div>'
      + '<scr' + 'ipt>function h(t,c,x){var e=document.createElement(t);'
      + 'if(c)e.className=c;if(x!==undefined)e.textContent=x;return e;}</scr' + 'ipt>'
      + '<scr' + 'ipt src="js/chal-howto.js?t=' + Date.now() + '"></scr' + 'ipt></body></html>');
    d.close();
    window.__hwIframe = f;
    return true;
  })()`);
  let bare = 'pending';
  for (let i = 0; i < 40 && bare !== 'object'; i++) {
    await sleep(150);
    bare = await ev('(() => { try { return window.__hwIframe.contentWindow.eval("typeof Howto"); } catch (e) { return "err:" + e.message; } })()');
  }
  check(bare === 'object', 'chal-howto.js did not define Howto in a bare document: ' + bare);
  if (bare === 'object') {
    const noGame = await ev(`(() => {
      const w = window.__hwIframe.contentWindow;
      const H = w.eval('Howto');
      const host = w.document.getElementById('host');
      const g = { id: 'rope', name: 'Hold the Rope', verb: 'hold' };
      let built = false, threw = null;
      try { built = !!H.build(g); } catch (e) { threw = 'build: ' + (e && e.message || e); }
      if (threw) return Promise.resolve({ threw });
      let p;
      try { p = H.show({ id: 'brace', name: 'Chimney Sweep', verb: 'sustain' }, host); }
      catch (e) { return Promise.resolve({ threw: 'show: ' + (e && e.message || e) }); }
      const card = host.querySelector('.hw-card');
      const rendered = !!card;
      if (card) card.dispatchEvent(new w.PointerEvent('pointerdown', { bubbles: true }));
      return p.then(v => ({ built, rendered, shown: v }));
    })()`);
    check(!noGame.threw, 'with no GAME in scope it threw — ' + noGame.threw);
    check(noGame.built === true, 'with no GAME in scope build() produced nothing');
    check(noGame.rendered === true, 'with no GAME in scope show() rendered nothing');
    check(noGame.shown === true, 'with no GAME in scope a tap did not resolve show()');
    console.log('no season      built and showed a card without GAME, resolved on tap');
  }
  await ev('window.__hwIframe.remove(); Screens.pop(); true;');
  check(pageErrors.length === 0, 'page errors: ' + pageErrors.slice(0, 3).join(' | '));

  console.log(NL + 'wrote tools/_look-howto-*.png (' + SHOTS.length + ' cards)');
  if (problems.length) {
    console.log(NL + 'PROBLEMS:');
    for (const p of problems.slice(0, 40)) console.log('  ! ' + p);
    if (problems.length > 40) console.log('  ... and ' + (problems.length - 40) + ' more');
  }
  console.log(problems.length ? NL + 'HOWTO TEST FAIL' : NL + 'HOWTO TEST PASS');
  ws.close(); ch.kill(); process.exit(problems.length ? 1 : 0);
})();
