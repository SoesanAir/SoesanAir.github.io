/* ============================================================
   SCENE3D — one WebGL context, several stages.

   The island, tribal council and the challenge arena are all real 3D now. This
   module owns the parts they share: the renderer, the prop library, the atlas
   material, the frame loop, and the decision about whether any of it runs at all.

   WHY ONE RENDERER. Creating a WebGLRenderer per screen is the classic way to kill
   a mobile browser — contexts are a scarce resource, and a phone will start silently
   dropping the oldest one after three or four. So there is exactly one canvas, and
   `mount()` moves it into whichever screen wants it. Moving a canvas between parents
   preserves its context.

   WHY IT IS MOUNTED RATHER THAN FIXED. #app is `transform: rotate(90deg)` in
   portrait. A fixed, full-viewport canvas would need every pointer coordinate and
   every size manually un-rotated. Appending the canvas INSIDE the element it should
   fill means it inherits the rotation and sizes to its parent for free — the same
   reason beach.js's tap layer uses offsetX.

   FALLING BACK IS A FEATURE. WebGL can be unavailable, blocklisted, or lost at any
   moment. `Scene3D.ok` is false in that case and the game keeps the original DOM
   beach, which is a complete and shipping renderer. A castaway sim that will not
   start because a phone dislikes a shader is a worse game than a flat one.
   ============================================================ */

'use strict';

const Scene3D = {
  ok: false,             /* did WebGL come up */
  ready: false,          /* is the prop library loaded */
  three: null,           /* the THREE namespace, once the module hands it over */
  renderer: null,
  canvas: null,
  props: {},             /* name -> loaded THREE.Group, cloned per placement */
  manifest: null,        /* which prop belongs to which scene */
  stage: null,           /* the active stage object */
  stages: {},
  host: null,            /* the element the canvas currently lives in */
  _loop: null,
  _last: 0,
  fps: 0,
  _acc: 0, _frames: 0,

  /* ---------- boot ----------
     Called by the module shim in index.html once three.js has been imported. Kept
     out of the module itself so every other file in the project can stay a plain
     script with globals, which is what the rest of the codebase is. */
  async boot(THREE, loaders, onProgress) {
    this.three = THREE;
    try {
      const canvas = document.createElement('canvas');
      canvas.id = 'gl';
      const renderer = new THREE.WebGLRenderer({
        canvas, antialias: false, alpha: true,
        powerPreference: 'high-performance'
      });
      /* Cap at 2. A modern phone reports 3 or 4, which quadruples the pixels for no
         visible gain on toon art and is the difference between 60fps and 25. */
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer = renderer;
      this.canvas = canvas;
      this.loaders = loaders;
      this.ok = true;
    } catch (e) {
      DBG.decision('Scene3D', 'webgl unavailable, staying 2D', { err: String(e && e.message) });
      this.ok = false;
      return false;
    }

    /* A lost context is recoverable in principle and catastrophic in practice —
       every texture and buffer is gone. Drop to the DOM renderer instead of
       showing a blank beach. */
    this.canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      this.ok = false;
      this.stop();
      DBG.decision('Scene3D', 'context lost, falling back to 2D', {});
      if (typeof Beach3D !== 'undefined' && Beach3D.onContextLost) Beach3D.onContextLost();
    });

    await this.loadProps(onProgress);
    return this.ok;
  },

  /* ---------- the prop library ----------
     Everything is loaded once, up front, and cloned per placement. 107 GLBs at 7.3MB
     is a real download, so this reports progress and never blocks the game: if it
     fails, `ready` stays false and the 2D beach carries on. */
  async loadProps(onProgress) {
    if (!this.ok) return false;
    const THREE = this.three;
    try {
      const meta = await fetch('assets/scene3d/props.json').then(r => r.json());
      this.manifest = meta.scenes || meta;      /* older shape had no pack map */
      this.packOf = meta.pack || {};

      /* ONE ATLAS PER PACK, and this is not a nicety.

         Every pack ships its own atlas, and each atlas is BOTH a foliage sheet and a
         colour PALETTE — a strip of flat swatches about 20px wide in one corner, which
         every solid prop UV-maps into by pointing at a single pixel. So a prop's UVs
         are only meaningful against the atlas from its own pack.

         Loading everything through the Adventure Island atlas is what made the
         challenge course's wooden bridge render dark green: it is a Fantasy Nature
         model, and its UVs were addressing tropical foliage. 50 of the 107 props were
         wrong this way and only some of them looked obviously wrong, which is exactly
         why this needed measuring rather than eyeballing.

         Two rules per atlas, both learned the hard way:
           - NearestFilter, or a palette swatch bleeds into its neighbour and solid
             props come out a blend of two unrelated colours
           - flipY TRUE, or v≈0 addresses the TOP of the image instead of the palette
             at the bottom, and every rock renders as dark foliage */
      /* All SIX packs. This list was four for a while after the manifest grew to six, so
         the Enchanted Meadow and Desert atlases were converted but never loaded — every
         prop from those packs silently fell back to the island atlas and rendered as a
         flat palette swatch. */
      const PACKS = ['TAI', 'TFF', 'TNA', 'TFD', 'TEM', 'TDS'];
      const loadTex = async url => {
        const t = await new THREE.TextureLoader().loadAsync(url);
        t.colorSpace = THREE.SRGBColorSpace;
        t.flipY = true;
        t.magFilter = THREE.NearestFilter;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.generateMipmaps = true;
        return t;
      };
      /* ---------- props with their OWN texture ----------
         A handful of models are alpha cards that are NOT in any atlas — each grass
         and flower patch ships its own sheet. Pointing all of them at one shared
         "grass" texture is what made the grass render half white: we import four
         grass variants and only Grass_Patch_01's texture was loaded, so 02, 03 and
         04A were sampling a sheet that has nothing where their UVs look.

         The same bug caught Flower_ and Fallen_Leaves, which are Fantasy Nature props
         belonging in the TFF atlas and were being forced through the grass card too.

         Keyed by exact prop name, so a prop either has its own sheet or falls through
         to its pack's atlas. No guessing by regex. */
      const OWN_TEXTURE = {
        Grass_Patch_01: 'tex_Grass_Patch_01',
        Grass_Patch_02: 'tex_Grass_Patch_02',
        Grass_Patch_03: 'tex_Grass_Patch_03',
        Flowers_Patch_01A: 'tex_Flowers_Patch_01A'
      };
      this.ownMat = {};
      for (const prop in OWN_TEXTURE) {
        try {
          const t = await loadTex('assets/scene3d/' + OWN_TEXTURE[prop] + '.webp');
          this.ownMat[prop] = new THREE.MeshLambertMaterial({
            map: t, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide
          });
        } catch (e) { /* falls through to the pack atlas */ }
      }

      /* mats[pack] = { solid, cut }.

         SOME PACKS SPLIT SOLID AND FOLIAGE INTO TWO ATLASES. Adventure Island puts
         both in one sheet — its foliage and its colour palette share `TAI_Atlas_1A`.
         Enchanted Meadow and Fantasy Nature ship a separate `Atlas_Vegetation`, and
         running their bushes and grass through the solid atlas landed every one of
         them on a single palette swatch: 19 TEM props came out as flat blocks of
         colour. `veg_<pack>.webp` exists where a pack needs one, and `cut` uses it.

         MEASURED, not assumed: Fantasy Nature ALSO ships an Atlas_Vegetation, and
         pointing its foliage at that made things WORSE — 91 of 95 correct dropped to
         83. Its main atlas already carries the foliage, so it keeps one sheet. Only
         Enchanted Meadow genuinely needs the split, so only veg_TEM.webp exists. */
      this.mats = {};
      for (const p of PACKS) {
        try {
          const tex = await loadTex('assets/scene3d/atlas_' + p + '.webp');
          let cutTex = tex;
          /* Only the packs that actually ship a separate sheet. Probing all six 404s
             three times on every boot for no benefit. */
          if (p === 'TEM') {
            try { cutTex = await loadTex('assets/scene3d/veg_' + p + '.webp'); } catch (e) { }
          }
          this.mats[p] = {
            solid: new THREE.MeshLambertMaterial({ map: tex }),
            /* Foliage needs alpha and two sides or a frond disappears edge-on. */
            cut: new THREE.MeshLambertMaterial({ map: cutTex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide })
          };
        } catch (e) { /* a missing pack atlas falls back to TAI below */ }
      }
      if (!this.mats.TAI) throw new Error('atlas_TAI.webp failed to load');
      /* Kept for the bake step, which groups merged geometry by material identity. */
      this.mat = { solid: this.mats.TAI.solid, cut: this.mats.TAI.cut };

      /* ---------- load LAZILY, per scene ----------
         654 props is 22.8 MB. Downloading all of it before the title screen appears is
         not a thing a phone should be asked to do, and most of it is not needed yet:
         the council set is 5 MB that cannot be seen until day two, and the feast props
         are irrelevant until somebody wins a reward.

         So boot fetches only what the first screen needs — the island and the horizon —
         and every other scene is fetched the first time it is shown. `ensureScene`
         below is the on-demand path.

         Kept honest by `this.loaded`: a scene is either fully in memory or it is
         fetched before its stage is allowed to build. */
      this.loaded = {};
      this.gltf = new this.loaders.GLTFLoader();

      /* TWO PASSES over the island, and this is the difference between a game that
         starts and a game that looks broken.

         The island alone is 331 props and 13 MB. Blocking the title screen on all of
         it reproduces exactly the failure that was reported — a flat beach for many
         seconds with no way to tell whether it is loading or dead.

         So: a first batch big enough to dress the island, which makes it playable, then
         the remaining variants continue in the background while the player is reading
         the title. `family()` simply returns fewer variants until they arrive, so a
         partly-loaded library dresses a slightly less varied island rather than an
         empty one — the failure mode degrades instead of breaking. */
      await this.loadScenes(['horizon'], onProgress);
      await this.loadScenes(['island'], onProgress, 130);
      this.ready = Object.keys(this.props).length > 20;

      /* ---------- then stream everything else, in play order ----------
         Unawaited and deliberately not blocking. The order is the order the player
         meets it: the rest of the island first, then the council they will see on day
         two, then the challenge arena, then the odds and ends.

         This is what stops the first tribal from stalling on a 5 MB download. The
         player has minutes of camp before their first vote; using them to fetch the
         council set means it is simply there. `ensureScene` remains the safety net for
         anyone who gets there faster than the network. */
      setTimeout(() => this.prefetch(['island', 'tribal', 'challenge', 'built', 'reward', 'trinket']), 1200);
      DBG.decision('Scene3D', 'props loaded', {
        loaded: Object.keys(this.props).length, scenes: Object.keys(this.loaded).join(',')
      });
      return this.ready;
    } catch (e) {
      /* Surfaced on the object, not just the design log: a silent fall back to the
         DOM beach looks exactly like success, and the reason has to be reachable. */
      this.loadError = String((e && e.message) || e);
      DBG.decision('Scene3D', 'prop load failed, staying 2D', { err: this.loadError });
      this.ready = false;
      return false;
    }
  },

  /* Fetch the props belonging to one or more scenes. Idempotent per scene. */
  async loadScenes(sceneNames, onProgress, limit) {
    const THREE = this.three;
    const want = [];
    for (const s of sceneNames) {
      /* 'partial' means some props are in and the rest are still streaming: enough to
         build a scene with, and the background pass will come back for the remainder. */
      if (this.loaded[s] === true) continue;
      for (const n of (this.manifest[s] || [])) if (!this.props[n]) want.push(n);
    }
    let names = [...new Set(want)];
    const partial = limit && names.length > limit;
    if (partial) names = names.slice(0, limit);
    let done = 0;
    for (const name of names) {
        try {
          const gltf = await this.gltf.loadAsync('assets/scene3d/models/' + name + '.glb');
          const g = gltf.scene;
          const pk = this.mats[this.packOf[name]] ? this.packOf[name] : 'TAI';
          /* Own sheet first, then the pack atlas. Foliage takes the alpha-cut variant
             or a frond disappears when seen edge-on. */
          const isCut = /Bush|Plant|Palm_Tree|Fern|Reed|Vine|Flower|Nettle|Leaves|Twigs|Water_Plant|Mushroom|Grass/i.test(name);
          const mat = this.ownMat[name] || (isCut ? this.mats[pk].cut : this.mats[pk].solid);
          /* Flat alpha cards — grass, flowers, leaf litter — must not cast. A crossed
             pair of cards casts a hard X on the ground and self-shadows into mush. */
          const isCard = !!this.ownMat[name] || /Grass_Patch|Flowers_Patch|Fallen_Leaves/i.test(name);
          g.traverse(o => {
            if (!o.isMesh) return;
            o.material = mat;
            o.castShadow = !isCard;
            o.receiveShadow = true;
          });
          this.props[name] = g;
        } catch (e) {
          /* One prop failing is survivable. Silence here once hid a ReferenceError in
             the loop body that made EVERY prop fail and looked exactly like a WebGL
             problem — so the reason is recorded now. */
          this.loadWarn = this.loadWarn || [];
          if (this.loadWarn.length < 5) this.loadWarn.push(name + ': ' + String(e && e.message).slice(0, 90));
        }
        done++;
      if (onProgress) onProgress(done, names.length);
    }
    for (const s of sceneNames) this.loaded[s] = partial ? 'partial' : true;
    return true;
  },

  /* Fetch scenes one after another in the background, never in parallel: a phone on a
     slow link should not have six requests competing with whatever the player is
     actually waiting for. Re-dresses the island when its own variety lands, so the
     world the player walks around uses everything that arrived — but only while the
     island is on screen, because reshuffling it mid-council would move the world
     behind their back. */
  async prefetch(order) {
    for (const s of order) {
      if (this.loaded[s] === true) continue;
      /* Yield to an urgent load. Without this the scene the player is waiting for
         queues behind a couple of hundred speculative fetches and the stage appears to
         never switch. */
      while (this._urgent) await new Promise(r => setTimeout(r, 120));
      try { await this.loadScenes([s], null); } catch (e) { /* try the next one */ }
      if (s === 'island' && typeof Beach3D !== 'undefined'
        && this.stage === Beach3D && Beach3D.dressing) {
        try { Beach3D.dress(this); } catch (e) { /* keep the island that works */ }
      }
      DBG.decision('Scene3D', 'prefetched', { scene: s, total: Object.keys(this.props).length });
    }
  },

  /* Which prop scenes a STAGE needs before it can build. Kept here rather than in each
     stage so the download plan is visible in one place. */
  NEEDS: {
    island: ['island', 'horizon'],
    title: ['island', 'horizon'],
    tribal: ['tribal'],
    challenge: ['challenge', 'horizon']
  },

  /* Make sure a stage's props are in memory. Called by show() before build(). */
  async ensureScene(stageName, onProgress) {
    const need = this.NEEDS[stageName] || [];
    const missing = need.filter(s => !this.loaded[s]);   /* 'partial' counts as present */
    if (!missing.length) return true;
    DBG.decision('Scene3D', 'fetching props on demand', { stage: stageName, scenes: missing.join(',') });
    this._urgent = (this._urgent || 0) + 1;
    try { await this.loadScenes(missing, onProgress); }
    finally { this._urgent--; }
    return true;
  },

  /* A fresh instance of a prop. Geometry and materials are shared by reference, so
     a clone costs a transform and nothing else. */
  spawn(name) {
    const src = this.props[name];
    return src ? src.clone(true) : null;
  },

  /* Spawn a prop scaled to a target height in metres.

     Necessary because the packs disagree wildly about what a prop is FOR. Toon
     Adventure Island authors a palm you stand next to; Toon Deserted Temples authors
     a gateway you walk through, and its Head_Entrance is over twenty metres tall. A
     hand-picked scale factor per prop is a guess that has to be re-guessed every time
     a variant changes, and getting it wrong is invisible in code and enormous on
     screen — the first tribal council put a 29-metre carved head just off the top of
     the frame and read as an empty clearing.

     Measuring the bounding box and solving for the scale removes the guess entirely. */
  spawnSized(name, targetHeight) {
    const o = this.spawn(name);
    if (!o) return null;
    const box = new this.three.Box3().setFromObject(o);
    const h = box.max.y - box.min.y;
    if (h > 0.001 && targetHeight > 0) o.scale.multiplyScalar(targetHeight / h);
    /* Sit it on the ground rather than through it: a prop whose origin is its centre
       would otherwise be buried to the waist. */
    const b2 = new this.three.Box3().setFromObject(o);
    o.position.y -= b2.min.y;
    return o;
  },
  /* The measured height of a prop at scale 1, for callers that want to reason about
     it rather than force it. */
  heightOf(name) {
    const src = this.props[name];
    if (!src) return 0;
    const b = new this.three.Box3().setFromObject(src);
    return b.max.y - b.min.y;
  },
  /* Every prop whose name starts with any of these. The dressing tables ask for
     families ("Palm_Tree") rather than exact variants, so a new variant appearing in
     the manifest is used automatically.

     Matches THROUGH an optional pack prefix. Two packs both ship a `Bush_01A`, so the
     manifest keeps the later one as `TFF_Bush_01A` to preserve both — and without this
     the dressing table's `Bush_0` would silently only ever find the island's. */
  family(...prefixes) {
    const out = [];
    for (const n in this.props) {
      const bare = n.replace(/^(TAI|TFF|TNA|TFD|TEM|TDS)_/, '').toLowerCase();
      const full = n.toLowerCase();
      for (const p of prefixes) {
        const q = p.toLowerCase();
        if (full.indexOf(q) === 0 || bare.indexOf(q) === 0) { out.push(n); break; }
      }
    }
    return out;
  },

  /* ---------- bake a group of static props ----------
     Merges everything in `group` into one mesh per material per x-slice, replacing
     the group's contents. The single biggest performance lever in the whole feature.

     Measured on the title screen before this existed: ~300 scattered props produced
     1,250 draw calls, on the very first screen a player sees. Triangles were fine at
     440k — draw calls are the mobile bottleneck, and one per mesh per prop is a
     disaster regardless of how little geometry each one holds.

     `slices` exists so the island can keep frustum culling: one merged mesh spanning
     150 units would be shaded in full no matter where the camera looks. Backdrops are
     small scenes always seen whole, so they pass 1 and take the cheapest path.

     Baked chunks do not cast shadows. A merged chunk is a single object to the shadow
     pass, so its shadow volume becomes the whole slice and per-prop detail collapses
     into mush. Characters still cast, which is what actually sells the grounding. */
  bakeGroup(group, slices, spanX) {
    const THREE = this.three;
    const merge = this.loaders && this.loaders.mergeGeometries;
    if (!merge || !group) return 0;
    const n = Math.max(1, slices || 1);
    const half = (spanX || 200) / 2;
    const sliceOf = x => Math.max(0, Math.min(n - 1, Math.floor(((x + half) / (half * 2)) * n)));

    const buckets = new Map();          /* slice -> Map(material -> [geometry]) */
    for (const root of group.children) {
      root.updateMatrixWorld(true);
      const si = sliceOf(root.position.x);
      root.traverse(o => {
        if (!o.isMesh || !o.geometry) return;
        const g = o.geometry.clone();
        g.applyMatrix4(o.matrixWorld);
        /* Merging needs identical attribute sets, and a prop with no UVs cannot pick a
           colour from the palette atlas anyway. */
        if (!g.attributes.uv || !g.attributes.normal || !g.attributes.position) { g.dispose(); return; }
        for (const a of Object.keys(g.attributes)) {
          if (a !== 'position' && a !== 'normal' && a !== 'uv') g.deleteAttribute(a);
        }
        if (!buckets.has(si)) buckets.set(si, new Map());
        const b = buckets.get(si);
        if (!b.has(o.material)) b.set(o.material, []);
        b.get(o.material).push(g);
      });
    }

    while (group.children.length) group.remove(group.children[0]);
    let made = 0;
    for (const [, byMat] of buckets) {
      for (const [material, list] of byMat) {
        try {
          const merged = merge(list, false);
          if (merged) {
            const mesh = new THREE.Mesh(merged, material);
            mesh.castShadow = false;
            mesh.receiveShadow = true;
            group.add(mesh);
            made++;
          }
        } catch (e) { /* an unmergeable bucket is dropped, not fatal */ }
        for (const g of list) g.dispose();
      }
    }
    return made;
  },

  /* ---------- mounting ----------
     Move the one canvas into the element a stage wants to fill. */
  mount(host) {
    if (!this.ok || !host) return;
    if (this.host === host) { this.resize(); return; }
    this.host = host;
    host.appendChild(this.canvas);
    this.canvas.style.cssText =
      'position:absolute; inset:0; width:100%; height:100%; display:block; z-index:0;';
    this.resize();
  },
  unmount() {
    if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    this.host = null;
  },
  resize() {
    if (!this.ok || !this.host) return;
    const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    if (this.stage && this.stage.camera) {
      this.stage.camera.aspect = w / h;
      this.stage.camera.updateProjectionMatrix();
    }
  },

  /* ---------- stages ---------- */
  register(name, stage) { this.stages[name] = stage; },

  /* Show a stage in a host element. Idempotent — calling it for the stage that is
     already showing just re-mounts and resizes, which is what a screen re-entry
     needs. */
  async show(name, host) {
    if (!this.ok || !this.ready) return false;
    const st = this.stages[name];
    if (!st) return false;
    /* Props first. A stage that builds against an unloaded library silently produces an
       empty scene — Scene3D.family() just returns nothing and every scatter is a no-op. */
    if (!st.built) {
      await this.ensureScene(name, (d, t) => {
        if (typeof Island3D !== 'undefined' && Island3D.note) {
          const el = Island3D.note(true);
          if (el) el.textContent = 'Loading scene  ' + Math.round(d / t * 100) + '%';
        }
      });
      if (typeof Island3D !== 'undefined' && Island3D.note) Island3D.note(false);
      await st.build(this.three, this); st.built = true;
    }
    this.stage = st;
    this.mount(host);
    if (st.onShow) st.onShow();
    this.start();
    return true;
  },
  hide(name) {
    if (this.stage && (!name || this.stages[name] === this.stage)) {
      if (this.stage.onHide) this.stage.onHide();
      this.stage = null;
      this.stop();
      this.unmount();
    }
  },

  /* ---------- the loop ----------
     Runs only while a stage is showing. This is the battery rule: the game spends
     most of its time on menus, dialogue and tribal text, and a WebGL loop spinning
     behind a screen nobody is looking at is pure drain. */
  start() {
    if (!this.ok || this._loop) return;
    this._last = performance.now();
    const tick = () => {
      this._loop = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min(0.05, (now - this._last) / 1000);
      this._last = now;
      const st = this.stage;
      if (!st) return;
      /* A throw inside a stage's update must not kill the frame loop permanently —
         that leaves a frozen image and no way back. */
      try { if (st.update) st.update(dt, now); } catch (e) { /* keep rendering */ }
      try { this.renderer.render(st.scene, st.camera); } catch (e) { /* keep going */ }
      this._acc += dt; this._frames++;
      if (this._acc >= 1) { this.fps = Math.round(this._frames / this._acc); this._acc = 0; this._frames = 0; }
    };
    this._loop = requestAnimationFrame(tick);
  },
  stop() {
    if (this._loop) cancelAnimationFrame(this._loop);
    this._loop = null;
  },

  /* ---------- shared scene furniture ----------
     Every outdoor stage wants the same sun, the same bounce light and the same
     water, so they are built here rather than three times. */
  sunRig(scene, opts) {
    const THREE = this.three, o = opts || {};
    const sun = new THREE.DirectionalLight(0xfff2d8, o.intensity === undefined ? 2.1 : o.intensity);
    sun.position.set(o.x === undefined ? -26 : o.x, 34, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 150;
    const s = o.span || 70;
    sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
    sun.shadow.camera.top = s * 0.7; sun.shadow.camera.bottom = -s * 0.7;
    sun.shadow.bias = -0.0012;
    scene.add(sun);
    const hemi = new THREE.HemisphereLight(0xbfe6ff, 0xc79a5e, 0.85);
    scene.add(hemi);
    return { sun, hemi };
  },

  /* Day, dusk and storm as one call, so the island and the council agree on what
     six in the evening looks like. */
  applyLight(rig, scene, mood) {
    const map = {
      day: { sky: 0x8fd0e8, sun: 0xfff2d8, i: 2.1, hemi: 0.85, fogN: 60, fogF: 200 },
      dusk: { sky: 0x3a2b4d, sun: 0xff9a5c, i: 0.95, hemi: 0.5, fogN: 40, fogF: 150 },
      night: { sky: 0x141026, sun: 0x8fa8d8, i: 0.35, hemi: 0.28, fogN: 26, fogF: 105 },
      storm: { sky: 0x5b6470, sun: 0xc8ccd4, i: 0.8, hemi: 0.6, fogN: 22, fogF: 95 }
    };
    const m = map[mood] || map.day;
    if (scene.background && scene.background.setHex) scene.background.setHex(m.sky);
    if (scene.fog) { scene.fog.color.setHex(m.sky); scene.fog.near = m.fogN; scene.fog.far = m.fogF; }
    if (rig) {
      rig.sun.color.setHex(m.sun);
      rig.sun.intensity = m.i;
      rig.hemi.intensity = m.hemi;
    }
  },

  /* A flat sea. Cheap: two triangles and a scrolling normal would be nicer, but a
     lambert plane with a slow vertical bob reads perfectly well at this art level. */
  water(scene, z, size) {
    const THREE = this.three;
    const w = new THREE.Mesh(
      new THREE.PlaneGeometry(size || 320, 150),
      new THREE.MeshLambertMaterial({ color: 0x3fa9c9, transparent: true, opacity: 0.92 })
    );
    w.rotation.x = -Math.PI / 2;
    w.position.set(0, -0.35, z === undefined ? 52 : z);
    scene.add(w);
    return w;
  },

  /* ---------- billboards ----------
     A castaway is a flat cutout standing in the world. alphaTest and NOT blending,
     deliberately: a blended plane does not write depth, so a castaway would draw
     over the palm in front of them and the occlusion that justifies the whole 3D
     move would silently not happen. */
  billboard(url, height) {
    const THREE = this.three;
    const tex = new THREE.TextureLoader().load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    const h = height || 3.4;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(h * 0.55, h),
      new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide })
    );
    mesh.castShadow = true;
    /* The aspect is not known until the image decodes, and a wrong aspect makes
       everybody either squat or stretched. Fix it up on load. */
    tex.addEventListener?.('update', () => { });
    const img = tex.image;
    const fix = () => {
      const t = tex.image;
      if (!t || !t.width) return;
      mesh.geometry.dispose();
      mesh.geometry = new THREE.PlaneGeometry(h * (t.width / t.height), h);
    };
    if (img && img.width) fix(); else tex.addEventListener ? tex.addEventListener('load', fix) : setTimeout(fix, 400);
    /* TextureLoader has no load event on the texture, so poll briefly. Cheap and
       reliable, and only runs while an image is still decoding. */
    let tries = 0;
    const poll = setInterval(() => { if ((tex.image && tex.image.width) || ++tries > 40) { fix(); clearInterval(poll); } }, 60);
    return mesh;
  },

  /* Face the camera on Y only, so cutouts stay standing instead of tipping over to
     meet a high camera. */
  faceCamera(mesh, camera) {
    mesh.rotation.y = Math.atan2(camera.position.x - mesh.position.x, camera.position.z - mesh.position.z);
  },

  /* World position -> pixel position inside the host element, for DOM overlays like
     speech bubbles and name tags. Returns null when the point is behind the camera.
     Coordinates come out in the host's own space, which is already rotated with #app
     in portrait, so no un-rotation is needed anywhere. */
  project(v3, camera) {
    const THREE = this.three;
    const p = v3.clone().project(camera);
    if (p.z > 1) return null;
    const w = this.host ? this.host.clientWidth : 0;
    const h = this.host ? this.host.clientHeight : 0;
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, depth: p.z };
  },

  /* Screen point -> ground point. offsetX/offsetY on purpose: getBoundingClientRect
     returns an axis-aligned box for a rotated element, so the usual NDC maths picks
     the wrong spot in portrait. Offsets are in the element's own space. */
  pickGround(ev, camera, plane) {
    const THREE = this.three;
    const el = this.canvas;
    if (!el) return null;
    const nx = (ev.offsetX / el.clientWidth) * 2 - 1;
    const ny = -(ev.offsetY / el.clientHeight) * 2 + 1;
    this._ray = this._ray || new THREE.Raycaster();
    this._ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const hits = this._ray.intersectObject(plane, false);
    return hits.length ? hits[0].point : null;
  }
};
