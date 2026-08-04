/* ============================================================
   STAGES3D — the scenes that are backdrops rather than playfields.

   Tribal council, the challenge arena and the title screen are all 3D now, but they
   are not walked around: their gameplay is entirely DOM — ballots, minigames,
   buttons, the conversation panel. So each is a scene with a slow camera and no
   characters, rendered BEHIND the existing UI.

   That split is deliberate and it is what makes this affordable. Only the island
   needs figures, occlusion, picking and pathing. Everything else needs to look like
   somewhere, and a drifting camera over real geometry does that for a fraction of
   the work and the framerate.

   Every stage implements the tiny contract Scene3D.show expects:
     build(THREE, S)   once, lazily, the first time the stage is shown
     update(dt, now)   per frame
     scene, camera     what to render
     onShow / onHide   optional
   ============================================================ */

'use strict';

/* Shared helper: scatter a family of props in a ring or a band. Composition for
   these scenes is a table too, for the same reason as the island — the look is the
   part most likely to be rewritten. */
function s3dScatter(group, fams, n, box, rnd) {
  const pool = Scene3D.family(...fams);
  if (!pool.length) return;
  for (let i = 0; i < n; i++) {
    const o = Scene3D.spawn(pool[Math.floor(rnd() * pool.length)]);
    if (!o) continue;
    o.position.set(box.x[0] + rnd() * (box.x[1] - box.x[0]), 0,
      box.z[0] + rnd() * (box.z[1] - box.z[0]));
    /* Default the scale range. A rule written without one used to throw and take the
       whole stage down with it, which showed up as a black backdrop. */
    const sr = box.s || [1, 1];
    o.scale.multiplyScalar(sr[0] + rnd() * (sr[1] - sr[0]));
    o.rotation.y = rnd() * Math.PI * 2;
    group.add(o);
  }
}

/* A cheap deterministic stream per stage, so a stage looks the same each time it is
   entered within a season but different between seasons. */
function s3dRng(seedBase) {
  let s = ((seedBase | 0) || 7919) & 0x7fffffff;
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}

/* ============================================================
   TRIBAL COUNCIL
   Real councils are built sets: carved stone, a brazier, benches in a horseshoe,
   and jungle pressing in behind. The Deserted Temples pack is exactly that kit,
   which is the single luckiest thing about this asset bundle.
   ============================================================ */
const TribalStage = {
  built: false,
  async build(THREE, S) {
    const rnd = s3dRng((GAME && GAME.seed) || 11);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x120d1e);
    scene.fog = new THREE.Fog(0x120d1e, 46, 165);   /* was 16/70 — it fogged the set itself to black */
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(40, 2, 0.3, 300);

    /* Firelight, not sunlight. One warm point low in the middle of the set doing
       almost all the work is what makes a council look like a council. The brazier
       light itself is added further down, once the set exists to be lit. */
    scene.add(new THREE.HemisphereLight(0x3b4670, 0x2a1e10, 0.95));

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshLambertMaterial({ color: 0x4a3a2c })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const set = new THREE.Group();
    scene.add(set);

    /* The set piece: a carved head or altar at the back, columns flanking, a brazier
       front and centre where the fire lives. */
    /* Sized, not scaled by a guessed factor. Head_Entrance is a 20m+ temple gateway
       at scale 1 — see Scene3D.spawnSized. 7m reads as a carved marker behind the fire. */
    const centre = Scene3D.spawnSized((Scene3D.family('Head_Entrance')[0]) || (Scene3D.family('Altar')[0]), 7);
    if (centre) { centre.position.z = -9; set.add(centre); }
    const colFams = Scene3D.family('Column_01A', 'Column_02A', 'Stone_Pillar');
    for (let i = 0; i < 6 && colFams.length; i++) {
      const o = Scene3D.spawnSized(colFams[i % colFams.length], 5.2 + rnd() * 1.4);
      if (!o) continue;
      const side = i % 2 ? 1 : -1;
      o.position.x = side * (11.5 + Math.floor(i / 2) * 2.6);
      o.position.z = -1 - Math.floor(i / 2) * 4;
      set.add(o);
    }
    const braz = Scene3D.spawnSized(Scene3D.family('Braizer')[0], 2.4);
    if (braz) { braz.position.z = 3; set.add(braz); }
    /* Benches: palm logs in a horseshoe, which is what the tribe actually sits on. */
    const logs = Scene3D.family('Palm_Log');
    for (let i = 0; i < 5 && logs.length; i++) {
      const o = Scene3D.spawnSized(logs[i % logs.length], 0.85);
      if (!o) continue;
      const a = -0.75 + (i / 4) * 1.5;
      o.position.x = Math.sin(a) * 8.5;
      o.position.z = 6.5 - Math.cos(a) * 2.2;
      o.rotation.y = -a + Math.PI / 2;
      set.add(o);
    }
    /* Jungle pressing in, and stone underfoot. */
    s3dScatter(set, ['Palm_Tree_0'], 22, { x: [-34, 34], z: [-30, -14], s: [1.1, 1.7] }, rnd);
    s3dScatter(set, ['Fern', 'Bush_0', 'Plant_0'], 16, { x: [-20, 20], z: [-16, -5], s: [0.9, 1.5] }, rnd);
    /* Kept BEHIND the brazier and small. At z up to +8 these sat between the camera and
       the set and a single scaled boulder blocked the entire council. */
    s3dScatter(set, ['Stone_Slab', 'Small_Rock'], 9, { x: [-15, 15], z: [-11, -1], s: [0.5, 0.8] }, rnd);
    s3dScatter(set, ['Skull_0', 'Bone_Pile'], 3, { x: [-12, 12], z: [-10, -3], s: [0.7, 1.0] }, rnd);

    /* Bake. ~90 props became ~400 draw calls unbaked; merged it is a handful. One
       slice: the council is a small set always seen whole, so per-slice culling would
       buy nothing. */
    S.bakeGroup(set, 1, 90);

    /* The fire itself: a point light plus a couple of emissive cards, animated. */
    this.fire = new THREE.PointLight(0xffb45c, 6.2, 60, 1.5);
    this.fire.position.set(0, 2.4, 3);
    this.fire.castShadow = true;
    this.fire.shadow.mapSize.set(512, 512);
    scene.add(this.fire);
    return true;
  },
  update(dt, now) {
    /* Flicker. Two out-of-phase sines instead of random, so it breathes rather than
       strobes — the same reason Scene3D's shake uses noise rather than rand(). */
    if (this.fire) {
      this.fire.intensity = 5.8 + Math.sin(now / 190) * 0.7 + Math.sin(now / 77) * 0.35;
    }
    /* A very slow push in, so the council is never a still image. */
    const t = now / 9000;
    this.camera.position.set(Math.sin(t) * 2.2, 8.2 + Math.sin(t * 1.7) * 0.22, 21 + Math.cos(t) * 1.0);
    this.camera.lookAt(0, 2.8, -5);
  }
};

/* ============================================================
   CHALLENGE ARENA
   A cleared stretch of beach with a course on it. The minigame is DOM on top, so
   this only has to establish "you are somewhere built for this".
   ============================================================ */
const ChallengeStage = {
  built: false,
  async build(THREE, S) {
    const rnd = s3dRng(((GAME && GAME.seed) || 3) * 31);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8fd0e8);
    scene.fog = new THREE.Fog(0x8fd0e8, 70, 210);
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(42, 2, 0.4, 400);
    this.rig = S.sunRig(scene, { span: 60 });

    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 90),
      new THREE.MeshLambertMaterial({ color: 0xe8cd99 })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.z = -6;
    sand.receiveShadow = true;
    scene.add(sand);
    S.water(scene, 44, 300);

    const g = new THREE.Group();
    scene.add(g);
    /* The course. Scaffolding and climbing grips read instantly as a challenge rig,
       and there is a genuine `Climbing_Grips` model in the Temples pack. */
    const grip = Scene3D.spawnSized(Scene3D.family('Climbing_Grips')[0], 5.5);
    if (grip) { grip.position.set(-6, grip.position.y, -8); g.add(grip); }
    const scaff = Scene3D.family('Scaffolding');
    for (let i = 0; i < 2 && scaff.length; i++) {
      const o = Scene3D.spawnSized(scaff[i % scaff.length], 4.6);
      if (!o) continue;
      o.position.x = -2 + i * 9; o.position.z = -10 - i * 2;
      g.add(o);
    }
    const bridge = Scene3D.spawnSized(Scene3D.family('Wooden_Bridge')[0], 1.8);
    if (bridge) { bridge.position.x = 10; bridge.position.z = -3; bridge.rotation.y = 0.3; g.add(bridge); }
    const flag = Scene3D.spawnSized(Scene3D.family('Flag_0')[0], 4.2);
    if (flag) { flag.position.x = 15; flag.position.z = -6; g.add(flag); }
    s3dScatter(g, ['Wooden_Pole', 'Stone_Steps'], 4, { x: [-14, 16], z: [-12, -2], s: [0.9, 1.2] }, rnd);
    /* Palms behind, and shoreline clutter in front, so it is on the island. */
    s3dScatter(g, ['Palm_Tree_0'], 26, { x: [-46, 46], z: [-40, -18], s: [1.1, 1.7] }, rnd);
    s3dScatter(g, ['Rock_Small', 'Shell_', 'Coconut_'], 18, { x: [-30, 30], z: [-4, 10], s: [0.7, 1.2] }, rnd);
    S.bakeGroup(g, 3, 120);
    return true;
  },
  update(dt, now) {
    const t = now / 12000;
    this.camera.position.set(Math.sin(t) * 5, 9.5, 26 + Math.cos(t) * 2);
    this.camera.lookAt(2, 2.5, -8);
  }
};

/* ============================================================
   TITLE
   The hero shot. Re-rolled per visit so the menu is never the same twice, which is
   most of what makes a menu feel alive.
   ============================================================ */
const TitleStage = {
  built: false,
  async build(THREE, S) {
    this.rnd = s3dRng(Math.floor(performance.now()) ^ 0x5f3a);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x7fc6e4);
    scene.fog = new THREE.Fog(0x7fc6e4, 60, 190);
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(38, 2, 0.4, 400);
    this.rig = S.sunRig(scene, { span: 60, intensity: 2.3 });

    const sand = new THREE.Mesh(new THREE.PlaneGeometry(220, 90),
      new THREE.MeshLambertMaterial({ color: 0xeed3a0 }));
    sand.rotation.x = -Math.PI / 2;
    sand.position.z = -8;
    sand.receiveShadow = true;
    scene.add(sand);
    S.water(scene, 40, 320);

    this.g = new THREE.Group();
    scene.add(this.g);
    this.reroll();
    return true;
  },
  /* The hero shot, and it gets to be the lushest thing in the game.

     Nothing is walked around here and no simulation is running, so the whole frame
     budget is scenery — this can afford several times the density of a live zone. The
     layering is deliberate: a deep jungle wall behind, a mid band of ferns and
     trunks, tide litter in front, and a couple of leaning palms framing the edges so
     the title has something to sit inside.

     Re-rolled on every visit, which is most of what makes a menu feel alive. */
  reroll() {
    if (!this.g) return;
    while (this.g.children.length) this.g.remove(this.g.children[0]);
    const rnd = this.rnd;
    /* Back wall: deep and dense, mostly cheap trunks and understory so the palm
       silhouettes on top of it stay affordable. */
    s3dScatter(this.g, ['Palm_Trunk', 'Palm_Tree_Broken', 'Tree_Trunk'], 34, { x: [-56, 56], z: [-48, -26], s: [1.0, 1.7] }, rnd);
    s3dScatter(this.g, ['Palm_Tree_0'], 26, { x: [-52, 52], z: [-44, -16], s: [1.1, 1.9] }, rnd);
    s3dScatter(this.g, ['Fern', 'Bush_Stub', 'Bush_0'], 46, { x: [-48, 48], z: [-40, -12], s: [1.0, 1.7] }, rnd);
    /* Mid band: the green the eye actually lands on. */
    s3dScatter(this.g, ['Plant_0', 'Plant_Leaves', 'Nettle'], 26, { x: [-38, 38], z: [-26, -8], s: [0.9, 1.5] }, rnd);
    s3dScatter(this.g, ['Grass_Patch', 'Flowers_Patch', 'Flower_0'], 54, { x: [-42, 42], z: [-24, -2], s: [0.9, 1.6] }, rnd);
    s3dScatter(this.g, ['Mushrooms', 'Reed', 'Pine_Cone'], 22, { x: [-36, 36], z: [-22, -4], s: [0.9, 1.4] }, rnd);
    /* Foreground: driftwood and tide litter, the detail that sells a beach.
       Kept SMALL and pushed to the flanks. The first pass scattered 48 shells and
       rocks at up to 1.4 scale right across the front and it read as a field of white
       rubble sitting on the title, not as a beach. Litter should be litter. */
    s3dScatter(this.g, ['Palm_Log', 'Tree_Log', 'Branch_Fallen'], 10, { x: [-36, 36], z: [-12, 0], s: [0.85, 1.2] }, rnd);
    s3dScatter(this.g, ['Shell_', 'StarFish', 'Coconut_'], 22, { x: [-42, 42], z: [-8, 6], s: [0.6, 0.95] }, rnd);
    /* No Rock_Small here: it is Fantasy Nature grey and read as limestone rubble
       scattered over tropical sand. Warm tide litter only. */
    s3dScatter(this.g, ['Coconut_'], 12, { x: [-44, 44], z: [-10, 4], s: [0.7, 1.0] }, rnd);
    s3dScatter(this.g, ['Twigs', 'Fallen_Leaves'], 22, { x: [-38, 38], z: [-16, 2], s: [0.7, 1.1] }, rnd);
    /* Rock mass, but OUT OF THE MIDDLE. Two boulders framing the edges read as a cove;
       six scattered across the front buried the logo. */
    s3dScatter(this.g, ['Rock_Medium', 'Rock_Boulder'], 2, { x: [-46, -34], z: [-18, -6], s: [0.9, 1.3] }, rnd);
    s3dScatter(this.g, ['Rock_Medium', 'Rock_Boulder'], 2, { x: [34, 46], z: [-18, -6], s: [0.9, 1.3] }, rnd);
    s3dScatter(this.g, ['Turtle_Shell'], 1, { x: [-24, 24], z: [-4, 3], s: [0.8, 1.0] }, rnd);

    /* Bake, every re-roll. Unbaked this scene was 1,250 draw calls on the FIRST screen
       a player ever sees — more than the whole island. Sliced by five along x so the
       drifting camera still culls what is off to the side. */
    Scene3D.bakeGroup(this.g, 5, 120);
  },
  onShow() { this.reroll(); },
  update(dt, now) {
    /* A slow drift along the shore. Never stops, never repeats within a session. */
    const t = now / 26000;
    this.camera.position.set(Math.sin(t) * 26, 7.5 + Math.sin(t * 2.3) * 0.8, 24 + Math.cos(t * 0.7) * 4);
    this.camera.lookAt(Math.sin(t) * 20, 3.4, -12);
  }
};
