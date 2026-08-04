/* The 3D island, inside the real game.

   scene3d-shot.js proved the standalone demo. This proves the INTEGRATION, which is
   where the risk actually is: one shared WebGL context moving between six screens, a
   Proxy standing in for the Beach interface, and a fallback that has to still work.

   What it checks, and why each one is here rather than assumed:

     - 3D actually engages. `Scene3D.ready` plus a canvas in #camp-scene. A silent
       fall back to the DOM beach would otherwise look like success.
     - the Beach PROXY forwards correctly. Every member game.js and marooning.js use
       must resolve on the live renderer, and methods must be bound — an unbound
       method reads `this` as the Proxy and every internal field comes back
       undefined, which fails at runtime and not at load.
     - a season runs. Walk, work, tribal, challenge, reveal. Screens swap the canvas
       between hosts, and a stage that fails to build leaves a dead black box.
     - the DOM beach still works with 3D off, because that is the fallback and an
       untested fallback is not one.
     - nothing 404s and no exceptions fire. A missing GLB is invisible: the prop is
       just not there.

   Run: node tools/island3d-test.js */
const http = require('http'), { spawn } = require('child_process'), os = require('os'), path = require('path'), fs = require('fs');
const WebSocket = require('ws');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const RUN_ID = process.pid.toString(36) + Math.floor(Math.random() * 1e6).toString(36);
const PORT = 9200 + Math.floor(Math.random() * 1800);
const NL = String.fromCharCode(10);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = p => new Promise((s, j) => http.get({ host: '127.0.0.1', port: PORT, path: p }, r => {
  let d = ''; r.on('data', c => d += c); r.on('end', () => s(JSON.parse(d)));
}).on('error', j));

/* Every Beach member game.js and marooning.js touch. If the Proxy drops one, a
   season dies at the moment it is needed rather than at load. */
const API = ['sync', 'walk', 'travel', 'bubble', 'emote', 'clearEmote', 'approach', 'night', 'storm',
  'start', 'reset', 'camTo', 'camToPlayer', 'travelToNpc', 'playerWalkTo', 'figures', 'ZONES',
  'maroonLine', 'maroonFocus', 'sendToWork', 'playerWork', 'stageWork', 'setAct',
  'zoneX', 'zoneIndexOf', 'spotlight'];

(async () => {
  const dir = 'C:/projects/Personal/Castaway/Castaway/WebGame';
  const fails = [];
  const check = (n, ok, d) => { console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + n + (d ? '  — ' + d : '')); if (!ok) fails.push(n); };

  const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT,
    '--no-first-run', '--window-size=900,430',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--user-data-dir=' + path.join(os.tmpdir(), 'cw-i3d-' + RUN_ID),
    'http://localhost:8099/index.html'], { stdio: 'ignore' });
  let t = null;
  for (let i = 0; i < 60 && !t; i++) {
    await sleep(400);
    try { t = (await get('/json/list')).find(x => x.type === 'page' && x.url.includes('index.html')); } catch { }
  }
  if (!t) { console.log('no page'); process.exit(1); }
  const ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false });
  let id = 0; const pend = new Map();
  const errs = [], notFound = [];
  ws.on('message', m => {
    const j = JSON.parse(m);
    if (j.id && pend.has(j.id)) { pend.get(j.id)(j); pend.delete(j.id); }
    if (j.method === 'Log.entryAdded' && j.params.entry.level === 'error'
      && j.params.entry.text.indexOf('404') < 0) errs.push(j.params.entry.text);
    if (j.method === 'Runtime.exceptionThrown') {
      errs.push('EXC ' + ((j.params.exceptionDetails.exception || {}).description
        || j.params.exceptionDetails.text || '').split(NL)[0]);
    }
    if (j.method === 'Network.responseReceived' && j.params.response.status === 404
      && j.params.response.url.indexOf('favicon') < 0) notFound.push(j.params.response.url);
  });
  await new Promise(r => ws.on('open', r));
  const send = (m, p) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  const ev = async e => {
    const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error('threw: ' + ((r.result.exceptionDetails.exception || {}).description || '').split(NL)[0]);
    return r.result.result.value;
  };
  await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');
  const waitFor = async (s, n) => {
    for (let i = 0; i < (n || 120); i++) { if (await ev('!!document.querySelector(' + JSON.stringify(s) + ')')) return true; await sleep(250); }
    return false;
  };

  console.log(NL + 'BOOT');
  /* No import map, ever again.
     The island silently failed to appear on a real phone while passing every test
     here, and the most likely cause was `<script type="importmap">` mapping the bare
     specifier "three": import maps need Safari 16.4+ and a recent Chrome, and when
     unsupported the whole module graph fails to resolve with NO error the player can
     see — you just get the flat beach. Desktop Chrome hid it completely. The vendored
     files now import ../three.module.js directly, and this makes sure nobody
     reintroduces the map. */
  const html = fs.readFileSync(dir + '/index.html', 'utf8');
  check('no import map — it needs a browser feature phones may not have',
    html.indexOf('importmap') < 0);
  check('no bare "three" specifier survives in vendor/',
    !(() => {
      const walk = d => fs.readdirSync(d, { withFileTypes: true }).some(e =>
        e.isDirectory() ? walk(path.join(d, e.name))
          : /\.js$/.test(e.name) && fs.readFileSync(path.join(d, e.name), 'utf8').indexOf("from 'three'") >= 0);
      return walk(dir + '/vendor/three');
    })());
  check('boot does not depend on the load event alone',
    html.indexOf('DOMContentLoaded') >= 0 && html.indexOf('readyState') >= 0);

  check('title screen', await waitFor('#screen-title.active'));
  /* No localStorage.clear() + hard reload here. Each run gets a fresh --user-data-dir,
     so storage is already empty — and reloading with ignoreCache re-fetches all 107
     GLBs plus three.js in the middle of boot, which made the prop library come up
     empty and looked exactly like a WebGL failure. */

  /* 107 GLBs under software GL takes a while. Wait for readiness rather than sleeping
     a guessed amount, and report if it never arrives. */
  let ready = false;
  for (let i = 0; i < 240; i++) {
    ready = await ev("typeof Scene3D !== 'undefined' && Scene3D.ready === true");
    if (ready) break;
    await sleep(500);
  }
  const loaded = await ev("typeof Scene3D !== 'undefined' ? Object.keys(Scene3D.props).length : -1");
  check('WebGL came up and the prop library loaded', ready, loaded + ' props');
  check('3D is the live renderer', await ev("typeof Beach3D !== 'undefined' && Beach3D.active === true"));
  check('the CSS scenery is retired', await ev("document.body.classList.contains('gl-on')"));
  check('the title screen has a 3D backdrop',
    await ev("!!document.querySelector('#title-beach canvas#gl')"));

  console.log(NL + 'THE BEACH INTERFACE');
  const api = await ev(`(() => {
    const missing = [], unbound = [];
    for (const k of ${JSON.stringify(API)}) {
      const v = Beach[k];
      if (v === undefined) missing.push(k);
    }
    /* A method that lost its receiver is the failure mode a Proxy introduces, and it
       does not show up until the method is called. zoneIndexOf reads this.ZONES, so
       it is a cheap canary for the whole set. */
    let bound = false;
    try { bound = typeof Beach.zoneIndexOf('Camp') === 'number'; } catch (e) { bound = false; }
    return { missing, bound, zones: (Beach.ZONES || []).length };
  })()`);
  check('every Beach member the game uses resolves', !api.missing.length,
    api.missing.length ? 'missing: ' + api.missing.join(', ') : API.length + ' members');
  check('proxied methods keep their receiver', api.bound, 'zoneIndexOf works through the Proxy');
  check('ZONES is the same 14 zones', api.zones === 14, api.zones + ' zones');

  console.log(NL + 'A SEASON');
  await ev("document.getElementById('btn-new-game').click()");
  check('creation screen', await waitFor('#screen-create.active'));
  await ev("GAME.fastMaroon=true;GAME.fastChallenge=true;document.getElementById('btn-create-go').click()");
  for (let i = 0; i < 500; i++) {
    if (await ev("!!document.querySelector('#screen-camp.active')")) break;
    await ev("(()=>{const b=document.querySelector('#maroon-choices button')||document.querySelector('.maroon-next');if(b&&!b.disabled)b.click();})()");
    await sleep(120);
  }
  check('reached camp', await ev("!!document.querySelector('#screen-camp.active')"));
  await ev("Tutorial.forceComplete(); window.toast=()=>{}; Telemetry.cfg.auto=false; DBG.setEnabled(false); true;");
  for (let i = 0; i < 8; i++) {
    const c = await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/skip tutorial/i.test(x.textContent)&&x.offsetParent); if(b){b.click();return true;} return false; })()`);
    if (c) break;
    await sleep(150);
  }
  await sleep(1200);

  check('the island canvas is mounted in the camp scene',
    await ev("!!document.querySelector('#camp-scene canvas#gl')"));
  const isl = await ev(`(() => ({
    figures: Beach3D.figures.size,
    dressing: Beach3D.dressing ? Beach3D.dressing.children.length : 0,
    objects: Beach3D.objectCount || 0,
    tags: document.querySelectorAll('.b3d-tag').length,
    fps: Scene3D.fps,
    tris: Scene3D.renderer.info.render.triangles,
    calls: Scene3D.renderer.info.render.calls
  }))()`);
  console.log('  island: ' + isl.figures + ' castaways, ' + isl.dressing + ' props placed, '
    + isl.tris.toLocaleString() + ' tris, ' + isl.calls + ' draws, ' + isl.fps + ' fps (software GL)');
  check('castaways exist in the 3D scene', isl.figures >= 6, isl.figures + ' figures');
  /* dressing.children counts BAKED CHUNKS now, not props — bake() merges each zone's
     geometry per material, which is what took draw calls from 977 to 66. So assert on
     the chunks and on the triangle budget instead. */
  check('the island is dressed and baked into chunks',
    isl.dressing >= 12 && isl.dressing <= 260, isl.dressing + ' merged chunks');
  /* Raised from 140: the library grew from four packs to six, and a baked chunk exists
     per material per zone — more packs means more materials means more chunks. Still two
     orders of magnitude below the 977 it started at. */
  check('draw calls are in mobile budget', isl.calls < 320, isl.calls + ' draws');
  /* 1.9M RENDERED, which is not the same as scene geometry: renderer.info counts the
     shadow pass too. The island itself is ~1.2M triangles across ~1,900 props at full
     density. The ceiling exists to catch a runaway dressing table, not to encode a
     device limit — the real limit is a phone, which cannot be measured from here, so
     it is a player setting instead. See BEACH3D_DENSITY. */
  const dens = await ev("typeof BEACH3D_DENSITY !== 'undefined' ? BEACH3D_DENSITY : 1");
  check('triangles are in the intended budget', isl.tris < 1900000,
    isl.tris.toLocaleString() + ' rendered at density ' + dens);
  check('the island is genuinely dense', isl.objects > 1200,
    isl.objects + ' props placed before baking');
  check('name tags are projected as DOM', isl.tags >= 6, isl.tags + ' tags');
  check('it is rendering', isl.tris > 1000, isl.tris.toLocaleString() + ' triangles');

  /* The natural-beach rule the design asks for: nothing man-made on the island. */
  const built = await ev(`(() => {
    const banned = /Campfire|Cauldron|Tripod|Torch|Staging|Crate|Barrel|Cloth|Jug|Bucket|Sack|Table|Chair|Bed|Shelf|Treasure|Anchor|Boat|Raft|Ladder|Plank|Stake|Fishing_Net|Flag/i;
    const hits = [];
    /* Scope to the ISLAND manifest. The challenge arena legitimately has a course
       flag and scaffolding on it — production builds those — so scanning every loaded
       prop flagged Flag_01A and was simply the wrong question. */
    for (const n of (Scene3D.manifest.island || [])) if (banned.test(n)) hits.push(n);
    return hits;
  })()`);
  check('the island ships no man-made props', !built.length,
    built.length ? 'found ' + built.slice(0, 4).join(', ') : 'natural only');

  /* Walking. The player should move, and `fig.x` must stay a 0-100 percentage
     because game.js compares it to percentages directly. */
  const walk = await ev(`(async () => {
    const f = Beach3D.figures.get(GAME.player.name);
    const x0 = f.mesh.position.x, pct0 = f.x;
    Beach.playerWalkTo(78);
    await new Promise(r => setTimeout(r, 9000));   /* software GL renders ~1fps here; the walk needs frames, not seconds */
    return { moved: Math.abs(f.mesh.position.x - x0), pct0, pct1: f.x,
             inRange: f.x >= 0 && f.x <= 100 };
  })()`);
  check('the player walks', walk.moved > 3, 'moved ' + walk.moved.toFixed(1) + ' units in 9s of software GL');
  check('fig.x stays a 0-100 percentage', walk.inRange,
    walk.pct0.toFixed(1) + ' -> ' + walk.pct1.toFixed(1));

  /* ---------- the water end, and dragging to look at it ----------
     "No scrolling to the right" was a real gap: the 2D beach was a scrollable strip and
     the 3D camera only ever followed the player, so there was no way to look at the
     island you were not standing on. A horizontal drag now pans and releases the
     follow. Checked by driving real pointer events, because the gesture has to beat
     tap-to-walk and that precedence only exists in the handler. */
  const pan = await ev(`(async () => {
    const c = Scene3D.canvas;
    const before = Beach3D._camTarget;
    const opt = { bubbles: true, clientX: 500, clientY: 200, pointerId: 1, isPrimary: true };
    c.dispatchEvent(new PointerEvent('pointerdown', Object.assign({}, opt)));
    for (let i = 1; i <= 8; i++) {
      c.dispatchEvent(new PointerEvent('pointermove', Object.assign({}, opt, { clientX: 500 - i * 25 })));
    }
    c.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, opt, { clientX: 300 })));
    await new Promise(r => setTimeout(r, 400));
    return { before: +before.toFixed(1), after: +Beach3D._camTarget.toFixed(1),
             follow: Beach3D._camFollow };
  })()`);
  check('dragging pans the camera along the island',
    Math.abs(pan.after - pan.before) > 4, pan.before + ' -> ' + pan.after);
  check('panning releases the follow so it stays where you put it', pan.follow === false);

  /* And the sea actually reads as sea: a swell that moves, and a shoreline. */
  const sea = await ev(`(async () => {
    const p = Beach3D.seaGeo.attributes.position;
    const z0 = p.getZ(120);
    await new Promise(r => setTimeout(r, 700));
    return { moved: Math.abs(p.getZ(120) - z0) > 0.001, hasFoam: !!Beach3D.foam,
             vertexColours: !!Beach3D.seaGeo.attributes.color };
  })()`);
  check('the sea has a moving swell, not a flat plane', sea.moved);
  check('the sea has a depth gradient and a foam line',
    sea.vertexColours && sea.hasFoam);

  /* Bubbles and spotlight, the two things that used to reach into DOM figures. */
  const chat = await ev(`(() => {
    /* Pick from the figures that EXIST, not from alive(). sync() only creates figures
       for campmates, so pre-merge alive() includes the other tribe and picking from it
       chose somebody who is correctly not on this island at all. */
    const other = [...Beach3D.figures.keys()].find(k => k !== GAME.player.name);
    const n = GAME.cast.find(c => c.name === other);
    Beach.bubble(n.name, 'Testing one two.');
    Beach.spotlight(n.name);
    return { bubbles: document.querySelectorAll('.b3d-bubble.show').length,
             spot: document.querySelectorAll('.b3d-tag.spot').length };
  })()`);
  check('speech renders over the 3D island', chat.bubbles >= 1, chat.bubbles + ' bubble');
  check('spotlight works without reaching for fig.el', chat.spot >= 1);

  console.log(NL + 'THE OTHER SCENES');
  /* Wait for the background prefetch, the way a player does. The library is 654 props
     and the council set alone is 5 MB; it streams while the player is at camp and is
     simply there by day two. Entering tribal 30 seconds after boot — which only a test
     does — races the download, and that raced timing is what these checks kept
     measuring rather than whether the backdrops work. ensureScene() remains the safety
     net for anyone who does beat the network, and is asserted separately below. */
  let pf = false;
  for (let i = 0; i < 300; i++) {
    pf = await ev("Scene3D.loaded.tribal === true && Scene3D.loaded.challenge === true");
    if (pf) break;
    await sleep(1000);
  }
  check('the background prefetch finishes without being asked', pf,
    'loaded: ' + await ev('Object.keys(Scene3D.loaded).filter(k => Scene3D.loaded[k] === true).join(",")'));
  check('on-demand loading exists as the fallback for anyone faster than the network',
    await ev("typeof Scene3D.ensureScene === 'function'"));
  for (const [screen, host, label] of [
    ['screen-tribal', 'tribal-3d', 'tribal council'],
    ['screen-challenge', 'chal-3d', 'challenge arena'],
    ['screen-tribalqa', 'tqa-3d', 'tribal conversation'],
    ['screen-reveal', 'reveal-3d', 'vote reveal']
  ]) {
    const r = await ev(`(async () => {
      Screens.push('${screen}');
      await new Promise(r => setTimeout(r, 1400));
      const mounted = !!document.querySelector('#${host} canvas#gl');
      const tris = Scene3D.renderer.info.render.triangles;
      const stage = Scene3D.stage ? (Scene3D.stage === TribalStage ? 'tribal'
        : Scene3D.stage === ChallengeStage ? 'challenge' : Scene3D.stage === Beach3D ? 'island' : 'title') : 'none';
      Screens.pop();
      await new Promise(r => setTimeout(r, 400));
      return { mounted, tris, stage };
    })()`);
    check(label + ' gets a 3D backdrop', r.mounted && r.tris > 500,
      r.stage + ', ' + r.tris.toLocaleString() + ' tris');
  }

  /* Back on the island afterwards — the canvas has to come home. */
  await sleep(900);
  check('the canvas returns to the island after a screen trip',
    await ev("!!document.querySelector('#camp-scene canvas#gl')"));

  console.log(NL + 'BATTERY AND HEALTH');
  const paused = await ev(`(async () => {
    Screens.push('screen-create');
    await new Promise(r => setTimeout(r, 700));
    const running = !!Scene3D._loop;
    Screens.pop();
    await new Promise(r => setTimeout(r, 600));
    return { pausedOffScreen: !running, resumed: !!Scene3D._loop };
  })()`);
  check('rendering stops on a screen with no 3D', paused.pausedOffScreen);
  check('and resumes when 3D comes back', paused.resumed);

  check('no page exceptions', errs.length === 0, errs.length ? errs[0].slice(0, 120) : 'clean');
  check('no asset 404s', notFound.length === 0,
    notFound.length ? notFound.map(u => u.replace(/^https?:\/\/[^/]+\//, '')).slice(0, 3).join(', ') : 'clean');

  /* Screenshots at phone size, both scenes. */
  await send('Emulation.setDeviceMetricsOverride', { width: 740, height: 344, deviceScaleFactor: 1, mobile: false });
  await sleep(900);
  await send('Page.captureScreenshot', { format: 'png' }).then(r =>
    fs.writeFileSync(dir + '/tools/_look-island3d.png', Buffer.from(r.result.data, 'base64')));
  for (const [screen, file] of [['screen-tribal', '_look-tribal3d.png'], ['screen-challenge', '_look-chal3d.png']]) {
    await ev("Screens.push('" + screen + "')"); await sleep(1600);
    await send('Page.captureScreenshot', { format: 'png' }).then(r =>
      fs.writeFileSync(dir + '/tools/' + file, Buffer.from(r.result.data, 'base64')));
    await ev('Screens.pop()'); await sleep(400);
  }
  console.log('  saved tools/_look-island3d.png, _look-tribal3d.png, _look-chal3d.png');

  console.log(NL + 'THE 2D FALLBACK');
  const fb = await ev(`(() => { localStorage.setItem('castaway_3d','0'); return true; })()`);
  await send('Page.reload', { ignoreCache: false });
  check('title screen after disabling 3D', await waitFor('#screen-title.active'));
  await sleep(1500);
  const off = await ev(`(() => ({
    glOn: document.body.classList.contains('gl-on'),
    canvas: !!document.querySelector('canvas#gl'),
    world: !!document.querySelector('#world'),
    beachIs2D: Beach.ZONES === Beach2D.ZONES
  }))()`);
  check('3D stays off when the preference says so', !off.glOn && !off.canvas);
  check('the DOM beach is back', off.world && off.beachIs2D);

  const ok = !fails.length;
  if (fails.length) console.log(NL + 'failing checks: ' + fails.join(', '));
  console.log(ok ? NL + 'ISLAND3D PASS' : NL + 'ISLAND3D FAIL');
  ws.close(); ch.kill(); process.exit(ok ? 0 : 1);
})();
