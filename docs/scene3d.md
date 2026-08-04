# The 3D island

Every scene in the game is real 3D now, rendered from the SICS Games toon asset packs.
Castaways are still paper cutouts — they just stand *in* the world instead of on top of
a picture of it, which means a palm can stand in front of one.

## What is 3D, and what is not

| scene | how | why |
|---|---|---|
| camp / island | **playfield** — figures in-scene, occlusion, tap-to-walk, depth | this is where you spend the game |
| tribal council | backdrop | the ballot and the conversation are DOM |
| challenge arena | backdrop | the minigame is DOM |
| tribal Q&A, vote reveal | backdrop, reuses the council set | same place, same night |
| title | backdrop, re-rolled per visit | it is a menu |
| marooning | backdrop | it is a cutscene |

Only the island needs picking, pathing and per-figure sorting. Everything else needs
to *look* like somewhere, and a drifting camera over real geometry does that for a
fraction of the cost.

## Files

| file | owns |
|---|---|
| `js/scene3d.js` | the one renderer, the prop library, the atlases, the frame loop |
| `js/beach3d.js` | the island — dressing, figures, walking, camera |
| `js/stages3d.js` | the three backdrop stages |
| `js/beach-switch.js` | the `Beach` dispatcher, boot, screen binding, input |
| `js/beach.js` | `Beach2D` — the original DOM renderer, still the fallback |
| `css/scene3d.css` | the canvas hosts, and retiring the CSS scenery |

## The asset pipeline

Source assets live outside the web app, in `Castaway/More Assets Then You Need/`.
Nothing there ships; the pipeline curates a small subset.

```
node tools/scene-manifest.js            # what resolves, what collides, what is missing
node tools/scene-manifest.js --audit    # the tally of what is deliberately skipped
node tools/scene-manifest.js --stage    # copy chosen FBX to tools/_fbx/
node tools/fbx2glb.js                   # FBX -> GLB: normalise size, decimate, index
node tools/prop-audit.js                # render every prop alone and verify it drew
node tools/make-asset-doc.js            # regenerate docs/asset-audit.md
```

`tools/scene-manifest.js` is the **only** place that decides which of the bundle's
2,236 models the game uses. It matches by prefix, not exact filename, because variant
suffixes (`_01A`, `_02B`, `_Module_1`) are not guessable and a hand-typed list silently
misses half of them. Anything that fails to resolve is reported loudly.

There is no Blender on this machine, so `tools/fbx2glb.js` converts in headless Chrome
using the project's own three.js. Using the same library that will later *load* the
result means anything surviving the round trip is loadable by construction.

Current: **654 props across all six packs.** Which families are in and which are out,
and why, is in **[asset-audit.md](asset-audit.md)** — generated, not hand-written, so it
cannot drift from the manifest.

### Verify, do not assume

"Loaded without error" and "actually renders" have diverged in this project more than
once — a prop can load cleanly and draw nothing, or draw one flat colour because it is
sampling the wrong pack's palette. `tools/prop-audit.js` renders **every** imported prop
alone against magenta and measures the framebuffer: percentage of frame covered, and how
many distinct colours were drawn. 640 of 654 pass (98%). The 14 that do not are
background props that read as one flat colour or are invisible edge-on; they are listed
individually in the audit doc.

### Size is a table of real-world heights, not a scale factor

The six packs disagree about authoring units by **five orders of magnitude** —
`Mountain_1A` is 20,000 units tall and `Coconut_01A` is 0.30. A single blanket scale
(the first attempt was x0.01) put 216 props under 5 cm and 17 over 30 m.

So `tools/_convert.html` holds a `SIZE` table of intended heights **in metres** per
family, and the converter measures each model's bounding box and scales it to fit:

```js
const box0 = new THREE.Box3().setFromObject(g);
const s0 = box0.getSize(new THREE.Vector3());
const raw = Math.max(s0.x, s0.y, s0.z);
const factor = raw > 1e-6 ? targetHeight(name) / raw : 1;
g.scale.setScalar(factor);
```

This one change took the library from 63% to 98% rendering correctly. **A family with no
`SIZE` entry falls back to 1 metre and will look wrong** — when adding anything, add its
height, never a scale factor.

### Loading is lazy, then speculative

654 props is far too much to download before the title screen appears, so
`Scene3D.loadScenes(names, onProgress, limit)` fetches per scene, and boot only waits for
the horizon plus the first 130 island props. Everything else is fetched in the background
in play order — island, tribal, challenge, built, reward, trinket — by `prefetch()`,
which **yields to any on-demand load**:

```js
while (this._urgent) await new Promise(r => setTimeout(r, 120));
```

Without that line the scene the player is actually waiting for queues behind a couple of
hundred speculative fetches, and the stage looks like it never switches. `ensureScene()`
is the safety net for a player who outruns the network; it sets `_urgent` for as long as
it is fetching.

## Five things that will bite you

### 1. The atlases are colour PALETTES

Each pack ships one atlas that is mostly foliage — but one corner holds a strip of
flat colour swatches about 20 px wide, and **every solid prop UV-maps to a single
pixel inside one of those swatches**. That is how a rock is grey with no texture of
its own.

Consequences, all of which were shipped wrong once:

- **Downscale with `NEAREST`.** LANCZOS averages neighbouring swatches together. The
  first attempt produced a solid black `Rock_Large` and bright green palm logs.
- **Sample with `NearestFilter`** on the GPU, same reason.
- **`flipY` must be `true`.** Measured: `Rock_Large_01A` samples u 0–0.041, v 0–0.011 —
  the palette sits at the atlas *bottom*, so `flipY:false` addressed the top and every
  rock rendered as dark foliage. Palms hid this because they span the whole atlas, so
  flipping them just swapped one frond for another and still looked plausible.

### 2. One atlas per PACK

A prop's UVs are only meaningful against its own pack's atlas. Loading everything
through the island atlas made the challenge course's wooden bridge render dark green —
it is a Fantasy Nature model addressing tropical foliage. **50 of 107 props were wrong
this way** and only some looked obviously wrong.

`props.json` therefore carries a `pack` map (`name -> TAI|TFF|TNA|TFD`), and
`Scene3D.mats[pack]` holds a material per pack. `Beach3D.bake()` buckets by **material
identity**, not by a `'solid'/'cut'` label — labelling would merge a Fantasy Nature
prop into the island material and silently undo all of this.

Grass and flower patches have their own textures and are in no atlas at all.

### 3. Draw calls, not triangles, are the mobile budget

259 placed props produced **977 draw calls**. `Beach3D.bake()` merges each zone's
geometry per material into one mesh — **per zone**, not one island-wide mesh, or
frustum culling dies and the GPU shades the whole 150-unit strip every frame.

Result: **977 draws → ~80**, at ~400k triangles.

Baked chunks do not cast shadows: a merged chunk is one object to the shadow pass, so
its shadow volume is the whole zone and the per-prop detail collapses into mush. The
castaways still cast, which is what sells the grounding.

### 4. Props from different packs are wildly different sizes

Adventure Island authors a palm you stand next to. Deserted Temples authors a gateway
you walk *through* — `Head_Entrance` is over 20 m tall. A hand-picked scale per prop is
a guess that must be re-guessed whenever a variant changes, and the first tribal
council put a 29 m carved head just off the top of frame, reading as an empty clearing.

Two layers deal with this. The converter normalises every model to a real-world height
from the `SIZE` table (above), so a prop is already roughly correct as it comes out of
the library. Where a placement wants a specific height anyway — a hero tree, an arch
framing the council — use `Scene3D.spawnSized(name, metres)`, which measures the
bounding box, solves for the scale, and seats the prop on the ground.

### 5. Two props can share a name across packs

`Rock_Small` (Fantasy Forest, grey, 91 triangles) and `Small_Rock` (Adventure Island,
warm sandstone, **1,336** triangles) are different rocks from different packs, and the
manifest resolves by prefix. Scattering forty of the wrong one costs 50k triangles and
puts grey granite on a tropical beach. The manifest pack-qualifies any colliding name to
`PACK_Name`:

```js
if (seen.has(n) && seen.get(n).pack !== rule.pack) {
  collisions.push(n + ' -> ' + rule.pack + '_' + n);
  n = rule.pack + '_' + n;
}
```

`Scene3D.family()` matches through those prefixes, so placement code still asks for
`Rock_Small` and gets the right one. The measured triangle costs are recorded in
`js/beach3d-dressing.js`.

## Falling back is a feature

`Beach` is a `Proxy` that re-picks the live renderer on **every** access, because the
choice is not made once: WebGL comes up asynchronously after the title screen is
already drawn, and a context can be *lost* at any moment. A loss mid-season silently
continues on the DOM beach instead of freezing on a dead canvas.

Turn 3D off with `Island3D.set(false)`, or per-load with `index.html?no3d=1`.
`?force3d=1` is the other direction.

Several harnesses (`smoke`, `camp-test`, `camp-ui-test`) validate the DOM renderer's
cut-out rigs, which have no measurable geometry once `gl-on` hides `#world`. They load
`?no3d=1` — which keeps them meaningful *and* keeps the fallback under test.

## Battery

The frame loop runs **only** while a stage is showing, and stops on
`visibilitychange`. A WebGL loop spinning behind a menu is the worst thing this feature
could do to a phone.

## Testing

```
node tools/island3d-test.js     # 33 checks: boot, the Beach proxy, a season,
                                # every backdrop, battery, the 2D fallback
node tools/scene3d-shot.js      # the standalone demo at /scene3d.html
```

Screenshots land in `tools/_look-island3d.png`, `_look-tribal3d.png`,
`_look-chal3d.png`.

## The island's shape

Zones are ordered as a **gradient, sea on the left to interior on the right** —
`Far Ocean, Ocean, Far Beach, Beach, Camp, FirePit, Shelter, Well, Grove, Clearing,
Forest, Deep Forest, Rocks, Treemail`. The old order put ocean at both ends and Deep
Forest third, which is why the island read as a symmetrical corridor.

Ids are unchanged, so the sim is untouched — camp jobs still say `zone: 'Well'`. The
`_Right` ids now mean "further out": Far Ocean is the deepest water.

`Beach3D.landDepth(x)` grows the landmass from **14 units at the waterline to 60 at
the interior**, and the sand is built as a triangle strip following that curve. This
one function is what makes it a landmass rather than a corridor: the treeline recedes
as you walk right, so there is always more island behind the island.

## Scale is derived from the castaway, not chosen

The level-design rule is that the character is the unit. Applied literally, because
"the NPCs are too small" was a metrics bug, not a taste one:

```
visible height = 2 * camDist * tan(fov / 2)
before:  fov 44, camDist 37  ->  30 units  ->  a 3.4-unit castaway is 11% of screen
after:   fov 44, camDist 20  ->  16 units  ->  a 4.2-unit castaway is 26%
```

`FIGURE_H` and `CAM_DIST` in `beach3d.js` are the two numbers; everything else —
figure standing height, bob, camera height, look-at target — is derived from them.
Both had to move: scaling the castaway alone next to a 12-unit palm would have made
the palms look like shrubs.

## Decimation

Everything is simplified at conversion time, because these props only need to look
right at a distance — most of them are background.

```
library:  160,888 -> 48,031 triangles
download:    7.3  ->  3.10  MB
a palm:     4,934 ->  1,554 triangles
the island: 1.68M ->   635k rendered, same 1,819 props
```

The ratio is chosen by **measured UV span**, not by name:

- **span < 0.12 → keep 30%.** The prop maps its whole mesh to one palette swatch, so a
  collapsed vertex cannot slide the colour. 59 of 107 props.
- **span >= 0.12 → keep 55%.** Real texture mapping (palm fronds, vines, scaffolding),
  where a moved UV genuinely smears the leaf it was sampling.

This is only safe because three.js r160's `SimplifyModifier` carries `uv` and `normal`
through the edge collapse; older versions dropped everything but position. Meshes under
120 triangles are skipped — collapsing a 4-triangle flower just deletes it.

Halving the download also fixes the other half of the "nothing rendered" report: 7.3 MB
over mobile data took long enough to look broken.

## Props with their own texture

Not everything is in an atlas. Each grass and flower patch ships its **own** sheet, and
pointing all four grass variants at `Grass_Patch_01`'s texture is what made the grass
render half white — 02, 03 and 04A were sampling a sheet with nothing where their UVs
look. `Scene3D.ownMat` keys per exact prop name; anything without an entry falls through
to its pack atlas. The same bug had swept up `Flower_` and `Fallen_Leaves`, which are
Fantasy Nature props that belong in the TFF atlas.

Flat alpha cards never cast shadows — a crossed pair casts a hard X on the ground.

## The sea

Three things separate water from a blue plane, all cheap:

1. **A segmented plane** (56×14, ~1,568 tris) with vertices displaced by two crossed
   sines in `update()`. A still surface is the biggest tell that a plane is not water.
2. **A depth gradient** in vertex colours — pale turquoise in the shallows, deep blue
   further out. Flat colour reads as paper.
3. **A foam line** at the waterline, so land and water meet somewhere.

The sand used to start 26 units out, *under* the sea plane, so a quarter of the beach
was pale flat blue over sand — that was the "it's just light blue" report. Sand now
begins at `SHORE_X`.

## Looking around

Dragging horizontally pans the camera and releases the player-follow; walking anywhere
takes the follow back. Without this there was no way to look at any part of the island
you were not standing on, which is what "no scrolling to the right" meant — the 2D beach
was a scrollable strip and the 3D camera only ever chased the player.

## Density, and why it is a setting

About **1,900 props and 1.2M triangles** at full density, roughly five times the
object count it shipped with, baked down to ~100 draw calls.

Counts are tiered by **measured** triangle cost (`js/beach3d-dressing.js` documents
the table). Three facts drove every number:

- Ground cover is 4–140 triangles. Scatter it by the hundred.
- `Fern` is 264 — the best density-per-triangle prop in the library.
- A full palm is **4,284–4,934**. Checked every variant in the source pack; all eight
  are within 10% of each other, so there is no cheap canopy.

So the treeline is **LOD by silhouette**: a dense stand of `Palm_Trunk` (266–292) and
`Palm_Tree_Broken_01A` (346) with fern understory, and full palms only in the near
band where fronds actually read. You do not see canopies deep in a treeline, you see
trunks. A wall of full palms cost 300k triangles and looked *thinner*, because it had
to be sparser to afford itself.

Two names to watch: `Small_Rock_01A` is **1,336** triangles while `Rock_Small_01A` is
**91**. Nearly identical names, 15× the cost.

**`BEACH3D_DENSITY`** multiplies every count, exposed in the Menu as Island detail
(Sparse / Light / Full / Lush). It is a setting rather than a constant because the
binding constraint is a phone GPU that cannot be measured from a build machine —
headless Chrome renders through software GL at a couple of frames per second no matter
what. Guessing low ships a sparse island; guessing high ships a slideshow.

Note that `renderer.info.render.triangles` counts the shadow pass, so the ~1.55M the
harness reports is *rendered* triangles, not scene geometry.

## Known, and deliberately left

- **Composition is unreviewed.** Every island placement is a row in
  `js/beach3d-dressing.js`; the backdrops are the `s3dScatter` calls in
  `stages3d.js`. Rearranging is editing a list. The tribal columns crowd the frame
  and the challenge bridge sprawls.
- **Name tags fan upward** when the tribe clusters, which is legible but busy. A
  cleaner answer is probably showing only the nearest few.
- **The sea is one flat plane.** No shoreline foam, no wave motion. The waterline is
  a straight edge in world space, hidden only because the sea's right edge is parked
  exactly on `SHORE_X`.
- **The camp is bare on purpose.** No shelter, no fire pit, no crates. The tribe
  arrives to untouched sand and builds later; `scene-manifest.js` records the `BUILT`
  list to bring back when camp construction exists.
- **7.3 MB of GLB on a cold load.** Draco or meshopt compression would cut it hard but
  needs a decoder vendored. Nothing is loaded lazily per scene yet either.
- **Name tags overlap** when the tribe clusters.
