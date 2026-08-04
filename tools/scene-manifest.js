/* Resolve the prop manifest against the real asset packs, and stage the FBX.

   The bundle is 7 GB: 2,236 models in 565 families across six packs. This file is the
   curated list AND the audit. Every family in every pack is accounted for — either in
   a priority bucket below, or in SKIP with a reason — so "what did we leave out and
   why" is answerable by reading this rather than by re-walking 7 GB.

   Buckets, in the order the game needs them:

     MUST   the island, the camp the tribe builds, tribal council, challenges
     NICE   variety and set dressing that makes one season look unlike the last
     OK     usable but low value; imported only where it is cheap
     SKIP   wrong genre. Not imported. Grouped with reasons at the bottom.

   Resolution is by PREFIX, not exact filename: variant suffixes (`_01A`, `_02B`,
   `_Module_1`) are not guessable and a hand-typed list of exact names silently misses
   half of them. Anything that fails to resolve is reported loudly.

   Run: node tools/scene-manifest.js          resolve and report
        node tools/scene-manifest.js --stage  also copy the FBX to tools/_fbx/
        node tools/scene-manifest.js --audit  print the SKIP tally
*/
const fs = require('fs'), path = require('path');

const ROOT = 'C:/projects/Personal/Castaway/Castaway/More Assets Then You Need/Assets';
const PACKS = {
  TAI: 'Toon Adventure Island',
  TFF: 'Toon Fantasy Nature',
  TNA: 'Toon Nature Assets',
  TFD: 'Toon Deserted Temples',
  TEM: 'Toon Enchanted Meadow',
  TDS: 'Toon Desert'
};

/* `max` caps variants per family. Background dressing rarely needs more than three of
   anything; hero props get more. */
const MANIFEST = {

  /* ============================================================
     ISLAND — the natural world. Still no man-made camp: the tribe
     arrives to bare sand and builds later. See `built`.
     ============================================================ */
  island: [
    /* MUST — palms, in every state */
    { pack: 'TAI', want: 'Palm_Tree_0', max: 8 },
    { pack: 'TAI', want: 'Palm_Tree_Broken', max: 2 },
    { pack: 'TAI', want: 'Palm_Trunk', max: 4 },
    { pack: 'TAI', want: 'Palm_Log', max: 2 },
    { pack: 'TFD', want: 'Palm_Sapling', max: 3 },
    { pack: 'TFD', want: 'Palm_Tree_0', max: 3 },
    /* MUST — rock and cliff, the island's bones */
    { pack: 'TAI', want: 'Rock_Large', max: 4 },
    { pack: 'TAI', want: 'Rock_Medium', max: 5 },
    { pack: 'TAI', want: 'Small_Rock', max: 4 },
    { pack: 'TAI', want: 'Cliff_0', max: 3 },
    { pack: 'TAI', want: 'Stone_Arch', max: 2 },
    { pack: 'TAI', want: 'Stone_Block', max: 3 },
    { pack: 'TAI', want: 'Stone_Slab', max: 3 },
    { pack: 'TNA', want: 'Cliff_Horizontal', max: 2 },
    { pack: 'TNA', want: 'Cliff_Vertical', max: 3 },
    { pack: 'TNA', want: 'Rock_Boulder', max: 3 },
    { pack: 'TNA', want: 'Rock_Cluster', max: 3 },
    /* MUST — undergrowth. The biggest single contributor to density. */
    { pack: 'TAI', want: 'Bush_0', max: 5 },
    { pack: 'TAI', want: 'Plant_0', max: 8 },
    { pack: 'TAI', want: 'Plant_Leaves', max: 2 },
    { pack: 'TAI', want: 'Grass_Patch', max: 4 },
    { pack: 'TAI', want: 'Flowers_Patch', max: 3 },
    { pack: 'TAI', want: 'Vine_0', max: 4 },
    { pack: 'TAI', want: 'Rope_Vine', max: 3 },
    { pack: 'TFF', want: 'Fern', max: 4 },
    { pack: 'TFF', want: 'Bush_0', max: 5 },
    { pack: 'TFF', want: 'Bush_Stub', max: 1 },
    { pack: 'TFF', want: 'Reed', max: 3 },
    { pack: 'TFF', want: 'Nettle', max: 2 },
    { pack: 'TFF', want: 'Plant_0', max: 4 },
    { pack: 'TFF', want: 'Flower_0', max: 2 },
    { pack: 'TFF', want: 'Flower_Patch', max: 2 },
    { pack: 'TFF', want: 'Mushrooms', max: 4 },
    { pack: 'TFF', want: 'Grass_Patch', max: 2 },
    { pack: 'TNA', want: 'Fern', max: 3 },
    { pack: 'TNA', want: 'Reed', max: 3 },
    { pack: 'TNA', want: 'Flower_', max: 4 },
    { pack: 'TNA', want: 'Mushroom_', max: 3 },
    { pack: 'TNA', want: 'Water_Plant', max: 4 },
    /* MUST — deadfall. What makes a jungle floor look lived in. */
    { pack: 'TFF', want: 'Branch_Fallen', max: 4 },
    { pack: 'TFF', want: 'Tree_Log', max: 4 },
    { pack: 'TFF', want: 'Tree_Trunk', max: 4 },
    { pack: 'TFF', want: 'Tree_Fallen', max: 2 },
    { pack: 'TFF', want: 'Tree_Broken', max: 2 },
    { pack: 'TFF', want: 'Twigs', max: 1 },
    { pack: 'TFF', want: 'Wood_Log', max: 2 },
    { pack: 'TFF', want: 'Fallen_Leaves', max: 3 },
    { pack: 'TFF', want: 'Leaf_0', max: 3 },
    { pack: 'TFF', want: 'Pine_Cone', max: 2 },
    { pack: 'TFF', want: 'Debris_0', max: 2 },
    { pack: 'TNA', want: 'Wooden_Twigs', max: 3 },
    { pack: 'TNA', want: 'Tree_Log', max: 2 },
    { pack: 'TNA', want: 'Tree_Trunk', max: 3 },
    { pack: 'TNA', want: 'Tree_Fallen', max: 2 },
    { pack: 'TNA', want: 'Falling_Leaf', max: 2 },
    /* MUST — what the tide leaves behind */
    { pack: 'TAI', want: 'Shell_0', max: 4 },
    { pack: 'TAI', want: 'StarFish', max: 3 },
    { pack: 'TAI', want: 'Coconut_0', max: 5 },
    { pack: 'TAI', want: 'Turtle_Shell', max: 1 },
    { pack: 'TAI', want: 'Bone_Pile', max: 4 },
    { pack: 'TAI', want: 'Dirt_0', max: 1 },
    { pack: 'TAI', want: 'Swordfish_0', max: 1 },
    { pack: 'TAI', want: 'Underwater_Plant', max: 2 },
    { pack: 'TAI', want: 'Underwater_Rock', max: 3 },
    /* NICE — island landmarks, used one or two per season */
    { pack: 'TAI', want: 'Shipwreck_0', max: 3 },
    { pack: 'TAI', want: 'Whale_Skeleton', max: 8 },
    { pack: 'TAI', want: 'Skeleton_0', max: 2 },
    { pack: 'TAI', want: 'Skull_0', max: 3 },
    { pack: 'TAI', want: 'Rock_Skull', max: 1 },
    { pack: 'TAI', want: 'Tree_0', max: 3 },
    /* NICE — other packs' nature, so seasons differ from each other */
    { pack: 'TFF', want: 'Aspen_Tree', max: 3 },
    { pack: 'TFF', want: 'Oak_Tree', max: 3 },
    { pack: 'TFF', want: 'Lotus_Flower', max: 3 },
    { pack: 'TFF', want: 'Lotus_Leaf', max: 2 },
    { pack: 'TFF', want: 'Water_LillY_Leaf', max: 2 },
    { pack: 'TFF', want: 'Glowing_Mushroom', max: 2 },
    { pack: 'TFF', want: 'Glowing_Lilly', max: 3 },
    { pack: 'TNA', want: 'Forest_Tree', max: 6 },
    { pack: 'TNA', want: 'Dry_Tree', max: 3 },
    { pack: 'TEM', want: 'Tree_0', max: 4 },
    { pack: 'TEM', want: 'Bush_0', max: 2 },
    { pack: 'TEM', want: 'Mushroom_0', max: 4 },
    { pack: 'TEM', want: 'Ivy_0', max: 2 },
    { pack: 'TEM', want: 'Leaf_Coverage', max: 3 },
    { pack: 'TEM', want: 'Lily_Flower', max: 3 },
    { pack: 'TEM', want: 'Rock_Large', max: 2 },
    { pack: 'TEM', want: 'Rock_Medium', max: 3 },
    { pack: 'TEM', want: 'Rock_Small', max: 4 },
    { pack: 'TEM', want: 'Flowers_Patch', max: 3 },
    { pack: 'TEM', want: 'Grass_Patch', max: 5 },
    { pack: 'TEM', want: 'Plant_0', max: 4 },
    /* OK — a drought island is a real Survivor look, so keep some dry flora */
    { pack: 'TDS', want: 'Dry_Bush', max: 2 },
    { pack: 'TDS', want: 'Dry_Tree', max: 2 },
    { pack: 'TDS', want: 'Plant_Dry', max: 5 },
    { pack: 'TDS', want: 'Sand_Pile', max: 3 },
    { pack: 'TDS', want: 'Rock_Small', max: 4 },
    { pack: 'TDS', want: 'Rock_Medium', max: 3 },
    { pack: 'TDS', want: 'Animal_Skull', max: 2 }
  ],

  /* ============================================================
     BUILT — the camp the tribe makes. Not placed on the island yet,
     but converted now so that adding construction is a gameplay job
     rather than an asset job.
     ============================================================ */
  built: [
    { pack: 'TAI', want: 'Campfire', max: 1 },
    { pack: 'TAI', want: 'Cauldron', max: 1 },
    { pack: 'TAI', want: 'Tripod', max: 1 },
    { pack: 'TAI', want: 'Torch_0', max: 2 },
    { pack: 'TAI', want: 'Staging', max: 1 },
    { pack: 'TAI', want: 'Plank_0', max: 3 },
    { pack: 'TAI', want: 'Stake_0', max: 1 },
    { pack: 'TAI', want: 'Ladder', max: 1 },
    { pack: 'TAI', want: 'Cloth_0', max: 4 },
    { pack: 'TAI', want: 'Wood_Crate', max: 3 },
    { pack: 'TAI', want: 'Wood_Barrel', max: 4 },
    { pack: 'TAI', want: 'Wood_Bucket', max: 3 },
    { pack: 'TAI', want: 'Sack_0', max: 2 },
    { pack: 'TAI', want: 'Jug_0', max: 2 },
    { pack: 'TAI', want: 'Bed_0', max: 2 },
    { pack: 'TAI', want: 'Shelf_0', max: 2 },
    { pack: 'TAI', want: 'Table_0', max: 1 },
    { pack: 'TAI', want: 'Chair_0', max: 2 },
    { pack: 'TAI', want: 'Fishing_Net', max: 3 },
    { pack: 'TAI', want: 'Rope_0', max: 3 },
    { pack: 'TAI', want: 'Anchor', max: 1 },
    { pack: 'TAI', want: 'Raft', max: 2 },
    { pack: 'TAI', want: 'Boat_0', max: 3 },
    { pack: 'TAI', want: 'Paddle', max: 2 },
    { pack: 'TAI', want: 'Axe', max: 1 },
    { pack: 'TAI', want: 'Shovel', max: 1 },
    { pack: 'TAI', want: 'Spear', max: 2 },
    { pack: 'TAI', want: 'Bottle_0', max: 3 },
    { pack: 'TAI', want: 'Lamp_0', max: 2 },
    { pack: 'TAI', want: 'Wooden_Pillar', max: 2 },
    { pack: 'TNA', want: 'Camp_Fire', max: 1 },
    { pack: 'TNA', want: 'Camp_Grill', max: 2 },
    { pack: 'TNA', want: 'Camp_Rotisory', max: 1 },
    { pack: 'TNA', want: 'Tent_', max: 3 },
    { pack: 'TNA', want: 'Wood_Stack', max: 3 },
    { pack: 'TNA', want: 'Rope_Pile', max: 2 },
    { pack: 'TNA', want: 'Canoe', max: 2 },
    { pack: 'TNA', want: 'Wooden_Pier', max: 2 },
    { pack: 'TEM', want: 'Wood_Bucket', max: 2 },
    { pack: 'TEM', want: 'Sack_0', max: 2 },
    { pack: 'TEM', want: 'Wood_Bench', max: 2 },
    { pack: 'TEM', want: 'Canopy', max: 3 }
  ],

  /* ============================================================
     TRIBAL COUNCIL — carved stone and firelight. Deserted Temples is
     exactly this kit and is the luckiest thing about the bundle.
     ============================================================ */
  tribal: [
    { pack: 'TFD', want: 'Braizer', max: 2 },
    { pack: 'TFD', want: 'Head_Entrance', max: 2 },
    { pack: 'TFD', want: 'Altar', max: 2 },
    { pack: 'TFD', want: 'Column_0', max: 4 },
    { pack: 'TFD', want: 'Column_Roots', max: 2 },
    { pack: 'TFD', want: 'Column_Vine', max: 2 },
    { pack: 'TFD', want: 'Wall_Plinth', max: 1 },
    { pack: 'TFD', want: 'Wall_Writing_Tablet', max: 3 },
    { pack: 'TFD', want: 'Wall_Decoration', max: 2 },
    { pack: 'TFD', want: 'Rune_0', max: 4 },
    { pack: 'TFD', want: 'Stairs_0', max: 2 },
    { pack: 'TFD', want: 'Circular_Stairs', max: 2 },
    { pack: 'TFD', want: 'Gate_0', max: 2 },
    { pack: 'TFD', want: 'Gate_Vine', max: 2 },
    { pack: 'TFD', want: 'Sarcophagus_0', max: 2 },
    { pack: 'TFD', want: 'Giant_Skeleton', max: 5 },
    { pack: 'TFD', want: 'Skeleton_0', max: 3 },
    { pack: 'TFD', want: 'Urn_0', max: 4 },
    { pack: 'TFD', want: 'Urn_Broken', max: 3 },
    { pack: 'TFD', want: 'Chest_0', max: 2 },
    { pack: 'TFD', want: 'Candle_0', max: 3 },
    { pack: 'TFD', want: 'Incense', max: 1 },
    { pack: 'TFD', want: 'Bowl_0', max: 2 },
    { pack: 'TFD', want: 'Cup_0', max: 2 },
    { pack: 'TFD', want: 'Pot_0', max: 2 },
    { pack: 'TFD', want: 'Plate_0', max: 2 },
    { pack: 'TFD', want: 'Papyrus_0', max: 2 },
    { pack: 'TFD', want: 'Pavement_0', max: 3 },
    { pack: 'TFD', want: 'Rock_Slab', max: 2 },
    { pack: 'TFD', want: 'Stone_0', max: 3 },
    { pack: 'TFD', want: 'Dust_Pile', max: 3 },
    { pack: 'TFD', want: 'Rubble', max: 1 },
    { pack: 'TFD', want: 'Web_0', max: 2 },
    { pack: 'TFD', want: 'Vine_0', max: 2 },
    { pack: 'TFD', want: 'Waterfall_01A', max: 3 },
    { pack: 'TFD', want: 'Water_Lily', max: 3 },
    { pack: 'TFD', want: 'Fountain', max: 1 },
    { pack: 'TFD', want: 'Sundial', max: 1 },
    { pack: 'TAI', want: 'Stone_Pillar', max: 3 },
    { pack: 'TAI', want: 'Stone_Pavilion', max: 1 },
    { pack: 'TAI', want: 'Chalice', max: 1 },
    { pack: 'TAI', want: 'Golden_Cup', max: 1 },
    { pack: 'TAI', want: 'Golden_Plate', max: 1 },
    { pack: 'TAI', want: 'Treasure_Chest', max: 2 },
    { pack: 'TAI', want: 'Gold_Coin_0', max: 2 },
    /* NICE — the meadow ruins read as an older, greener council */
    { pack: 'TEM', want: 'Rock_Idol', max: 2 },
    { pack: 'TEM', want: 'Broken_Pillar', max: 3 },
    { pack: 'TEM', want: 'Ruin_0', max: 4 },
    { pack: 'TEM', want: 'Stone_Bridge', max: 2 },
    { pack: 'TEM', want: 'Stone_Railing', max: 3 },
    { pack: 'TEM', want: 'Stone_Pillar', max: 1 },
    { pack: 'TEM', want: 'Waterfall', max: 1 }
  ],

  /* ============================================================
     CHALLENGE ARENA — genuine course pieces.
     ============================================================ */
  challenge: [
    { pack: 'TFD', want: 'Climbing_Grips', max: 1 },
    { pack: 'TFD', want: 'Scaffolding', max: 4 },
    { pack: 'TFD', want: 'Beam_0', max: 4 },
    { pack: 'TFD', want: 'Railing_0', max: 3 },
    { pack: 'TFD', want: 'Plank_0', max: 3 },
    { pack: 'TAI', want: 'Climbing_Grips', max: 1 },
    { pack: 'TAI', want: 'Stone_Steps', max: 2 },
    { pack: 'TAI', want: 'Flag_0', max: 1 },
    { pack: 'TAI', want: 'Wooden_Bridge', max: 2 },
    { pack: 'TAI', want: 'Pier_Structure', max: 1 },
    { pack: 'TAI', want: 'Pier_Bollard', max: 2 },
    { pack: 'TFF', want: 'Wooden_Bridge', max: 2 },
    { pack: 'TFF', want: 'Wooden_Pole', max: 2 },
    { pack: 'TFF', want: 'Wooden_Pavilion', max: 2 },
    { pack: 'TFF', want: 'Wood_Plank', max: 2 },
    { pack: 'TFF', want: 'Wood_Stack', max: 1 },
    { pack: 'TNA', want: 'Wooden_Ramp', max: 3 },
    { pack: 'TNA', want: 'Wooden_Steps', max: 1 },
    { pack: 'TNA', want: 'Wooden_Beam', max: 3 },
    { pack: 'TNA', want: 'Wooden_Plank', max: 3 },
    { pack: 'TNA', want: 'Wooden_Pole', max: 2 },
    { pack: 'TNA', want: 'Bridge_Modular', max: 2 },
    { pack: 'TNA', want: 'Bridge_Pillar', max: 1 },
    { pack: 'TEM', want: 'Wood_Beam', max: 3 },
    { pack: 'TEM', want: 'Wood_Plank', max: 2 },
    { pack: 'TEM', want: 'Wood_Pillar', max: 3 },
    { pack: 'TEM', want: 'Wood_Platform', max: 1 },
    { pack: 'TEM', want: 'Stairs_0', max: 2 }
  ],

  /* ============================================================
     REWARD — the feast. Real Survivor rewards are food.
     ============================================================ */
  reward: [
    { pack: 'TNA', want: 'Steak_', max: 3 },
    { pack: 'TNA', want: 'Bacon_Strip', max: 2 },
    { pack: 'TNA', want: 'Scrambled_Egg', max: 2 },
    { pack: 'TNA', want: 'Plate_', max: 2 },
    { pack: 'TNA', want: 'Pot_', max: 3 },
    { pack: 'TNA', want: 'Tea_Cup', max: 1 },
    { pack: 'TNA', want: 'Thermos', max: 2 },
    { pack: 'TNA', want: 'Beer_Bottle', max: 3 },
    { pack: 'TAI', want: 'Swordfish_Steak', max: 1 },
    { pack: 'TAI', want: 'Tankard', max: 1 },
    { pack: 'TAI', want: 'Rum_Bottle', max: 2 },
    { pack: 'TEM', want: 'Apple_0', max: 2 },
    { pack: 'TEM', want: 'Apple_Crate', max: 2 },
    { pack: 'TEM', want: 'Carrot', max: 1 },
    { pack: 'TEM', want: 'Tomato_0', max: 2 },
    { pack: 'TEM', want: 'Pear_Crate', max: 2 },
    { pack: 'TEM', want: 'Produce_Crate', max: 2 },
    { pack: 'TEM', want: 'Bowl_0', max: 2 },
    { pack: 'TEM', want: 'Plate_0', max: 2 },
    { pack: 'TEM', want: 'Tankard', max: 2 }
  ],

  /* ============================================================
     HORIZON — shared by every outdoor scene. Billboard trees are two
     triangles each and belong at the very back of a treeline.
     ============================================================ */
  horizon: [
    { pack: 'TNA', want: 'Cloud', max: 2 },
    { pack: 'TNA', want: 'Mountain_', max: 4 },
    { pack: 'TNA', want: 'Hills', max: 3 },
    { pack: 'TFD', want: 'BG_Desert_Mountain', max: 2 },
    { pack: 'TFD', want: 'BG_Dunes', max: 2 },
    { pack: 'TEM', want: 'BG_Mountain', max: 2 },
    { pack: 'TFF', want: 'Board_Pine_Tree', max: 3 },
    { pack: 'TFF', want: 'Board_Birch_Tree', max: 2 },
    { pack: 'TFF', want: 'Board_Dead_Tree', max: 1 },
    { pack: 'TFF', want: 'Pine_Tree', max: 4 },
    { pack: 'TNA', want: 'Pine_Tree', max: 3 }
  ],

  /* ============================================================
     TRINKETS — hidden immunity idols, treemail, jury dressing.
     ============================================================ */
  trinket: [
    { pack: 'TAI', want: 'Treasure_Map', max: 2 },
    { pack: 'TAI', want: 'Compass', max: 1 },
    { pack: 'TAI', want: 'Spyglass', max: 1 },
    { pack: 'TAI', want: 'Hat', max: 1 },
    { pack: 'TAI', want: 'Book_0', max: 2 },
    { pack: 'TAI', want: 'Candle_0', max: 2 },
    { pack: 'TAI', want: 'Gold_Sack', max: 2 },
    { pack: 'TAI', want: 'Gold_Coin_Stack', max: 2 },
    { pack: 'TAI', want: 'Dagger', max: 1 },
    { pack: 'TAI', want: 'Sword_0', max: 2 },
    { pack: 'TFD', want: 'Coin', max: 2 },
    { pack: 'TFD', want: 'Gold_Sack', max: 1 },
    { pack: 'TEM', want: 'Treasure_Chest', max: 1 },
    { pack: 'TEM', want: 'Book_0', max: 2 },
    { pack: 'TEM', want: 'Flower_Pot', max: 3 }
  ]
};

/* ============================================================
   SKIP — everything deliberately NOT imported, with the reason.
   Lives in code so the audit cannot drift away from the manifest.
   Printed by --audit; the prose version is docs/asset-audit.md.
   ============================================================ */
const SKIP = {
  'Modern vehicles and roads': {
    why: 'A 26-day marooning has no cars. Nothing here can appear on an island.',
    fams: ['TDS Car', 'TDS Truck', 'TDS Rusty_Car', 'TDS Rusty_Truck', 'TDS Motorcycle',
      'TDS Superbike', 'TDS Rim', 'TDS Wheel', 'TDS Tire', 'TDS Road_Straight',
      'TDS Road_Curve', 'TDS Road_Crossing', 'TDS Road_Serpentine', 'TDS Road_Special',
      'TDS Road_End', 'TDS Dirt_Road_Curve', 'TDS Dirt_Road_Straight',
      'TNA Car', 'TNA Truck', 'TNA Camper_Trailer', 'TNA Country_Road', 'TNA Parking']
  },
  'Towns, shops and buildings': {
    why: 'Production infrastructure the show never puts on camera.',
    fams: ['TDS Gas_Station', 'TDS Gas_Station_Shop', 'TDS Gas_Station_Pole', 'TDS Motel',
      'TDS Motel_Pole', 'TDS Shop', 'TDS Shop_Sign', 'TDS House', 'TDS Barn', 'TDS Shed',
      'TDS Greenhouse', 'TDS Windmill', 'TDS Water_Tower', 'TDS Air_Conditioner',
      'TDS Mailbox', 'TDS Trash_Can', 'TDS Trash_Container', 'TDS Bar',
      'TNA Diner', 'TNA Ranger_Station', 'TNA Outhouse', 'TNA Shed', 'TNA Trash_Bag',
      'TNA Trash_Container']
  },
  'Street furniture and signage': {
    why: 'Signposts and traffic lights break the marooning fiction instantly.',
    fams: ['TDS Streetsign', 'TDS City_Limits_Streetsign', 'TDS Motel_Streetsign',
      'TDS Shop_Streetsign', 'TDS Stoplight', 'TDS Streetlight', 'TDS Streetlight_Pole',
      'TDS Electric_Pole', 'TDS Electric_Cable', 'TDS Metal_Fence', 'TDS Metal_Fence_Pole',
      'TDS Metal_Gate', 'TNA Stoplight', 'TNA Streetlight', 'TNA Streetsign',
      'TNA Bridge_Streetlight', 'TNA Signpost', 'TNA Fence', 'TNA Hose',
      'TNA Gas_Barrel', 'TNA Gas_Cannister', 'TNA Umbrella', 'TEM Lamp_Post', 'TEM Mailbox']
  },
  'Cacti and hard-desert flora': {
    why: 'Wrong biome. A cactus on a tropical island reads as a bug, not a location.',
    fams: ['TDS Cactus_Small', 'TDS Cactus_Medium', 'TDS Cactus_Tall', 'TDS Sand_Dune',
      'TDS Sand_Field', 'TDS Sand_Patch', 'TDS Animal_Carcass']
  },
  'Village craft and architecture': {
    why: 'A blacksmith forge and tiled roofs belong to a settled village, not a camp '
      + 'built out of driftwood in three days.',
    fams: ['TEM Forge', 'TEM ForgeBlower', 'TEM SmithingHammerStation', 'TEM SharpeningStation',
      'TEM QuenchingTrough', 'TEM Mill_Wheel', 'TEM WheelMechanism', 'TEM Market_Stand',
      'TEM Roof_Corner', 'TEM Roof_Straight', 'TEM Roof_Tall', 'TEM Eave_Corner',
      'TEM Eave_Straight', 'TEM Window_Sill', 'TEM Wood_Cabinet', 'TEM Wood_Cart',
      'TEM Rail', 'TEM Rail_Pole', 'TEM Entrance', 'TEM Foundation_Block',
      'TEM Paved_Floor', 'TEM Wood_Floor', 'TEM WaterTank', 'TEM Pulley', 'TEM Broom',
      'TEM Belt', 'TEM Books', 'TEM Wood_Deck', 'TEM Wood_Fence', 'TEM Wood_Fence_Pole',
      'TEM Stone_Road', 'TEM Wall', 'TEM Wall_Long', 'TEM Wall_Nub', 'TEM Column',
      'TEM Stone_Step', 'TEM Stone_Wall', 'TEM Stone_Wall_Anchor', 'TEM Stone_Wall_Ring',
      'TEM Wood_Wheel', 'TEM Wood_Chair', 'TEM Wood_Table', 'TEM Wood_Pier', 'TEM Bed',
      'TEM Barrel_Stand', 'TEM Onion_Crate', 'TEM Pepper_Crate', 'TEM Pear_Stack',
      'TEM Apple_Stack', 'TEM Sack_Pile', 'TEM Pier_Bollard', 'TEM Boat', 'TEM Boat_Wreck',
      'TEM Rope', 'TEM Candle', 'TEM Lamp', 'TEM Stone_Railing_Ornament',
      'TEM Stone_Railing_Pole', 'TEM Stone_Bridge_Pillar', 'TEM Broken_Pillar_Base',
      'TEM Broken_Pillar_Decoration', 'TEM Ruin_Brick', 'TEM Flower_Bush', 'TEM Ivy_Corner',
      'TEM Leaf', 'TEM Rock_Idol_Eyes', 'TEM Stone_Block', 'TEM Wood_Barrel',
      'TEM Wood_Crate', 'TEM Pavement_Dust', 'TEM Stairs', 'TEM Tomato', 'TEM Plate',
      'TEM Bowl', 'TEM Carrot', 'TEM Apple']
  },
  'Pirate weaponry and ship fittings': {
    why: 'The island pack is pirate-themed. Cannons and flintlocks are a different '
      + 'story from starving for 26 days.',
    fams: ['TAI Cannon', 'TAI Cannon_Ammo', 'TAI Cannon_Barrel', 'TAI Cannon_Wheel',
      'TAI Pirate_Gun', 'TAI Ship_Steering_Wheel', 'TAI Metal_Cage', 'TAI Metal_Cage_Damaged',
      'TAI Metal_Cage_Door_Damaged', 'TAI Lock', 'TAI Metal_Bar', 'TAI Stone_Tower',
      'TAI Cabin', 'TAI Chain', 'TAI Wall_Ring', 'TAI Wall_Support', 'TAI Pavement_Block',
      'TAI Pavement_Stones', 'TAI Pavement_Stones_Dust', 'TAI Stone_Wall',
      'TAI Stone_Wall_Dust', 'TAI Wood_Barrels_Rubble', 'TAI Palm_Trunk_Stack',
      'TAI Swordfish_Bite']
  },
  'Dungeon mechanisms': {
    why: 'Levers, traps and manholes are for a temple crawl, not a vote.',
    fams: ['TFD Console', 'TFD Lever', 'TFD Wall_Lever', 'TFD Floor_Trap', 'TFD Trap',
      'TFD Pit', 'TFD Manhole_Pipe', 'TFD Pavement_Manhole', 'TFD Ceiling_Manhole',
      'TFD Floor_Metal_Grate', 'TFD Ceiling', 'TFD Corbelled_Roof', 'TFD Building_Block',
      'TFD Wheel', 'TFD Cane', 'TFD Mortar', 'TFD Pestle', 'TFD Blanket', 'TFD Box',
      'TFD Wall_Nub', 'TFD Wall_Chain', 'TFD Metal_Bar', 'TFD Chain', 'TFD Wall',
      'TFD Wall_Block', 'TFD Wall_Dust', 'TFD Wall_Roots', 'TFD Wall_Vine',
      'TFD Railing_Roots', 'TFD Railing_Vine', 'TFD Gate_Roots', 'TFD Sarcophagus_Lid',
      'TFD Pavement_Blocks', 'TFD Pavement_Dust', 'TFD Pavement_Roots', 'TFD Sack',
      'TFD Sack_Pile', 'TFD Large_Plate', 'TFD Lamp', 'TFD Cloth', 'TFD Bush',
      'TFD Tree', 'TFD Grass_Patch', 'TFD Flowers_Patch', 'TFD Manna_Patch',
      'TFD Papyrus_Stack', 'TFD Rune_Sides', 'TFD Urn_Interactable', 'TFD Vine_Dry',
      'TFD Water_Lily_Flower', 'TFD BG_Salt_Mountain', 'TFD Canyon_Cliff', 'TFD Beam']
  },
  'Engine-specific effect quads': {
    why: 'Particle and decal planes authored for Unity shaders. They render as flat '
      + 'untextured cards outside that setup — exactly the class of asset this audit '
      + 'exists to catch before it ships.',
    fams: ['TFD Particle_Quad', 'TFD Water_Ripple', 'TFD Wax', 'TFD Wax_Drip',
      'TFD Floating_Debris', 'TEM Particle_Quad', 'TDS Decal_Leaf', 'TDS Decal_Footprint',
      'TFF Decal_Debris', 'TDS Ground_Tile', 'TDS Stone_Pavement', 'TDS Tile_Pavement',
      'TDS Wooden_Deck', 'TDS Grass_Patch', 'TDS Stone_Slab', 'TDS Wooden_Fence',
      'TDS Wooden_Fence_Pole', 'TDS Wooden_Pole', 'TDS Wooden_Steps', 'TDS Barrel',
      'TDS Cliff_Plateau', 'TDS Cliff_Ramp', 'TDS Cliff_Vertical', 'TDS Rock_Large',
      'TFF Debris', 'TFF Leaf', 'TFF Wooden_Chair', 'TFF Wooden_Table', 'TFF Wooden_Fence',
      'TFF Wooden_Swing', 'TFF Gas_Lamp', 'TFF Camp_Fire', 'TFF Birch_Tree',
      'TFF Birch_Tree_Dry', 'TFF Board_Aspen_Tree', 'TFF Stone_Slab', 'TFF Rock_Large',
      'TFF Rock_Medium', 'TFF Rock_Small', 'TFF Vine']
  },
  'Animated wildlife': {
    why: 'Seagull, Crow and Fish are SKINNED meshes with animation. Their geometry '
      + 'arrives from FBXLoader without a usable position buffer, and three.js throws '
      + 'inside Box3.setFromObject before anything can measure or export them. Four '
      + 'props out of 658, all decorative — a wheeling bird is a nice touch, not a '
      + 'reason to build an animated-mesh path through the whole pipeline.',
    fams: ['TAI Seagull', 'TAI Fish', 'TAI Swordfish', 'TDS Crow']
  },
  'Character models': {
    why: 'Castaways are the game\'s own paper cutouts. A toon 3D human standing next '
      + 'to them would look like a different game.',
    fams: ['TDS Female_Character', 'TDS Male_Character']
  }
};

function modelsIn(packKey) {
  const dir = path.join(ROOT, PACKS[packKey]);
  const out = [];
  const walk = d => {
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.fbx$/i.test(e.name) && !/MeshCollider/i.test(e.name)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

const cache = {};
const listing = k => (cache[k] = cache[k] || modelsIn(k));

/* Pack prefixes differ and are not guessable: Deserted Temples is TFD_, Fantasy
   Nature TFF_, Desert DS_, and Nature Assets has no prefix at all. */
const webName = f => path.basename(f, path.extname(f)).replace(/^(TAI|TFF|TFD|TNA|TEM|TDS|DS)_/, '');

/* Two packs can both contain e.g. `Rock_Small_01A`. Names must stay unique across the
   whole library, so a collision keeps the FIRST pack to claim it and the duplicate is
   reported — silently overwriting would give a prop the wrong pack's atlas. */
function resolve() {
  const scenes = {}, misses = [], seen = new Map(), collisions = [];
  let bytes = 0;
  for (const scene in MANIFEST) {
    scenes[scene] = [];
    for (const rule of MANIFEST[scene]) {
      const all = listing(rule.pack);
      const hits = all.filter(f => webName(f).toLowerCase().indexOf(rule.want.toLowerCase()) === 0)
        .sort()
        .slice(0, rule.max || 99);
      if (!hits.length) { misses.push(rule.pack + ' / ' + rule.want); continue; }
      for (const f of hits) {
        let n = webName(f);
        /* Two packs both ship e.g. Bush_01A. Qualifying the second with its pack key
           keeps BOTH — Scene3D.family() matches through an optional pack prefix, so
           the dressing tables need no change. Dropping one silently substituted a
           different pack's model for 58 requested props. */
        if (seen.has(n) && seen.get(n).pack !== rule.pack) {
          collisions.push(n + ' -> ' + rule.pack + '_' + n);
          n = rule.pack + '_' + n;
        }
        if (!seen.has(n)) { seen.set(n, { file: f, pack: rule.pack }); bytes += fs.statSync(f).size; }
        scenes[scene].push({ name: n, file: seen.get(n).file, pack: seen.get(n).pack });
      }
    }
  }
  return { scenes, misses, bytes, unique: seen, collisions };
}

const r = resolve();
console.log('');
for (const s in r.scenes) {
  const names = [...new Set(r.scenes[s].map(x => x.name))];
  console.log(s.toUpperCase().padEnd(11) + String(names.length).padStart(4) + ' props');
}
console.log('');
console.log('unique models : ' + r.unique.size);
console.log('source FBX    : ' + (r.bytes / 1048576).toFixed(1) + ' MB');
if (r.collisions.length) {
  const uniq = [...new Set(r.collisions)];
  console.log('');
  console.log('NAME COLLISIONS across packs (' + uniq.length + ') — the later one is pack-qualified:');
  for (const c of uniq.slice(0, 10)) console.log('  · ' + c);
}
if (r.misses.length) {
  console.log('');
  console.log('UNRESOLVED — these patterns matched nothing, fix the manifest:');
  for (const m of r.misses) console.log('  ! ' + m);
}

if (process.argv.includes('--audit')) {
  console.log('');
  let n = 0;
  for (const g in SKIP) { n += SKIP[g].fams.length; console.log('SKIP  ' + String(SKIP[g].fams.length).padStart(3) + '  ' + g); }
  console.log('      ' + n + ' families deliberately excluded — reasons in docs/asset-audit.md');
}

if (process.argv.includes('--stage')) {
  const stage = path.join(__dirname, '_fbx');
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(stage, { recursive: true });
  const index = {}, packOf = {};
  for (const s in r.scenes) index[s] = [];
  for (const s in r.scenes) {
    for (const { name, file, pack } of r.scenes[s]) {
      const dest = path.join(stage, name + '.fbx');
      if (!fs.existsSync(dest)) fs.copyFileSync(file, dest);
      packOf[name] = pack;
      if (index[s].indexOf(name) < 0) index[s].push(name);
    }
  }
  /* The pack map is written HERE, from the resolver that actually knows which pack a
     file came from. fbx2glb used to re-derive it from the path, which is fragile and
     was wrong once. */
  fs.writeFileSync(path.join(stage, 'index.json'), JSON.stringify({ scenes: index, pack: packOf }, null, 2));
  console.log('');
  console.log('staged ' + r.unique.size + ' FBX to tools/_fbx/ with index.json');
}

module.exports = { MANIFEST, SKIP, resolve, PACKS };
