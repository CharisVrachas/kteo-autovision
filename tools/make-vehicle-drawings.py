"""Normalise the three CC0 vehicle drawings into the site's fine-line style.

The three sources are public-domain (CC0) SVGs from freesvg.org. They are good
drawings but they do not agree with each other: different canvases, different
padding, one of them holds two copies of the bike, and each encodes its lines
differently -- one as filled compound paths, one as hairline strokes, one as
thick strokes over white fills. This script makes them one set:

  * crops away everything but the wanted vehicle,
  * recolours every dark line to the site grey,
  * drops the paper and shading fills, so each drawing is transparent and the
    section shows through it the way it does through the bike,
  * trims each drawing to its own ink and rewrites the viewBox, so all three
    can be laid out from a single height.

The trimming, the line-weight solving and the writing live in linework.py,
which tools/make-map-drawings.py shares, so both cards' artwork comes out at
the same weight.

Run from the project root; the sources are vendored in tools/sources:

    python tools/make-vehicle-drawings.py
"""

import io
import json
import os
import re
import subprocess

import linework as lw

# name -> (source file, viewBox crop, outline mode, mirror left-right)
#
# outline mode is for sources drawn as FILLED colour rather than as linework.
# Dropping their fills leaves nothing and keeping them leaves a silhouette, so
# instead every filled region is turned into its own contour -- the same
# treatment the Europe map gets in make-map-drawings.py. The articulated lorry
# is the only vehicle that needs it, and it is the reason that lorry exists at
# all: every public-domain line drawing of one is a schematic icon.
SOURCES = {
    "moto": ("moto.svg", (0, 0, 608, 330), False, False),   # the file holds two bikes; keep the top one
    "car": ("hatchback.svg", None, False, False),
    "van": ("van.svg", None, False, False),
    # For the deadline cards on the homepage. The taxi is the SAME drawing as the
    # car, with a roof sign added below. That is deliberate: no public-domain taxi
    # line drawing exists at this quality, and every other saloon that does is
    # drawn by a different hand -- next to the car it read as a different set.
    # The two never appear together anyway; the deadline cards are a pinned stack
    # showing one at a time, and the sign is what tells them apart.
    "taxi": ("hatchback.svg", None, False, False),
    "lorry": ("semired.svg", None, True, True),
}

# One width for the whole set, in pixels at linework.RENDER_H.
#
# linework solves for equal INK by default, which is the better rule in theory:
# the bike carries hundreds of lines and the van a few dozen, so at one width the
# bike reads as the heavier drawing. But these are seen one at a time in a pinned
# stack, not compared side by side, and what actually shows is that one drawing
# is drawn with a finer pen than the next. Equal width is what was asked for and
# what reads as one hand.
LINE_PX = 1.25

NOTE = ("<!-- Vehicle drawing, CC0 (public domain) from freesvg.org, normalised by\n"
        "     tools/make-vehicle-drawings.py: cropped to its own ink, dark lines\n"
        "     recoloured to %s and every paper or shading fill dropped, so the\n"
        "     drawing is transparent. Do not hand edit; re-run the script. -->\n" % lw.LINE)


def remap(match):
    """Dark -> the line grey. Everything lighter -> nothing at all.

    The sources paint their paper and their shading as solid light fills. Left
    in, the van reads as a white cut-out sitting on the section rather than a
    drawing on it, and it does not match the bike, which never had a fill to
    begin with. Dropping them to `none` makes all three genuinely transparent --
    which is only safe because the three are spaced not to overlap.

    Do not tighten DARK_MAX to chase the car's solid tyres: that drawing's body
    outline is itself a mid grey, and a stricter threshold erases the whole car
    and leaves the wheel hubs floating. Measured, not guessed."""
    return lw.LINE if lw.luminance(match.group(0)) < lw.DARK_MAX else "none"


def recolour(svg):
    svg = lw.HEX.sub(remap, svg)
    # Named colours the sources also use.
    svg = re.sub(r"\b(black|#000)\b", lw.LINE, svg)
    # Gradient fills survive a colour swap untouched, because the colour lives in
    # a <stop> somewhere else in the file. The van paints its glass and lamps
    # with five of them, which is enough to keep it looking solid after every
    # flat fill has already gone. Only fills: a gradient on a stroke would be a
    # line, and dropping that would delete part of the drawing.
    svg = re.sub(r"fill\s*:\s*url\(#[^)]*\)", "fill:none", svg)
    svg = re.sub(r'fill="url\(#[^)]*\)"', 'fill="none"', svg)

    # A <rect> filled with the line colour is not line art -- line art is paths.
    # The van hides two of them (103x116 and 55x60) under its wheel arches as
    # shadow blocks. They were invisible only because white shapes sat on top,
    # so removing the paper turned them into two solid slabs.
    def blank_rect(m):
        return re.sub(r"fill\s*:\s*%s" % lw.LINE, "fill:none",
                      re.sub(r'fill="%s"' % lw.LINE, 'fill="none"', m.group(0)))

    return re.sub(r"<rect[^>]*>", blank_rect, svg, flags=re.S)


def outline_all(svg):
    """Turn a filled illustration into a line drawing.

    Every fill becomes none and every shape gains a contour, so what was a block
    of colour becomes its edge. Only for sources that were never linework: run on
    a drawing that already has lines and it doubles them."""
    svg = re.sub(r"fill\s*:\s*[^;\">\s]+", "fill:none", svg)
    svg = re.sub(r'fill="[^"]*"', 'fill="none"', svg)
    svg = re.sub(r"stroke\s*:\s*[^;\">\s]+", "stroke:%s" % lw.LINE, svg)
    svg = re.sub(r'stroke="[^"]*"', 'stroke="%s"' % lw.LINE, svg)

    def add(m):
        tag = m.group(0).rstrip()
        if "stroke" in tag:
            return tag
        closing = "/>" if tag.endswith("/>") else ">"
        return '%s stroke="%s" stroke-width="1"%s' % (tag[:-len(closing)].rstrip(), lw.LINE, closing)

    svg = re.sub(r"<path[^>]*>", add, svg)

    # Blur filters have to go. The source used them for drop shadows, which is
    # fine under a solid body but fatal to a hairline: the lorry's front wheel
    # carried one and simply faded out, so the tractor looked like it was
    # missing a wheel.
    svg = re.sub(r"\sfilter\s*=\s*\"url\([^)]*\)\"", "", svg)
    svg = re.sub(r"filter\s*:\s*url\([^)]*\)\s*;?", "", svg)

    # And every partial opacity goes back to full, so one line is not paler than
    # the next. opacity:0 is left alone -- that is a shape the author hid, and
    # reviving it would draw something that was never meant to be seen.
    svg = re.sub(r'(opacity\s*[:=]\s*"?)(0?\.\d+)', lambda m: m.group(1) + "1", svg)
    return svg


def roof_line(svg, name):
    """Where the highest ink sits, in viewBox units: (x_centre, y_top).

    Found by rasterising rather than by reading the path data, because the
    source is a 3/4 view whose roof is not the first thing in the file and not
    the extreme of any single path."""
    tmp = os.path.join(lw.OUT_DIR, "_tmp-roof-%s.svg" % name)
    io.open(tmp, "w", encoding="utf-8", newline="\n").write(svg)
    script = (
        "const sharp=require('sharp');"
        "(async()=>{const r=await sharp(process.argv[1]).resize({height:500})"
        ".flatten({background:'#ffffff'}).greyscale().raw().toBuffer({resolveWithObject:true});"
        "const{data,info}=r;let y0=-1,lo=info.width,hi=-1;"
        "for(let y=0;y<info.height&&y0<0;y++)for(let x=0;x<info.width;x++)"
        "if(data[y*info.width+x]<200){y0=y;break;}"
        # The roof's width is measured a little BELOW its apex, where the curve
        # has opened out; at the apex itself it is a single pixel and the centre
        # would be meaningless.
        "const band=Math.min(info.height-1,y0+Math.round(info.height*0.06));"
        "for(let x=0;x<info.width;x++)if(data[band*info.width+x]<200){if(x<lo)lo=x;if(x>hi)hi=x;}"
        "console.log(JSON.stringify({y0,lo,hi,w:info.width,h:info.height}));})();"
    )
    out = subprocess.run(["node", "-e", script, tmp], capture_output=True, text=True, check=True).stdout
    os.remove(tmp)
    b = json.loads(out)
    vx, vy, vw, vh = lw.current_viewbox(svg)
    return (vx + (b["lo"] + b["hi"]) / 2 * vw / b["w"], vy + b["y0"] * vh / b["h"], vw, vh)


def add_taxi_sign(svg, name):
    """Put a roof sign on the car, so it reads as a taxi rather than a car.

    Drawn here instead of sourced: there is no public-domain taxi line drawing
    of any quality, and the sign is the one thing that carries the meaning. It
    is a plain rounded box on the roof -- which is what a taxi sign is, and what
    survives being drawn 1px wide."""
    cx, top, vw, vh = roof_line(svg, name)
    # Size the sign from ONE dimension and give it its own fixed proportion.
    # Taking the width off vw and the height off vh sounds symmetrical but is
    # not: it hands the sign the car's aspect ratio, so on a long saloon it came
    # out nearly five times wider than tall -- a stripe, not a sign.
    h = vh * 0.075
    w = h * 2.2
    r = h * 0.3
    x, y = cx - w / 2, top - h
    # Make room above the roof first. The sign is drawn OUTSIDE the source's
    # viewBox -- a drawing is usually cropped tight to the car -- and anything
    # outside it is not rendered at all, so the trim that follows never saw the
    # sign and cut it off at the roofline.
    vx, vy, _, _ = lw.current_viewbox(svg)
    headroom = h * 1.4
    svg = lw.set_viewbox(svg, (vx, vy - headroom, vw, vh + headroom))
    d = ("M%s %sh%sa%s %s 0 0 1 %s %sv%sa%s %s 0 0 1 %s %sh%sa%s %s 0 0 1 %s %sv%sa%s %s 0 0 1 %s %sZ"
         % (lw.fmt(x + r), lw.fmt(y), lw.fmt(w - 2 * r), lw.fmt(r), lw.fmt(r), lw.fmt(r), lw.fmt(r),
            lw.fmt(h - 2 * r), lw.fmt(r), lw.fmt(r), lw.fmt(-r), lw.fmt(r), lw.fmt(-(w - 2 * r)),
            lw.fmt(r), lw.fmt(r), lw.fmt(-r), lw.fmt(-r), lw.fmt(-(h - 2 * r)), lw.fmt(r), lw.fmt(r),
            lw.fmt(r), lw.fmt(-r)))
    sign = '<path d="%s" fill="none" stroke="%s" stroke-width="1" stroke-linejoin="round"/>' % (d, lw.LINE)
    return svg.replace("</svg>", "\t" + sign + "\n</svg>", 1)


def main():
    # The sources live beside this script so it can be re-run at any time; see
    # tools/sources/README.md for where each came from. VEHICLE_SRC overrides it.
    src_dir = os.environ.get("VEHICLE_SRC") or os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "sources")
    for name, (filename, crop, outline, flip) in SOURCES.items():
        svg = io.open(os.path.join(src_dir, filename), encoding="utf-8", errors="replace").read()
        svg = lw.set_viewbox(svg, crop) if crop else lw.ensure_viewbox(svg)
        svg = outline_all(svg) if outline else recolour(svg)
        if flip:
            svg = lw.flip_h(svg)
        svg = lw.default_fill_none(svg)
        svg = lw.thin_precision(svg)
        if name == "taxi":
            svg = add_taxi_sign(svg, name)
        # Outlined sources nest parts inside scaled groups, so their stroke width
        # has to be worked out per element rather than written once.
        setter = lw.apply_weight_scaled if outline else None
        lw.report(name, *lw.finish(svg, "vehicle-%s" % name, NOTE, line_px=LINE_PX, apply=setter))


if __name__ == "__main__":
    main()
