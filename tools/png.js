/* Minimal PNG reader for 8-bit RGBA (colorType 6), non-interlaced.
   Used by the rig tools; not shipped to the browser. */
const fs = require('fs');
const zlib = require('zlib');

function readPNG(file) {
  const b = fs.readFileSync(file);
  let o = 8, w = 0, h = 0, colorType = 0, depth = 0;
  const idat = [];
  while (o < b.length) {
    const len = b.readUInt32BE(o);
    const type = b.toString('ascii', o + 4, o + 8);
    if (type === 'IHDR') {
      w = b.readUInt32BE(o + 8); h = b.readUInt32BE(o + 12);
      depth = b[o + 16]; colorType = b[o + 17];
    } else if (type === 'IDAT') {
      idat.push(b.subarray(o + 8, o + 8 + len));
    } else if (type === 'IEND') break;
    o += 12 + len;
  }
  if (depth !== 8 || colorType !== 6) throw new Error(`${file}: expected 8-bit RGBA, got depth ${depth} colorType ${colorType}`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const line = raw.subarray(p, p + stride); p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const A = x >= bpp ? cur[x - bpp] : 0;
      const B = prev ? prev[x] : 0;
      const C = (prev && x >= bpp) ? prev[x - bpp] : 0;
      let v = line[x];
      switch (filter) {
        case 0: break;
        case 1: v += A; break;
        case 2: v += B; break;
        case 3: v += (A + B) >> 1; break;
        case 4: {
          const pa = Math.abs(B - C), pb = Math.abs(A - C), pc = Math.abs(A + B - 2 * C);
          v += (pa <= pb && pa <= pc) ? A : (pb <= pc ? B : C);
          break;
        }
        default: throw new Error('bad filter ' + filter);
      }
      cur[x] = v & 0xff;
    }
  }
  return { w, h, data: out };
}

/* Opaque-pixel runs on a row: [{x0,x1}], inclusive, gaps of < minGap merged. */
function runs(img, y, alphaMin = 40, minGap = 3) {
  const { w, data } = img;
  const res = [];
  let start = -1;
  for (let x = 0; x < w; x++) {
    const a = data[(y * w + x) * 4 + 3];
    if (a >= alphaMin) { if (start < 0) start = x; }
    else if (start >= 0) { res.push({ x0: start, x1: x - 1 }); start = -1; }
  }
  if (start >= 0) res.push({ x0: start, x1: w - 1 });
  // merge runs separated by a tiny gap (antialiasing / outline nicks)
  const merged = [];
  for (const r of res) {
    const last = merged[merged.length - 1];
    if (last && r.x0 - last.x1 - 1 < minGap) last.x1 = r.x1;
    else merged.push({ ...r });
  }
  return merged;
}

module.exports = { readPNG, runs };
