/* logo-cycle.js — the two brand marks in the navbar, cross-fading.
 *
 * The bar carries both the AUTOVISION wordmark and the ΚΤΕΟ Ρόδου one. They sit
 * in the same CSS grid cell (see .nav_logo-stack in components/nav.css), so the
 * panel is sized by the wider of the two and neither moves as they swap — the
 * alternative, absolute positioning, would collapse the container's width.
 *
 * Each is held for three seconds, then cross-faded over 0.6s.
 *
 * Wiring, as with the rest: app.js calls this on every page rather than once at
 * DOMContentLoaded. The navbar itself survives a Barba swap, so the per-element
 * guard is what stops a second timeline being stacked on the first — two
 * timelines on the same images would fight and flicker.
 */
"use strict";

function initLogoCycle() {
	if (typeof gsap === "undefined") return;

	document.querySelectorAll("[data-logo-cycle]").forEach((stack) => {
		if (stack.__logoCycleInit) return;
		const marks = Array.from(stack.querySelectorAll("img"));
		if (marks.length < 2) return;
		stack.__logoCycleInit = true;

		// A brand mark swapping itself out on a timer is decoration, and this is
		// the kind of unprompted movement the setting asks to be spared. The
		// first mark stays put.
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			gsap.set(marks.slice(1), { autoAlpha: 0 });
			return;
		}

		gsap.set(marks, { autoAlpha: 0 });
		gsap.set(marks[0], { autoAlpha: 1 });

		const HOLD = 3;
		const FADE = 0.6;
		const tl = gsap.timeline({ repeat: -1 });
		marks.forEach((mark, i) => {
			const next = marks[(i + 1) % marks.length];
			tl.to(mark, { autoAlpha: 0, duration: FADE, ease: "power2.inOut" }, "+=" + HOLD).to(
				next,
				{ autoAlpha: 1, duration: FADE, ease: "power2.inOut" },
				"<",
			);
		});
		stack.__logoCycleTl = tl;
	});
}
