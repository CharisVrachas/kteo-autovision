"""Turn the blueprint PNGs into clean, transparent, uniformly-coloured artwork.

The seven source images are good drawings but they cannot be shipped as they
arrive, for two separate reasons:

  * The five vehicles carry a faint CHECKERBOARD baked into their pixels as
    semi-transparent grey -- between 21% and 45% of every one of them is neither
    opaque nor clear. That is an editor's transparency backdrop that got
    exported along with the drawing, and on the page it renders as a subtle grid
    behind the vehicle.
  * The two maps have NO alpha channel at all: 100% opaque, on a near-white
    ground. Dropped onto the loading screen, which is dark, each would be a
    white rectangle.

Both are fixed the same way, and the fix is what makes the set coherent:
transparency is DERIVED from the drawing's own ink rather than trusted from the
file. Anything lighter than WHITE_POINT becomes fully clear, anything at the
drawing's own darkest becomes fully opaque, and everything between ramps
smoothly so edges stay anti-aliased. The colour is then replaced outright with
the site's line grey, so all seven match each other exactly instead of each
carrying whatever grey it happened to be drawn in.

The black point is measured PER IMAGE from its own darkest percentile, not
fixed: the sources were drawn with different pen pressures, and mapping each
one's darkest lines to full opacity is what makes them read as one hand.

Run from the project root:

    python tools/make-blueprint-icons.py
"""

import io
import json
import os
import subprocess

LINE = "#747576"       # the grey every drawing on the site is painted in
SRC = os.environ.get("BLUEPRINT_SRC") or os.path.expanduser("~/Downloads")
OUT_DIR = "public/assets/img/shapes"

# source stem -> output name
SOURCES = {
    "blueprint-moto": "vehicle-moto",
    "blueprint-car": "vehicle-car",
    "blueprint-van": "vehicle-van",
    "blueprint-taxi": "vehicle-taxi",
    "blueprint-truck": "vehicle-lorry",
    "blueprint-rhodes": "map-rhodes",
    "blueprint-network": "map-europe",
}

WHITE_POINT = 244      # lighter than this is background, whatever the file says
DARK_PERCENTILE = 0.01  # the darkest 1% of ink defines "fully opaque"
PAD = 0.015            # breathing room around the trimmed drawing
TARGET_H = 420         # tall enough for the deadline cards at 2x; nothing needs more

# The node half. Everything here is per-pixel work over about a megapixel an
# image, which sharp does in native code; the same loop in Python would take
# minutes rather than seconds.
SCRIPT = r"""
const sharp = require('sharp');
const [src, dest, whitePoint, darkPct, pad, targetH, tint] = process.argv.slice(1);
const WP = +whitePoint, PCT = +darkPct, PAD = +pad, TH = +targetH;
const [tr, tg, tb] = tint.split(',').map(Number);

(async () => {
  // 1. Read the ink: flatten onto white so semi-transparent pixels reveal
  //    themselves, then work in grey.
  const flat = await sharp(src).flatten({ background: '#ffffff' }).greyscale()
    .raw().toBuffer({ resolveWithObject: true });
  const g = flat.data, W = flat.info.width, H = flat.info.height;

  // 2. Trim to the ink's own bounding box.
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (g[y * W + x] < WP) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const iw = x1 - x0 + 1, ih = y1 - y0 + 1;
  const px = Math.round(iw * PAD), py = Math.round(ih * PAD);
  const cx = Math.max(0, x0 - px), cy = Math.max(0, y0 - py);
  const cw = Math.min(W - cx, iw + 2 * px), chh = Math.min(H - cy, ih + 2 * py);

  // 3. Find this drawing's own black point: the darkest PCT of its ink. Fixed
  //    at 0 the lighter drawings would stay ghostly; measured per image, every
  //    one's darkest lines land at the same opacity.
  const inks = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const v = g[y * W + x];
    if (v < WP) inks.push(v);
  }
  inks.sort((a, b) => a - b);
  const black = inks[Math.floor(inks.length * PCT)] ?? 0;
  const span = Math.max(1, WP - black);

  // 4. Build the alpha from the ink and paint every pixel the one grey.
  const out = Buffer.alloc(cw * chh * 4);
  for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) {
    const v = g[(cy + y) * W + (cx + x)];
    let a = (WP - v) / span;
    a = a < 0 ? 0 : a > 1 ? 1 : a;
    const i = (y * cw + x) * 4;
    out[i] = tr; out[i + 1] = tg; out[i + 2] = tb; out[i + 3] = Math.round(a * 255);
  }

  const img = sharp(out, { raw: { width: cw, height: chh, channels: 4 } })
    .resize({ height: Math.min(TH, chh), fit: 'inside' });
  const buf = await img.png({ palette: true, quality: 90, effort: 10 }).toBuffer();
  await sharp(buf).toFile(dest);
  const meta = await sharp(buf).metadata();

  // report: mean alpha over the box is the drawing's weight on the page
  const raw = await sharp(buf).ensureAlpha().raw().toBuffer();
  let sum = 0;
  for (let i = 3; i < raw.length; i += 4) sum += raw[i];
  console.log(JSON.stringify({
    w: meta.width, h: meta.height, ratio: +(meta.width / meta.height).toFixed(3),
    black, ink: +(sum / (raw.length / 4 * 255)).toFixed(4), bytes: buf.length
  }));
})();
"""


def main():
    tint = tuple(int(LINE[i:i + 2], 16) for i in (1, 3, 5))
    print("%-14s %-12s %-8s %-7s %-8s %s" % ("file", "size", "ratio", "black", "ink", "weight"))
    for stem, name in SOURCES.items():
        src = os.path.join(SRC, stem + ".png")
        if not os.path.exists(src):
            raise SystemExit("λείπει η πηγή: %s" % src)
        dest = os.path.join(OUT_DIR, name + ".png")
        out = subprocess.run(
            ["node", "-e", SCRIPT, src, dest, str(WHITE_POINT), str(DARK_PERCENTILE),
             str(PAD), str(TARGET_H), "%d,%d,%d" % tint],
            capture_output=True, text=True, check=True).stdout
        r = json.loads(out)
        print("%-14s %-12s %-7s %-7s %-8s %.0f KB"
              % (name, "%dx%d" % (r["w"], r["h"]), r["ratio"], r["black"],
                 r["ink"], r["bytes"] / 1024))


if __name__ == "__main__":
    main()
