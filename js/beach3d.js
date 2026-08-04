/* ============================================================
   BEACH3D — the island, in 3D, behind the existing Beach interface.

   A drop-in replacement for beach.js. It implements the same public members with
   the same signatures, so game.js and marooning.js do not care which one is
   running, and the 2D renderer stays as a working fallback for a phone that cannot
   or will not do WebGL.

   THE ISLAND IS NATURAL. No shelter, no fire pit, no crates, no cloth. The tribe
   steps onto bare sand and builds its camp later, so DRESSING below contains only
   things that grow, wash up, or fall over. The zone ids are unchanged — the sim
   still says "go to the Well" and still means it — but the Well is a spot on a
   shoreline rather than a piece of furniture, until somebody digs one.

   WHAT IS DIFFERENT FROM THE 2D BEACH, deliberately:
     - castaways are cutouts standing IN the world, so a palm can stand in front of
       one. That occlusion is the entire reason for doing this.
     - the island has depth: figures move in x AND z, not along a rail.
     - the camera is perspective and follows, so walking somewhere feels like
       travelling rather than scrolling.

   COMPOSITION IS DATA. Every prop placement comes out of the DRESSING table and a
   seeded RNG. Nothing about the look is expressed in code, because the look is the
   part most likely to change.
   ============================================================ */

'use strict';

const Beach3D = {
  active: false,
  built: false,
  /* Taken from the 2D beach at LOAD time, not in build(). The Beach proxy starts
     forwarding the moment 3D activates, which is while the title screen is up and
     long before the island stage has been built — so leaving these null meant
     `Beach.ZONES` was null and `Beach.zoneIndexOf` threw for anything that asked
     early. They are static data shared by both renderers; there is no reason for
     them to wait. */
  ZONES: (typeof Beach2D !== 'undefined' ? Beach2D.ZONES : null),
  ACTS: (typeof Beach2D !== 'undefined' ? Beach2D.ACTS : null),
  figures: new Map(),
  scene: null, camera: null, rig: null, sand: null, overlay: null,
  _seed: 1, _camX: 0, _camTarget: 0, _drag: null, _mood: 'day',

  /* ---------- world scale, derived from the CASTAWAY ----------
     The level-design rule is that the character is the unit and every dimension is
     measured in them. That is also the fix for "the NPCs are too small": they were
     3.4 units tall in a frame showing 30 units of world, so a castaway was 11% of
     screen height and the scenery owned the picture.

     Worked backwards instead. A castaway should read at roughly a quarter of the
     screen, so the visible height wants to be about 4 castaways:

       visible height = 2 * camDist * tan(fov/2)
       at fov 44 and camDist 20  ->  16 units  ->  a 4.2-unit castaway is 26%

     So FIGURE_H went up and the camera came in from 37 units to 20. Both matter:
     scaling the castaway alone next to a 12-unit palm would have made the palms look
     like shrubs. */
  FIGURE_H: 4.2,
  CAM_DIST: 20,

  WIDTH: 150,
  /* The shoreline. Everything left of this is sea, so open water occupies the first
     two zones and the island body is everything to the right. */
  SHORE_X: -52,
  xToWorld(p) { return (p / 100 - 0.5) * this.WIDTH; },
  worldToX(w) { return (w / this.WIDTH + 0.5) * 100; },

  /* How far inland the island reaches at a given x — a thin spit at the shore,
     growing to deep jungle at the far end. This one function is what makes the
     island feel like a landmass rather than a corridor: the treeline recedes as you
     walk right, so there is always more island behind the island. */
  landDepth(x) {
    const t = clamp01((x - this.SHORE_X) / (this.WIDTH / 2 + 20 - this.SHORE_X));
    return 14 + t * 46;          /* 14 units at the waterline, 60 at the interior */
  },

  /* Every prop count is multiplied by this. See BEACH3D_DENSITY — it is a setting
     rather than a constant because the binding constraint is a phone GPU that cannot
     be measured from here. */
  density() {
    return typeof BEACH3D_DENSITY !== 'undefined' ? BEACH3D_DENSITY : 1;
  },

  /* ============================================================
     DRESSING lives in js/beach3d-dressing.js.

     Composition is the part most likely to be rewritten, so it is a data table in
     its own file rather than something buried in this one. Nothing here has an
     opinion about where a palm goes.
     ============================================================ */
  get DRESSING() {
    return typeof BEACH3D_DRESSING !== 'undefined' ? BEACH3D_DRESSING : {};
  },

  /* ---------- seeded RNG ----------
     Separate from the game's stream so re-dressing the island never shifts a vote.
     Seeded from GAME.seed so a season's island is reproducible. */
  srand() { this._seed = (this._seed * 1103515245 + 12345) & 0x7fffffff; return this._seed / 0x7fffffff; },
  rr(a, b) { return a + this.srand() * (b - a); },
  spick(a) { return a[Math.floor(this.srand() * a.length)]; },

  /* ============================================================
     BUILD
     ============================================================ */
  async build(THREE, S) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8fd0e8);
    scene.fog = new THREE.Fog(0x8fd0e8, 60, 200);
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(44, 2, 0.4, 400);
    this.rig = S.sunRig(scene, { span: 80 });

    /* ---------- the landmass ----------
       Open water on the LEFT, island to the RIGHT, and the land growing deeper as it
       goes. The old version was one sand rectangle with sea behind it, which is why
       the island read as a corridor with no geography: every zone had the same shape.

       Built as a triangle strip whose inland edge follows landDepth(x). Two triangles
       per step, 40 steps — nothing, and it gives the island an actual coastline that
       recedes as you walk inland. */
    const steps = 40;
    const pos = [], uv = [], idx = [];
    /* Sand STARTS at the shoreline. It used to begin 26 units further out, under the
       sea plane — so a quarter of the beach was pale flat blue laid over sand and the
       whole shore read as washed-out nothing rather than as water meeting land. */
    const x0 = this.SHORE_X - 2;
    const x1 = this.WIDTH / 2 + 30;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const back = -this.landDepth(x) - 8;      /* inland edge */
      const front = 12;                         /* out into the water */
      pos.push(x, 0, front, x, 0, back);
      uv.push(t, 0, t, 1);
      if (i < steps) {
        const a = i * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    this.sand = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0xe4c893 }));
    this.sand.receiveShadow = true;
    scene.add(this.sand);

    /* ---------- the sea ----------
       It was one flat pale-blue plane, which is why it did not read as water at all.
       Three things fix that, none of them expensive:

       1. A SEGMENTED plane, so it can actually move. 56x14 is 1,568 triangles — noise
          next to the island's million — and animating the vertices in update() gives
          real swell. A still surface is the single biggest tell that a plane is not
          water.
       2. A DEPTH GRADIENT baked into vertex colours: pale turquoise in the shallows by
          the shore, deep ocean blue further out. Flat colour reads as paper; a
          gradient reads as depth, and it costs one attribute.
       3. A FOAM line at the waterline, so land and water meet somewhere instead of
          just abutting. */
    const SEA_W = 240, SEA_D = 200, SW = 56, SD = 14;
    const seaGeo = new THREE.PlaneGeometry(SEA_W, SEA_D, SW, SD);
    const shallow = new THREE.Color(0x67ccd8), deep = new THREE.Color(0x1d6a99);
    const col = [];
    const sp = seaGeo.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      /* Plane is built in XY then rotated, so its local x maps to world x. Distance
         from the shore edge drives the blend. */
      const t = clamp01((SEA_W / 2 - sp.getX(i)) / (SEA_W * 0.55));
      const c = shallow.clone().lerp(deep, t);
      col.push(c.r, c.g, c.b);
    }
    seaGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.seaGeo = seaGeo;
    this.seaBase = Float32Array.from(sp.array);      /* rest positions for the swell */
    this.sea = new THREE.Mesh(seaGeo, new THREE.MeshLambertMaterial({
      vertexColors: true, transparent: true, opacity: 0.95
    }));
    this.sea.rotation.x = -Math.PI / 2;
    /* Right edge lands just past the shoreline so there is no seam. */
    this.sea.position.set(this.SHORE_X - SEA_W / 2 + 3, -0.04, -30);
    scene.add(this.sea);

    /* Foam: a narrow bright strip along the waterline. Slightly above the sea so it
       always wins the depth test, and its own mesh so it can pulse independently. */
    this.foam = new THREE.Mesh(
      new THREE.PlaneGeometry(6, SEA_D),
      new THREE.MeshBasicMaterial({ color: 0xdff4f7, transparent: true, opacity: 0.55 })
    );
    this.foam.rotation.x = -Math.PI / 2;
    this.foam.position.set(this.SHORE_X + 1.5, 0.02, -30);
    scene.add(this.foam);

    /* No `seaFar` plane and no ridge.

       The far sea was parked at z +60, which is BEHIND the camera at z +18 — it was
       never visible and never could be. The ridge was a 150x20 card at z -76 that
       fogged into a hard green rectangle floating above the treeline.

       Both were solving a problem the dense treeline now solves properly: with the
       jungle receding by landDepth(x) there is already island behind the island, so
       nothing needs to be painted in to close the horizon. */

    this.dressing = new THREE.Group();
    scene.add(this.dressing);
    this.dress(S);

    /* The DOM layer for bubbles and name tags. Speech does not need occlusion and
       text is far crisper as DOM than as a texture, so it stays in HTML and gets
       positioned by projecting the world point each frame. */
    return true;
  },

  /* Scatter the island from DRESSING. Called on build and on every new season. */
  dress(S) {
    const THREE = Scene3D.three;
    this._seed = ((GAME && GAME.seed) || 1337) & 0x7fffffff;
    while (this.dressing.children.length) this.dressing.remove(this.dressing.children[0]);

    const ZN = this.ZONES.length;
    this.ZONES.forEach((z, i) => {
      const cx = this.xToWorld(((i + 0.5) / ZN) * 100);
      const rules = this.DRESSING[z.kind] || this.DRESSING.beach;
      const halfW = this.WIDTH / ZN / 2 + 2;
      for (const rule of rules) {
        const pool = Scene3D.family(...rule.fam);
        if (!pool.length) continue;
        const count = Math.max(1, Math.round(rule.n * this.density()));
        for (let k = 0; k < count; k++) {
          const o = Scene3D.spawn(this.spick(pool));
          if (!o) continue;
          o.position.set(cx + this.rr(-halfW, halfW), 0, this.rr(rule.z[0], rule.z[1]));
          o.scale.multiplyScalar(this.rr(rule.s[0], rule.s[1]));
          o.rotation.y = this.rr(0, Math.PI * 2);
          /* A tiny lean on anything tall stops the palms looking like fence posts. */
          if (/Palm_Tree|Tree_Trunk/i.test(o.name || '')) o.rotation.z = this.rr(-0.05, 0.05);
          this.dressing.add(o);
        }
      }
    });

    /* ---------- the inland treeline ----------
       The mass that makes the island look like it continues past what you can see.
       It starts at the shoreline and DEEPENS with landDepth(x), so walking right
       reveals more island rather than the same wall sliding by.

       Only palms are rationed here. The bulk is ferns, stubs and bare trunks — 138
       to 366 triangles against a palm's 4,900 — which is what actually reads as
       impenetrable. A wall of full palms would cost ten times as much and look
       thinner, because it would have to be sparser. */
    const T = typeof BEACH3D_TREELINE !== 'undefined' ? BEACH3D_TREELINE
      : { palms: 4, fill: [] };
    const from = this.SHORE_X - 6, to = this.WIDTH / 2 + 24;
    const span = to - from;

    const palms = Scene3D.family('Palm_Tree_0');
    if (palms.length) {
      const n = Math.max(2, Math.round(span / 10 * T.palms * this.density()));
      for (let i = 0; i < n; i++) {
        const x = from + (i / n) * span + this.rr(-4, 4);
        const d = this.landDepth(x);
        const o = Scene3D.spawn(this.spick(palms));
        if (!o) continue;
        o.position.set(x, 0, this.rr(-d - 4, -d * 0.42));
        o.scale.multiplyScalar(this.rr(1.1, 1.9));
        o.rotation.y = this.rr(0, Math.PI * 2);
        o.rotation.z = this.rr(-0.05, 0.05);
        o.castShadow = false;      /* far enough back that nobody sees the shadow */
        this.dressing.add(o);
      }
    }
    for (const layer of (T.fill || [])) {
      const pool = Scene3D.family(...layer.fam);
      if (!pool.length) continue;
      const n = Math.max(2, Math.round(span / 10 * layer.per10 * this.density()));
      for (let i = 0; i < n; i++) {
        const x = from + (i / n) * span + this.rr(-5, 5);
        const d = this.landDepth(x);
        const o = Scene3D.spawn(this.spick(pool));
        if (!o) continue;
        o.position.set(x, 0, this.rr(-d - 2, -d * 0.35));
        o.scale.multiplyScalar(this.rr(0.9, 1.6));
        o.rotation.y = this.rr(0, Math.PI * 2);
        o.castShadow = false;
        this.dressing.add(o);
      }
    }

    this.objectCount = this.dressing.children.length;
    DBG.decision('Beach3D', 'island dressed', { objects: this.objectCount, density: this.density() });
    this.bake();
  },

  /* ---------- bake the dressing ----------
     THE SINGLE MOST IMPORTANT OPTIMISATION IN THIS FILE.

     Measured before doing it: 259 placed props produced 977 draw calls and 593,000
     triangles, and the frame loop could not keep up even on a desktop. Triangles are
     not really the problem — a modern phone eats 600k — but draw calls are the
     mobile bottleneck, and roughly one per mesh per prop is a disaster.

     The dressing never moves. So every prop's geometry is baked into world space and
     merged into one mesh PER ZONE PER MATERIAL. Per zone rather than one giant mesh
     on purpose: a single merged island would defeat frustum culling and the GPU would
     shade the whole 150-unit strip every frame no matter where the camera looks.
     Fourteen chunks keeps culling useful while collapsing draws by ~50x.

     Shadow casting is dropped on the baked chunks. A merged chunk is one object to
     the shadow pass, so its shadow volume is the whole zone and the map resolution
     per prop collapses into mush — and the castaways, who DO cast shadows, are what
     sells the grounding anyway. */
  bake() {
    const made = Scene3D.bakeGroup(this.dressing, this.ZONES.length, this.WIDTH);
    DBG.decision('Beach3D', 'dressing baked', { meshes: made, slices: this.ZONES.length });
  },

  /* ============================================================
     FIGURES
     ============================================================ */
  ensureOverlay() {
    const host = document.getElementById('camp-scene');
    if (!host) return null;
    let ov = document.getElementById('b3d-overlay');
    if (!ov) {
      ov = h('div', 'b3d-overlay');
      ov.id = 'b3d-overlay';
      host.appendChild(ov);
    }
    this.overlay = ov;
    return ov;
  },

  figFor(c) {
    let f = this.figures.get(c.name);
    if (f) return f;
    const THREE = Scene3D.three;
    const mesh = Scene3D.billboard(c.spriteURL || 'assets/bodies/' + (c.bodyKey || 'male_muscular') + '.png', this.FIGURE_H);
    /* Spread the cast along the shore at the camp end to begin with. */
    const zi = Math.max(0, this.ZONES.findIndex(z => z.kind === 'camp'));
    const startX = ((zi + 0.5) / this.ZONES.length) * 100;
    mesh.position.set(this.xToWorld(startX + this.rr(-7, 7)), this.FIGURE_H / 2, this.rr(-7, 4));
    this.scene.add(mesh);
    const tag = h('div', 'b3d-tag', c.displayName);
    if (c.isPlayer) tag.classList.add('me');
    this.ensureOverlay();
    if (this.overlay) this.overlay.appendChild(tag);
    f = {
      c, mesh, tag, bubbleEl: null, bubbleTimer: null,
      x: startX, target: null, walking: false, busy: false,
      phase: this.rr(0, 6.3), act: null, actUntil: 0
    };
    this.figures.set(c.name, f);
    return f;
  },

  /* ============================================================
     THE BEACH INTERFACE
     Every member below exists on the 2D beach with the same signature.
     ============================================================ */
  start() { this.sync(); this.camToPlayer(true); },

  reset() {
    for (const f of this.figures.values()) {
      if (f.mesh && f.mesh.parent) f.mesh.parent.remove(f.mesh);
      if (f.tag && f.tag.parentNode) f.tag.parentNode.removeChild(f.tag);
      if (f.bubbleEl && f.bubbleEl.parentNode) f.bubbleEl.parentNode.removeChild(f.bubbleEl);
    }
    this.figures.clear();
    if (this.dressing) this.dress(Scene3D);
  },

  sync() {
    if (!this.scene) return;
    const live = new Set();
    for (const c of alive()) {
      if (!campmates(GAME.player).includes(c) && !c.isPlayer) continue;
      live.add(c.name);
      const f = this.figFor(c);
      /* A changed sprite means a re-tint or a new body; swap the texture. */
      if (c.spriteURL && f.spriteURL !== c.spriteURL) {
        f.spriteURL = c.spriteURL;
        const THREE = Scene3D.three;
        const t = new THREE.TextureLoader().load(c.spriteURL);
        t.colorSpace = THREE.SRGBColorSpace;
        f.mesh.material = new THREE.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
      }
    }
    /* Anybody gone is gone. */
    for (const [name, f] of [...this.figures]) {
      if (live.has(name)) continue;
      if (f.mesh.parent) f.mesh.parent.remove(f.mesh);
      if (f.tag && f.tag.parentNode) f.tag.parentNode.removeChild(f.tag);
      this.figures.delete(name);
    }
  },

  zoneX(i) { return ((i + 0.5) / this.ZONES.length) * 100; },
  zoneIndexOf(id) {
    const i = this.ZONES.findIndex(z => z.id === id || z.label === id);
    return i < 0 ? this.ZONES.findIndex(z => z.kind === 'camp') : i;
  },

  walk(name, x, done) {
    const f = this.figures.get(name);
    if (!f) { if (done) done(); return; }
    f.target = { x, z: this.rr(-7, 4), done };
    f.walking = true;
  },
  travel(name, x, done) { this.walk(name, x, done); },
  playerWalkTo(x, done) {
    if (!GAME.player) return;
    this.walk(GAME.player.name, x, done);
    this._camFollow = true;
  },
  travelToNpc(npc, done) {
    const nf = this.figures.get(npc.name);
    if (!nf || !GAME.player) { if (done) done(); return; }
    const px = this.worldToX(nf.mesh.position.x) + (this.srand() < 0.5 ? -2.2 : 2.2);
    this.walk(GAME.player.name, Math.max(1, Math.min(99, px)), done);
    this._camFollow = true;
  },
  approach(name, targetName, done) {
    const tf = this.figures.get(targetName);
    if (!tf) { if (done) done(); return; }
    this.walk(name, this.worldToX(tf.mesh.position.x) + this.rr(-2.6, 2.6), done);
  },

  camTo(x, snap) {
    this._camTarget = this.xToWorld(x);
    this._camFollow = false;
    if (snap) this._camX = this._camTarget;
  },
  camToPlayer(snap) {
    const f = GAME.player && this.figures.get(GAME.player.name);
    this._camFollow = true;
    if (f) { this._camTarget = f.mesh.position.x; if (snap) this._camX = this._camTarget; }
  },

  /* A castaway saying something. DOM, because text as a texture is unreadable at
     this resolution and speech never needs to be occluded by a palm. */
  bubble(name, text, ms) {
    const f = this.figures.get(name);
    if (!f) return;
    this.ensureOverlay();
    if (!this.overlay) return;
    if (!f.bubbleEl) {
      f.bubbleEl = h('div', 'b3d-bubble');
      this.overlay.appendChild(f.bubbleEl);
    }
    f.bubbleEl.textContent = text;
    f.bubbleEl.classList.add('show');
    clearTimeout(f.bubbleTimer);
    f.bubbleTimer = setTimeout(() => f.bubbleEl && f.bubbleEl.classList.remove('show'), ms || 2600);
  },
  emote(name, kind) {
    const f = this.figures.get(name);
    if (!f) return;
    f.emote = kind;
    f.emoteUntil = performance.now() + 1400;
  },
  clearEmote(name) {
    const f = this.figures.get(name);
    if (f) { f.emote = null; f.emoteUntil = 0; }
  },

  setAct(name, act) {
    const f = this.figures.get(name);
    if (f) f.act = act;
  },
  sendToWork(name, zoneId, act, ms) {
    const f = this.figures.get(name);
    if (!f) return;
    const x = this.zoneX(this.zoneIndexOf(zoneId));
    this.walk(name, x, () => {
      f.act = act;
      f.actUntil = performance.now() + (ms || 4000);
      f.busy = true;
      setTimeout(() => { f.busy = false; f.act = null; }, ms || 4000);
    });
  },
  playerWork(zoneId, act, ms, done) {
    if (!GAME.player) { if (done) done(); return; }
    const f = this.figures.get(GAME.player.name);
    const x = this.zoneX(this.zoneIndexOf(zoneId));
    this._camFollow = true;
    this.walk(GAME.player.name, x, () => {
      if (f) { f.act = act; f.actUntil = performance.now() + (ms || 3000); f.busy = true; }
      setTimeout(() => { if (f) { f.busy = false; f.act = null; } if (done) done(); }, ms || 3000);
    });
  },
  stageWork(list) {
    for (const a of (list || [])) this.sendToWork(a.name, a.zone, a.act, 5000);
  },

  night(on) { this._mood = on ? 'night' : 'day'; this.applyMood(); },
  storm(on) { this._mood = on ? 'storm' : (this._mood === 'night' ? 'night' : 'day'); this.applyMood(); },
  applyMood() {
    if (this.scene) Scene3D.applyLight(this.rig, this.scene, this._mood);
    if (this.sea) this.sea.material.color.setHex(
      this._mood === 'night' ? 0x16344a : this._mood === 'storm' ? 0x40525e : this._mood === 'dusk' ? 0x1d4a63 : 0x3fa9c9);
  },

  /* Replaces the 2D beach's `fig.el.classList.add('spotlight')`. Reaching into a
     figure's DOM node from game.js only worked because figures WERE DOM nodes; now
     they are meshes, so the highlight is a method on both renderers. */
  spotlight(name) {
    const f = this.figures.get(name);
    if (!f) return;
    this.camTo(this.worldToX(f.mesh.position.x));
    f.glow = performance.now() + 1900;
    if (f.tag) {
      f.tag.classList.add('spot');
      setTimeout(() => f.tag && f.tag.classList.remove('spot'), 1900);
    }
  },

  /* The marooning screen drives the camera and a caption directly. */
  maroonFocus(name) {
    const f = name && this.figures.get(name);
    if (f) this.camTo(this.worldToX(f.mesh.position.x));
    else this.camToPlayer();
  },
  maroonLine(text) {
    if (GAME.player) this.bubble(GAME.player.name, text, 3200);
  },

  onContextLost() { this.active = false; },

  /* ============================================================
     FRAME
     ============================================================ */
  update(dt, now) {
    const THREE = Scene3D.three;
    const cam = this.camera;

    for (const f of this.figures.values()) {
      const p = f.mesh.position;

      /* Walk. Straight-line, eased at the end, which is all a top-down stroll on
         open sand needs — there is nothing to path around. */
      if (f.walking && f.target) {
        const tx = this.xToWorld(f.target.x);
        const dx = tx - p.x, dz = (f.target.z || 0) - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.35) {
          f.walking = false;
          const cb = f.target.done; f.target = null;
          if (cb) cb();
        } else {
          const step = Math.min(d, dt * 7.5);
          p.x += dx / d * step; p.z += dz / d * step;
          f.mesh.material.map && (f.mesh.scale.x = dx < 0 ? -1 : 1);   /* face travel */
        }
      }

      /* Bob, so nobody is a statue. Working castaways bob faster. */
      const busy = f.busy || (f.actUntil > now);
      p.y = this.FIGURE_H / 2 + Math.sin(now / (busy ? 260 : 720) + f.phase) * (busy ? 0.09 : 0.035);
      f.x = this.worldToX(p.x);

      Scene3D.faceCamera(f.mesh, cam);
      /* faceCamera overwrote the flip, so re-apply it as a scale on the mesh. */
      if (f.mesh.scale.x < 0) f.mesh.scale.x = Math.abs(f.mesh.scale.x) * -1;

      /* Tags and bubbles ride along, projected from the world each frame. */
      const head = p.clone(); head.y += this.FIGURE_H * 0.62;
      f.screen = Scene3D.project(head, cam);
      if (f.bubbleEl && f.screen) {
        f.bubbleEl.style.transform = 'translate(-50%,-100%) translate('
          + f.screen.x.toFixed(1) + 'px,' + (f.screen.y - 24).toFixed(1) + 'px)';
      }
      if (f.glow && f.glow < now) f.glow = 0;
    }

    /* ---------- declutter the name tags ----------
       The tribe clusters, so nine tags landed on top of each other in a stack you
       could not read a single name out of. That matters more now than it did: the
       castaways are the focus of the frame, and their labels were the least legible
       thing in it.

       Sorted back-to-front and lifted whenever a tag would overlap the one before
       it, so a cluster fans upward into a readable column instead of a smear. Only
       ever moves UP, so a tag never covers the face it belongs to. */
    const tagged = [];
    for (const f of this.figures.values()) if (f.tag && f.screen) tagged.push(f);
    tagged.sort((a, b) => b.screen.depth - a.screen.depth);   /* furthest first */
    const placed = [];
    const TAG_H = 20, TAG_W = 74;
    for (const f of tagged) {
      let y = f.screen.y;
      /* Walk up past anything already occupying this column. */
      for (let guard = 0; guard < 12; guard++) {
        const clash = placed.find(q => Math.abs(q.x - f.screen.x) < TAG_W && Math.abs(q.y - y) < TAG_H);
        if (!clash) break;
        y = clash.y - TAG_H;
      }
      placed.push({ x: f.screen.x, y });
      f.tag.style.transform = 'translate(-50%,-100%) translate('
        + f.screen.x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
      /* Fade with distance so the far side of the island does not shout. */
      f.tag.style.opacity = String(Math.max(0.3, 1 - Math.max(0, f.screen.depth - 0.986) * 60));
      f.tag.classList.remove('hidden');
    }
    for (const f of this.figures.values()) {
      if (f.tag && !f.screen) f.tag.classList.add('hidden');
    }

    /* ---------- the swell ----------
       Displace the sea vertices from their rest positions. Two crossed waves at
       different frequencies so it never looks like a repeating ripple, plus a foam
       line that breathes. Cheap: 1,568 vertices touched per frame. */
    if (this.seaGeo && this.seaBase) {
      const sp = this.seaGeo.attributes.position;
      const base = this.seaBase;
      for (let i = 0; i < sp.count; i++) {
        const x = base[i * 3], y = base[i * 3 + 1];
        sp.array[i * 3 + 2] = Math.sin(x * 0.13 + now / 1300) * 0.35
          + Math.sin(y * 0.21 - now / 900) * 0.22;
      }
      sp.needsUpdate = true;
    }
    if (this.foam) this.foam.material.opacity = 0.42 + Math.sin(now / 1100) * 0.16;

    /* Camera. Follows the player with lag, stays inside the island, and sits high
       enough to see depth without becoming a top-down map.

       DRAGGING PANS IT. The 2D beach let you scroll the strip sideways to look around,
       and losing that was reported as "no scrolling to the right" — the 3D camera only
       ever followed the player, so there was no way to see the island you were not
       standing on. A drag now takes over, and walking somewhere hands control back. */
    const pf = GAME.player && this.figures.get(GAME.player.name);
    if (this._camFollow && pf) this._camTarget = pf.mesh.position.x;
    const lim = this.WIDTH / 2 - 8;
    this._camTarget = Math.max(-lim, Math.min(lim, this._camTarget));
    this._camX += (this._camTarget - this._camX) * Math.min(1, dt * 2.6);
    /* Framing derived from FIGURE_H and CAM_DIST rather than picked by eye — see the
       note on those constants. Camera came in from 37 units to 20, which is what takes
       a castaway from 11% of screen height to about 26%. The scenery did not shrink;
       the frame did, and the extra density fills it. */
    const h = this.CAM_DIST * 0.42;
    cam.position.set(this._camX + 1.5, h, this.CAM_DIST * 0.9);
    cam.lookAt(this._camX, this.FIGURE_H * 0.62, -5);
  },

  /* ---------- picking ----------
     Which castaway is under a tap. Raycast against the billboards only — the sand
     and the scenery are not people and testing them is wasted work. */
  pickFigure(pt) {
    const THREE = Scene3D.three;
    const el = Scene3D.canvas;
    if (!el) return null;
    const nx = (pt.ox / el.clientWidth) * 2 - 1;
    const ny = -(pt.oy / el.clientHeight) * 2 + 1;
    this._pray = this._pray || new THREE.Raycaster();
    this._pray.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    const meshes = [], byMesh = new Map();
    for (const f of this.figures.values()) { meshes.push(f.mesh); byMesh.set(f.mesh, f); }
    const hits = this._pray.intersectObjects(meshes, false);
    return hits.length ? byMesh.get(hits[0].object) : null;
  },

  /* Walk the player to an arbitrary ground point, keeping BOTH axes. walk() only
     takes an x because that is the 2D beach's interface, and going through it would
     throw away the depth the player just chose — which is the whole point of the
     island having depth. */
  walkToPoint(p) {
    if (!GAME.player) return;
    const f = this.figures.get(GAME.player.name);
    if (!f) return;
    const z = Math.max(-24, Math.min(9, p.z));
    f.target = { x: Math.max(0.8, Math.min(99.2, this.worldToX(p.x))), z, done: null };
    f.walking = true;
    this._camFollow = true;
    this.ping(p);
  },

  /* A marker so a tap reads as "go there" before the walk starts — the 2D beach does
     the same with .tap-ping, and losing that feedback made the 3D island feel
     unresponsive even though it was moving. */
  ping(p) {
    const s = Scene3D.project(p.clone(), this.camera);
    if (!s || !this.ensureOverlay()) return;
    const d = h('div', 'b3d-ping');
    d.style.transform = 'translate(-50%,-50%) translate(' + s.x.toFixed(1) + 'px,' + s.y.toFixed(1) + 'px)';
    this.overlay.appendChild(d);
    setTimeout(() => d.remove(), 640);
  },

  onShow() {
    this.ensureOverlay();
    this.sync();
    this.applyMood();
  },
  onHide() {
    /* Leave the overlay in place; it is cheap and rebuilding it every visit
       churns DOM for no reason. */
  }
};
