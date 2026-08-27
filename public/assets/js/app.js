/* app.js -- boot orchestrator */
"use strict";

function initPageAnimations() {
	// Preloader first, BEFORE the gsap guard: its internal skip path removes the
	// overlay even when gsap is missing — otherwise the homepage would stay
	// covered forever.
	initPreloader();
	if (!has.gsap) {
		return;
	}
	initButtonHover();
	initScrollCardShapes();
	initDeadlineStack();
	initOrisaPortfolio();
	initOrisaVCards();
	initOrisaJourney();
	initOrisaScrollZoom();
	initGlobalParallax();
	initHeroScrollDarken();
	initScrollTextFill();
	initScroller();
	// The drill-string scene that used to be lazied in here is gone; the homepage
	// now runs the KTEO car stage, which mounts itself from
	// /assets/js/kteo-mount.js as an ES module and needs nothing from this chain.
	initFooterParallax();
	initForms();
	initLogoCycle();
	initNavContactScroll();
	initMobileMenu();
	initNavSubmenu();
	initSectionReveal();
	initFeatureListReveal();
	initNumberOdometer();
	// initHighlightMarkerTextReveal already runs earlier (bootReveal, above the
	// IIFE) without waiting for the async Lenis import. Do not duplicate it here.
}
function boot() {
	if (has.gsap && has.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
	if (has.gsap && typeof window.ScrollToPlugin !== "undefined") {
		gsap.registerPlugin(ScrollToPlugin);
	}
	if (has.gsap && typeof window.SplitText !== "undefined") {
		gsap.registerPlugin(SplitText);
	}
	if (has.gsap && has.CustomEase) {
		gsap.registerPlugin(CustomEase);
		CustomEase.create("smoothOut", "0.625, 0.05, 0, 1");
	}
	initLenis();
	initNavThemeScroll();
	initHoverTextMirror();
	initFooterLinkHover();
	initPageAnimations();
	initBarba(); // ← last: every init*() it needs is registered by now
}
// In the original single file this ran inside `(async () => { ... })()` after
// `await import(lenis)`, so the readyState check happened only once Lenis had
// landed. Awaiting core.js's lenisReady here preserves that order exactly.
lenisReady.then(() => {
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", boot);
	} else {
		boot();
	}
});
