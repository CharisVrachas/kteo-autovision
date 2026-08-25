/* barba.js -- Barba.js page transitions */
"use strict";

// ============================================================
// Barba.js page transitions (the page-name wipe)
// ============================================================
function initBarba() {
	if (typeof window === "undefined") return;
	if (window.__appBarbaInit) return;
	if (!window.barba || !window.gsap) return;
	window.__appBarbaInit = true;

	// Layer 1 — manual scroll restoration (otherwise the browser restores scrollY
	// on pushState and competes with our own logic).
	if ("scrollRestoration" in window.history) {
		window.history.scrollRestoration = "manual";
	}

	// Global hooks — ScrollTrigger cleanup + transition flag + click lock.
	// ⭐ Strict guard: skip cold load (no event = no user click).
	window.barba.hooks.beforeLeave(function (data) {
		if (!data || !data.event) return;
		window.__appBarbaInTransition = true;
		document.body.setAttribute("data-barba-running", "true");
		// Safety net: force the pointer-events lock off after 5s even if the
		// transition crashes and afterEnter never runs. Otherwise
		// pointer-events:none would stick forever and nothing would be clickable.
		clearTimeout(window.__appBarbaRunningFailsafe);
		window.__appBarbaRunningFailsafe = setTimeout(function () {
			document.body.removeAttribute("data-barba-running");
			window.__appBarbaInTransition = false;
			console.warn("failsafe: data-barba-running force-removed after 5s");
		}, 5000);
		if (window.ScrollTrigger) {
			window.ScrollTrigger.getAll().forEach(function (st) {
				st.kill();
			});
		}
		// Mapbox: release the WebGL context when leaving the page
		if (window.__appMap && typeof window.__appMap.remove === "function") {
			try {
				window.__appMap.remove();
			} catch (e) {}
			window.__appMap = null;
		}
		// The drill-string scene used to be torn down here: release its GL context,
		// remove the overlays it had injected into <body>, unlock the scroll it
		// pinned, and reset the flags so a return to the homepage would inject a
		// fresh one. All of that went with the scene. The KTEO car stage that
		// replaced it disposes itself — /assets/js/kteo-mount.js registers its own
		// beforeLeave hook, and removes the chrome it created along with the stage.
	});

	// ⭐ Sync mode beforeEnter (fires BEFORE leave+enter parallel pair):
	//  1) Sync the head <link>/<style> tags — each page pulls its own per-route CSS
	//     from assets/css/pages/, and Barba does not update the head by default.
	//  2) position:fixed on next.container, so it overlaps the old container.
	//  3) Swap theme/active-nav under the mask — blink-free.
	//  4) Pre-hide the headings + set up the highlight-marker reveal (paused).
	//  5) Set the label text — next.container is already available in sync mode.
	window.barba.hooks.beforeEnter(function (data) {
		// ⭐ MULTIPLE strict guards — skip ALL cold load edge cases.
		if (!data) return;
		if (!data.event) return; // cold load = no user event
		if (!data.trigger) return; // no clicked link
		if (!data.current || !data.current.container) return; // no current = cold
		var nextContainer = data && data.next && data.next.container;
		if (!nextContainer) return;
		// 1) Sync the CSS from the fetched <head>
		syncHeadStyles(data.next.html);
		// 2) Position next fixed at top so it overlays old during transition
		window.gsap.set(nextContainer, {
			position: "fixed",
			top: 0,
			left: 0,
			right: 0,
			autoAlpha: 0,
		});
		// 3) Pre-hide headings + setup highlight-marker bars (mix viewport-based).
		try {
			nextContainer
				.querySelectorAll("h1.heading_h1, .inner-hero_heading-container p")
				.forEach(function (el) {
					if (el.hasAttribute("data-anim")) return;
					window.gsap.set(el, { autoAlpha: 0 });
				});
			setupHeadingsRevealDeferred(nextContainer);
		} catch (e) {
			console.warn("headings setup failed", e);
		}
		// 3c) Pre-hide above-fold section-reveal cards. Target = cell.children
		// (NOT the cells themselves). Why:
		//   .content-grid carries its own dark background (--mapped-border-default
		//   = grey-200 light / grey-700 dark) to draw the 1px grid lines via the
		//   gap:1px hack. The cells (.grid-col) cover it with the light
		//   --mapped-surface-default. Setting opacity:0 on a cell makes it fully
		//   transparent, letting that dark grid background show through as a large
		//   dark slab instead of the expected page colour. So hide the INNER
		//   content (card_wrap) and leave the cells visible with their light
		//   background and grid lines.
		//
		// Heading containers are skipped — the highlight-marker bars handle their reveal.
		try {
			var prehideVh = window.innerHeight;
			var prehideCount = 0;
			nextContainer.querySelectorAll("section").forEach(function (sec) {
				var rect = sec.getBoundingClientRect();
				if (rect.top >= prehideVh) return; // below-fold — IO handles
				sec
					.querySelectorAll(".content-grid > *, .feature-list > .feature-list_item")
					.forEach(function (cell) {
						var inner = Array.from(cell.children);
						if (!inner.length) return;
						window.gsap.set(inner, { opacity: 0 });
						cell.dataset.barbaPrehidden = "1";
						prehideCount++;
					});
			});
			console.log(
				"[" + performance.now().toFixed(0) + "ms] beforeEnter pre-hide:",
				prehideCount + " above-fold cards (inner content) hidden",
			);
		} catch (e) {
			console.warn("section pre-hide failed", e);
		}
		// 3b) Pre-set the parallax initial state. Without it initGlobalParallax in
		// resetPage runs a fromTo with {yPercent:startVal}, producing a visible
		// instant jump from 0 to startVal (the video jerks when re-entering the
		// homepage). Applying the initial transform here, under the mask, means
		// initGlobalParallax later finds the element already at startVal — no jerk.
		try {
			nextContainer.querySelectorAll('[data-parallax="trigger"]').forEach(function (trigger) {
				var target = trigger.querySelector('[data-parallax="target"]') || trigger;
				var direction = trigger.getAttribute("data-parallax-direction") || "vertical";
				var prop = direction === "horizontal" ? "xPercent" : "yPercent";
				var startAttr = trigger.getAttribute("data-parallax-start");
				var startVal = startAttr !== null ? parseFloat(startAttr) : 20;
				window.gsap.set(target, { [prop]: startVal });
			});
		} catch (e) {}
		// 4) Set transition label text (next available in sync mode)
		var labelEl = document.querySelector("[data-transition-label-text]");
		if (labelEl) {
			var labelStr =
				nextContainer.getAttribute("data-page-label") ||
				nextContainer.getAttribute("data-barba-namespace") ||
				"";
			labelEl.textContent = labelStr;
			labelEl.style.visibility = "visible";
			labelEl.style.opacity = "1";
		}
		// 5) Shell state (theme nav) — applyShellStateFrom is called from the leave
		//    timeline at the moment the panel is at yPercent:-100 (fully covering).
		//    Doing it here would make the nav colour blink BEFORE the curtain lifts.
	});

	window.barba.hooks.afterEnter(function () {
		window.__appBarbaInTransition = false;
		document.body.removeAttribute("data-barba-running");
		clearTimeout(window.__appBarbaRunningFailsafe);
	});

	// Safety net: a catch-all `after` hook, as a second line of defence if
	// afterEnter never fires (transition error or timeout). It still clears the lock.
	window.barba.hooks.after(function () {
		window.__appBarbaInTransition = false;
		document.body.removeAttribute("data-barba-running");
		clearTimeout(window.__appBarbaRunningFailsafe);
	});

	window.barba.init({
		debug: false,
		timeout: 7000,
		prevent: function (data) {
			if (!data || !data.el) return true;
			var el = data.el;
			var href = data.href || (el.getAttribute && el.getAttribute("href")) || "";
			if (!href) return true;
			if (href.indexOf("mailto:") === 0) return true;
			if (href.indexOf("tel:") === 0) return true;
			if (href.indexOf("#") === 0) return true;
			if (el.getAttribute && el.getAttribute("target") === "_blank") return true;
			return false;
		},
		transitions: [
			{
				name: "page-name-wipe",
				// sync:true — leave and enter run in parallel and next.container is
				// available during leave (Barba pre-fetches it). Both the old and new
				// containers stay in the DOM until the end, managed with position:fixed
				// on the new container (set in beforeEnter, cleared in resetPage).
				sync: true,
				// A once handler — Barba expects a defined transition on a cold load.
				// Without it the global beforeEnter hooks can fire incorrectly.
				async once() {
					return Promise.resolve();
				},
				// Safety net: a try/catch wrapper with a fallback to native navigation.
				// If the GSAP timeline throws, Lenis gets upset or SplitText fails, do
				// a full page reload rather than leaving the user with a frozen UI.
				async leave(data) {
					try {
						return runPageLeaveAnimation(data.current.container, data.next.container);
					} catch (e) {
						console.error("leave crashed → native nav", e);
						window.location.href = data.next.url.href;
						return new Promise(function () {}); // hold barba while native nav happens
					}
				},
				async enter(data) {
					try {
						return runPageEnterAnimation(data.next.container);
					} catch (e) {
						console.error("enter crashed → native nav", e);
						window.location.href = data.next.url.href;
						return new Promise(function () {});
					}
				},
			},
		],
	});
}

// Parses the fetched HTML of the next page and copies any <link rel="stylesheet">
// and <style> tags into the current <head> that are not there yet. This is what
// makes per-route CSS work at all: the head is persistent across a Barba swap, so
// a page's own stylesheet would otherwise never load. Links are compared by href,
// style tags by content.
function syncHeadStyles(htmlString) {
	if (!htmlString) return;
	try {
		var parser = new DOMParser();
		var doc = parser.parseFromString(htmlString, "text/html");
		var nextHead = doc.head;
		if (!nextHead) return;
		// 1) <link rel="stylesheet" href="...">
		var currentLinks = new Set();
		document.head.querySelectorAll("link[rel='stylesheet'][href]").forEach(function (l) {
			currentLinks.add(l.getAttribute("href"));
		});
		nextHead.querySelectorAll("link[rel='stylesheet'][href]").forEach(function (link) {
			var href = link.getAttribute("href");
			if (currentLinks.has(href)) return;
			var newLink = document.createElement("link");
			newLink.rel = "stylesheet";
			newLink.href = href;
			document.head.appendChild(newLink);
		});
		// 2) <style> inline
		var currentStyleContents = new Set();
		document.head.querySelectorAll("style").forEach(function (s) {
			currentStyleContents.add(s.textContent);
		});
		nextHead.querySelectorAll("style").forEach(function (s) {
			if (currentStyleContents.has(s.textContent)) return;
			var newStyle = document.createElement("style");
			Array.from(s.attributes).forEach(function (a) {
				newStyle.setAttribute(a.name, a.value);
			});
			newStyle.textContent = s.textContent;
			document.head.appendChild(newStyle);
		});
	} catch (e) {
		console.warn("head sync failed", e);
	}
}

function runPageLeaveAnimation(current, next) {
	// Safety net (C1): prefers-reduced-motion → instant swap, no animation.
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
		if (next) applyShellStateFrom(next);
		return Promise.resolve();
	}
	var transitionWrap = document.querySelector("[data-transition-wrap]");
	var transitionPanel = transitionWrap && transitionWrap.querySelector("[data-transition-panel]");
	var transitionLabel = transitionWrap && transitionWrap.querySelector("[data-transition-label]");
	// Note: the label text is already set in beforeEnter — do not duplicate it here.

	// With sync:true Barba removes the old container itself once enter resolves.
	// So no manual removeChild here, and no scroll reset in the leave onComplete.
	var tl = gsap.timeline();

	if (transitionPanel) tl.set(transitionPanel, { autoAlpha: 1, yPercent: 0 }, 0);

	var EASE = "smoothOut";
	if (transitionPanel) {
		tl.fromTo(transitionPanel, { yPercent: 0 }, { yPercent: -100, duration: 0.8, ease: EASE }, 0);
	}
	if (transitionLabel) {
		tl.fromTo(transitionLabel, { autoAlpha: 0 }, { autoAlpha: 1 }, "<+=0.2");
	}
	if (current) {
		tl.fromTo(current, { y: "0vh" }, { y: "-15vh", duration: 0.8, ease: EASE }, 0);
	}

	// Swap the nav theme and active link AT THE MOMENT the panel sits at
	// yPercent:-100 (fully covering the viewport) — a tl.call at t=0.8s, the end of
	// the panel rise. Doing this in beforeEnter caused a visible blink before the
	// curtain lifted.
	tl.call(
		function () {
			if (next) applyShellStateFrom(next);
		},
		null,
		0.8,
	);

	return tl;
}

function runPageEnterAnimation(next) {
	// Safety net (C1): prefers-reduced-motion → instant swap, no animation.
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
		if (next)
			gsap.set(next, {
				autoAlpha: 1,
				clearProps: "position,top,left,right,y,transform",
			});
		resetPageAfterTransition(next);
		return Promise.resolve();
	}
	var transitionWrap = document.querySelector("[data-transition-wrap]");
	var transitionPanel = transitionWrap && transitionWrap.querySelector("[data-transition-panel]");
	var transitionLabel = transitionWrap && transitionWrap.querySelector("[data-transition-label]");

	var tl = gsap.timeline();

	// A reading pause for the label, giving the user time to read the page name.
	// Tuned by eye: 0.6 felt abrupt, 1.0 was acceptable, 1.3 is the current value.
	tl.add("startEnter", 1.3);

	tl.call(
		function () {
			console.log("[" + performance.now().toFixed(0) + "ms] enter: startEnter (next visible)");
		},
		null,
		"startEnter",
	);
	if (next) tl.set(next, { autoAlpha: 1 }, "startEnter");

	var EASE = "smoothOut";
	if (transitionPanel) {
		tl.fromTo(
			transitionPanel,
			{ yPercent: -100 },
			{
				yPercent: -200,
				duration: 1,
				ease: EASE,
				overwrite: "auto",
				immediateRender: false,
			},
			"startEnter",
		);
		tl.set(transitionPanel, { autoAlpha: 0, yPercent: 0 }, ">");
	}
	if (transitionLabel) {
		tl.fromTo(
			transitionLabel,
			{ autoAlpha: 1 },
			{
				autoAlpha: 0,
				duration: 0.4,
				overwrite: "auto",
				immediateRender: false,
			},
			"startEnter+=0.1",
		);
	}
	if (next) {
		tl.from(next, { y: "15vh", duration: 1, ease: EASE }, "startEnter");
	}

	// TWEAK: when the heading bars play. Measured in seconds RELATIVE to startEnter
	// (the moment the curtain begins to lift):
	//   0     = the bars start exactly as the curtain begins to move
	//   0.3   = slightly later (the curtain is about a third of the way up)
	//   0.5   = halfway through the curtain rise
	//   1.0   = once the curtain has fully gone, the same moment as pageReady
	//  -0.2   = slightly earlier (risks seeing the bars past the panel edge)
	// Set it by feel.
	var HEADINGS_REVEAL_OFFSET = 0.3;
	tl.call(
		function () {
			try {
				playHeadingsRevealIn(next);
			} catch (e) {}
		},
		null,
		"startEnter+=" + HEADINGS_REVEAL_OFFSET,
	);

	tl.add("pageReady");
	tl.call(
		function () {
			resetPageAfterTransition(next);
		},
		null,
		"pageReady",
	);

	return new Promise(function (resolve) {
		tl.call(resolve, null, "pageReady");
	});
}

// Applies the shell state from the new container: data-theme-nav on the nav (by
// namespace) plus .is-active on the current nav link (by pathname).
// Hiding the footer is handled by the CSS selector .page[data-no-footer="true"],
// so no body attribute swap is needed — it is intrinsic to the container.
// Called from beforeEnter, BEFORE phase 2, so no blink is ever visible.
function applyShellStateFrom(container) {
	if (!container) return;
	var ns = container.getAttribute && container.getAttribute("data-barba-namespace");
	var theme = ns === "home" ? "hero" : ns === "contacts" ? "dark" : "light";
	var nav = document.querySelector("[data-theme-nav]");
	if (nav) nav.setAttribute("data-theme-nav", theme);
	syncActiveNavLinks();
}

function resetPageAfterTransition(container) {
	// Manually remove the OLD .page container. Under sync:true Barba removes it
	// only after the promise resolves, which happens AFTER this function. Without
	// the manual removal the new container sits AFTER the old one in normal flow
	// (they are siblings), pushing its sections down below the viewport, so
	// `rect.top < innerHeight` is false for all of them, baseDelay is never
	// applied, and the next section appears immediately with no delay.
	document.querySelectorAll('[data-barba="container"]').forEach(function (c) {
		if (c !== container && c.parentNode) c.parentNode.removeChild(c);
	});

	window.scrollTo(0, 0);
	// Clean up everything we set: position:fixed (the sync-mode overlap) plus the
	// y/autoAlpha/transform left behind by the leave and enter animations.
	if (container)
		gsap.set(container, {
			clearProps: "position,top,left,right,y,autoAlpha,transform",
		});
	if (window.__lenis && typeof window.__lenis.scrollTo === "function") {
		window.__lenis.scrollTo(0, { immediate: true, force: true });
	}

	// Note: the theme switch and active nav already ran in beforeEnter, under the mask.

	// Re-init the container-bound functions (most of them querySelectorAll across
	// the document, so they pick up the new elements without trouble).
	try {
		initPageAnimations();
	} catch (e) {
		console.warn("initPageAnimations failed", e);
	}

	// TWEAK: how long the blocks wait AFTER the heading reveal (Barba only).
	// Applied manually after initSectionReveal by bumping the inline
	// transition-delay on the `.section-reveal` elements in the above-fold sections
	// of the NEW container. Below-fold sections are left alone (normal scrolling).
	// See BARBA_SECTION_REVEAL_DELAY.
	var BARBA_SECTION_REVEAL_DELAY = 0.1;
	bumpSectionRevealDelayForBarba(container, BARBA_SECTION_REVEAL_DELAY);
	try {
		initFooterLinkHover();
	} catch (e) {}

	// Re-init the nav theme scroll: the old scroll listeners are still attached but
	// their sections collection is stale. A fresh init builds new observers over
	// the new sections (the old ones fail immediately on detached nodes).
	try {
		initNavThemeScroll();
	} catch (e) {}

	// Play the highlight-marker bars right after the reveal (they were prepared in beforeEnter)
	try {
		playHeadingsRevealIn(container);
	} catch (e) {}

	// Safety net: after 3s force-reveal any headings still stuck at autoAlpha:0
	// (if SplitText failed to load, or the setup did not finish in time).
	setTimeout(function () {
		if (!container) return;
		container
			.querySelectorAll("h1.heading_h1, .inner-hero_heading-container p")
			.forEach(function (el) {
				if (
					getComputedStyle(el).visibility === "hidden" ||
					parseFloat(getComputedStyle(el).opacity) < 0.1
				) {
					if (window.gsap) window.gsap.set(el, { autoAlpha: 1 });
					else {
						el.style.visibility = "visible";
						el.style.opacity = "1";
					}
					console.warn("reveal failsafe: force-shown stuck heading");
				}
			});
	}, 3000);

	// Lenis + ScrollTrigger settle (3-layer scroll handling, compendium §6).
	if (window.__lenis) {
		if (typeof window.__lenis.scrollTo === "function") {
			window.__lenis.scrollTo(0, { immediate: true, force: true });
		}
		if (typeof window.__lenis.start === "function") window.__lenis.start();
		if (typeof window.__lenis.resize === "function") window.__lenis.resize();
	}
	if (window.ScrollTrigger && typeof window.ScrollTrigger.refresh === "function") {
		window.ScrollTrigger.refresh();
		setTimeout(function () {
			window.ScrollTrigger.refresh();
		}, 100);
		setTimeout(function () {
			window.ScrollTrigger.refresh();
		}, 600);
		setTimeout(function () {
			window.ScrollTrigger.refresh();
		}, 1500);
	}
	window.dispatchEvent(new Event("resize"));
}
