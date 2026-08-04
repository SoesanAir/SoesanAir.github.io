/* Repair assets/scene3d/props.json's pack map.

   A prop's `pack` decides which atlas its UVs address; the wrong pack renders it in
   another biome's palette (a Fantasy Nature bridge comes out dark green). The map
   was regenerated all-'TAI' because fbx2glb.js derived the pack with a regex that
   only matched forward slashes, and Windows path.join produces backslashes — so
   every prop fell through to the 'TAI' default.

   This re-derives the pack for each existing prop from its true source folder,
   slash-agnostically, and rewrites ONLY the pack map. Scene lists and the prop set
   are left exactly as they are, so the game keeps loading the same 107 props.

   Run: node tools/fix-packmap.js
*/
const fs = require('fs');
const { resolve } = require('./scene-manifest.js');

const packFromDir = dir =>
  dir.includes('Adventure Island') ? 'TAI' :
  dir.includes('Fantasy Nature') ? 'TFF' :
  dir.includes('Nature Assets') ? 'TNA' :
  dir.includes('Deserted Temples') ? 'TFD' : 'TAI';

const r = resolve();
const derived = {};
for (const scene in r.scenes) for (const { name, file } of r.scenes[scene]) {
  const m = /Assets[\\/]([^\\/]+)[\\/]/.exec(file);   // both slashes, unlike the old bug
  derived[name] = packFromDir(m ? m[1] : '');
}

const pj = JSON.parse(fs.readFileSync('assets/scene3d/props.json', 'utf8'));
let changed = 0; const missing = [];
for (const name of Object.keys(pj.pack)) {
  if (derived[name]) { if (pj.pack[name] !== derived[name]) changed++; pj.pack[name] = derived[name]; }
  else missing.push(name);
}
fs.writeFileSync('assets/scene3d/props.json', JSON.stringify(pj));

const dist = {};
for (const v of Object.values(pj.pack)) dist[v] = (dist[v] || 0) + 1;
console.log('repaired pack map: ' + changed + ' changed, ' + missing.length + ' not resolved');
console.log('distribution:', dist);
if (missing.length) console.log('unresolved:', missing.slice(0, 12).join(', '));
