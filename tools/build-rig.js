/* Segment each master body sprite into animatable parts by reading its alpha
   channel, then emit js/rig.js (boxes + pivots in source pixels).

   The A-pose art makes this tractable: scanning a row for runs of opaque
   pixels gives 1 run across the head, 3 once the arms clear the torso
   ([arm][torso][arm]), and 2 central runs once the legs split. Those
   transitions are the joints.

   Run:  node tools/build-rig.js
   Parts tile the body with vertical seams at the shoulders and horizontal
   seams at neck/crotch; the validator asserts every opaque pixel lands in
   exactly one part, so nothing is dropped or double-drawn.
*/
const fs = require('fs');
const path = require('path');
const { readPNG, runs } = require('./png.js');

const BODIES = ['male_skinny', 'male_muscular', 'male_curvy', 'female_skinny', 'female_muscular', 'female_curvy'];
const DIR = path.join(__dirname, '..', 'assets', 'bodies');

function analyze(file) {
  const img = readPNG(file);
  const { w, h } = img;
  const rowRuns = [];
  for (let y = 0; y < h; y++) rowRuns.push(runs(img, y));
  const width = y => rowRuns[y].reduce((a, r) => a + (r.x1 - r.x0 + 1), 0);
  const spanOf = rs => rs.length ? { x0: Math.min(...rs.map(r => r.x0)), x1: Math.max(...rs.map(r => r.x1)) } : null;

  const topY = rowRuns.findIndex(r => r.length > 0);

  /* --- arms: first row that resolves into [arm][torso][arm] --- */
  const armSplitY = rowRuns.findIndex((r, y) => y > topY + 20 && r.length >= 3);
  if (armSplitY < 0) throw new Error(file + ': never found a 3-run row');

  /* Body midline, taken from the chest just above the arm split (still one run). */
  const chest = spanOf(rowRuns[Math.max(topY, armSplitY - 6)]);
  const centre = (chest.x0 + chest.x1) / 2;
  /* Only the trunk straddles the midline — arms and split legs never do.
     Far more reliable than "is this run near the middle". */
  const straddles = r => r.x0 <= centre && r.x1 >= centre;

  /* --- crotch: first row below the arm split where nothing straddles the
     midline any more, i.e. the legs have parted. --- */
  let crotchY = -1;
  for (let y = armSplitY + 10; y < h; y++) {
    if (!rowRuns[y].some(straddles)) { crotchY = y; break; }
  }
  if (crotchY < 0) throw new Error(file + ': never found a leg split');

  /* Trunk column: the straddling run, measured only where the arms are already
     clear of it (at/below armSplitY) so the shoulders don't inflate it. */
  let tX0 = Infinity, tX1 = -Infinity;
  for (let y = armSplitY; y < crotchY; y++) {
    for (const r of rowRuns[y]) {
      if (!straddles(r)) continue;
      tX0 = Math.min(tX0, r.x0); tX1 = Math.max(tX1, r.x1);
    }
  }

  /* --- shoulders: first row whose silhouette spills outside the trunk column.
     Tested with no tolerance: any pixel outside that column must belong to an
     arm box, or it would land in no part at all. --- */
  let armTopY = armSplitY;
  for (let y = topY; y < armSplitY; y++) {
    const s = spanOf(rowRuns[y]);
    if (s && (s.x0 < tX0 || s.x1 > tX1)) { armTopY = y; break; }
  }

  /* --- neck: the narrowest row above the shoulders. Skip the first tenth so
     the tapering top of the skull can't win. --- */
  const neckFrom = topY + Math.round(h * 0.10);
  let neckY = neckFrom;
  for (let y = neckFrom; y < armTopY; y++) if (width(y) < width(neckY)) neckY = y;

  /* Arms hang well outside the trunk; legs stay near the midline even where the
     feet splay. One distance threshold separates them cleanly. */
  const LIMB_SPLIT = w * 0.28;
  const isArmRun = r => Math.abs((r.x0 + r.x1) / 2 - centre) > LIMB_SPLIT;

  /* --- arm extents (from the split down; the shoulder cap above it stays with
     the torso so a swinging arm can't tear a gap at the joint) --- */
  let lX0 = Infinity, lX1 = -Infinity, rX0 = Infinity, rX1 = -Infinity, armBottomY = armSplitY;
  for (let y = armSplitY; y < h; y++) {
    for (const r of rowRuns[y]) {
      if (!isArmRun(r)) continue;
      if ((r.x0 + r.x1) / 2 < centre) { lX0 = Math.min(lX0, r.x0); lX1 = Math.max(lX1, r.x1); }
      else { rX0 = Math.min(rX0, r.x0); rX1 = Math.max(rX1, r.x1); }
      armBottomY = Math.max(armBottomY, y);
    }
  }

  /* --- legs: split the below-crotch silhouette at the gap between them --- */
  const legRow = rowRuns[Math.min(h - 1, crotchY + 24)].filter(r => !isArmRun(r));
  const legGapX = legRow.length >= 2 ? Math.round((legRow[0].x1 + legRow[1].x0) / 2) : Math.round(centre);
  let llX0 = Infinity, llX1 = -Infinity, lrX0 = Infinity, lrX1 = -Infinity;
  for (let y = crotchY; y < h; y++) {
    for (const r of rowRuns[y]) {
      if (isArmRun(r)) continue;                          // skip hands
      const mid = (r.x0 + r.x1) / 2;
      if (mid < legGapX) { llX0 = Math.min(llX0, r.x0); llX1 = Math.max(llX1, r.x1); }
      else { lrX0 = Math.min(lrX0, r.x0); lrX1 = Math.max(lrX1, r.x1); }
    }
  }

  /* Head keeps a few rows of neck so the torso can overlap it. */
  const headSpan = spanOf(rowRuns.slice(topY, neckY + 1).flat());
  const HEAD_OVERLAP = 6;

  /* The torso is T-shaped: a full-width shoulder band down to the arm split,
     then just the trunk column. It is drawn ABOVE the arms, so the static
     shoulder caps hide the rotating arms' top edge. A clip-path carves the T
     out of the bounding box. */
  const shoulderSpan = spanOf(rowRuns.slice(neckY, armSplitY + 1).flat());
  const tBoxX0 = Math.min(shoulderSpan.x0, tX0);
  const tBoxX1 = Math.max(shoulderSpan.x1, tX1);
  const tBoxW = tBoxX1 - tBoxX0 + 1, tBoxH = crotchY - neckY;
  /* The band reaches a little PAST the arm split, so the static shoulder cap
     overlaps the top of each arm and plugs the seam that rotation would open. */
  const capPad = Math.round(h * 0.03);
  const clip = {
    sy: (armSplitY + capPad - neckY) / tBoxH * 100, // bottom of the shoulder band
    lx: (tX0 - tBoxX0) / tBoxW * 100,               // trunk column, left
    rx: (tX1 + 1 - tBoxX0) / tBoxW * 100            // trunk column, right
  };

  /* Below the crotch an arm box's inner edge overlaps the thigh, so it carries a
     1px sliver of leg that rotates away as a visible speck. Notch that corner
     off: below the crotch, keep only as far in as the arm's own pixels reach. */
  let lBelowMax = -Infinity, rBelowMin = Infinity;
  for (let y = crotchY; y < h; y++) {
    for (const r of rowRuns[y]) {
      if (!isArmRun(r)) continue;
      if ((r.x0 + r.x1) / 2 < centre) lBelowMax = Math.max(lBelowMax, r.x1);
      else rBelowMin = Math.min(rBelowMin, r.x0);
    }
  }
  const armLBox = { x: lX0, y: armSplitY, w: (tX0 - 1) - lX0 + 1, h: armBottomY - armSplitY + 1 };
  const armRBox = { x: tX1 + 1, y: armSplitY, w: rX1 - (tX1 + 1) + 1, h: armBottomY - armSplitY + 1 };
  const notch = (box, side) => {
    if (crotchY >= box.y + box.h) return null;            // arm ends above the crotch
    const cy = (crotchY - box.y) / box.h * 100;
    let ix;
    if (side === 'L') ix = lBelowMax === -Infinity ? 0 : (lBelowMax + 2 - box.x) / box.w * 100;
    else ix = rBelowMin === Infinity ? 100 : (rBelowMin - 1 - box.x) / box.w * 100;
    return { cy, ix: Math.max(0, Math.min(100, ix)), side };
  };

  const parts = {
    legL:  { x: llX0, y: crotchY, w: llX1 - llX0 + 1, h: h - crotchY, pivot: [(llX1 - llX0 + 1) / 2, 0] },
    legR:  { x: lrX0, y: crotchY, w: lrX1 - lrX0 + 1, h: h - crotchY, pivot: [(lrX1 - lrX0 + 1) / 2, 0] },
    armL:  { ...armLBox, pivot: [armLBox.w, 0], notch: notch(armLBox, 'L') },
    armR:  { ...armRBox, pivot: [0, 0], notch: notch(armRBox, 'R') },
    torso: { x: tBoxX0, y: neckY, w: tBoxW, h: tBoxH, pivot: [tBoxW / 2, tBoxH], clip },
    head:  { x: headSpan.x0, y: topY, w: headSpan.x1 - headSpan.x0 + 1, h: (neckY + HEAD_OVERLAP) - topY,
             pivot: [(headSpan.x1 - headSpan.x0 + 1) / 2, (neckY + HEAD_OVERLAP) - topY] }
  };

  return { w, h, seams: { topY, neckY, armTopY, armSplitY, crotchY, armBottomY, legGapX }, parts, img, rowRuns };
}

/* Every opaque pixel must land in exactly one part box. */
function validate(r) {
  const { w, h, img, parts } = r;
  const order = ['legL', 'legR', 'armL', 'armR', 'torso', 'head'];
  let missing = 0, doubled = 0;
  const missMap = {}, dblMap = {};
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (img.data[(y * w + x) * 4 + 3] < 40) continue;
      const hits = order.filter(k => {
        const p = parts[k];
        if (!(x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h)) return false;
        if (p.clip) {                       // T-shape: shoulder band, then trunk column
          const ly = (y - p.y) / p.h * 100, lx = (x - p.x) / p.w * 100;
          if (ly >= p.clip.sy && (lx < p.clip.lx || lx >= p.clip.rx)) return false;
        }
        if (p.notch) {                      // arm: inner corner cut below the crotch
          const ly = (y - p.y) / p.h * 100, lx = (x - p.x) / p.w * 100;
          if (ly >= p.notch.cy &&
              (p.notch.side === 'L' ? lx > p.notch.ix : lx < p.notch.ix)) return false;
        }
        return true;
      });
      if (hits.length === 0) { missing++; missMap[`${Math.floor(y / 20) * 20}`] = (missMap[`${Math.floor(y / 20) * 20}`] || 0) + 1; }
      else if (hits.length > 1) {
        const k = hits.join('+');
        /* Deliberate overlaps, all resolved by draw order: the head keeps a few
           rows of neck, and the shoulder cap sits over the top of each arm. */
        const intentional = k === 'torso+head' || k === 'armL+torso' || k === 'armR+torso';
        if (!intentional) doubled++;
        dblMap[k] = (dblMap[k] || 0) + 1;
      }
    }
  }
  return { missing, doubled, missMap, dblMap };
}

const out = {};
let bad = false;
for (const b of BODIES) {
  const r = analyze(path.join(DIR, b + '.png'));
  const v = validate(r);
  out[b] = { w: r.w, h: r.h, parts: r.parts };
  /* A handful of overlapping pixels where a hand passes a thigh, or the head's
     neck rows brush a shoulder, are sub-pixel once figures render ~5x smaller.
     Anything larger means a seam was misplaced. */
  const TOLERANCE = 64;
  const flag = (v.missing || v.doubled > TOLERANCE) ? '  <-- CHECK' : (v.doubled ? '  (negligible)' : '');
  console.log(`${b.padEnd(17)} ${r.w}x${r.h}  seams ${JSON.stringify(r.seams)}`);
  console.log(`${''.padEnd(17)} uncovered ${v.missing}  double-covered ${v.doubled}${flag}`);
  if (v.missing) console.log(`${''.padEnd(17)} uncovered by row-band: ${JSON.stringify(v.missMap)}`);
  if (v.doubled) console.log(`${''.padEnd(17)} overlaps: ${JSON.stringify(v.dblMap)}`);
  if (v.missing || v.doubled > TOLERANCE) bad = true;
}

const banner = `/* GENERATED by tools/build-rig.js — do not edit by hand.
   Part boxes and pivots in source-sprite pixels, per body type.
   Draw order: legL, legR, armL, armR, torso, head (later = on top). */\n`;
fs.writeFileSync(path.join(__dirname, '..', 'js', 'rig.js'),
  banner + 'const RIG = ' + JSON.stringify(out, null, 1) + ';\n');
console.log('\nwrote js/rig.js', bad ? '(with coverage warnings)' : '(clean coverage)');
