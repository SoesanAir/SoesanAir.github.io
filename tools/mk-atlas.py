"""Downscale a pack's source atlas to a NEAREST-filtered WebP for the web build.

The toon packs ship one 4096 atlas that doubles as a colour PALETTE: a strip of
~20px flat swatches that every solid prop UV-maps into by pointing at a single
pixel. That is why it MUST be resampled with NEAREST — averaging neighbours
(LANCZOS) blends two unrelated swatches and a rock comes out the wrong colour.
See docs/scene3d.md.

Pillow reads PSD (composite), TGA and PNG, so this handles every pack including
Toon Desert, whose atlas ships only as .psd.

Usage: py tools/mk-atlas.py <src image> <out.webp> [size=1024]
"""
import sys
from PIL import Image

def main():
    if len(sys.argv) < 3:
        print("usage: mk-atlas.py <src> <out.webp> [size]"); sys.exit(2)
    src, out = sys.argv[1], sys.argv[2]
    size = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
    im = Image.open(src)
    if im.mode == "P":
        im = im.convert("RGBA")
    elif im.mode not in ("RGB", "RGBA"):
        im = im.convert("RGBA")
    # Square-ish atlases: scale the longest side to `size`, NEAREST both ways.
    w, h = im.size
    scale = size / max(w, h)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    im = im.resize((nw, nh), Image.NEAREST)
    im.save(out, "WEBP", quality=92, method=6)
    print(f"wrote {out}  {w}x{h} -> {nw}x{nh}")

if __name__ == "__main__":
    main()
