/* reveal-section.js -- scroll-triggered section + feature-list reveals */
"use strict";

function initSectionReveal() {
	// Scroll reveal for sections, via IntersectionObserver plus the is-revealed
	// CSS class. Elements fade in on opacity alone (no movement), staggered in
	// READING ORDER: sorted by rect.top (rows) then rect.left (columns within a
	// row). The trigger is deliberately late (rootMargin -25%) so the user's eye
	// catches the animation.
	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const targets = [];
	document.querySelectorAll("section").forEach((section) => {
		if (section.__sectionRevealInit) return;
		section.__sectionRevealInit = true;
		// Targets: the heading block plus any columns/rows inside it. This covers
		// the section heading, the inner hero and content-grid (any grid).
		// feature-list is handled SEPARATELY (initFeatureListReveal), keyed to the
		// LIST ITSELF entering the viewport rather than the section: in tall
		// sections the list sits far down, so a section trigger would reveal it
		// off-screen and the animation would never be seen.
		const candidates = section.querySelectorAll(
			[".heading_container", ".inner-hero_heading-container", ".content-grid > *"].join(", "),
		);
		if (!candidates.length) return;
		// Sort into reading order (rows top→bottom, columns left→right within a
		// row). The 5px threshold stops elements on the same visual row from being
		// split across different rows.
		const sorted = Array.from(candidates).sort((a, b) => {
			const ra = a.getBoundingClientRect();
			const rb = b.getBoundingClientRect();
			const dy = ra.top - rb.top;
			if (Math.abs(dy) > 5) return dy;
			return ra.left - rb.left;
		});
		const stagger = sorted.length > 6 ? 0.05 : 0.08;
		// A plain stagger — no base-delay logic here. The bump for a Barba arrival
		// is applied separately in bumpSectionRevealDelayForBarba(), AFTER
		// initSectionReveal has finished (see resetPageAfterTransition).
		sorted.forEach((el, i) => {
			el.classList.add("section-reveal");
			el.style.transitionDelay = i * stagger + "s";
		});
		targets.push({ section, items: sorted });
	});
	if (!targets.length) return;
	const reveal = (entryTarget) => {
		const found = targets.find((t) => t.section === entryTarget);
		if (!found) return;
		// Double rAF gives the browser time to paint the .section-reveal initial
		// state (opacity:0) BEFORE .is-revealed (opacity:1) is added. Without it
		// both classes land in the same tick → no transition → the delay is ignored.
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				found.items.forEach((el) => el.classList.add("is-revealed"));
			});
		});
	};
	if (reduceMotion) {
		targets.forEach(({ section }) => reveal(section));
		return;
	}
	const io = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (!entry.isIntersecting) return;
				io.unobserve(entry.target);
				reveal(entry.target);
			});
		},
		{ rootMargin: "0px 0px -25% 0px" },
	);
	targets.forEach(({ section }) => {
		const rect = section.getBoundingClientRect();
		// Reveal immediately for sections already in or above the viewport at init.
		if (rect.bottom < window.innerHeight * 0.75) {
			reveal(section);
		} else {
			io.observe(section);
		}
	});
}
function initFeatureListReveal() {
	// Each <ul.feature-list> reveals when THE LIST ITSELF enters the viewport (its
	// own IntersectionObserver), not when the section does — otherwise in tall
	// sections (a 3300px product card, a task list) the list sits far down and a
	// section trigger would reveal it off-screen, so the animation is never seen.
	// Same CSS (.section-reveal/.is-revealed) and the same stagger as sections.
	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	document.querySelectorAll(".feature-list").forEach((list) => {
		if (list.__featureListRevealInit) return;
		list.__featureListRevealInit = true;
		const items = Array.from(list.querySelectorAll(".feature-list_item"));
		if (!items.length) return;
		const stagger = items.length > 6 ? 0.05 : 0.08;
		items.forEach((el, i) => {
			el.classList.add("section-reveal");
			el.style.transitionDelay = i * stagger + "s";
		});
		const reveal = () => {
			// Double rAF so the browser paints opacity:0 BEFORE is-revealed lands;
			// otherwise both classes hit the same tick → no transition (same as in
			// initSectionReveal).
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					items.forEach((el) => el.classList.add("is-revealed"));
				});
			});
		};
		if (reduceMotion) {
			reveal();
			return;
		}
		const rect = list.getBoundingClientRect();
		if (rect.bottom < window.innerHeight * 0.75) {
			reveal();
		} else {
			const io = new IntersectionObserver(
				(entries) => {
					entries.forEach((entry) => {
						if (!entry.isIntersecting) return;
						io.unobserve(entry.target);
						reveal();
					});
				},
				{ rootMargin: "0px 0px -25% 0px" },
			);
			io.observe(list);
		}
	});
}

// Reveals the above-fold cards in the NEW container after a Barba arrival, with
// a given delay. This bypasses CSS with GSAP to sidestep a transition race, and
// targets the cell children (not the cells themselves) so the grid-line
// background hack does not show through:
//
// (1) A CSS spec quirk: during the transition-delay phase, computed opacity is
//     still the start value (1, the default). After a double rAF (~32ms)
//     initSectionReveal adds .is-revealed → opacity:1, changing the transition
//     target from 0 to 1 DURING the 3s delay. Per spec, if the new target (1)
//     equals the current animated value (1, in the delay phase) the transition
//     is cancelled.
// (2) .content-grid carries its own dark background
//     (--mapped-border-default = grey-200/700) to draw the 1px grid lines via
//     the gap:1px hack. opacity:0 on the cells lets that dark grid background
//     show through as one large dark slab.
//
// The fix: for above-fold cells, drop the .section-reveal/.is-revealed classes
// and clear the inline transition-delay (disabling the CSS mechanism), then
// target cell.children (NOT the cells) with gsap.set opacity:0 + gsap.to
// opacity:1 on a delay. The cells stay visible with their light background and
// only the inner content is hidden.
//
// Below-fold sections are left alone — the IntersectionObserver reveal handles them.
// Above-fold = section.top < viewport.bottom (any part visible at scroll=0).
function bumpSectionRevealDelayForBarba(container, extraSeconds) {
	if (!container || !extraSeconds || !window.gsap) return;
	var vh = window.innerHeight;
	container.querySelectorAll("section").forEach(function (sec) {
		var rect = sec.getBoundingClientRect();
		var isAbove = rect.top < vh;
		// Same selector as beforeEnter pre-hide — skip heading containers
		// (the highlight-marker bars handle their reveal, so they must not be hidden).
		var cells = sec.querySelectorAll(".content-grid > *, .feature-list > .feature-list_item");
		if (!isAbove || !cells.length) return;
		var stagger = cells.length > 6 ? 0.05 : 0.08;
		console.log(
			"[" + performance.now().toFixed(0) + "ms] bumpSection:",
			sec.className.slice(0, 30),
			"—",
			cells.length,
			"cells, base delay:",
			extraSeconds + "s",
		);
		cells.forEach(function (cell, idx) {
			cell.classList.remove("section-reveal");
			cell.classList.remove("is-revealed");
			cell.style.transitionDelay = "";
			var inner = Array.from(cell.children);
			if (!inner.length) return;
			window.gsap.set(inner, { opacity: 0 });
			window.gsap.to(inner, {
				opacity: 1,
				duration: 0.5,
				delay: extraSeconds + idx * stagger,
				ease: "power3.out",
				onComplete: function () {
					window.gsap.set(inner, { clearProps: "opacity" });
					delete cell.dataset.barbaPrehidden;
					if (idx === 0) {
						console.log(
							"[" + performance.now().toFixed(0) + "ms] reveal done (first cell):",
							sec.className.slice(0, 30),
						);
					}
				},
			});
		});
	});
}
