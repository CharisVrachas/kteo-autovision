/* index.js — the door into the stage.

   Drop the whole `kteo-stage/` folder into a site and point it at an empty
   element. That is the entire integration:

       <section id="stage"></section>
       <script type="module">
         import { mountKteoStage } from "/kteo-stage/index.js";
         mountKteoStage("#stage");
       </script>

   Or skip the script entirely and let the markup do it:

       <section data-kteo-stage></section>
       <script type="module" src="/kteo-stage/index.js"></script>

   Two things the previous version made the host page get right, and this one
   works out for itself:

     · **where the folder lives.** `import.meta.url` is the URL of this file, so
       the folder it sits in is known without being told. A hand-written
       `basePath` was the single most common way to mount a broken stage — it
       only shows up as a 404 on a model, halfway down a scroll.
     · **the stylesheet.** It is injected from next to this file and awaited
       before anything is built. The waiting matters: chip widths are measured
       once, and a chip measured before its CSS lands measures as wide as its
       text, which puts every leader line in the wrong place for the life of
       the page.

   The car is rendered live in WebGL. There is no baked-frame path: measured on
   this scene, a 120-frame sequence at 1920x1080 is 9.7 MB against 1.5 MB for the
   live stage, and it would freeze the content — every caption edit would need a
   re-bake. See the README for the full comparison.

   The script itself lives in content.js. These files are the machinery.

   Options — all optional
     basePath   override the folder location. Only needed if you serve these
                files from somewhere other than where this module sits.
     css        false to skip the stylesheet injection and link it yourself
     lenis      an existing Lenis instance to ride. Defaults to window.__lenis
                if the host already runs one, otherwise a private instance
     debug      false to keep window.__kteo clean
*/

/** Where this folder sits, worked out from this module's own URL. */
export const BASE = new URL("./", import.meta.url).href;

const injected = new Map();

/** Add the stylesheet once and resolve when it has actually applied. */
function ensureStylesheet(href) {
	if (injected.has(href)) return injected.get(href);
	const existing = document.querySelector(`link[rel="stylesheet"][href="${href}"]`);
	if (existing) {
		injected.set(href, Promise.resolve());
		return injected.get(href);
	}
	const link = document.createElement("link");
	link.rel = "stylesheet";
	link.href = href;
	link.dataset.kteoStage = "";
	const done = new Promise((resolve) => {
		link.addEventListener("load", resolve, { once: true });
		// A stylesheet that 404s must not wedge the mount for ever. The stage
		// still builds — it just looks unstyled, which is visible and reported,
		// rather than a blank section with no explanation.
		link.addEventListener(
			"error",
			() => {
				console.warn("[kteo-stage] stylesheet did not load:", href);
				resolve();
			},
			{ once: true },
		);
	});
	document.head.appendChild(link);
	injected.set(href, done);
	return done;
}

/**
 * Mount the stage into `target`.
 * @param {Element|string} target element, or a selector for one
 * @param {object} [opts]
 * @returns {Promise<object>} handle with `dispose()`
 */
export async function mountKteoStage(target, opts = {}) {
	const el = typeof target === "string" ? document.querySelector(target) : target;
	if (!el) throw new Error(`[kteo-stage] no element matched ${JSON.stringify(target)}`);

	const basePath = opts.basePath ? new URL(opts.basePath, location.href).href : BASE;
	if (opts.css !== false) await ensureStylesheet(basePath + "kteo-stage.css");

	const options = { ...opts, basePath };
	try {
		const { mountLive } = await import("./stage-live.js");
		return await mountLive(el, options);
	} catch (err) {
		// Mounting is async, so anything thrown in here becomes an unhandled
		// rejection: the stage stops half-built and the page shows an empty
		// canvas with the chips stranded wherever the stylesheet left them. Say
		// what happened, on the page and in the console, so the next failure is
		// five seconds of reading rather than an evening of guessing.
		console.error("[kteo-stage] the stage failed to mount:", err);
		const status = el.querySelector(".kc-status");
		if (status) status.textContent = "Σφάλμα φόρτωσης — δες την κονσόλα";
		throw err;
	}
}

/** Mount every `[data-kteo-stage]` on the page. Runs itself on import. */
export function autoMount(root = document) {
	return Promise.all(
		[...root.querySelectorAll("[data-kteo-stage]")]
			.filter((el) => !el.dataset.kteoMounted)
			.map((el) => {
				el.dataset.kteoMounted = "1";
				// data-debug="false" — attributes mirror the options
				const opts = {};
				if (el.dataset.debug === "false") opts.debug = false;
				return mountKteoStage(el, opts);
			}),
	);
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", () => autoMount(), { once: true });
} else {
	autoMount();
}
