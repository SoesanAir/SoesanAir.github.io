/* ============================================================
   BEACH — the name game.js and marooning.js call, dispatching to whichever
   renderer is actually alive.

   There are two island renderers now: Beach2D (DOM and CSS, the original) and
   Beach3D (WebGL). Rather than teach forty call sites about the difference, this
   forwards every property access to the live one.

   Why a Proxy rather than `let Beach = pick()`: the choice is not made once. WebGL
   comes up asynchronously after the page has already booted and drawn a title
   screen, and it can be LOST at any moment — a phone backgrounding the tab, a
   driver reset, thermal throttling. A Proxy re-decides on every access, so a context
   loss mid-season silently continues on the DOM beach instead of freezing on a dead
   canvas.

   The cost is a property lookup per call, and the call sites are things like
   "somebody walked" and "show a bubble" — a few per second, not per frame. The 3D
   renderer's own per-frame work goes through Scene3D directly and never touches
   this.
   ============================================================ */

'use strict';

const Beach = new Proxy({}, {
  get(_t, key) {
    const live = (typeof Scene3D !== 'undefined' && Scene3D.ok && Scene3D.ready
      && typeof Beach3D !== 'undefined' && Beach3D.active) ? Beach3D : Beach2D;
    const v = live[key];
    /* Bind methods to their own renderer, or `this` inside them resolves to the
       Proxy and every internal field read comes back undefined. */
    return typeof v === 'function' ? v.bind(live) : v;
  },
  set(_t, key, val) {
    const live = (typeof Scene3D !== 'undefined' && Scene3D.ok && Scene3D.ready
      && typeof Beach3D !== 'undefined' && Beach3D.active) ? Beach3D : Beach2D;
    live[key] = val;
    return true;
  },
  has(_t, key) { return key in Beach2D || key in Beach3D; }
});

/* ============================================================
   BOOT — decide whether the island is 3D, and keep it honest.
   ============================================================ */
const Island3D = {
  /* A user-facing switch, because a phone that runs it badly should be able to turn
     it off, and because comparing the two is the fastest way to judge the new one. */
  PREF_KEY: 'castaway_3d',
  wanted() {
    /* A URL override that beats the stored preference, because several harnesses
       exist specifically to test the DOM renderer's cut-out rigs and those rigs have
       no measurable geometry once `gl-on` hides #world. Those suites load
       index.html?no3d=1 — which keeps them meaningful AND keeps the 2D fallback
       under test, rather than deleting the checks or teaching each of them about
       WebGL. ?force3d=1 is the other direction, for a harness that wants 3D
       regardless of what a previous run left in localStorage. */
    try {
      const q = location.search;
      if (/[?&]no3d=1/.test(q)) return false;
      if (/[?&]force3d=1/.test(q)) return true;
      const v = localStorage.getItem(this.PREF_KEY);
      return v === null ? true : v === '1';
    } catch { return true; }
  },
  set(on) {
    try { localStorage.setItem(this.PREF_KEY, on ? '1' : '0'); } catch { }
    location.reload();
  },

  /* The loading / failure line. Lives on whichever screen is up, styled by
     #gl-loading in css/scene3d.css. */
  note(on) {
    let el = document.getElementById('gl-loading');
    if (!on) { if (el) el.remove(); return null; }
    if (!el) {
      el = h('div', '');
      el.id = 'gl-loading';
      el.textContent = 'Loading island';
      const host = document.getElementById('screen-title') || document.getElementById('app');
      if (host) host.appendChild(el);
    }
    return el;
  },

  /* Called by the module shim in index.html once three.js has imported. */
  async boot(THREE, loaders) {
    if (!this.wanted()) {
      DBG.decision('Island3D', '3D disabled by preference', {});
      return false;
    }
    /* ---------- tell the player something is happening ----------
       7.3 MB of models over mobile data takes real seconds, and until this finishes
       the flat beach is what is on screen. Without a note, a slow connection is
       indistinguishable from the feature being broken — which is exactly how it was
       reported. So: a progress line while it loads, and if it FAILS, a line that says
       so rather than silently leaving the 2D beach up pretending nothing happened. */
    const note = this.note(true);
    const ok = await Scene3D.boot(THREE, loaders, (done, total) => {
      if (note) note.textContent = 'Loading island  ' + Math.round(done / total * 100) + '%';
    });
    if (!ok || !Scene3D.ready) {
      if (note) {
        note.textContent = Scene3D.ok === false
          ? 'This device did not give us 3D — flat island'
          : 'Island assets did not load — flat island';
        setTimeout(() => this.note(false), 5000);
      }
      DBG.decision('Island3D', 'staying on the DOM beach',
        { ok, ready: Scene3D.ready, err: Scene3D.loadError || null });
      return false;
    }
    this.note(false);
    Scene3D.register('island', Beach3D);
    Scene3D.register('tribal', TribalStage);
    Scene3D.register('challenge', ChallengeStage);
    Scene3D.register('title', TitleStage);
    Beach3D.active = true;

    /* Hide the CSS beach so the two are not stacked on top of each other. */
    document.body.classList.add('gl-on');
    this.bindScreens();
    this.bindInput();

    /* If the island is already on screen when 3D finishes loading — which it will be
       on a reload straight into a saved season — show it now rather than waiting for
       the next screen change. */
    if (document.getElementById('screen-camp').classList.contains('active')) {
      await Scene3D.show('island', document.getElementById('camp-scene'));
      Beach3D.start();
    } else if (document.getElementById('screen-title').classList.contains('active')) {
      await Scene3D.show('title', document.getElementById('title-beach'));
    }
    DBG.decision('Island3D', '3D island live', { props: Object.keys(Scene3D.props).length });
    return true;
  },

  /* Which stage belongs to which screen, and where its canvas goes. */
  MAP: {
    'screen-camp': ['island', 'camp-scene'],
    'screen-title': ['title', 'title-beach'],
    'screen-tribal': ['tribal', 'tribal-3d'],
    'screen-tribalqa': ['tribal', 'tqa-3d'],
    'screen-reveal': ['tribal', 'reveal-3d'],
    'screen-challenge': ['challenge', 'chal-3d'],
    'screen-maroon': ['title', 'maroon-3d']
  },

  /* Screens are pushed and popped by Screens.push/pop, which knows nothing about
     3D. Rather than edit every call site, watch the DOM for the active class. A
     MutationObserver is the honest tool here: it reacts to the screen ACTUALLY
     being shown, including the paths that bypass Screens entirely. */
  bindScreens() {
    const apply = () => {
      let target = null;
      for (const id in this.MAP) {
        const el = document.getElementById(id);
        if (el && el.classList.contains('active')) { target = id; break; }
      }
      if (!target) { Scene3D.hide(); return; }
      const [stage, hostId] = this.MAP[target];
      const host = document.getElementById(hostId);
      if (!host) { Scene3D.hide(); return; }
      Scene3D.show(stage, host);
    };
    const obs = new MutationObserver(() => apply());
    for (const id in this.MAP) {
      const el = document.getElementById(id);
      if (el) obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    }
    window.addEventListener('resize', () => Scene3D.resize());
    /* Orientation changes resize the host without a resize event on some phones. */
    window.addEventListener('orientationchange', () => setTimeout(() => Scene3D.resize(), 260));
    /* Stop rendering entirely when the tab is hidden. A backgrounded WebGL loop is
       the single worst thing this feature could do to a phone battery. */
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) Scene3D.stop();
      else if (Scene3D.stage) Scene3D.start();
    });
    this._applyScreens = apply;
    apply();
  },

  /* Tap the sand to walk, tap a castaway to talk to them. The 2D beach's tap layer
     is bypassed entirely when 3D is on — see the `gl-on` rule in the stylesheet. */
  bindInput() {
    const canvas = Scene3D.canvas;
    let down = null;
    canvas.addEventListener('pointerdown', e => {
      down = { x: e.clientX, y: e.clientY, t: Date.now(), ox: e.offsetX, oy: e.offsetY, panned: false };
    });

    /* ---------- drag to look along the island ----------
       Reported as "no scrolling to the right": the 2D beach was a scrollable strip and
       the 3D camera only ever followed the player, so there was no way to look at any
       part of the island you were not standing on.

       Horizontal drag pans the camera and releases the follow. Walking anywhere takes
       the follow back, so it never gets stuck looking at empty jungle. The gesture has
       to beat tap-to-walk, which is why pointerup checks `panned`. */
    canvas.addEventListener('pointermove', e => {
      if (!down || Scene3D.stage !== Beach3D) return;
      const dx = e.clientX - down.x;
      if (!down.panned && Math.abs(dx) < 12) return;
      down.panned = true;
      Beach3D._camFollow = false;
      /* Screen pixels to world units at the camera's distance, so a drag moves the
         island by the amount under your thumb rather than an arbitrary factor. */
      const el = Scene3D.canvas;
      const worldPerPx = (2 * Beach3D.CAM_DIST * Math.tan(44 * Math.PI / 360))
        * (el.clientWidth / el.clientHeight) / Math.max(1, el.clientWidth);
      Beach3D._camTarget -= (e.clientX - down.x) * worldPerPx;
      down.x = e.clientX;
    });
    canvas.addEventListener('pointerup', e => {
      if (!down) return;
      const moved = Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y);
      const held = Date.now() - down.t;
      const start = down;
      down = null;
      if (start.panned) return;                             /* that was a camera pan */
      if (moved > 14 || held > 620) return;                 /* a drag, not a tap */
      if (Scene3D.stage !== Beach3D) return;                /* backdrops are not interactive */
      if (!GAME.player || GAME.playerEliminated || !GAME.seasonActive || GAME.watchMode) return;
      if (document.getElementById('dialogue-layer').classList.contains('open')) return;
      if (document.getElementById('modal-veil').classList.contains('open')) return;

      /* A castaway first: tapping a person should talk to them, not walk past them.
         Same precedence the 2D tap layer gets from z-index. */
      const hit = Beach3D.pickFigure(start);
      if (hit && !hit.c.isPlayer) {
        if (typeof openTalkMenu === 'function') Beach.travelToNpc(hit.c, () => openTalkMenu(hit.c));
        return;
      }
      const p = Scene3D.pickGround({ offsetX: start.ox, offsetY: start.oy }, Beach3D.camera, Beach3D.sand);
      if (!p) return;
      const pf = Beach3D.figures.get(GAME.player.name);
      if (!pf || pf.walking || pf.busy) return;
      Beach3D.walkToPoint(p);
    });
    canvas.addEventListener('pointercancel', () => { down = null; });
  }
};
