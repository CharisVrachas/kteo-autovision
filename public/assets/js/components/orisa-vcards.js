/* orisa-vcards.js — Orisa's stacking-card scroller, ported as it stands.
 *
 * Source: Orisa v1.1.0, main.js §32 "section-fix (pin section-title + stacking
 * cards)". Two of its sections use it and both are ported here:
 *
 *   · "Home 3 Section 4"        (index-3.html)         → the three centres
 *   · "Services details sec 3"  (services-details.html) → the company profile
 *
 * The mechanic: `.section-fix` is pinned for `items.length * 50`% of scroll,
 * the first `.item` is visible and the rest are parked at yPercent 100, and the
 * timeline walks through them — each card scales to 0.9 as the next slides up
 * over it. `onUpdate` marks the current card and the matching nav row `.active`.
 *
 * The body below is Orisa's, unchanged: same distances, same eases, same
 * `.active` bookkeeping. What differs is only the wiring around it:
 *
 *   · a per-element guard, because app.js calls this on every page rather than
 *     once at DOMContentLoaded (Barba swaps <main> without a reload);
 *   · Orisa's own `ScrollTrigger.addEventListener('scroll', …)` re-check is
 *     kept, but registered once per section rather than once per call, so
 *     repeated page loads do not pile listeners up;
 *   · the pin is confined to (min-width: 992px) with gsap.matchMedia. Below
 *     that the two Bootstrap columns are already stacked, and pinning a
 *     full-height card stack on a phone traps the scroll for five viewports
 *     with the left-hand title off screen. On small screens the cards are laid
 *     out one after another instead (see orisa-vcards.css).
 */
"use strict";

/* Publish the navbar's real height, in pixels, as --nav-clearance-px on <html>.
 *
 * --layout-nav-clearance is written in em: `calc(4.375em + 2.5em + 1.9em +
 * 0.75em)`, which is correct everywhere it inherits the page's own font size.
 * The Orisa scopes do not -- their lifted `body` rule pins font-size to 16px --
 * so inside them the very same token resolved to 152px while the navbar and the
 * logo panel below it actually reached 201px. Anything padded by it there
 * cleared the header by 49px too little, and the eyebrow sat behind the logo.
 *
 * Measured on a probe under document.body, so the em resolves against the
 * page's font size rather than the scope's, and republished as a length no
 * scope can reinterpret.
 */
function publishNavClearance() {
	const probe = document.createElement("div");
	probe.style.cssText =
		"position:absolute;visibility:hidden;pointer-events:none;width:0;top:0;left:0;height:var(--layout-nav-clearance,0px)";
	document.body.appendChild(probe);
	const h = Math.round(probe.getBoundingClientRect().height);
	probe.remove();
	if (h > 0) document.documentElement.style.setProperty("--nav-clearance-px", h + "px");
	return h;
}

/* Give every card in one stack the same height.
 *
 * This is the difference between Orisa's content and ours. Its cards each hold
 * an icon, one line and a short blurb, so they come out the same height by
 * accident and the incoming card always covers the one it is sliding over.
 * Ours hold the operator's own paragraphs, which run from 350px to 585px --
 * and a short card sliding up over a tall one leaves the bottom of the tall one
 * sticking out below it for the whole transition. That is what read as the
 * cards breaking up on scroll.
 *
 * The tallest card sets the height for all of them, as a custom property on the
 * scroll section. It is measured rather than guessed because it depends on the
 * viewport width, the font and the copy. offsetHeight, not
 * getBoundingClientRect: the timeline scales the cards, and a bounding box
 * reports the SCALED height, which would ratchet the value down on every
 * refresh.
 */
function equaliseVCards(scrollSection) {
	const cards = scrollSection.querySelectorAll(".item > .container");
	if (!cards.length) return;
	// Clear first, or each card is measured at the height last written here and
	// the maximum can never come back down after the text reflows.
	scrollSection.style.removeProperty("--vcard-h");
	let tallest = 0;
	cards.forEach((card) => {
		if (card.offsetHeight > tallest) tallest = card.offsetHeight;
	});
	if (tallest > 0) scrollSection.style.setProperty("--vcard-h", Math.ceil(tallest) + "px");
}

function initOrisaVCards() {
	if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

	publishNavClearance();
	if (!window.__navClearanceWatched) {
		window.__navClearanceWatched = true;
		// refreshInit fires on resize, before ScrollTrigger re-measures, so the
		// pin distances it works out already use the new clearance.
		ScrollTrigger.addEventListener("refreshInit", publishNavClearance);
	}

	const sectionFixList = document.querySelectorAll(".orisa-vcards .section-fix");
	if (!sectionFixList.length) return;

	sectionFixList.forEach((sectionFix) => {
		if (sectionFix.__orisaVCardsInit) return;
		sectionFix.__orisaVCardsInit = true;

		const sectionTitlePin = sectionFix.querySelector(".section-title-pin");
		const scrollSectionEl = sectionFix.querySelector(".scroll-section.vertical-section");
		if (!scrollSectionEl || !sectionTitlePin) return;
		const wrapper = scrollSectionEl.querySelector(".wrapper");
		if (!wrapper) return;
		const items = wrapper.querySelectorAll(".item");
		if (!items.length) return;

		const navList = sectionFix.querySelector(".navigation-active-item");
		const navItems = navList ? navList.querySelectorAll("li .item") : [];

		equaliseVCards(scrollSectionEl);
		// refreshInit fires before ScrollTrigger re-measures, so the pin distances
		// it works out are based on the equalised heights rather than on the ones
		// from before the resize.
		ScrollTrigger.addEventListener("refreshInit", () => equaliseVCards(scrollSectionEl));

		function markActive(progress) {
			const p = Math.min(Math.max(progress, 0), 0.9999);
			const index = Math.min(Math.floor(p * items.length), items.length - 1);
			items.forEach((el, i) => el.classList.toggle("active", i === index));
			navItems.forEach((el, i) => el.classList.toggle("active", i === index));
		}

		gsap.matchMedia().add("(min-width: 992px)", () => {
			items.forEach((item, index) => {
				if (index !== 0) gsap.set(item, { yPercent: 100 });
			});

			const scrollDistance = items.length * 50;

			const tl = gsap.timeline({
				scrollTrigger: {
					trigger: sectionFix,
					pin: true,
					start: "top top",
					end: () => `+=${scrollDistance}%`,
					scrub: 1,
					invalidateOnRefresh: true,
					onUpdate: (self) => markActive(self.progress),
				},
				defaults: { ease: "none", duration: 1 },
			});

			items.forEach((item, index) => {
				tl.to(item, { scale: 0.9 });
				if (items[index + 1]) {
					tl.to(items[index + 1], { yPercent: 0 }, "<");
				}
			});

			function updateActiveByProgress() {
				if (tl.scrollTrigger && tl.scrollTrigger.isActive()) markActive(tl.scrollTrigger.progress);
			}
			ScrollTrigger.addEventListener("scroll", updateActiveByProgress);

			// matchMedia cleanup: unwind everything this branch created, so
			// crossing the breakpoint does not leave a pinned section or a stale
			// scroll listener behind.
			return () => {
				ScrollTrigger.removeEventListener("scroll", updateActiveByProgress);
				tl.scrollTrigger && tl.scrollTrigger.kill();
				tl.kill();
				gsap.set(items, { clearProps: "all" });
				items.forEach((el) => el.classList.remove("active"));
				navItems.forEach((el) => el.classList.remove("active"));
			};
		});

		// Below the breakpoint the cards are a plain column, so the first row of
		// the nav is marked instead of nothing at all.
		gsap.matchMedia().add("(max-width: 991px)", () => {
			markActive(0);
			return () => {};
		});
	});
}
