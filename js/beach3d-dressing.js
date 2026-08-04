/* ============================================================
   THE ISLAND'S LOOK — one table, nothing else.

   This is the file to edit to change how the island looks. Beach3D reads it and
   does nothing else opinionated about composition. Per zone kind:

     fam   prop families, matched by PREFIX, so a new variant added to the manifest
           gets used automatically without touching this file
     n     how many to scatter in that zone
     s     [min, max] scale jitter
     z     [near, far] depth band. Negative is inland; positive is toward the water.

   COUNTS ARE TIERED BY MEASURED TRIANGLE COST, not by eye. Density is what makes a
   jungle read as a jungle, but these props differ by three orders of magnitude:

     Flower 4        Fallen_Leaves 30    Twigs 60       Reed 70-91
     Rock_Small 91   Grass_Patch 134     Bush_Stub 138  Branch_Fallen 142
     Fern 264        Palm_Log 180-212    Palm_Trunk 266-292
     Palm_Tree_Broken_01A 346            Bush 1192-1418
     Rock_Medium 1854                    Palm_Tree 4284-4934

   So the ground layer is scattered by the hundred for almost nothing, ferns and
   trunks by the dozen, and full palms are RATIONED — they are the most expensive
   thing in the library by an order of magnitude, and multiplying THEM by five would
   have pushed the island past two million triangles on its own. The density the
   player sees comes from the cheap layers; the palms only supply the skyline.

   THE ISLAND IS ALSO STILL NATURAL. No shelter, no fire pit, no crates. Camp, fire
   pit and shelter are deliberately bare clearings framed heavily at their edges, so
   the empty middle reads as somewhere to build rather than somewhere unfinished.
   ============================================================ */

'use strict';

/* ---------- the density dial ----------
   Multiplies every `n` below. 1.0 is the designed island: about 1,900 objects and
   1.2M triangles, which is roughly five times the object count it shipped with.

   This exists because the real constraint is a phone GPU that cannot be measured
   from a build machine — headless Chrome renders through software GL at a couple of
   frames a second no matter what, so there is no honest way to pick this number
   without the device. Rather than guess low and ship a sparse island, or guess high
   and ship a slideshow, the density is a setting: play it, and if it struggles, turn
   it down. 0.6 removes about a third of the geometry and is barely visible.

   Read from localStorage so the Menu can change it and it survives a reload. */
const BEACH3D_DENSITY = (() => {
  try {
    const v = parseFloat(localStorage.getItem('castaway_density'));
    return isFinite(v) && v > 0.1 && v <= 2 ? v : 1;
  } catch { return 1; }
})();

const BEACH3D_DRESSING = {
  /* NOTE ON ROCK FAMILIES. Rock_Small is Fantasy Nature and reads cold grey; Small_Rock
     is Adventure Island and reads warm sandstone. Swapping to Rock_Small purely for its
     91-triangle cost turned tropical beaches into fields of limestone chippings — the
     cheap prop was cheap because it was from a different pack, and the palette came
     with it. Grey belongs in the ocean and the rocks; beaches get shells and coconut.
     Small_Rock_02A/03A are ~460 tris and correctly coloured if a warm rock is needed. */


  /* Open water. Rock and weed breaking the surface, reeds at the margin. */
  ocean: [
    { fam: ['Water_Plant'], n: 26, s: [0.7, 1.4], z: [-8, 18] },
    { fam: ['Rock_Cluster'], n: 18, s: [0.6, 1.3], z: [-6, 16] },
    { fam: ['Rock_Small'], n: 26, s: [0.6, 1.2], z: [-4, 14] },
    { fam: ['Reed'], n: 14, s: [0.8, 1.3], z: [-10, 2] }
  ],

  /* The shoreline. Tide litter thick on the sand, palms leaning over it. */
  beach: [
    { fam: ['Palm_Tree_0'], n: 6, s: [0.9, 1.4], z: [-16, -3] },
    { fam: ['Palm_Tree_Broken', 'Palm_Trunk'], n: 5, s: [0.9, 1.3], z: [-14, -2] },
    { fam: ['Palm_Log'], n: 6, s: [0.85, 1.2], z: [-8, 3] },
    { fam: ['Shell_', 'StarFish', 'Coconut_'], n: 34, s: [0.8, 1.4], z: [-3, 7] },
    { fam: ['Shell_', 'Coconut_'], n: 14, s: [0.8, 1.2], z: [-6, 6] },
    { fam: ['Grass_Patch', 'Reed'], n: 22, s: [0.8, 1.5], z: [-15, -4] },
    { fam: ['Fern'], n: 12, s: [0.9, 1.4], z: [-16, -6] },
    { fam: ['Twigs', 'Fallen_Leaves', 'Branch_Fallen'], n: 20, s: [0.8, 1.3], z: [-12, 2] },
    { fam: ['Turtle_Shell', 'Bone_Pile'], n: 3, s: [0.9, 1.2], z: [-6, 3] }
  ],

  /* Camp — bare in the middle, framed at the edges. */
  camp: [
    { fam: ['Palm_Tree_0'], n: 5, s: [1.0, 1.5], z: [-22, -11] },
    { fam: ['Fern', 'Bush_Stub'], n: 26, s: [0.9, 1.5], z: [-24, -10] },
    { fam: ['Palm_Log', 'Tree_Log'], n: 5, s: [0.9, 1.3], z: [-9, 0] },
    { fam: ['Grass_Patch'], n: 18, s: [0.7, 1.2], z: [-20, -7] },
    { fam: ['Coconut_', 'Shell_'], n: 12, s: [0.7, 1.1], z: [-8, 4] },
    { fam: ['Twigs', 'Fallen_Leaves'], n: 16, s: [0.8, 1.2], z: [-14, 1] },
    { fam: ['Coconut_'], n: 8, s: [0.9, 1.2], z: [-10, 2] }
  ],

  /* Fire pit — a ring of loose stone and scorched dirt, no fire yet. */
  firepit: [
    { fam: ['Small_Rock'], n: 16, s: [0.7, 1.2], z: [-10, 3] },
    { fam: ['Palm_Log', 'Tree_Log'], n: 4, s: [1.0, 1.3], z: [-7, 0] },
    { fam: ['Dirt_0'], n: 6, s: [0.9, 1.4], z: [-7, 1] },
    { fam: ['Twigs', 'Branch_Fallen'], n: 18, s: [0.8, 1.3], z: [-10, 2] },
    { fam: ['Palm_Tree_0'], n: 4, s: [1.0, 1.4], z: [-24, -13] },
    { fam: ['Fern', 'Bush_Stub'], n: 20, s: [0.9, 1.4], z: [-26, -12] }
  ],

  /* Shelter — standing trunks that obviously want to be a frame. */
  shelter: [
    { fam: ['Palm_Tree_0'], n: 6, s: [1.1, 1.6], z: [-26, -12] },
    { fam: ['Palm_Trunk', 'Tree_Trunk'], n: 8, s: [0.9, 1.3], z: [-16, -5] },
    { fam: ['Fern', 'Plant_0'], n: 24, s: [0.9, 1.4], z: [-24, -8] },
    { fam: ['Bush_0'], n: 6, s: [0.9, 1.3], z: [-22, -10] },
    { fam: ['Grass_Patch', 'Flowers_Patch'], n: 20, s: [0.8, 1.4], z: [-20, -4] },
    { fam: ['Branch_Fallen', 'Twigs'], n: 14, s: [0.8, 1.2], z: [-16, 0] }
  ],

  /* Fresh water. Reeds, mud and mushrooms — the wettest place on the island. */
  well: [
    { fam: ['Rock_Medium'], n: 5, s: [0.8, 1.3], z: [-16, -4] },
    { fam: ['Reed', 'Water_Plant', 'Nettle'], n: 34, s: [0.9, 1.5], z: [-14, -1] },
    { fam: ['Fern'], n: 22, s: [0.9, 1.4], z: [-20, -6] },
    { fam: ['Bush_0', 'Bush_Stub'], n: 10, s: [0.9, 1.3], z: [-22, -8] },
    { fam: ['Mushrooms'], n: 12, s: [0.9, 1.3], z: [-18, -4] },
    { fam: ['Flower_0', 'Flowers_Patch'], n: 22, s: [0.9, 1.4], z: [-16, -2] },
    { fam: ['Palm_Tree_0'], n: 5, s: [1.0, 1.5], z: [-26, -14] }
  ],

  /* Light jungle. The most walkable green — dappled, flowering, open. */
  forest: [
    { fam: ['Palm_Tree_0'], n: 8, s: [1.0, 1.6], z: [-30, -8] },
    { fam: ['Fern'], n: 34, s: [0.9, 1.5], z: [-28, -5] },
    { fam: ['Bush_0', 'Bush_Stub'], n: 16, s: [0.9, 1.4], z: [-26, -5] },
    { fam: ['Grass_Patch', 'Flower_0', 'Flowers_Patch'], n: 34, s: [0.8, 1.4], z: [-24, -3] },
    { fam: ['Plant_0', 'Plant_Leaves'], n: 18, s: [0.9, 1.4], z: [-26, -6] },
    { fam: ['Branch_Fallen', 'Twigs', 'Fallen_Leaves'], n: 26, s: [0.8, 1.3], z: [-24, -2] },
    { fam: ['Tree_Log', 'Tree_Trunk'], n: 6, s: [0.9, 1.2], z: [-20, -4] },
    { fam: ['Mushrooms', 'Pine_Cone'], n: 14, s: [0.9, 1.3], z: [-22, -4] }
  ],

  /* A clearing. Deliberately the airiest zone, so the walk gets a rest beat —
     wall-to-wall density numbs exactly the way wall-to-wall combat does. */
  'forest-light': [
    { fam: ['Palm_Tree_0'], n: 4, s: [0.9, 1.4], z: [-28, -16] },
    { fam: ['Grass_Patch', 'Flowers_Patch', 'Flower_0'], n: 46, s: [0.9, 1.6], z: [-20, -2] },
    { fam: ['Palm_Sapling', 'Nettle', 'Reed'], n: 20, s: [0.9, 1.4], z: [-18, -3] },
    { fam: ['Fern'], n: 14, s: [0.9, 1.3], z: [-24, -8] },
    { fam: ['Fallen_Leaves', 'Pine_Cone'], n: 18, s: [0.8, 1.3], z: [-16, -1] },
    { fam: ['Tree_Log'], n: 3, s: [0.9, 1.2], z: [-14, -3] }
  ],

  /* Deep jungle. The densest and darkest thing on the island. */
  'forest-deep': [
    { fam: ['Palm_Tree_0'], n: 11, s: [1.2, 1.9], z: [-40, -8] },
    { fam: ['Fern'], n: 44, s: [1.0, 1.6], z: [-38, -5] },
    { fam: ['Bush_0', 'Bush_Stub'], n: 22, s: [1.0, 1.5], z: [-36, -5] },
    { fam: ['Plant_0', 'Plant_Leaves'], n: 26, s: [0.9, 1.5], z: [-34, -5] },
    { fam: ['Tree_Log', 'Branch_Fallen', 'Tree_Trunk'], n: 18, s: [0.8, 1.3], z: [-32, -4] },
    { fam: ['Mushrooms', 'Twigs', 'Fallen_Leaves'], n: 30, s: [0.8, 1.4], z: [-34, -4] },
    { fam: ['Vine_0', 'Rope_Vine'], n: 8, s: [0.9, 1.4], z: [-34, -14] },
    { fam: ['Nettle', 'Reed'], n: 16, s: [0.9, 1.4], z: [-30, -6] },
    { fam: ['Palm_Trunk'], n: 10, s: [1.0, 1.4], z: [-30, -8] }
  ],

  /* Rock. The one zone with real vertical mass, so the skyline changes. */
  rocky: [
    { fam: ['Rock_Large'], n: 3, s: [0.9, 1.4], z: [-24, -6] },
    { fam: ['Rock_Medium', 'Rock_Boulder'], n: 14, s: [0.8, 1.4], z: [-22, -2] },
    { fam: ['Rock_Small', 'Rock_Cluster'], n: 50, s: [0.7, 1.4], z: [-20, 5] },
    { fam: ['Stone_Arch'], n: 1, s: [0.9, 1.2], z: [-20, -12] },
    { fam: ['Fern', 'Nettle'], n: 18, s: [0.8, 1.3], z: [-24, -6] },
    { fam: ['Palm_Tree_0'], n: 5, s: [1.0, 1.5], z: [-32, -16] },
    { fam: ['Twigs', 'Fallen_Leaves'], n: 14, s: [0.8, 1.2], z: [-18, 2] }
  ],

  /* Treemail. Bones and driftwood — the strangest corner of the island. */
  treemail: [
    { fam: ['Palm_Tree_0'], n: 7, s: [1.0, 1.6], z: [-30, -9] },
    { fam: ['Bone_Pile', 'Turtle_Shell', 'Skull_0'], n: 7, s: [0.9, 1.3], z: [-10, 2] },
    { fam: ['Bush_0', 'Fern'], n: 24, s: [0.9, 1.4], z: [-28, -6] },
    { fam: ['Palm_Log', 'Tree_Log', 'Palm_Trunk'], n: 10, s: [0.9, 1.3], z: [-16, 1] },
    { fam: ['Grass_Patch', 'Flowers_Patch'], n: 24, s: [0.8, 1.4], z: [-24, -3] },
    { fam: ['Twigs', 'Branch_Fallen', 'Fallen_Leaves'], n: 22, s: [0.8, 1.3], z: [-20, 2] },
    { fam: ['Mushrooms', 'Nettle'], n: 12, s: [0.9, 1.3], z: [-22, -5] }
  ]
};

/* The inland treeline behind every zone — the mass that makes the island look like
   it continues past what you can see. Depth and count scale with landDepth(x), so
   the jungle recedes and thickens as you walk right. */
const BEACH3D_TREELINE = {
  /* Per 10 units of island width.

     LOD BY SILHOUETTE, and it is the reason this is affordable. A full canopied palm
     is 4,284-4,934 triangles; a bare Palm_Trunk is 266-292 and Palm_Tree_Broken_01A
     is 346 — fifteen times cheaper. Checked the source pack for a cheap palm variant
     and there is none: all eight are within 10% of each other.

     But you do not SEE canopies deep in a treeline, you see trunks. So the far band
     is a dense stand of trunks and broken palms with fern understory, and full palms
     only appear in the near band where the fronds actually read. A wall built from
     full palms cost 300k triangles and looked thinner, because it had to be sparser
     to afford itself. */
  palms: 1.6,          /* near band only, where fronds are visible */
  fill: [
    { fam: ['Palm_Trunk', 'Palm_Tree_Broken', 'Tree_Trunk'], per10: 5.5 },
    { fam: ['Fern', 'Bush_Stub'], per10: 8 },
    { fam: ['Bush_0'], per10: 0.7 }
  ]
};
