/* ============================================================
   CASTAWAY — beach.js
   The scrollable island: the 14 zones from the Unity project,
   laid out left-to-right exactly as the scene had them. The
   cast roams between zones using the ported zone-affinity
   weights (CastawaySprite.CalculateZoneWeight), clusters with
   tribemates, and the player walks the island to find people.
   Purely presentational — reads the sim, never mutates it.
   Cosmetic randomness uses Math.random so the seeded game RNG
   stream stays untouched.
   ============================================================ */

'use strict';

/* Zones in Unity scene order (sorted by X): kind drives the visuals */
/* Ordered as a GRADIENT, open water on the left to deep island interior on the
   right. The old order put ocean at both ends and Deep Forest third, which made the
   island read as a symmetrical strip with no sense of going anywhere.

   Read left to right it is now a journey inland: deep water, shallows, the spit, the
   main beach, then the places the tribe lives, then progressively heavier jungle,
   and finally the rocks and treemail at the far interior. Beach3D uses this order
   directly for world position AND grows the land deeper as x increases, so walking
   right genuinely takes you into the island.

   Ids are unchanged, because the sim addresses zones by NAME — camp jobs say
   `zone: 'Well'` — so reordering is purely spatial and nothing in the simulation
   notices. The two `_Right` ids now mean "further out" rather than "on the right":
   Far Ocean is the deepest water, Far Beach the outer spit. */
const ZONES = [
  { id: 'Ocean_Right',     label: 'Far Ocean', kind: 'ocean' },
  { id: 'Ocean_Left',      label: 'Ocean',     kind: 'ocean' },
  { id: 'Beach_Right',     label: 'Far Beach', kind: 'beach' },
  { id: 'Beach_Left',      label: 'Beach',     kind: 'beach' },
  { id: 'Camp',            label: 'Camp',      kind: 'camp' },
  { id: 'FirePit',         label: 'Fire Pit',  kind: 'firepit' },
  { id: 'Shelter',         label: 'Shelter',   kind: 'shelter' },
  { id: 'Well',            label: 'The Well',  kind: 'well' },
  { id: 'Forest_Grove',    label: 'Grove',     kind: 'forest' },
  { id: 'Forest_Clearing', label: 'Clearing',  kind: 'forest-light' },
  { id: 'Forest',          label: 'Forest',    kind: 'forest' },
  { id: 'Forest_Deep',     label: 'Deep Forest', kind: 'forest-deep' },
  { id: 'Rocky',           label: 'Rocks',     kind: 'rocky' },
  { id: 'Treemail',        label: 'Treemail',  kind: 'treemail' }
];
const ZN = ZONES.length;
const zoneCenter = i => ((i + 0.5) / ZN) * 100;   // world-%
const zoneOfX = x => Math.max(0, Math.min(ZN - 1, Math.floor((x / 100) * ZN)));

/* Renamed from Beach to Beach2D. js/beach-switch.js now owns the name  and
   dispatches to whichever renderer is live — this DOM one, or Beach3D. Keeping this
   file intact and reachable is deliberate: it is a complete, shipping renderer and
   the fallback when WebGL is unavailable, blocklisted, or lost mid-season. */
const Beach2D = (() => {
  const figures = new Map();   // name -> fig record
  let ticker = null;
  let built = false;

  const sceneEl = () => document.getElementById('camp-scene');
  const worldEl = () => document.getElementById('world');
  const figRoot = () => document.getElementById('figures');
  const campActive = () =>
    document.getElementById('screen-camp').classList.contains('active') &&
    !document.getElementById('dialogue-layer').classList.contains('open') &&
    !document.getElementById('modal-veil').classList.contains('open');

  const mrand = (min, max) => min + Math.random() * (max - min);
  const mpick = arr => arr[Math.floor(Math.random() * arr.length)];

  function visibleCast() {
    if (!GAME.seasonActive || !GAME.player) return [];
    return campmates(GAME.player);
  }

  /* ---------- world construction ----------
     Seamless biomes: every zone shares the same two horizon lines
     (distant band at 44%, ground at 61%) so the ink outlines run
     unbroken across the island. Coastal zones fill the distant band
     with sea, inland zones with a hazy ridge. Wherever the material
     changes at a seam, the LEFT neighbor's material "fingers" into
     the zone via a jagged tongue overlay (.g-edge / .bd-edge). */
  const MAT = {
    ocean:          { band: 'bd-sea',        ground: 'g-deepsea' },
    beach:          { band: 'bd-sea',        ground: 'g-sand' },
    camp:           { band: 'bd-sea',        ground: 'g-sand' },
    firepit:        { band: 'bd-ridge',      ground: 'g-sand' },
    shelter:        { band: 'bd-ridge',      ground: 'g-sand' },
    well:           { band: 'bd-ridge',      ground: 'g-grass' },
    forest:         { band: 'bd-ridge',      ground: 'g-grass' },
    'forest-deep':  { band: 'bd-ridge-deep', ground: 'g-grass-deep' },
    'forest-light': { band: 'bd-ridge',      ground: 'g-grass-light' },
    rocky:          { band: 'bd-ridge-grey', ground: 'g-stone' },
    treemail:       { band: 'bd-ridge-grey', ground: 'g-stone-light' }
  };

  function buildWorld() {
    if (built) return;
    built = true;
    const w = worldEl();
    ZONES.forEach((z, i) => {
      const b = h('div', 'biome bk-' + z.kind);
      b.dataset.zone = z.id;
      // shared sky
      const sky = h('div', 'b-sky');
      if (i === 1 || i === 12) sky.appendChild(h('div', 'b-sun'));
      if (i === 3 || i === 10) sky.appendChild(h('div', 'b-moon'));
      b.appendChild(sky);

      // distant band (sea or ridge) + ground, with seam tongues
      const m = MAT[z.kind];
      const lm = i > 0 ? MAT[ZONES[i - 1].kind] : null;
      const band = m.band === 'bd-sea' ? waves('b-sea') : h('div', 'b-ridge ' + m.band);
      if (lm && lm.band !== m.band) band.appendChild(h('div', 'bd-edge ' + lm.band));
      b.appendChild(band);
      const g = h('div', 'b-ground ' + m.ground);
      if (lm && lm.ground !== m.ground) g.appendChild(h('div', 'g-edge ' + lm.ground));
      b.appendChild(g);

      // per-kind furniture
      if (z.kind === 'beach') {
        b.appendChild(palm(i === 1 ? 12 : 62, i === 1 ? 1 : 0.85));
      } else if (z.kind === 'camp') {
        b.appendChild(crates());
        b.appendChild(palm(74, 0.9));
        /* The camp flag. This is where the tribe colour lives on the island. */
        const flagWrap = h('div', 'furn camp-flag-f');
        flagWrap.appendChild(Tribes.flag(GAME.player ? GAME.player.tribeName : 'Tidal'));
        b.appendChild(flagWrap);
      } else if (z.kind === 'firepit') {
        b.appendChild(firepit());
      } else if (z.kind === 'shelter') {
        b.appendChild(shelter());
      } else if (z.kind === 'well') {
        b.appendChild(well());
      } else if (z.kind.startsWith('forest')) {
        const n = z.kind === 'forest-deep' ? 4 : z.kind === 'forest-light' ? 1 : 3;
        for (let t = 0; t < n; t++) b.appendChild(tree(8 + t * (80 / Math.max(1, n - 1)) + mrand(-4, 4), z.kind === 'forest-deep'));
      } else if (z.kind === 'rocky') {
        b.appendChild(rocks());
      } else if (z.kind === 'treemail') {
        b.appendChild(treemail());
      }
      b.appendChild(h('div', 'b-label', z.label));
      w.appendChild(b);
    });
    buildTapLayer(w);
  }

  /* ---------- tap to walk ----------
     A transparent layer over the scenery but UNDER the figures, so taps on
     empty beach move the player while taps on a castaway still open dialogue.
     offsetX is in the layer's own coordinate space, which is what makes this
     work even in portrait, where the whole app is rendered rotated 90deg. */
  function buildTapLayer(w) {
    const tap = h('div', 'tap-layer');
    let down = null;
    tap.addEventListener('pointerdown', e => {
      down = { x: e.clientX, y: e.clientY, t: Date.now(), ox: e.offsetX };
    });
    tap.addEventListener('pointerup', e => {
      if (!down) return;
      const moved = Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y);
      const held = Date.now() - down.t;
      const ox = down.ox;
      down = null;
      if (moved > 12 || held > 600) return;           // a scroll-swipe, not a tap
      if (!campActive()) return;
      if (!GAME.player || GAME.playerEliminated || !GAME.seasonActive || GAME.watchMode) return;
      const pf = figures.get(GAME.player.name);
      if (!pf || pf.walking || pf.busy) return;
      const pct = Math.max(0.8, Math.min(99.2, ox / tap.offsetWidth * 100));
      if (Math.abs(pct - pf.x) < 1.2) return;
      pingAt(pct);
      playerWalkTo(pct);
    });
    tap.addEventListener('pointercancel', () => { down = null; });
    w.appendChild(tap);
  }

  /* Little marker so a tap reads as "go there" even before the walk starts. */
  function pingAt(x) {
    const w = worldEl();
    if (!w) return;
    const p = h('div', 'tap-ping');
    p.style.left = x + '%';
    w.appendChild(p);
    setTimeout(() => p.remove(), 620);
  }

  function waves(cls) {
    const sea = h('div', cls);
    sea.appendChild(h('i', 'wave w1'));
    sea.appendChild(h('i', 'wave w2'));
    return sea;
  }
  function palm(x, s) {
    const p = h('div', 'palm');
    p.style.left = x + '%';
    p.style.transform = `scale(${s})`;
    const fr = h('div', 'fronds');
    for (let i = 0; i < 4; i++) fr.appendChild(h('div', 'frond'));
    p.appendChild(fr);
    p.appendChild(h('div', 'trunk'));
    return p;
  }
  function tree(x, deep) {
    const t = h('div', 'tree' + (deep ? ' deep' : ''));
    t.style.left = x + '%';
    t.appendChild(h('div', 'canopy'));
    t.appendChild(h('div', 'bole'));
    return t;
  }
  function firepit() {
    const f = h('div', 'furn firepit-f');
    f.appendChild(h('div', 'flame'));
    f.appendChild(h('div', 'flame f2'));
    f.appendChild(h('div', 'log l1'));
    f.appendChild(h('div', 'log l2'));
    f.appendChild(h('div', 'stones'));
    return f;
  }
  function shelter() {
    const s = h('div', 'furn shelter-f');
    s.appendChild(h('div', 'roof'));
    s.appendChild(h('div', 'post p1'));
    s.appendChild(h('div', 'post p2'));
    return s;
  }
  function well() {
    const s = h('div', 'furn well-f');
    s.appendChild(h('div', 'ring'));
    s.appendChild(h('div', 'post p1'));
    s.appendChild(h('div', 'post p2'));
    s.appendChild(h('div', 'beam'));
    return s;
  }
  function crates() {
    const c = h('div', 'furn crates-f');
    c.appendChild(h('div', 'crate c1'));
    c.appendChild(h('div', 'crate c2'));
    return c;
  }
  function rocks() {
    const r = h('div', 'furn rocks-f');
    r.appendChild(h('div', 'boulder b1'));
    r.appendChild(h('div', 'boulder b2'));
    r.appendChild(h('div', 'boulder b3'));
    return r;
  }
  function treemail() {
    const t = h('div', 'furn treemail-f');
    t.appendChild(h('div', 'post'));
    t.appendChild(h('div', 'box'));
    return t;
  }

  /* ---------- zone affinity (CalculateZoneWeight port) ---------- */
  function zoneWeight(c, zi) {
    const z = ZONES[zi];
    const n = z.id;
    let w = 1;
    if (n === 'Camp' || n === 'FirePit' || n === 'Well') w += c.stats.social * 2.5;
    if (n === 'Shelter') w += (1 - c.morale) * 2.5;
    if (n.startsWith('Forest')) w += (1 - c.stats.social) * 2.5;
    if (n === 'Rocky' || n === 'Treemail') w += c.stats.gameAwareness * 2;
    if (n === 'Ocean_Left') w = 0.3 + c.stats.gameAwareness * 0.5;
    if (n === 'Beach_Left') w *= 0.5;
    if (n === 'Beach_Right' || n === 'Ocean_Right') w *= 0.1;
    // telegraphing: avoid the zone your big target is in
    const { target, weight } = c.topVoteTarget(visibleCast());
    if (target && weight >= 1.5) {
      const tf = figures.get(target.name);
      if (tf && zoneOfX(tf.x) === zi) w -= 1.5;
    }
    return Math.max(w, 0.05);
  }
  function pickWeightedZone(c) {
    const ws = ZONES.map((_, i) => zoneWeight(c, i));
    const total = ws.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < ws.length; i++) {
      roll -= ws[i];
      if (roll <= 0) return i;
    }
    return ZN - 1;
  }

  /* ---------- cut-out rig ----------
     Each body is split into 6 parts (see tools/build-rig.js). Every part is a
     div showing its own window onto the SAME recolored sprite via background
     -position, so one --sprite url drives the whole figure and re-tinting
     stays free. Boxes are percentages, so the rig scales with the figure. */
  const RIG_ORDER = ['legL', 'legR', 'armL', 'armR', 'torso', 'head'];

  function buildRig(c) {
    const spec = (typeof RIG !== 'undefined' && RIG[c.bodyKey]) || null;
    const rig = h('div', 'rig');
    if (!spec) {                                  // no rig data: plain sprite
      const img = document.createElement('img');
      img.src = c.spriteURL || '';
      img.alt = c.displayName;
      rig.appendChild(img);
      return { rig, parts: null };
    }
    const W = spec.w, H = spec.h;
    rig.style.aspectRatio = W + ' / ' + H;
    const parts = {};
    for (const key of RIG_ORDER) {
      const p = spec.parts[key];
      if (!p) continue;
      const el = h('div', 'part ' + key);
      el.style.left = (p.x / W * 100) + '%';
      el.style.top = (p.y / H * 100) + '%';
      el.style.width = (p.w / W * 100) + '%';
      el.style.height = (p.h / H * 100) + '%';
      el.style.backgroundSize = (W / p.w * 100) + '% ' + (H / p.h * 100) + '%';
      // sprite-sheet offset: p% of (box - image), which lands -p.x/-p.y
      el.style.backgroundPosition =
        (W === p.w ? 0 : p.x / (W - p.w) * 100) + '% ' +
        (H === p.h ? 0 : p.y / (H - p.h) * 100) + '%';
      el.style.transformOrigin = (p.pivot[0] / p.w * 100) + '% ' + (p.pivot[1] / p.h * 100) + '%';
      if (p.clip) {
        // T-shape: full-width shoulder band, then the trunk column below
        const { sy, lx, rx } = p.clip;
        el.style.clipPath = `polygon(0 0, 100% 0, 100% ${sy}%, ${rx}% ${sy}%, ` +
                            `${rx}% 100%, ${lx}% 100%, ${lx}% ${sy}%, 0 ${sy}%)`;
      } else if (p.notch) {
        // arm: inner corner cut away below the crotch so no thigh sliver rides along
        const { cy, ix, side } = p.notch;
        el.style.clipPath = side === 'L'
          ? `polygon(0 0, 100% 0, 100% ${cy}%, ${ix}% ${cy}%, ${ix}% 100%, 0 100%)`
          : `polygon(0 0, 100% 0, 100% 100%, ${ix}% 100%, ${ix}% ${cy}%, 0 ${cy}%)`;
      }
      rig.appendChild(el);
      parts[key] = el;
    }
    return { rig, parts };
  }

  function setRigSprite(fig, url) {
    fig.rig.style.setProperty('--sprite', 'url("' + url + '")');
    if (fig.img) fig.img.src = url;               // fallback path
  }

  /* ---------- figure lifecycle ---------- */
  function createFigure(c) {
    const el = h('div', 'bfig' + (c.isPlayer ? ' player' : ''));
    const depth = !c.isPlayer && Math.random() < 0.4 ? 1 : 0;
    if (depth) el.classList.add('back');
    const bubbleEl = h('div', 'bubble');
    const sprite = h('div', 'sprite');
    const { rig, parts } = buildRig(c);
    sprite.appendChild(rig);
    const img = rig.querySelector('img');         // null when rigged
    // stagger the idle loops so the cast doesn't breathe in lockstep
    rig.style.setProperty('--phase', (-Math.random() * 4).toFixed(2) + 's');
    const tag = h('div', 'btag', c.displayName);
    /* Tribe colour lives on the camp flag and on the name tag, not on the body —
       a band across a fifty-pixel figure read as a bum bag rather than a buff. */
    el.appendChild(bubbleEl);
    el.appendChild(sprite);
    el.appendChild(tag);
    Tribes.mark(el, c.tribeName);
    const hw = [0.88, 1.0, 1.1][c.heightTier] || 1;
    el.style.width = `calc(clamp(46px, 8.5vw, 88px) * ${hw})`;

    // start in an affinity-picked zone (player starts at Camp)
    const zi = c.isPlayer ? 3 : pickWeightedZone(c);
    const x = zoneCenter(zi) + mrand(-2.6, 2.6);
    el.style.left = x + '%';

    if (!c.isPlayer) el.addEventListener('click', e => { e.stopPropagation(); goTalkTo(c); });
    else el.addEventListener('click', e => { e.stopPropagation(); showSelf(); });

    figRoot().appendChild(el);
    const fig = { el, sprite, rig, parts, img, tag, bubbleEl, x, depth, walking: false, busy: false,
                  bubbleTimer: null, emoteTimer: null, actTimer: null, spriteURL: '' };
    if (c.spriteURL) { setRigSprite(fig, c.spriteURL); fig.spriteURL = c.spriteURL; }
    figures.set(c.name, fig);
    return fig;
  }

  /* The flag in the ground has to change when the tribe does. */
  function syncCampFlag() {
    const wrap = document.querySelector('.camp-flag-f');
    if (!wrap || !GAME.player) return;
    const want = GAME.merged ? 'Solara' : GAME.player.tribeName;
    const cur = wrap.firstChild;
    if (cur && cur.dataset.tribe === want) return;
    wrap.innerHTML = '';
    wrap.appendChild(Tribes.flag(want));
  }

  function sync() {
    buildWorld();
    syncCampFlag();
    const pool = visibleCast();
    const names = new Set(pool.map(c => c.name));
    for (const [name, fig] of figures) {
      if (!names.has(name)) {
        fig.el.classList.add('leaving');
        setTimeout(() => fig.el.remove(), 750);
        figures.delete(name);
      }
    }
    for (const c of pool) {
      const fig = figures.get(c.name) || createFigure(c);
      if (c.spriteURL && fig.spriteURL !== c.spriteURL) { setRigSprite(fig, c.spriteURL); fig.spriteURL = c.spriteURL; }
      fig.tag.textContent = c.displayName + (GAME.todayImmune === c ? ' • IMMUNE' : '');
      /* A swap or a merge changes which tribe they belong to. */
      if (fig.el.dataset.tribe !== c.tribeName) Tribes.mark(fig.el, c.tribeName);
      fig.el.classList.toggle('immune', GAME.todayImmune === c);
      // posture carries morale: worn-down castaways stand differently
      fig.el.classList.toggle('weary', c.morale < 0.35);
    }
  }

  /* ---------- movement ---------- */
  const NPC_SPEED = 190;     // ms per world-%
  const PLAYER_SPEED = 120;

  function walk(name, targetX, cb, speed) {
    const fig = figures.get(name);
    if (!fig || fig.walking) { if (cb) cb(); return; }
    targetX = Math.max(0.8, Math.min(99.2, targetX));
    const dist = Math.abs(targetX - fig.x);
    if (dist < 0.35) { if (cb) cb(); return; }
    const dur = Math.max(420, dist * (speed || NPC_SPEED));
    fig.rig.style.setProperty('--flip', targetX < fig.x ? -1 : 1);
    fig.el.style.transitionDuration = dur + 'ms';
    fig.el.classList.add('walking');
    fig.walking = true;
    void fig.el.offsetWidth;
    fig.el.style.left = targetX + '%';
    fig.x = targetX;
    setTimeout(() => {
      fig.el.classList.remove('walking');
      fig.walking = false;
      if (cb) cb();
    }, dur + 40);
  }

  /* Long trips fade out and re-enter near the destination (off-screen shortcut) */
  function travel(name, targetX, cb, speed) {
    const fig = figures.get(name);
    if (!fig) { if (cb) cb(); return; }
    const dist = Math.abs(targetX - fig.x);
    if (dist <= 14) { walk(name, targetX, cb, speed); return; }
    fig.el.classList.add('leaving');
    setTimeout(() => {
      fig.x = targetX + (targetX > 50 ? 6 : -6);
      fig.el.style.transitionDuration = '0ms';
      fig.el.style.left = fig.x + '%';
      void fig.el.offsetWidth;
      fig.el.classList.remove('leaving');
      walk(name, targetX, cb, speed);
    }, 720);
  }

  /* ---------- camera ---------- */
  function camTo(x, instant) {
    const sc = sceneEl();
    if (!sc) return;
    const world = worldEl();
    const px = (x / 100) * world.scrollWidth - sc.clientWidth / 2;
    sc.scrollTo({ left: Math.max(0, px), behavior: instant ? 'auto' : 'smooth' });
  }
  function camToPlayer(instant) {
    const pf = figures.get(GAME.player && GAME.player.name);
    if (pf) camTo(pf.x, instant);
  }

  /* Player walks somewhere, camera follows */
  function playerWalkTo(x, cb) {
    const p = GAME.player;
    if (!p) { if (cb) cb(); return; }
    const fig = figures.get(p.name);
    if (!fig) { if (cb) cb(); return; }
    walk(p.name, x, () => { if (cb) cb(); }, PLAYER_SPEED);
    // follow while walking
    const follow = setInterval(() => {
      camTo(fig.x);
      if (!fig.walking) clearInterval(follow);
    }, 360);
  }

  /* Player travels to an NPC, then the callback fires (used by talk) */
  function travelToNpc(npc, cb) {
    const nf = figures.get(npc.name);
    const pf = figures.get(GAME.player.name);
    if (!nf || !pf) { cb(); return; }
    camTo(nf.x);
    const side = pf.x < nf.x ? -6 : 6;
    const dist = Math.abs(nf.x + side - pf.x);
    if (dist > 16) {
      travel(GAME.player.name, nf.x + side, cb, PLAYER_SPEED);
    } else {
      playerWalkTo(nf.x + side, cb);
    }
  }

  /* ---------- emotes ----------
     One-shot body language. 'talking' runs for as long as a line is on screen;
     the rest are timed bursts. All are pure CSS on the rig parts. */
  const EMOTES = { talking: 0, cheer: 1500, slump: 2600, wave: 1400, shrug: 1200 };

  function emote(name, kind, dur) {
    const fig = figures.get(name);
    if (!fig || !(kind in EMOTES)) return;
    clearTimeout(fig.emoteTimer);
    for (const k of Object.keys(EMOTES)) fig.el.classList.remove('em-' + k);
    void fig.el.offsetWidth;                       // restart the keyframes
    fig.el.classList.add('em-' + kind);
    const ms = dur || EMOTES[kind];
    if (ms) fig.emoteTimer = setTimeout(() => fig.el.classList.remove('em-' + kind), ms);
  }
  function clearEmote(name) {
    const fig = figures.get(name);
    if (!fig) return;
    clearTimeout(fig.emoteTimer);
    for (const k of Object.keys(EMOTES)) fig.el.classList.remove('em-' + k);
  }

  /* ---------- speech bubbles ---------- */
  function bubble(name, text, dur) {
    const fig = figures.get(name);
    if (!fig) return;
    clearTimeout(fig.bubbleTimer);
    fig.bubbleEl.textContent = text;
    fig.bubbleEl.classList.remove('show');
    void fig.bubbleEl.offsetWidth;
    fig.bubbleEl.classList.add('show');
    const ms = dur || 4200;
    // gesture and nod for as long as the line is up
    emote(name, 'talking', ms);
    fig.bubbleTimer = setTimeout(() => fig.bubbleEl.classList.remove('show'), ms);
  }

  /* ---------- ambient life ---------- */
  function freeNpcs() {
    return visibleCast().filter(c => {
      if (c.isPlayer) return false;
      const f = figures.get(c.name);
      return f && !f.walking && !f.busy;
    });
  }

  function cluster() {
    const pool = freeNpcs();
    if (pool.length < 2) return;
    const a = mpick(pool);
    const af = figures.get(a.name);
    // prefer someone already in the same zone; else warmest relationship anywhere
    const sameZone = pool.filter(c => c !== a && zoneOfX(figures.get(c.name).x) === zoneOfX(af.x));
    let b = null;
    if (sameZone.length) b = mpick(sameZone);
    else {
      let best = -1;
      for (const c of pool) {
        if (c === a) continue;
        const r = a.getRel(c.name);
        if (r > best) { best = r; b = c; }
      }
    }
    if (!b) return;
    const group = [a, b];
    if (pool.length > 2 && Math.random() < 0.3) {
      const rest = sameZone.filter(c => !group.includes(c));
      if (rest.length) group.push(mpick(rest));
    }
    const meet = Math.max(2, Math.min(98, af.x + mrand(-2, 2)));
    let arrived = 0;
    group.forEach((c, i) => {
      const fig = figures.get(c.name);
      fig.busy = true;
      const go = Math.abs(meet - fig.x) > 14 ? travel : walk;
      go(c.name, meet + (i - (group.length - 1) / 2) * 3.2, () => {
        arrived++;
        if (arrived === group.length) {
          const maxSoc = Math.max(...group.map(m => m.stats.social));
          const verbs = maxSoc > 0.65 ? NPC_LINES.chatHi : maxSoc > 0.35 ? NPC_LINES.chatMid : NPC_LINES.chatLow;
          bubble(mpick(group).name, mpick(verbs));
          setTimeout(() => {
            group.forEach(m => {
              const f = figures.get(m.name);
              if (!f) return;
              f.busy = false;
            });
          }, mrand(5000, 8500));
        }
      });
    });
  }

  function tick() {
    if (!campActive() || !GAME.seasonActive || GAME.playerEliminated) return;
    const r = Math.random();
    if (r < 0.30) {
      // roam: pick a new zone by affinity and travel there
      const pool = freeNpcs();
      if (pool.length) {
        const c = mpick(pool);
        const zi = pickWeightedZone(c);
        const dest = zoneCenter(zi) + mrand(-2.8, 2.8);
        const fig = figures.get(c.name);
        const go = Math.abs(dest - fig.x) > 14 ? travel : walk;
        go(c.name, dest);
        if (Math.random() < 0.22) bubble(c.name, mpick(NPC_LINES.solo));
      }
    } else if (r < 0.60) {
      cluster();
    } else if (r < 0.70) {
      // sociable drift toward the player
      const pf = figures.get(GAME.player.name);
      const pool = freeNpcs().filter(c => c.stats.social > 0.5);
      if (pf && pool.length) {
        const c = mpick(pool);
        const fig = figures.get(c.name);
        if (Math.abs(pf.x - fig.x) < 18) walk(c.name, pf.x + (Math.random() < 0.5 ? -5 : 5));
      }
    } else if (r < 0.82) {
      /* Somebody says out loud that the camp is short of something. The needs
         board should be audible, not only readable. */
      if (typeof CampNeeds === 'undefined') return;
      const bad = CampNeeds.problems();
      if (!bad.length) return;
      const pool = freeNpcs().filter(c => typeof valuesWork === 'function' && valuesWork(c) > 0.3);
      if (!pool.length) return;
      const c = mpick(pool);
      bubble(c.name, CampLines.pick('needMention', c, { need: mpick(bad).short }), 3600);
    }
  }

  /* ---------- camp work on the island ----------
     Nothing gets done by teleport. A castaway who is fetching water walks to the
     well; somebody on firewood goes into the treeline. Two things come out of
     this that the rest of the game reads:

       data-act="chop"   the ACTION TYPE, as a parameter on the figure. Every
                         piece of work carries one, so an animation can be hung
                         off it later without touching the labour system.
       .working          a plain state flag for CSS.

     Zones are looked up by the ids in ZONES, so a job says where it happens
     ('Forest', 'Well', 'FirePit') and this resolves it to a place on the island. */
  const ACTS = ['chop', 'haul', 'gather', 'build', 'tidy', 'tend', 'eat', 'sleep'];

  function zoneIndexOf(id) {
    const i = ZONES.findIndex(z => z.id === id);
    return i >= 0 ? i : 3;                        // fall back to Camp
  }
  function zoneX(id) { return zoneCenter(zoneIndexOf(id)); }

  /* Put a figure into an action. `act` is the animation tag; ms is how long it
     shows for. Returns immediately — the tag clears itself. */
  function setAct(name, act, ms) {
    const fig = figures.get(name);
    if (!fig) return;
    clearTimeout(fig.actTimer);
    for (const a of ACTS) fig.el.classList.remove('act-' + a);
    if (!act) { fig.el.classList.remove('working'); delete fig.el.dataset.act; return; }
    fig.el.dataset.act = act;
    fig.el.classList.add('working', 'act-' + act);
    void fig.el.offsetWidth;
    if (ms) {
      fig.actTimer = setTimeout(() => {
        fig.el.classList.remove('working', 'act-' + act);
        delete fig.el.dataset.act;
      }, ms);
    }
  }

  /* Send an NPC off to do a job: walk to the right biome, work there, come back
     to being an ordinary castaway. */
  function sendToWork(name, zoneId, act, ms, cb) {
    const fig = figures.get(name);
    if (!fig) { if (cb) cb(); return; }
    if (fig.busy || fig.walking) { if (cb) cb(); return; }
    fig.busy = true;
    const dest = zoneX(zoneId) + mrand(-2.4, 2.4);
    const go = Math.abs(dest - fig.x) > 14 ? travel : walk;
    go(name, dest, () => {
      setAct(name, act, ms || 4200);
      setTimeout(() => {
        fig.busy = false;
        setAct(name, null);
        if (cb) cb();
      }, ms || 4200);
    });
  }

  /* The player doing a job. Same trip, camera follows, then the callback applies
     the actual effect — so the work lands when you get there, not when you tap. */
  function playerWork(zoneId, act, ms, cb) {
    const p = GAME.player;
    if (!p) { if (cb) cb(); return; }
    const dest = zoneX(zoneId) + mrand(-1.8, 1.8);
    const fig = figures.get(p.name);
    if (!fig) { if (cb) cb(); return; }
    camTo(dest);
    const done = () => {
      setAct(p.name, act, ms || 1500);
      setTimeout(() => { setAct(p.name, null); if (cb) cb(); }, ms || 1500);
    };
    if (Math.abs(dest - fig.x) > 16) travel(p.name, dest, done, PLAYER_SPEED);
    else playerWalkTo(dest, done);
  }

  /* Spread the day's tribe labour across real time so the island looks like a
     place where people are getting on with things. */
  let workQueue = [], workTimer = null;
  function stageWork(assignments) {
    workQueue = (assignments || []).slice();
    if (workTimer) clearInterval(workTimer);
    if (!workQueue.length) return;
    const step = () => {
      if (!campActive()) return;                  // hold until the player is looking
      const a = workQueue.shift();
      if (!a) { clearInterval(workTimer); workTimer = null; return; }
      sendToWork(a.name, a.zone, a.act, mrand(4200, 7000));
      if (Math.random() < 0.5) {
        const job = typeof jobById === 'function' ? jobById(a.job && a.job.id) : null;
        if (job) bubble(a.name, mpick(['Right.', 'Someone had to.', job.verb ? 'I am ' + job.verb + '.' : 'On it.', 'Give me a hand?']), 3000);
      }
    };
    step();
    workTimer = setInterval(step, 5200);
  }

  /* ---------- scripted moments ---------- */
  function approach(npc, done) {
    const fig = figures.get(npc.name);
    const pf = figures.get(GAME.player.name);
    if (!fig || !pf) { done(); return; }
    fig.busy = true;
    camToPlayer();
    travel(npc.name, pf.x + (fig.x < pf.x ? -5 : 5), () => {
      emote(npc.name, 'wave');
      bubble(npc.name, mpick(NPC_LINES.approach), 2600);
      setTimeout(() => { fig.busy = false; done(); }, 900);
    });
  }

  /* ---------- scene state ---------- */
  function night(on) { document.getElementById('screen-camp').classList.toggle('night', !!on); }
  function storm(on) { document.getElementById('screen-camp').classList.toggle('stormy', !!on); }

  function reset() {
    for (const [, fig] of figures) fig.el.remove();
    figures.clear();
  }

  /* ---------- marooning wide shot ----------
     Both tribes in one line facing the camera, reusing the same rigs as the
     beach so the cast looks identical to how it will in play. */
  function maroonLine(cast) {
    const root = document.getElementById('maroon-line');
    if (!root) return;
    root.innerHTML = '';
    const tidal = cast.filter(c => c.tribeName === 'Tidal');
    const ember = cast.filter(c => c.tribeName !== 'Tidal');
    /* Two tribes have to READ as two. They used to be one row with a small text
       tag, which looked like a single crowd of eighteen. Each now stands on its
       own coloured mat under its own banner, with a strip of open beach between
       them. */
    const groups = [['Tidal', tidal], ['Ember', ember]];
    for (let gi = 0; gi < groups.length; gi++) {
      const [tribe, group] = groups[gi];
      if (gi > 0) root.appendChild(h('div', 'maroon-gap'));
      const g = h('div', 'maroon-tribe ' + tribe.toLowerCase());
      Tribes.mark(g, tribe);
      g.appendChild(h('div', 'maroon-tribe-tag', Tribes.label(tribe)));
      const row = h('div', 'maroon-row');
      /* Planted at the end of the line, standing in the sand. */
      row.appendChild(Tribes.flag(tribe, 'tf-big'));
      for (const c of group) {
        const fig = h('div', 'mfig' + (c.isPlayer ? ' player' : ''));
        fig.dataset.name = c.name;
        /* buildRig returns {rig, parts}; the sprite url has to be applied too,
           exactly as createFigure does, or the whole line renders blank. */
        const sprite = h('div', 'sprite');
        const { rig, parts } = buildRig(c);
        sprite.appendChild(rig);
        if (c.spriteURL) {
          rig.style.setProperty('--sprite', 'url("' + c.spriteURL + '")');
          const im = rig.querySelector('img');
          if (im) im.src = c.spriteURL;
        }
        rig.style.setProperty('--phase', (-Math.random() * 4).toFixed(2) + 's');
        fig.appendChild(sprite);
        fig.appendChild(h('div', 'mtag', c.displayName));
        Tribes.mark(fig, c.tribeName);
        const hw = [0.9, 1.0, 1.08][c.heightTier] || 1;
        fig.style.width = `calc(clamp(34px, 6.2vmin, 62px) * ${hw})`;
        row.appendChild(fig);
      }
      g.appendChild(row);
      root.appendChild(g);
    }
  }
  /* Spotlight whoever Peff is talking to. */
  function maroonFocus(name) {
    const root = document.getElementById('maroon-line');
    if (!root) return;
    /* The class on the container is what dims everybody else, so nobody recedes
       until Peff has actually picked somebody. */
    root.classList.toggle('focusing', !!name);
    root.querySelectorAll('.mfig').forEach(f => {
      const on = !!name && f.dataset.name === name;
      f.classList.toggle('speaking', on);
      f.classList.toggle('em-talking', on);
    });
  }

  function start() {
    if (ticker) clearInterval(ticker);
    ticker = setInterval(tick, 3400);
  }

  /* Highlight a castaway. Added so game.js stops reaching in for `fig.el` and
     poking a CSS class onto it — that only ever worked because figures WERE DOM
     nodes here, and in the 3D renderer they are meshes. Both renderers expose this
     instead, so the caller does not need to know what a figure is made of. */
  function spotlight(name) {
    const fig = figures.get(name);
    if (!fig) return;
    camTo(fig.x);
    fig.el.classList.add('spotlight');
    setTimeout(() => fig.el.classList.remove('spotlight'), 1900);
  }

  return { spotlight, sync, walk, travel, bubble, emote, clearEmote, approach, night, storm, start, reset,
           camTo, camToPlayer, travelToNpc, playerWalkTo, figures, ZONES, maroonLine, maroonFocus,
           sendToWork, playerWork, stageWork, setAct, zoneX, zoneIndexOf, ACTS };
})();
