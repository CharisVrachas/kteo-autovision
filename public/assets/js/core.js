/* core.js -- shared state, GSAP plugin registration, Lenis smooth scroll */
"use strict";

// Lenis is self-hosted ESM — imported from the local /assets/js/. Its CSS is
// already linked from the page <head>, so there is nothing to inject here.
// Was `const Lenis = (await import(...)).default` inside an async IIFE. As a
// classic script there is no top-level await, so the import becomes a promise
// that app.js waits on before booting -- same ordering, same failure behaviour.
let Lenis = null;
const lenisReady = import("/assets/js/lenis.min.js").then((m) => (Lenis = m.default));
const has = {
	gsap: typeof window.gsap !== "undefined",
	ScrollTrigger: typeof window.ScrollTrigger !== "undefined",
	CustomEase: typeof window.CustomEase !== "undefined",
};
const CARD_EASE = has.CustomEase ? "smoothOut" : "power3.out";
function initLenis() {
	const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
	window.__lenis = lenis;
	if (has.gsap && has.ScrollTrigger) {
		// Mobile browsers collapse/expand the address bar WHILE SCROLLING →
		// resize → ScrollTrigger's built-in auto-refresh fires MID-scroll →
		// a vertical jump the FIRST time you enter a pinned/locked section (the
		// second time the bar is already collapsed, so no jump). GSAP's canonical fix.
		ScrollTrigger.config({ ignoreMobileResize: true });
		lenis.on("scroll", ScrollTrigger.update);
		gsap.ticker.add((time) => lenis.raf(time * 1e3));
		gsap.ticker.lagSmoothing(0);
		installScrollTriggerRefreshGuards(lenis);
	} else {
		let raf = function (time) {
			lenis.raf(time);
			requestAnimationFrame(raf);
		};
		requestAnimationFrame(raf);
	}
	return lenis;
}
function installScrollTriggerRefreshGuards(lenis) {
	// ScrollTrigger computes start/end once at init, against the document height
	// as it stands then. Lazy images change that height post-init → the stored
	// positions go stale → animations never fire on a first load.
	//
	// CRITICAL: only run refresh() while the user is NOT scrolling. During an
	// active scroll a refresh interrupts the Lenis tween, and recomputing
	// start/end shifts the scroll position → a visible jump. The pending flag
	// accumulates requests while scrolling and flushes them once idle.
	let isScrolling = false;
	let scrollIdleTimer;
	let pendingRefresh = false;
	let refreshDebounce;
	lenis.on("scroll", () => {
		isScrolling = true;
		clearTimeout(scrollIdleTimer);
		scrollIdleTimer = setTimeout(() => {
			isScrolling = false;
			if (pendingRefresh) doRefresh();
		}, 300);
	});
	function doRefresh() {
		pendingRefresh = false;
		if (lenis && typeof lenis.resize === "function") lenis.resize();
		ScrollTrigger.refresh();
	}
	function scheduleRefresh() {
		clearTimeout(refreshDebounce);
		refreshDebounce = setTimeout(() => {
			if (isScrolling) {
				pendingRefresh = true;
			} else {
				doRefresh();
			}
		}, 200);
	}
	document.querySelectorAll('img[loading="lazy"]').forEach((img) => {
		if (img.complete && img.naturalHeight > 0) return;
		img.addEventListener("load", scheduleRefresh, { once: true });
		img.addEventListener("error", scheduleRefresh, { once: true });
	});
	if (document.fonts && document.fonts.ready) {
		document.fonts.ready.then(scheduleRefresh);
	}
	window.addEventListener("load", scheduleRefresh, { once: true });
}
