/* orisa-journey.js — the drift on the journey timeline's rows.
 *
 * Source: Orisa v1.1.0, main.js §48 "scroll-move-up animation", used by
 * "About section 2" of about-1.html. Each row is pulled 100px upward on a
 * scrub as it comes past, so the list opens out as you scroll it.
 *
 * The body is Orisa's; only the jQuery length check is dropped (this project
 * has no jQuery) and a per-element guard added, because app.js runs the init
 * on every page rather than once — Barba swaps <main> without a reload.
 *
 * The other effect on that section, `.scale-img-from-to` on the photograph,
 * needs nothing here: orisa-portfolio.js already binds it by class, site-wide.
 */
"use strict";

function initOrisaJourney() {
	if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

	// Orisa's §54: the vertical rule beside the list, drawn downward as the
	// block comes past. querySelectorAll rather than its querySelector, so a
	// page with more than one of these still gets both.
	document.querySelectorAll(".orisa-journey .journey-list-wrap").forEach((wrap) => {
		if (wrap.__orisaLineInit) return;
		const line = wrap.querySelector(".journey-list-line");
		if (!line) return;
		wrap.__orisaLineInit = true;
		gsap.set(line, { height: 0 });
		gsap.to(line, {
			height: "100%",
			ease: "none",
			scrollTrigger: {
				trigger: wrap,
				start: "top 80%",
				end: "bottom 60%",
				scrub: 1.2,
				invalidateOnRefresh: true,
			},
		});
	});

	document.querySelectorAll(".orisa-journey .scroll-move-up").forEach((el) => {
		if (!el || el.__orisaMoveUpInit) return;
		el.__orisaMoveUpInit = true;
		gsap.to(el, {
			y: -100,
			duration: 1.5,
			scrollTrigger: {
				trigger: el,
				start: "top 70%",
				scrub: 1,
				markers: false,
			},
		});
	});
}
