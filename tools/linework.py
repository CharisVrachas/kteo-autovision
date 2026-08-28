"""Shared machinery for turning artwork into the site's fine-line style.

The reference is assets/img/shapes/process-car.svg: hairline strokes in one
grey, no fills, nothing solid. Two scripts use this module and must stay in
step, because their output sits side by side on the same row of cards:

    tools/make-vehicle-drawings.py   the three vehicles
    tools/make-map-drawings.py       Europe, Rhodes and the map pins

The part worth understanding is solve_weight(). Line weight is not set to a
fixed number, because a drawing with many lines reads far heavier than a sparse
one at the same stroke width -- the bike carries hundreds of lines, the island
outline carries one. Instead each drawing is rendered at the size the page
actually uses and its stroke is searched for until it puts the same amount of
ink on the page as the others. Equal ink is equal weight to the eye.
"""

import io
import json
import math
import os
import re
import subprocess
import xml.dom.minidom

LINE = "#747576"          # the grey process-car.svg uses
DARK_MAX = 0.12           # linear luminance below this counts as a drawn line
LIGHT_MIN = 0.80          # and above this as paper
OUT_DIR = "public/assets/img/shapes"
PAD = 0.02                # breathing room around the trimmed ink

TARGET_INK = 0.085        # the shared weight every drawing is solved to
RENDER_H = 120            # 40 CSS px at 3x, which is how the page draws them
# ...but never past these, whatever the ink says. A drawing that is simply
# sparser than the others cannot be made to match by fattening its lines: the
# search will happily return a six pixel stroke and ruin it. Better slightly
# light than blunt.
MIN_LINE_PX = 0.75
MAX_LINE_PX = 1.60

HEX = re.compile(r"#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b")
LONG_NUM = re.compile(r"-?\d+\.\d{3,}")


def fmt(v):
    return ("%.4f" % v).rstrip("0").rstrip(".")


def thin_precision(svg, places=2):
    """Sources carry up to nine decimal places. On canvases a few hundred units
    wide that is orders of magnitude below a pixel at any size this site draws
    them at, and it is most of the file weight."""
    return LONG_NUM.sub(
        lambda m: ("%.*f" % (places, float(m.group(0)))).rstrip("0").rstrip("."), svg)


def luminance(hex_colour):
    h = hex_colour.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * out[0] + 0.7152 * out[1] + 0.0722 * out[2]


def set_viewbox(svg, box):
    vb = "%s %s %s %s" % tuple(("%.3f" % v).rstrip("0").rstrip(".") for v in box)
    head = re.search(r"<svg[^>]*>", svg).group(0)
    new = head
    if re.search(r'viewBox="[^"]*"', new):
        new = re.sub(r'viewBox="[^"]*"', 'viewBox="%s"' % vb, new)
    else:
        new = new.replace("<svg", '<svg viewBox="%s"' % vb, 1)
    # Fixed width/height would fight the viewBox; the page sizes these in CSS.
    new = re.sub(r'\s(width|height)="[^"]*"', "", new)
    return svg.replace(head, new, 1)


def current_viewbox(svg):
    m = re.search(r'viewBox="([^"]+)"', svg)
    return tuple(float(v) for v in re.split(r"[\s,]+", m.group(1).strip()))


def flip_h(svg):
    """Mirror the drawing left-to-right inside its own viewBox.

    Sources face whichever way their author drew them; on this site every
    vehicle faces right, so one of them has to be turned round. Mirroring about
    the viewBox rather than the origin is what keeps it in frame: the box starts
    at x0, so the axis is at x0 + w/2 and the transform is translate(2*x0 + w)
    then scale(-1, 1)."""
    x0, _, w, _ = current_viewbox(svg)
    head = re.search(r"<svg[^>]*>", svg).group(0)
    open_g = '<g transform="translate(%s 0) scale(-1 1)">' % fmt(2 * x0 + w)
    body = svg.replace(head, head + "\n" + open_g, 1)
    return body[: body.rindex("</svg>")] + "</g>\n</svg>" + body[body.rindex("</svg>") + 6:]


def default_fill_none(svg):
    """Make "no fill stated" mean transparent instead of black.

    SVG's initial fill is BLACK, so a shape that never mentions fill is solid --
    and a colour swap cannot touch it, because there is no colour written down to
    swap. The lorry's two wheels are exactly that: bare <circle r="30.5"> with a
    stroke and nothing else, which came out as two black discs after every
    explicit fill in the file had already been cleared. fill inherits, so
    declaring it on the root fixes every such shape at once, and leaves alone
    every shape that states its own."""
    head = re.search(r"<svg[^>]*>", svg).group(0)
    new = re.sub(r'\sfill="[^"]*"', "", head)
    new = new[:-1].rstrip() + ' fill="none">' if not new.endswith("/>") else new
    return svg.replace(head, new, 1)


def ensure_viewbox(svg):
    """Give the document a viewBox if it only declares width and height.

    Not every source has one -- the taxi's does not -- and everything downstream
    reads geometry out of the viewBox, so without this the drawing fails at the
    first trim rather than at a point that explains itself."""
    if re.search(r'viewBox="[^"]+"', svg):
        return svg
    head = re.search(r"<svg[^>]*>", svg).group(0)
    w = re.search(r'\swidth="([0-9.]+)', head)
    h = re.search(r'\sheight="([0-9.]+)', head)
    if not (w and h):
        raise ValueError("no viewBox and no usable width/height to build one from")
    return set_viewbox(svg, (0.0, 0.0, float(w.group(1)), float(h.group(1))))


def ink_box(svg_path, viewbox):
    """Rasterise and find the bounding box of everything that is not paper,
    returned in viewBox units. sharp is already a dependency of the build."""
    script = (
        "const sharp=require('sharp');"
        "(async()=>{const W=900;"
        "const r=await sharp(process.argv[1]).resize({width:W}).flatten({background:'#ffffff'})"
        ".greyscale().raw().toBuffer({resolveWithObject:true});"
        "const{data,info}=r;let x0=info.width,x1=-1,y0=info.height,y1=-1;"
        "for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){"
        "if(data[y*info.width+x]<245){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}}"
        "console.log(JSON.stringify({x0,x1,y0,y1,w:info.width,h:info.height}));})();"
    )
    out = subprocess.run(["node", "-e", script, svg_path],
                         capture_output=True, text=True, check=True).stdout
    b = json.loads(out)
    vx, vy, vw, vh = viewbox
    sx, sy = vw / b["w"], vh / b["h"]
    return (vx + b["x0"] * sx, vy + b["y0"] * sy,
            (b["x1"] - b["x0"] + 1) * sx, (b["y1"] - b["y0"] + 1) * sy)


def mean_ink(svg_path, height):
    """Average darkness over the drawing's box, 0 = blank, 1 = solid."""
    script = (
        "const sharp=require('sharp');"
        "(async()=>{const r=await sharp(process.argv[1]).resize({height:+process.argv[2]})"
        ".flatten({background:'#ffffff'}).greyscale().raw().toBuffer({resolveWithObject:true});"
        "let s=0;for(const v of r.data)s+=255-v;"
        "console.log(s/(r.data.length*255));})();"
    )
    out = subprocess.run(["node", "-e", script, svg_path, str(height)],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def apply_weight(svg, w):
    """Force every line in the drawing to width w, in the drawing's own units.

    Sources disagree on how they say it: some use presentation attributes, some
    CSS in a style attribute, and one draws its lines as filled shapes with only
    a hairline stroke. So both spellings are rewritten and any filled line shape
    is additionally given a stroke -- that is what thickens fill-based artwork,
    which no stroke-width alone can reach."""
    ws = fmt(w)
    svg = re.sub(r"stroke-width\s*:\s*[0-9.]+", "stroke-width:%s" % ws, svg)
    svg = re.sub(r'stroke-width="[0-9.]+"', 'stroke-width="%s"' % ws, svg)

    def add_stroke(m):
        tag = m.group(0).rstrip()
        if "stroke" in tag:
            return tag
        # Mind the self-closing form: chopping one character off "/>" leaves a
        # stray slash in the middle of the tag and the file stops parsing.
        closing = "/>" if tag.endswith("/>") else ">"
        body = tag[:-len(closing)].rstrip()
        return '%s stroke="%s" stroke-width="%s"%s' % (body, LINE, ws, closing)

    return re.sub(r'<path[^>]*fill="%s"[^>]*>' % LINE, add_stroke, svg)


TRANSFORM_SCALE = re.compile(r"(matrix|scale)\s*\(([^)]*)\)")
NUMBERS = re.compile(r"-?\d*\.?\d+(?:[eE]-?\d+)?")
STROKABLE = {"path", "circle", "ellipse", "rect", "line", "polyline", "polygon", "g"}


def _uniform_scale(transform):
    """How much a transform list shrinks or grows what it contains."""
    total = 1.0
    for m in TRANSFORM_SCALE.finditer(transform or ""):
        nums = [float(n) for n in NUMBERS.findall(m.group(2))]
        if m.group(1) == "scale" and nums:
            sx, sy = nums[0], (nums[1] if len(nums) > 1 else nums[0])
        elif len(nums) >= 4:
            sx = math.hypot(nums[0], nums[1])
            sy = math.hypot(nums[2], nums[3])
        else:
            continue
        total *= math.sqrt(abs(sx * sy)) or 1.0
    return total or 1.0


def apply_weight_scaled(svg, w):
    """Set every line to width w AS DRAWN, compensating for its ancestors.

    apply_weight writes one number into every stroke-width, which is right only
    when nothing is scaled. The lorry nests its wheels inside scale(0.26) groups,
    so that one number came out at a quarter width there and the tractor looked
    like it was missing its front wheel -- the wheel was drawn in full, rim,
    bolts and brand name, just far too faint to see.

    Walking the tree is the only way to know: a stroke-width is expressed in its
    element's own coordinate system, and what that is depends on every transform
    above it."""
    doc = xml.dom.minidom.parseString(svg)

    def walk(node, scale):
        for child in node.childNodes:
            if child.nodeType != child.ELEMENT_NODE:
                continue
            here = scale * _uniform_scale(child.getAttribute("transform"))
            if child.tagName in STROKABLE:
                own = fmt(w / here)
                style = child.getAttribute("style")
                if "stroke-width" in style:
                    child.setAttribute(
                        "style", re.sub(r"stroke-width\s*:\s*[0-9.]+", "stroke-width:" + own, style))
                if child.hasAttribute("stroke-width") or child.tagName != "g":
                    child.setAttribute("stroke-width", own)
            walk(child, here)

    walk(doc.documentElement, _uniform_scale(doc.documentElement.getAttribute("transform")))
    return doc.documentElement.toxml()


def solve_weight(svg, viewbox, tmp_path):
    """Binary search the line width that puts TARGET_INK on the page."""
    lo, hi = 0.0, viewbox[3] * 0.05          # 5% of the drawing's height is plenty
    best = None
    for _ in range(18):
        mid = (lo + hi) / 2
        io.open(tmp_path, "w", encoding="utf-8", newline="\n").write(apply_weight(svg, mid))
        ink = mean_ink(tmp_path, RENDER_H)
        best = (mid, ink)
        if ink > TARGET_INK:
            hi = mid
        else:
            lo = mid
        if abs(ink - TARGET_INK) < 0.0015:
            break
    w = min(max(best[0], MIN_LINE_PX * viewbox[3] / RENDER_H),
            MAX_LINE_PX * viewbox[3] / RENDER_H)
    if w != best[0]:
        io.open(tmp_path, "w", encoding="utf-8", newline="\n").write(apply_weight(svg, w))
        best = (w, mean_ink(tmp_path, RENDER_H))
    return best


def finish(svg, out_name, note, pad=PAD, line_px=None, apply=None):
    """Trim to the ink, set the line weight, label the file and write it.

    Trimming has to come first: until the drawing is cropped to what it actually
    draws, its rendered height is meaningless and so is any weight measured from
    it.

    line_px asks for a stroke of exactly that many pixels at RENDER_H instead of
    searching for one. Equal ink is the right rule for drawings of comparable
    density, but a map is one long contour and a marker is two small ones -- both
    are so sparse that the search always runs into the clamp anyway, and what
    they need is a weight chosen against each other, not against the bike.

    Returns (viewbox, weight, ink, path)."""
    tmp = os.path.join(OUT_DIR, "_tmp-%s.svg" % out_name)
    io.open(tmp, "w", encoding="utf-8", newline="\n").write(svg)
    box = ink_box(tmp, current_viewbox(svg))
    os.remove(tmp)

    px, py = box[2] * pad, box[3] * pad
    svg = set_viewbox(svg, (box[0] - px, box[1] - py, box[2] + 2 * px, box[3] + 2 * py))

    setter = apply or apply_weight
    tmp = os.path.join(OUT_DIR, "_tmp-%s.svg" % out_name)
    if line_px is None:
        weight, ink = solve_weight(svg, current_viewbox(svg), tmp)
    else:
        weight = line_px * current_viewbox(svg)[3] / RENDER_H
        io.open(tmp, "w", encoding="utf-8", newline="\n").write(setter(svg, weight))
        ink = mean_ink(tmp, RENDER_H)
    os.remove(tmp)
    svg = setter(svg, weight)

    head = re.search(r"<svg[^>]*>", svg).group(0)
    svg = svg.replace(head, head + "\n\t" + note.replace("\n", "\n\t").rstrip("\t"), 1)

    path = os.path.join(OUT_DIR, "%s.svg" % out_name)
    io.open(path, "w", encoding="utf-8", newline="\n").write(svg)
    xml.dom.minidom.parse(path)      # never ship what the browser cannot parse
    return current_viewbox(svg), weight, ink, path


def report(name, viewbox, weight, ink, path):
    print("%-14s ratio %.2f  line %6.2f units (%.2f px at %dpx tall)  ink %.3f  %7d bytes"
          % (name, viewbox[2] / viewbox[3], weight, weight * RENDER_H / viewbox[3],
             RENDER_H, ink, os.path.getsize(path)))
