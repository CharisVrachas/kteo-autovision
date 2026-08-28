# Sources for the drawing tools

Kept in the repository so `make-vehicle-drawings.py` and `make-map-drawings.py`
can be re-run. Without them the tools are committed but not runnable, and the
generated SVGs in `public/assets/img/shapes/` could never be regenerated -- to
change the line weight, say, or to re-crop a drawing.

All six are public domain. None asks for attribution; the credit below is a
record of where they came from, not a licence obligation.

| file            | used for              | origin |
|-----------------|-----------------------|--------|
| `moto.svg`      | the motorcycle        | freesvg.org, CC0. Holds two bikes; the tool crops to the top one. |
| `hatchback.svg` | the car AND the taxi  | freesvg.org, CC0. The taxi is this drawing with a roof sign added by the tool. |
| `van.svg`       | the small van         | freesvg.org, CC0 |
| `semired.svg`   | the articulated lorry | freesvg.org, CC0. Filled colour, so the tool outlines it rather than recolouring it. |
| `europe.svg`    | the Europe map        | Wikimedia Commons, "Blank map europe no borders.svg", PUBLIC DOMAIN. Chosen over better-looking maps there because those are CC BY-SA, which would oblige the site to carry a credit and force the same licence onto our derivative. |
| `rhodes.json`   | the island of Rhodes  | Natural Earth 1:10m admin-0 country geometry, public domain. Extracted ring for Rhodes; there is no ready-made public-domain outline of the island. |

Run either tool from the project root:

    python tools/make-vehicle-drawings.py
    python tools/make-map-drawings.py
