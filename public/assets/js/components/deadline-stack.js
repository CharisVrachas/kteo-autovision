/* deadline-stack.js — Orisa's card-stacking scroll, transferred.
 *
 * Source: Orisa v1.1.0, main.js §51 "scroll-section card stacking". The two
 * functions below are Orisa's, unchanged — same zIndex pass, same pin, same
 * 'top top' start, same items.length * 50% distance, same scrub, same
 * scale 0.9 / yPercent 0 pairing on the '<' position.
 *
 * The only thing added is the wiring this project needs, and it is kept outside
 * those functions on purpose:
 *
 *   - Orisa runs initScrollSectionStack() once, off DOMContentLoaded. Barba
 *     swaps <main> without a reload, so that would fire on the first page and
 *     never again. Here app.js calls initDeadlineStack() on every page instead.
 *   - Barba kills every ScrollTrigger before a transition and the init pass runs
 *     again after, so the guard flag below stops a second timeline being built
 *     on a section that already has a live one.
 *
 * Note the section is pinned at 'top top', exactly as in Orisa — which parks it
 * under this site's fixed navbar. That is corrected in CSS (padding-top on
 * .scroll-section, in site.css) rather than by moving the start value, so this
 * file stays a faithful copy.
 */
"use strict";

function initScrollSectionStack() {
	const scrollSection = document.querySelectorAll(".scroll-section");
	scrollSection.forEach((section) => {
		if (section.closest(".section-fix")) return;
		if (!section.classList.contains("is-stacked")) return; // added by this project — see initDeadlineStack
		const wrapper = section.querySelector(".wrapper");
		const items = wrapper ? wrapper.querySelectorAll(".item") : [];
		if (!items.length) return;
		let direction = section.classList.contains("horizontal-section") ? "horizontal" : "vertical";
		initScroll(section, items, direction);
	});
}

function initScroll(section, items, direction) {
	// Initial states + z-index so stacked absolute items show in correct order (current on top)
	items.forEach((item, index) => {
		gsap.set(item, { zIndex: index });
		if (index !== 0) {
			direction == "horizontal" ? gsap.set(item, { xPercent: 100 }) : gsap.set(item, { yPercent: 100 });
		}
	});

	const timeline = gsap.timeline({
		scrollTrigger: {
			trigger: section,
			pin: true,
			start: "top top",
			end: () => `+=${items.length * 50}%`,
			scrub: 1,
			invalidateOnRefresh: true,
			// markers: true,
		},
		defaults: { ease: "none" },
	});
	items.forEach((item, index) => {
		timeline.to(item, {
			scale: 0.9,
		});

		direction == "horizontal"
			? timeline.to(
					items[index + 1],
					{
						xPercent: 0,
					},
					"<",
				)
			: timeline.to(
					items[index + 1],
					{
						yPercent: 0,
					},
					"<",
				);
	});
}

/**
 * This project's entry point into the two functions above.
 *
 * It also decides WHETHER to stack. A pinned section has no internal scroll: if
 * the card is taller than the space between the navbar and the bottom of the
 * screen, the rest of it is simply unreachable for the whole pinned range. That
 * is a real case here and not in Orisa -- the cards carry a navbar clearance on
 * top, and Greek titles run to two lines -- so on a short screen the section is
 * left as a plain vertical list, which the CSS falls back to whenever
 * .is-stacked is absent.
 */
function initDeadlineStack() {
	if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;
	document.querySelectorAll(".scroll-section").forEach((section) => {
		if (section.__deadlineStackInit) return;
		section.__deadlineStackInit = true;

		const cards = section.querySelectorAll(".process-card");
		if (cards.length < 2) return;
		let tallest = 0;
		cards.forEach((c) => {
			tallest = Math.max(tallest, c.getBoundingClientRect().height);
		});
		const reserved = parseFloat(getComputedStyle(section).paddingTop) || 0;
		// A little slack rather than an exact fit: mobile browsers grow and shrink
		// the viewport as their chrome collapses, and a card that clears by 5px
		// standing still will not clear it once the address bar comes back.
		if (reserved + tallest + 32 > window.innerHeight) return; // leave it as a list

		section.classList.add("is-stacked");
	});
	initScrollSectionStack();
}
