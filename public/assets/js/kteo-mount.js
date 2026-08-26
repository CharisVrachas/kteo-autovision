/* kteo-mount.js -- mounts the KTEO stage into this template.

   The component auto-mounts anything marked `data-kteo-stage` the moment it is
   imported. That is wrong here for two reasons, so the section is marked with
   an id instead and mounted from this file:

     1. LENIS. The stage rides window.__lenis when the host page already runs
        one, and starts a private instance when it does not. This template does
        run one -- core.js sets window.__lenis -- but only inside boot(), which
        waits on the dynamic import of Lenis. A module script is deferred, so it
        can easily win that race, and the stage would then start a SECOND Lenis
        on the same document. Two of them fight over the scroll and the page
        judders. So: wait for window.__lenis, then mount.

     2. BARBA. Navigation swaps <main>, which destroys the stage's DOM and
        leaves its WebGL context, rAF loop and resize listeners running against
        detached nodes. Dispose on the way out, mount again on the way back.

   CHROME. The component draws its own buttons, scroll hint and progress ticks.
   They are hidden (see assets/css/components/kteo-stage.css) and this file
   rebuilds the drill-string scene's chrome instead -- the SAME markup that
   bundle generated, byte for byte, so the rules already sitting in
   assets/css/pages/home-extra.css and assets/css/components/button.css style it
   with no new CSS at all. Restyling the component's own buttons only ever gets
   close; reusing .button gets the hover wipe, the arrow glyph, the focus ring
   and the active state exactly. */

import { mountKteoStage } from "/assets/kteo-stage/index.js";

const SECTION = "#kteo-stage";

/* Numbers lifted from the original readout so it behaves identically:
   48 squares in rows of four, the arrow travelling 172px over the grid, one row
   every 15px, and the arrow's own centring offset. */
const SQUARES = 48;
const ARROW_TRAVEL = 172;
const ROW_PITCH = 15;
const ARROW_OFFSET = 9;

/* Plain words, no arrow glyphs. The .button component draws the arrow itself in
   .button__text::before -- an SVG mask, sized off --button-icon-size -- and
   home-extra.css mirrors it with scaleX(-1) for #back-cta so it points the other
   way. Putting an arrow in the label too, as an earlier pass did, gets you two:
   the drawn one and a stray character beside it. */
const UI = { skip: "Παράλειψη", back: "Από την αρχή", scroll: "Κύλιση" };

let handle = null;
let mounting = false;
let chrome = null;
let rafId = 0;

/** Resolve once the template's Lenis exists, or give up and let the stage make
    its own. core.js creates it in boot(); if that never runs -- gsap missing,
    a thrown init -- waiting for ever would mean no car at all. */
function waitForLenis(timeout = 8000) {
	if (window.__lenis) return Promise.resolve(window.__lenis);
	return new Promise((resolve) => {
		const t0 = performance.now();
		const poll = () => {
			if (window.__lenis) return resolve(window.__lenis);
			if (performance.now() - t0 > timeout) {
				console.warn("[kteo] window.__lenis never appeared; the stage will run its own");
				return resolve(null);
			}
			requestAnimationFrame(poll);
		};
		poll();
	});
}

/** One .button, in the exact shape the template's CSS expects: two stacked
    copies of the label, each over its own background, which the stylesheet
    wipes between on hover. No JS -- initButtonHover only touches .button-wrap. */
function ctaButton(id, label) {
	const wrap = document.createElement("div");
	wrap.id = id;
	wrap.innerHTML =
		'<a class="button" role="button" tabindex="0" aria-label="' +
		label +
		'"><div class="button__default"><div class="button__bg is--default"></div>' +
		'<div class="button__text">' +
		label +
		'</div></div><div class="button__hover"><div class="button__bg is--hover"></div>' +
		'<div class="button__text">' +
		label +
		"</div></div></a>";
	return wrap;
}

function buildChrome(lenis, section, total) {
	const skip = ctaButton("skip-cta", UI.skip);
	const back = ctaButton("back-cta", UI.back);

	const hint = document.createElement("div");
	hint.id = "scroll-hint";
	hint.innerHTML =
		'<div class="scroll-hint__chev"></div><div class="scroll-hint__chev"></div>' +
		'<div class="scroll-hint__chev"></div><span class="scroll-hint__text">' +
		UI.scroll +
		"</span>";

	const depth = document.createElement("div");
	depth.id = "depth-ui";
	let sq = "";
	for (let i = 0; i < SQUARES; i++) sq += '<div class="depth-sq"></div>';
	depth.innerHTML =
		'<div class="depth-grid">' +
		sq +
		'</div><div class="depth-arrow"><svg xmlns="http://www.w3.org/2000/svg" ' +
		'viewBox="0 0 68 18" preserveAspectRatio="none"><path d="M60 0H0V18H60L67.5 9L60 0Z" ' +
		'fill="#FE5B2A"/></svg><span>01 / ' +
		String(total).padStart(2, "0") +
		"</span></div>";

	// The originals were fixed-position and lived on <body>, not inside the
	// section, so that is where these go too -- the CSS that positions them
	// assumes it.
	document.body.append(skip, back, hint, depth);

	const goTo = (y) =>
		lenis && typeof lenis.scrollTo === "function"
			? lenis.scrollTo(y, { duration: 1.1 })
			: window.scrollTo({ top: y, behavior: "smooth" });

	const end = () => section.offsetTop + section.offsetHeight - window.innerHeight;
	const start = () => section.offsetTop;

	const wire = (wrap, to) => {
		const a = wrap.querySelector(".button");
		a.addEventListener("click", (e) => {
			e.preventDefault();
			goTo(to());
		});
		a.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				goTo(to());
			}
		});
	};
	wire(skip, end);
	wire(back, start);

	return {
		nodes: [skip, back, hint, depth],
		hint,
		depth,
		squares: [...depth.querySelectorAll(".depth-sq")],
		arrow: depth.querySelector(".depth-arrow"),
		label: depth.querySelector(".depth-arrow span"),
	};
}

/** Drive the chrome from the page's own scroll over the stage's track.

    Deliberately not read from the stage's internals: `state.active` is the stop
    the camera has arrived at, which holds still through each flight, while the
    grid is meant to creep. Scroll position over the track is the honest source
    and forces no layout -- both measurements are cached and refreshed on
    resize only. */
function drive(section, c, total) {
	let top = 0;
	let span = 1;
	const remeasure = () => {
		top = section.getBoundingClientRect().top + window.scrollY;
		span = Math.max(1, section.offsetHeight - window.innerHeight);
	};
	remeasure();
	window.addEventListener("resize", remeasure);

	let lastOn = -1;
	let lastStop = -1;
	let lastVis = null;

	const frame = () => {
		rafId = requestAnimationFrame(frame);

		// The chrome is fixed to the viewport, so it has to disappear when the
		// section does -- otherwise the buttons float over the sections above
		// and below it.
		const r = section.getBoundingClientRect();
		const visible = r.top < window.innerHeight * 0.5 && r.bottom > window.innerHeight * 0.5;
		if (visible !== lastVis) {
			for (const n of c.nodes) n.style.visibility = visible ? "" : "hidden";
			lastVis = visible;
		}
		if (!visible) return;

		const p = Math.min(1, Math.max(0, (window.scrollY - top) / span));

		// same fade curve the drill scene used: gone by 6% in
		c.hint.style.opacity = String(Math.min(1, Math.max(0, (1 - p) / 0.06)));

		const n = p * ARROW_TRAVEL;
		c.arrow.style.top = n - ARROW_OFFSET + "px";

		const on = Math.round(p * SQUARES);
		if (on !== lastOn) {
			for (let i = 0; i < c.squares.length; i++) {
				c.squares[i].classList.toggle("is-on", Math.floor(i / 4) * ROW_PITCH + 3.5 <= n);
			}
			lastOn = on;
		}

		const stop = Math.min(total, Math.max(1, Math.ceil(p * total) || 1));
		if (stop !== lastStop) {
			c.label.textContent =
				String(stop).padStart(2, "0") + " / " + String(total).padStart(2, "0");
			lastStop = stop;
		}
	};
	frame();

	return () => {
		cancelAnimationFrame(rafId);
		window.removeEventListener("resize", remeasure);
	};
}

/** Compile the scene before the user reaches it.

    The stage's frame loop only draws while its track is on screen:

        if (rect.top < innerHeight && rect.bottom > 0) render();

    which is right, but it means the FIRST draw of the whole page happens at the
    exact moment the section scrolls into view -- and a first draw is not a
    normal draw. It compiles a shader program for every material, uploads every
    texture to the GPU and builds the shadow map, all on the main thread, all in
    one frame. With this car's PBR set that is seconds of frozen page on
    integrated graphics, landing precisely when the user is mid-scroll.

    So do it early instead, while the browser is idle and the section is still
    far below. compileAsync (three r152+) uses KHR_parallel_shader_compile where
    the driver has it, so the compile itself does not block; the single render()
    after it is what forces the texture uploads and the shadow pass. Both are
    harmless off-screen -- the canvas is not visible yet.

    Idempotent and best-effort: if anything here throws, the stage still works,
    it just pays the old cost on arrival. */
function warmUp(h) {
	if (!h || !h.renderer || !h.scene || !h.camera || typeof h.render !== "function") return;

	let done = false;
	const run = async () => {
		if (done) return;
		done = true;
		try {
			if (typeof h.renderer.compileAsync === "function") {
				await h.renderer.compileAsync(h.scene, h.camera);
			} else if (typeof h.renderer.compile === "function") {
				h.renderer.compile(h.scene, h.camera);
			}
			h.render();
		} catch (err) {
			console.warn("[kteo] warm-up skipped:", err);
		}
	};
	const schedule = () =>
		"requestIdleCallback" in window
			? requestIdleCallback(run, { timeout: 2500 })
			: setTimeout(run, 600);

	// mountLive does NOT await the model: the GLB is loaded with `.then(...)`
	// and the car is added to its group inside that callback. Compiling here and
	// now would therefore compile an empty scene on a fast machine and the real
	// one on a slow machine, which is the worst kind of bug — it works when you
	// test it. Wait for the group to have children.
	const t0 = performance.now();
	const waitForCar = () => {
		if (h.car && h.car.children && h.car.children.length) return schedule();
		if (performance.now() - t0 > 20000) return; // model never arrived; leave it
		setTimeout(waitForCar, 150);
	};
	waitForCar();
}

let stopDriving = null;

async function mount() {
	if (handle || mounting) return;
	const section = document.querySelector(SECTION);
	if (!section) return;
	mounting = true;
	try {
		const lenis = await waitForLenis();
		// Barba may have swapped the page out from under us while we waited.
		if (!document.querySelector(SECTION)) return;
		handle = await mountKteoStage(section, { debug: false });
		const total = (handle && handle.STOPS && handle.STOPS.length) || 8;
		chrome = buildChrome(lenis || handle.lenis, section, total);
		stopDriving = drive(section, chrome, total);
		warmUp(handle);
	} catch (err) {
		console.error("[kteo] mount failed:", err);
	} finally {
		mounting = false;
	}
}

function dispose() {
	if (stopDriving) {
		stopDriving();
		stopDriving = null;
	}
	if (chrome) {
		for (const n of chrome.nodes) n.remove();
		chrome = null;
	}
	if (handle && typeof handle.dispose === "function") {
		try {
			handle.dispose();
		} catch (err) {
			console.warn("[kteo] dispose failed:", err);
		}
	}
	handle = null;
}

/* Barba is initialised last in boot(), so it may not exist yet when this module
   evaluates. Attach when it shows up, and keep the retry cheap. */
function hookBarba(attempt = 0) {
	if (window.barba && window.barba.hooks) {
		window.barba.hooks.beforeLeave(dispose);
		window.barba.hooks.afterEnter(() => mount());
		return;
	}
	if (attempt < 40) setTimeout(() => hookBarba(attempt + 1), 250);
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", () => mount(), { once: true });
} else {
	mount();
}
hookBarba();

window.addEventListener("pagehide", dispose);
