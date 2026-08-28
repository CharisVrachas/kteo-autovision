"""Build the map artwork for the second and third pillar cards.

Three drawings come out of this, all in the same fine-line style as the vehicles
(see linework.py, which does the trimming and the line-weight solving):

    map-europe.svg   the European coastline, for "Δίκτυο Autovision"
    map-rhodes.svg   the island of Rhodes, for "Δύο σημεία στη Ρόδο"
    map-pin.svg      one marker, reused on both cards

Provenance, which matters because this is a commercial site:

  * Europe comes from Wikimedia Commons, "Blank map europe no borders.svg",
    released into the PUBLIC DOMAIN. Every other blank Europe map worth using on
    Commons is CC BY-SA, which would oblige the site to carry a credit and would
    force the same licence onto our derivative. This one carries no such string.
  * Rhodes is drawn here from Natural Earth 1:10m country geometry, which is
    explicitly public domain and asks for no attribution. There is no
    ready-made public-domain outline of the island, so the coordinates are
    projected and emitted directly rather than traced from someone's map.
  * The pin is generated from scratch below, so it owes nothing to anyone and
    its line weight can be dictated rather than inherited.

Run from the project root; the sources are vendored in tools/sources:

    python tools/make-map-drawings.py
"""

import io
import json
import math
import os
import re

import linework as lw

# The sources live beside this script so it can be re-run at any time; see
# tools/sources/README.md for where each came from. MAP_SRC overrides it.
SRC = os.environ.get("MAP_SRC") or os.path.join(os.path.dirname(__file__), "sources")

# The Europe source draws its whole landmass as one compound path; everything
# else in the file is a legend, an ocean rectangle and a lakes layer.
EUROPE_PATH_ID = "path4629"
EUROPE_CANVAS = (0, 0, 10494.797, 7944.9995)

# Flattening and simplification tolerance, in the source's own units. The map is
# drawn about 120px tall from a canvas 7945 units high, so a pixel is roughly 66
# units and 60 is still under one. It started at 10 and had to go up, not down:
# the stroke is about 80 units wide, so detail finer than the stroke cannot be
# drawn at all -- it only turns every wiggle into a spike where the line doubles
# back on itself. Keeping the tolerance near the stroke width is what makes the
# coast read as smooth instead of furry, and it cut the file fivefold.
EUROPE_TOLERANCE = 60.0
EUROPE_MIN_ISLAND = 45.0     # drop subpaths smaller than a third of a pixel
STRAIGHT_CUT = 250.0         # a ruled line this long is a map clip, not a coast.
                             # The north-east cut is 358 units and arrives as the
                             # ring's own closing segment, so 400 let it through;
                             # the longest genuine near-straight coast in this
                             # source deviates by 113 units, nowhere near axis-aligned.

# Natural Earth gives Rhodes as longitude/latitude degrees.
RHODES_JSON = "rhodes.json"


# --------------------------------------------------------------------------- #
# Path flattening and simplification
# --------------------------------------------------------------------------- #

NUM = re.compile(r"[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?")
CMD = re.compile(r"([MmLlCcZz])")


def flatten(d, steps=8):
    """Path data -> list of point lists. Only M/L/C/Z, which is all the source
    uses; anything else would silently distort the coastline, so it raises."""
    unknown = set(re.findall(r"[A-Za-z]", d)) - set("MmLlCcZz")
    if unknown:
        raise ValueError("unsupported path commands: %s" % sorted(unknown))
    parts = [p for p in CMD.split(d) if p.strip()]
    rings, cur, pos, start = [], [], (0.0, 0.0), (0.0, 0.0)
    i = 0
    while i < len(parts):
        cmd = parts[i]
        args = []
        if i + 1 < len(parts) and not CMD.fullmatch(parts[i + 1]):
            args = [float(n) for n in NUM.findall(parts[i + 1])]
            i += 2
        else:
            i += 1
        rel = cmd.islower()
        c = cmd.upper()
        if c == "Z":
            if cur:
                cur.append(start)
                rings.append(cur)
                cur = []
            pos = start
            continue
        j = 0
        while j < len(args):
            if c == "M":
                p = (args[j] + (pos[0] if rel else 0), args[j + 1] + (pos[1] if rel else 0))
                if cur:
                    rings.append(cur)
                cur, pos, start = [p], p, p
                j += 2
                c = "L"     # further pairs after an M are implicit linetos
            elif c == "L":
                p = (args[j] + (pos[0] if rel else 0), args[j + 1] + (pos[1] if rel else 0))
                cur.append(p)
                pos = p
                j += 2
            else:  # C
                c1 = (args[j] + (pos[0] if rel else 0), args[j + 1] + (pos[1] if rel else 0))
                c2 = (args[j + 2] + (pos[0] if rel else 0), args[j + 3] + (pos[1] if rel else 0))
                p = (args[j + 4] + (pos[0] if rel else 0), args[j + 5] + (pos[1] if rel else 0))
                for k in range(1, steps + 1):
                    t = k / steps
                    u = 1 - t
                    cur.append((
                        u * u * u * pos[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * p[0],
                        u * u * u * pos[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * p[1],
                    ))
                pos = p
                j += 6
    if cur:
        rings.append(cur)
    return rings


def simplify(points, tol):
    """Douglas-Peucker. Keeps the shape's corners and throws away the rest."""
    if len(points) < 3:
        return points
    ax, ay = points[0]
    bx, by = points[-1]
    dx, dy = bx - ax, by - ay
    span = math.hypot(dx, dy)
    worst, index = -1.0, 0
    for i in range(1, len(points) - 1):
        px, py = points[i]
        if span < 1e-12:
            dist = math.hypot(px - ax, py - ay)
        else:
            dist = abs(dy * px - dx * py + bx * ay - by * ax) / span
        if dist > worst:
            worst, index = dist, i
    if worst <= tol:
        return [points[0], points[-1]]
    return simplify(points[:index + 1], tol)[:-1] + simplify(points[index:], tol)


def ring_size(points):
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return math.hypot(max(xs) - min(xs), max(ys) - min(ys))


def on_edges(p, canvas, eps):
    """Which of the canvas's four sides this point sits on, if any."""
    x0, y0, w, h = canvas
    hits = set()
    if abs(p[0] - x0) < eps:
        hits.add("L")
    if abs(p[0] - (x0 + w)) < eps:
        hits.add("R")
    if abs(p[1] - y0) < eps:
        hits.add("T")
    if abs(p[1] - (y0 + h)) < eps:
        hits.add("B")
    return hits


def strip_frame(ring, canvas, eps=2.0):
    """Cut out the segments that run along the edge of the source map.

    The landmass was clipped to a rectangle when the map was made, so Russia and
    north Africa end in dead-straight lines down the canvas border. Those lines
    are part of the same closed path as the coastline, and drawn as an outline
    they read as a stray box around the continent. Any segment whose two ends sit
    on the SAME border is one of them; what is left is emitted as open coastline
    rather than a closed ring.

    Returns a list of (points, closed) pairs."""
    n = len(ring) - 1
    border = []
    axis = []
    length = []
    for i in range(n):
        a, b = ring[i], ring[i + 1]
        border.append(bool(on_edges(a, canvas, eps) & on_edges(b, canvas, eps)))
        dx, dy = abs(b[0] - a[0]), abs(b[1] - a[1])
        axis.append(dx < 0.5 or dy < 0.5)
        length.append(math.hypot(dx, dy))

    # Not every cut lies on the canvas border: this source also clips the north
    # east along a line set in from it, at y = 12.4. So catch the shape of a cut
    # rather than its position -- but measure it over a RUN of segments, because
    # in the source a single 358-unit rule is carved into dozens of little ones,
    # none of which is long enough to look suspicious on its own. A run of
    # axis-aligned segments totalling hundreds of units is a ruled line; real
    # coastline is never straight for that far at this resolution.
    ruled = [False] * n
    i = 0
    while i < n:
        if not axis[i]:
            i += 1
            continue
        j = i
        total = 0.0
        while j < n and axis[j]:
            total += length[j]
            j += 1
        if total > STRAIGHT_CUT:
            for k in range(i, j):
                ruled[k] = True
        i = j

    keep = [not (border[i] or ruled[i]) for i in range(n)]
    if all(keep):
        return [(ring, True)]
    runs, cur = [], []
    for i, ok in enumerate(keep):
        if ok:
            if not cur:
                cur = [ring[i]]
            cur.append(ring[i + 1])
        elif len(cur) >= 2:
            runs.append((cur, False))
            cur = []
        else:
            cur = []
    if len(cur) >= 2:
        runs.append((cur, False))
    return runs


def to_path(rings, places=1):
    def n(v):
        return ("%.*f" % (places, v)).rstrip("0").rstrip(".") or "0"
    out = []
    for item in rings:
        r, closed = item if isinstance(item, tuple) else (item, True)
        out.append("M%s %s" % (n(r[0][0]), n(r[0][1])))
        out.extend("L%s %s" % (n(x), n(y)) for x, y in r[1:])
        if closed:
            out.append("Z")
    return "".join(out)


def svg_document(viewbox, body):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s" fill="none">\n%s\n</svg>\n'
            % (" ".join(lw.fmt(v) for v in viewbox), body))


# --------------------------------------------------------------------------- #
# The three drawings
# --------------------------------------------------------------------------- #

def build_europe():
    src = io.open(os.path.join(SRC, "europe.svg"), encoding="utf-8", errors="replace").read()
    tag = re.search(r'<path\b[^>]*id="%s"[^>]*>' % EUROPE_PATH_ID, src, re.S).group(0)
    d = re.search(r'\sd="([^"]*)"', tag, re.S).group(1)
    # The landmass sits inside one layer group; fold its translate into the
    # points rather than keeping a <g>, so the output is a single flat path.
    g = re.search(r"<g\b[^>]*transform=\"translate\(([-\d.]+),([-\d.]+)\)\"", src, re.S)
    ox, oy = (float(g.group(1)), float(g.group(2))) if g else (0.0, 0.0)

    rings = []
    for raw in flatten(d):
        moved = [(x + ox, y + oy) for x, y in raw]
        for piece, closed in strip_frame(moved, EUROPE_CANVAS):
            if ring_size(piece) < EUROPE_MIN_ISLAND:
                continue                   # specks, invisible at any size we draw this
            s = simplify(piece, EUROPE_TOLERANCE)
            if len(s) >= (3 if closed else 2):
                rings.append((s, closed))

    # Round joins for the same reason as the tolerance: at this stroke width a
    # mitre on a tight corner shoots out into a spike several pixels long.
    body = ('\t<path d="%s" fill="none" stroke="%s" stroke-width="8"'
            ' stroke-linejoin="round" stroke-linecap="round"/>' % (to_path(rings), lw.LINE))
    note = ("<!-- Europe, from Wikimedia Commons \"Blank map europe no borders.svg\"\n"
            "     (PUBLIC DOMAIN), rebuilt by tools/make-map-drawings.py: the filled\n"
            "     landmass turned into an outline, curves flattened and simplified to\n"
            "     %g units, specks dropped. Do not hand edit; re-run the script. -->\n"
            % EUROPE_TOLERANCE)
    return svg_document(EUROPE_CANVAS, body), note, len(rings)


def build_rhodes():
    ring = json.load(open(os.path.join(SRC, RHODES_JSON), encoding="utf-8"))
    lats = [p[1] for p in ring]
    # Equirectangular, with longitudes squeezed by cos(latitude). Without that
    # the island comes out about 20% too wide at this latitude.
    k = math.cos(math.radians(sum(lats) / len(lats)))
    pts = [(p[0] * k * 1000.0, -p[1] * 1000.0) for p in ring]
    if pts[0] != pts[-1]:
        pts.append(pts[0])
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    box = (min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys))
    body = ('\t<path d="%s" fill="none" stroke="%s" stroke-width="4"'
            ' stroke-linejoin="round" stroke-linecap="round"/>'
            % (to_path([pts], places=2), lw.LINE))
    note = ("<!-- Rhodes, drawn from Natural Earth 1:10m country geometry (PUBLIC\n"
            "     DOMAIN) by tools/make-map-drawings.py. Equirectangular, longitudes\n"
            "     scaled by cos(latitude) so the island is not 20%% too wide. Do not\n"
            "     hand edit; re-run the script. -->\n")
    return svg_document(box, body), note, len(pts)


def build_pin():
    """A map marker: a disc on a point, with a hole.

    Drawn rather than borrowed. The outline is the two tangents from the tip to
    the head, closed by the major arc over the top, which is what gives a pin
    its shoulders instead of a lollipop's abrupt join."""
    R, H = 10.0, 25.5                 # head radius, tip-to-centre distance
    L = math.sqrt(H * H - R * R)      # tangent length
    tx, ty = R * L / H, -H + R * R / H
    outline = ("M0 0L%s %s" % (lw.fmt(-tx), lw.fmt(ty)) +
               "A%s %s 0 1 1 %s %sZ" % (lw.fmt(R), lw.fmt(R), lw.fmt(tx), lw.fmt(ty)))
    hole = "M0 %s A%s %s 0 1 1 0 %s A%s %s 0 1 1 0 %s Z" % (
        lw.fmt(-H - R * 0.4), lw.fmt(R * 0.4), lw.fmt(R * 0.4),
        lw.fmt(-H + R * 0.4), lw.fmt(R * 0.4), lw.fmt(R * 0.4), lw.fmt(-H - R * 0.4))
    body = ('\t<path d="%s" fill="none" stroke="%s" stroke-width="2"/>\n'
            '\t<path d="%s" fill="none" stroke="%s" stroke-width="2"/>'
            % (outline, lw.LINE, hole, lw.LINE))
    note = ("<!-- Map marker, generated by tools/make-map-drawings.py. Not borrowed\n"
            "     from anywhere, so its weight is dictated rather than inherited.\n"
            "     Do not hand edit; re-run the script. -->\n")
    return svg_document((-R - 2, -H - R - 2, 2 * R + 4, H + R + 4), body), note, 2


# Chosen against each other rather than measured, for the reason in
# linework.finish(): the coastlines read as background the marker stands on, so
# they are drawn finer than the vehicles and the markers heavier, which is what
# separates the two layers on a card only 170px across.
LINE_PX = {"europe": 1.15, "rhodes": 1.15, "pin": 2.05}


def main():
    for name, build in (("europe", build_europe), ("rhodes", build_rhodes), ("pin", build_pin)):
        svg, note, count = build()
        lw.report("%s (%d)" % (name, count),
                  *lw.finish(svg, "map-%s" % name, note, line_px=LINE_PX[name]))


if __name__ == "__main__":
    main()
