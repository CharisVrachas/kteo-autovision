# ΙΚΤΕΟ Autovision Ρόδου

Website for **ΙΚΤΕΟ ΔΩΔΕΚΑΝΗΣΟΥ Α.Ε.**, which runs two private vehicle
inspection centres on Rhodes — Ασγούρου and Τσαϊρι, with a third announced for
Αφάντου — as part of the AUTOVISION network.

Rebuilt from [kteo-rodos.gr](https://kteo-rodos.gr) with
[Astro](https://astro.build). Static output: no server, no database, no client
framework. `npm run build` produces a folder you can put behind any static host.

---

## Quick start

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # → dist/
npm run preview  # serve dist/ locally
npm run check    # TypeScript + Astro diagnostics
```

---

## Structure

```
src/
  data/                  everything that appears in more than one place
    site.ts              company details, the branches, hours, milestones, deadlines
    navigation.ts        the menu — bar, mobile panel and footer read this one array
    privacy.ts           the privacy policy, verbatim
  components/
    Nav.astro            bar + mobile panel, both generated from navigation.ts
    Footer.astro
    Preloader.astro
    ui/                  Button, Field, Select, Eyebrow, Bracket, Consent, FormFeedback
    sections/            InnerHero, Cta, Branches, Scroller
  layouts/
    Base.astro           the one page shell: head, nav, footer, script chain
  pages/                 one file per route
public/
  assets/                CSS, fonts, images, the animation stack, the 3D stage
```

### Routes

URLs match the old WordPress site, so inbound links and search results keep
resolving without redirects. That is what `trailingSlash: "always"` and
`build.format: "directory"` in `astro.config.mjs` are for.

| Route | Holds |
| --- | --- |
| `/` | hero, what the company does, the figures, the 3D inspection stage, the statutory deadlines, both centres, opening hours, contact form |
| `/company/` | company profile and the timeline from 2002 |
| `/kteo-reminder/` | sign-up for an inspection-deadline reminder |
| `/online-calculator/` | "when is my KTEO due" calculator, plus the deadlines in prose |
| `/online-rantevou/` | hand-off to Autovision's central booking system |
| `/contact-us/` | contact form, both centres, opening hours |
| `/privacy-policy/` | the company's own privacy policy |

### What was removed

The template shipped for a different site and carried a lot this one does not
use. Everything below was removed after checking it against the built output —
no page, stylesheet or script here is unreferenced:

- **8 stylesheets** whose selectors matched nothing: `logo`, `result-card`,
  `case-card`, `technology`, and the route sheets `products`, `case`,
  `product`, `engineering`. Verified by measuring every section before and
  after — the layout is pixel-identical.
- **`zoom.js` + `zoom.css`** and the empty lightbox container: nothing on the
  site is marked `data-click-zoom`.
- **`initImageSlider`** (no galleries) and **`initCaseCardHover`** (no case
  cards), leaving the rest of their files intact.
- **`charts.js`** and, critically, the `initLazyCharts()` call left behind in
  `app.js`. That call threw on every page load, which stopped `boot()` before
  `initBarba()` — page transitions were dead site-wide until it was removed.
- **6 shape SVGs** and the stock OG image, none of them referenced.
- Two dangling `url()`s inside the template's own CSS that pointed at images
  this project never had.

### Utility bar

The old site carried a thin strip above the menu with both phone lines and a
“Βρείτε μας στον χάρτη” link, on every page. The template has no such strip, so
it is added in `site.css` rather than edited into the vendor sheet.

Only its **height** has to be shared with the rest of the design: `.nav`, the
mobile panel’s `top`, `.section_inner-hero`’s `padding-top`, the sticky scroller
and `--layout-section-viewport` all measure the fixed bar off
`--layout-nav-height`. Folding the strip into that one token keeps every one of
them correct without touching any of them; `.nav-container` then owns the height
of the menu row alone.

### Brand: typeface and palette

The design is the bought template’s; the **brand** is the client’s, taken from
the original site:

| | Original | Here |
| --- | --- | --- |
| Typeface | Roboto | Roboto, self-hosted |
| Primary | `#164194` Autovision blue | `--brand-blue-500` |
| Secondary | `#e7453a` Autovision red | `--brand-red-500` |

**Roboto** is served from `public/assets/fonts/` as four woff2 subsets with the
same `unicode-range` split Google uses — Greek is the one that matters here and
is preloaded first, since every heading on the site is Greek. The template’s own
ABC Monument Grotesk was removed.

**The palette** is swapped at a single hook. `base.css` routes every accent
through `--alias-brand-*`, so redefining those ten steps in `site.css` moves the
whole site and leaves the template’s orange ramp untouched underneath.

Two things did not follow from that, and both are worth knowing before editing
colours here:

- **A custom property is substituted where it is *declared*, not where it is
  inherited.** `--mapped-surface-action: var(--alias-brand-500)` is declared on
  `:root`, so it resolves against `:root` no matter which section inherits it.
  Overriding the alias further down the tree does nothing — the *mapped* tokens
  have to be restated. The same applies again to the `--button-*` layer, which
  is its own `:root` block on top of the mapped one.
- **On dark sections the ramp is lifted one step.** `#164194` against the
  near-black page is 1.8:1, so a button in it reads as a floating white label
  with no visible edge. The hue is kept exactly; only the lightness moves. The
  light sections — where the original site lives, on white — use `#164194`
  unchanged.

Heading **weights** are still the template’s (400), not the original’s 600.
Changing that is a one-line edit to `--brand-weight-regular` in `base.css` if
the headings want more presence.

### Where the design lives

The visual system — roughly 300 KB of CSS and the GSAP/Lenis/Barba animation
stack — is a bought template, kept intact under `public/assets/`. It is **not**
bundled by Astro, deliberately:

- **The CSS order is load-bearing.** `base.css` first (its utilities set
  `display` on classes the components override at *equal* specificity), and
  `heading-reveal.css` last (it hides headings until JS reveals them, so it has
  to win over everything above). `Base.astro` documents this where the `<link>`
  tags are emitted.
- **The scripts are classic scripts sharing globals, not modules.** `core.js`
  declares values the component files read, and `app.js` calls every `init*()`.
  So: `core.js` first, `app.js` last, and no `defer` on any of them. Bundling
  would break that chain and gain nothing — the files are already minified and
  version-pinned.

### The deadline card stack

The statutory-deadline cards on the homepage are Orisa’s “about section 2”
(`services-3.html`), transferred rather than reimplemented: the list pins to the
viewport and each card slides up over the one before, which shrinks behind it.

| File | What it is |
| --- | --- |
| `public/assets/css/vendors/orisa-process-scroll.css` | Orisa’s rules, lifted out of its built CSS |
| `public/assets/js/components/deadline-stack.js` | Orisa’s `initScrollSectionStack` / `initScroll`, unchanged |
| `src/components/sections/Deadlines.astro` | Orisa’s markup, with this site’s copy and images |

**`.orisa-embed` is the whole trick.** Orisa is Bootstrap-based and claims
generic class names — `.container`, `.row`, `.item`, `.wrapper`, `.h5` — that
this project’s template already uses for other things. Left global they would
fight on every page. So the extraction prefixes every selector with
`.orisa-embed` and changes nothing else: declarations are byte-for-byte Orisa’s,
and they only apply inside the one wrapper that opts in.

Regenerate the stylesheet with `scratchpad/rodos/extract_orisa.py` rather than
editing it by hand. It also pulls across Orisa’s base `p` rule — easy to miss,
because `.process-card__desc` never restates font-size or weight and quietly
inherits 16px/500 from it. Without that the paragraph falls back to this site’s
14.2px/400 and the card reads wrong.

The block sits inside the template's own `container > .padding`, not full-bleed.
Those two elements are where the section's vertical rules live — `.padding`
carries a 1px border left and right — and where its width comes from, so wrapping
the Orisa block in them makes the band read as one continuous section with the
heading above rather than a panel dropped into it. `is-none` drops the padding's
own vertical space and `is-border-btn-none` its bottom rule, so the line does not
cut across mid-section.

Its background is the section's own. Three were stacking before: the section's
light surface behind the heading, Orisa's base `body` rule (`#fefefe`) on
`.orisa-embed`, and a grey panel on `.sec-2-about` from an earlier pass — the
seams ran straight across the page. Both of Orisa's are cleared in `site.css`.

Three adjustments live in `site.css`, all about the host page rather than the
section, so the lifted files stay clean:

- **The pin start.** Orisa pins at `top top`, and its page has no fixed header
  there; this one does, so the cards would sit behind the navbar for the whole
  pinned scroll. `padding-top` on `.scroll-section` clears it without touching
  Orisa’s start value.
- **The typeface.** Everything else about the type is Orisa’s — sizes, weights,
  tracking, colours — but the family stays Roboto, from kteo-rodos.gr. A second
  face in one section would read as a mistake.

Checked against the live Orisa page at 1280×720: card padding and background,
column widths, row flex and gutters, header direction and border, title size /
weight / tracking / colour, description size / weight / line-height / colour /
max-width / line-clamp, meta gap and padding, icon size and radius, and the
item positioning all match.

**Fitting the cards on screen.** A pinned section has no internal scroll, so
whatever does not fit is unreachable for the whole pinned range. Orisa never
hits this — its four images share one landscape crop and its English titles run
to one line. Ours do neither, so `site.css` adds three things:

- The image is pinned to 16/10, the ratio Orisa’s own images work out to.
  `kteo-tsairi-entrance.jpg` is portrait and was driving the card past the
  bottom of the screen. `width: 100%` on that box is load-bearing: with width
  left auto, an aspect-ratio box that also has a max-height gets resolved from
  the height side, and the browser made it wider than the column holding it.
- Two lines are reserved for the title and the meta line on phones. “02.
  ΔΙΚΥΚΛΟ / ΤΡΙΚΥΚΛΟ / ΤΕΤΡΑΚΥΚΛΟ” wraps where the other four titles do
  not, which made that card taller and the stack jump as it arrived.
- `deadline-stack.js` measures before it commits. If the card plus the navbar
  clearance will not fit the viewport, it never adds `.is-stacked` and the
  section stays an ordinary vertical list — which is what happens below roughly
  700px of viewport height.

**The cards must not eat clicks below the section.** Orisa gives every item after
the first `position: absolute` and `min-height: 100vh` inside a `.wrapper` only
as tall as one card, so the items hang far below it — at 1440×900 the wrapper
ends at 487px and the last item reaches 1360px. That overhang is invisible but
still hit-tested, and it sat straight over the “Υπολογίστε την προθεσμία
σας” button at 1220–1307: the button read as dead because the pointer was
hitting a card. `pointer-events: none` on the items, `auto` on the cards, fixes
it without touching the geometry the animation depends on.

Verified at twelve viewport sizes from 320×480 to 1920×1080: five cards, equal
height, fully on screen in whichever mode applies, no horizontal overflow, and
the button hit-tested at five points down its height.

The card images are photographs of the centres, not of each vehicle class —
swap them in `deadlines` in `src/data/site.ts` when there is proper imagery.

### The centres, as Orisa’s portfolio grid

The three inspection centres on the homepage are Orisa’s “Home 2 Section 6”
(`index-2.html`), transferred the same way the deadline cards were:

| File | What it is |
| --- | --- |
| `public/assets/css/vendors/orisa-portfolio.css` | Orisa’s rules, lifted from its built CSS, every selector scoped to `.orisa-portfolio` |
| `public/assets/js/components/orisa-portfolio.js` | Orisa’s §20 and §38 timelines, unchanged |
| `src/components/sections/BranchPortfolio.astro` | Orisa’s markup, with this site’s content |

Regenerate the stylesheet with `scratchpad/rodos/extract_orisa_portfolio.py`.

**The row structure is the effect.** Orisa puts **two items per row**, and the
diagonal comes from each column’s offset plus a negative `margin-top` on the
second and third variants. Giving each item its own row — the first attempt here
— produced a column of cards with large gaps and no stagger at all. Measured
against the original at 1280 wide, the rows are: title, items 1+2, items 3+4,
items 5+6, closing text. There are three centres, so rows 1–3 are used and the
fourth slot keeps the decorative shapes Orisa parks there. The diagonal still
reads: 454 → 834 → 74.

Its title block came across too, worded for this site, which is why the section’s
old `heading_container` was removed rather than kept — the two said the same
thing. That block is also what §18 pins and flies diagonally across the section.

Two things needed adapting to this site’s material:

- **The photographs are landscape; Orisa’s six are all the same portrait crop**
  (356×425 measured). Its negative margins were authored against cards of that
  height, so landscape thumbnails collapsed them to a third and pulled the
  diagonal apart. `site.css` pins the ratio; the crop is Orisa’s own
  `object-fit: cover`.
- **Bootstrap declares its tokens on `:root,[data-bs-theme=light]`,** not a bare
  `:root`. The extractor matched the selector exactly and so captured none of the
  `--bs-*` variables — `.rounded-5` resolved to nothing and the panel had square
  corners. Both stylesheets were regenerated once that was fixed.

Two of the section’s behaviours are deliberately left behind, and
`orisa-portfolio.js` says so at the top:

- **§17 `at-hover-item`** is a WebGL displacement hover needing the `hoverEffect`
  library and an `.at-hover-img` wrapper. Neither exists here, and the markup
  carries no such wrapper — in Orisa itself this code finds nothing to bind.
- **§18** pins Orisa’s own `.portfolio-text` heading and flies it across the
  section. This page keeps its own heading, so there is nothing to pin.

### The technical line drawing

`public/assets/img/shapes/process-car.svg` is a hidden-line projection of
**`car.glb` — the same model the 3D stage renders**, so the drawing and the
scroll scene are literally the same car. It replaced the template’s stock oil-rig
illustration.

It was produced by loading the GLB in the browser, taking `EdgesGeometry` at a
26° threshold per mesh, projecting every edge through a three-quarter camera and
writing the result as one `<path>` — 29,631 segments, in the rig’s own
`stroke="#747576"`, `stroke-width="0.3"`, `opacity="0.6"`. No renderer is
involved: `Vector3.project()` is pure matrix maths, so none of it needs WebGL.

To reshoot it, change the camera in that script and re-run — the parameters are
`cam.position`, `lookAt`, the fov, and the edge threshold.

### The 3D stage

`public/assets/kteo-stage/` is the scroll-driven inspection scene on the
homepage — a three.js build with its own Draco decoder and `car.glb`. It loads
as ES modules, separately from the chain above, and waits for `window.__lenis`
so it does not start a second smooth-scroll instance.

Its captions live in `public/assets/kteo-stage/content.js` — edit that file, not
the engine.

The buttons around it are **not** the component's own. `kteo-mount.js` hides
those and rebuilds them out of this template's `.button`, so they pick up its
hover wipe and focus ring; their labels are the `UI` object at the top of that
file. They are anchors without an `href` — they scroll rather than navigate —
which is why `site.css` has to give them `cursor: pointer`, since a bare `<a>`
does not get one.

The callout chips are placed by projecting points off the model, so they landed
on whatever this page happens to fix over the stage: the navbar's logo panel at
the top, and the stage's own buttons in the lower corners. The stage now clamps
them between a ceiling and a floor it reads from `--kc-chip-top-inset` and
`--kc-chip-bottom-inset` on its own element, which the page sets from
`--layout-nav-clearance` and the button height. Both allow for half a chip,
since chips are centred on their clamp point. Unset, the component behaves
exactly as before, so it stays droppable into a page with no fixed chrome.

Both are read once per resize, not per frame, and through a hidden probe element
rather than `getComputedStyle`. That detail is not optional: a **custom property
computes to its token**, so `getPropertyValue("--kc-chip-bottom-inset")` hands
back the string `"7.5em"` and `parseFloat` turns it into `7.5`, while
`calc(... + 1.75em)` parses as `NaN`. Both clamps silently fell back to their
defaults and the chips carried on landing behind the header and the buttons.
Assigning the variable to a real `height` and measuring the element is what makes
the browser do the arithmetic, in whatever unit the page wrote it in.

---

## Editing

| To change | Edit |
| --- | --- |
| A phone number, address, or centre | `src/data/site.ts` |
| Opening hours | `openingHours` in `src/data/site.ts` |
| The menu, anywhere it appears | `src/data/navigation.ts` |
| The company timeline | `milestones` in `src/data/site.ts` |
| The statutory deadlines | `deadlines` in `src/data/site.ts` **and** `KTEO_RULES` in `public/assets/js/components/kteo-tools.js` — they state the same rules, one in prose and one in arithmetic |
| The privacy policy | `src/data/privacy.ts` |
| The 3D scene's captions | `public/assets/kteo-stage/content.js` |
| The preloader's timings, including the logo intro | `CFG` at the top of `public/assets/js/components/preloader.js` |

A centre announced but not open yet is marked `upcoming: true` in `branches`.
It then shows as a notice rather than a card, and is left off the map — that is
what `openBranches` filters for.

### Lifting a section from Orisa — the three traps

Three sections now come from that template, and each one hit the same handful of
problems. They are worth knowing before a fourth is added:

1. **Every scope arrives painted white.** The extraction carries Orisa’s base
   `body` rule, and that rule sets `background-color: #FEFEFE`. It caught the
   deadlines band, the portfolio grid and the opening-hours cards in turn.
   `site.css` now clears all three scopes in one rule.
2. **A class with no rule fails silently.** The extractor only keeps selectors it
   is told to want, so `offset-xxl-9` and `justify-content-center` were in the
   markup with no CSS behind them — a card simply flowed where it landed and the
   row never centred. If a Bootstrap utility does not seem to work, check it is
   in the extractor’s `WANTED` set before looking anywhere else.
3. **The stylesheet has to be linked.** `orisa-process-cards.css` was generated,
   scoped and correct, and left out of `Base.astro` — the cards rendered with no
   styling at all.

### The map section is gone

The template’s globe of the two centres has been removed, along with everything
that served it: `Branches.astro`, `globe.js`, `globe.css` and the lazily-loaded
`mapbox-gl` pair — **1.7 MB** of assets for a section that never had a token and
so rendered an empty band on the homepage and on `/company/`. Both pages already
list the centres in full: the portfolio grid on one, the cards and the footer
strip on the other.

To bring a map back, the addresses and coordinates are still in `branches`.

### The preloader

Homepage only, skipped entirely under `prefers-reduced-motion`. Every timing is a
named constant in `CFG` at the top of `preloader.js`.

It shows on **every full page load**, not once per session, and runs for about
two seconds. That is a deliberate pair: it is the site's first frame of branding,
and Barba handles navigation between pages without a reload, so it only costs on
a genuine load — an arrival, a refresh, a link from outside. `ALWAYS_SHOW: false`
restores the once-per-session behaviour.

Its blue cell carries nothing but the mark. The status lines it used to show
(“παρακαλώ περιμένετε”, “φορτώνει…”) are gone and the mark takes their room,
capped in `vh` as well as `em` so it cannot overflow a short window.

When the curtain finishes lifting the sequence calls `ScrollTrigger.refresh()`,
twice. Removing the preloader, mounting the 3D stage and settling the hero video
all change the document height *after* every ScrollTrigger has measured itself,
which leaves anything below the fold armed against stale positions.

The mark sits on a white panel — the file is a JPG on a white
ground, so it gets the same treatment as in the navbar rather than showing a
white rectangle against the blue. Its intro is a GSAP timeline: the panel wipes
open from the left on `clip-path`, the mark eases out of an overshoot behind it
so it reads as being uncovered rather than sliding in, and a slow scale drift
keeps it alive for the seconds the fill takes. `stopLogo()` settles it back onto
its resting values when the reveal starts — without that the mark is caught
mid-drift as the curtain lifts.

Two details that are easy to get wrong: the resting `clip-path` has to be
declared in CSS or GSAP has nothing to tween from, and the panel needs
`width: fit-content` because `.preloader__head` is a block — `align-self` does
nothing there, and the panel stretches into a full-width band.

The blue cell is `display: none` below 768px, as it was before, so the mark shows
on tablet and desktop only.

---

## Content notes

**Greek and `lang="el"`.** The design uppercases most headings, and Greek drops
the tonos when it goes to capitals — ΕΛΕΓΧΟΣ, not ΈΛΕΓΧΟΣ. Browsers apply that
rule only to text they know is Greek, so the `lang` attribute is doing real
work, not bookkeeping.

**Booking is not on this site.** The AUTOVISION network runs one central booking
system for every member centre, so `/online-rantevou/` explains what the visitor
will be asked for and links out to it, rather than reimplementing a form whose
data has nowhere to go. The target is `site.bookingUrl`.

**The calculator** answers in the browser. Its form deliberately does **not**
carry `.cta-form`: `forms.js` wires every `.cta-form` to POST, and this one has
nothing to send.

---

## Responsive

Checked at **320, 375, 768, 1024 and 1280px** across all seven routes: no
horizontal overflow anywhere, and every multi-column grid collapses to one
column on a phone. The only content wider than the viewport is the branch
carousel, which is a deliberate horizontal scroller with its own prev/next
buttons.

Three things were fixed in that pass:

| Issue | Fix |
| --- | --- |
| The hero is centred with `justify-content`, so the padding that clears the fixed navbar moved its centre by half of itself — the block sat low and the button reached the bottom of the frame | Pad **both** sides equally: the content box shrinks symmetrically, so its middle stays on the viewport’s middle, and a block tall enough to reach the top still stops at the clearance |
| Two full clearances plus the template’s own `.padding` (171px) did not fit a short window — 1127px of content in a 768px one | Below 950px tall the reservation is capped against the viewport and the heading steps down a size |
| Dead centre put the first heading line close enough to the logo panel’s point to read as touching it | `--hero-drop`, a small bias added to the top padding only. Half of it lands as an offset from centre, so it is 17–32px depending on the size — enough air to separate the two, not enough to look like the block has slipped |
| Form fields were 14px, so iOS Safari zooms the page on focus and never zooms back | 16px below 768px, in `site.css` |
| The bar's booking button is `display:none` on mobile, and the slide-down menu did not list it — the site's primary action was unreachable from the menu on a phone | Added to the mobile panel, marked out in the accent colour |
| The "Οδηγίες →" map links were ~20px tall | 44px touch target on touch devices only, via `@media (hover: hover)` |

**The odometer counts up every time.** Its roll is `once: true` — the timeline
drives roller markup that `onComplete` tears down again, so it cannot simply be
replayed. A second, cheap ScrollTrigger watches for the user leaving the group
upwards and re-arms it: clearing the init flag and calling the initialiser again
rebuilds that one group from the number `onComplete` put back. It is guarded on
the roll having finished, because scrolling out mid-roll leaves the markup in
place and rebuilding from that would parse the markup as the value.

`assets/css/site.css` holds these and the other rules this project adds on top
of the template — keeping them in one file makes it obvious which CSS is ours
and which came with the design.

---

## Still to do

| What | Where |
| --- | --- |
| **`/api/contact` does not exist.** The contact and reminder forms fail until `ENDPOINT` points at a real handler. Forms tag themselves with `data-form-source` (`cta`, `contacts`, `reminder`, `footer-subscribe`) so one endpoint can tell them apart | `public/assets/js/components/forms.js` |
| **Open Graph image** falls back to a photo of the Ασγούρου centre; a purpose-made 1200×630 image would frame better | `site.ogImage` in `src/data/site.ts` |
| The Αφάντου coordinates are approximate — replace them once the address is fixed | `branches` in `src/data/site.ts` |
| The hero still uses the template's stock video | `public/assets/video/main-framerate.*` |

---

## Licence

The site content and photography belong to ΙΚΤΕΟ ΔΩΔΕΚΑΝΗΣΟΥ Α.Ε. The template's
vendor bundles under `public/assets/js/` ship under their own licences — GSAP,
Lenis, Barba, Mapbox GL JS, three.js. The car model in the 3D stage is CC BY 4.0;
its attribution file must ship with it
(`public/assets/kteo-stage/assets/models/ATTRIBUTION.txt`).
