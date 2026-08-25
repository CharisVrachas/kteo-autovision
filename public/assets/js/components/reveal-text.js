/* reveal-text.js -- SplitText / highlight-marker heading reveals */
"use strict";

function bootReveal() {
	if (typeof window.gsap === "undefined" || typeof window.SplitText === "undefined") return;
	if (typeof window.ScrollTrigger === "undefined") return;
	window.gsap.registerPlugin(window.ScrollTrigger);
	window.gsap.registerPlugin(window.SplitText);
	initHighlightMarkerTextRevealEarly();
}
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", () => {
		if (document.fonts && document.fonts.ready) {
			document.fonts.ready.then(bootReveal);
		} else {
			bootReveal();
		}
	});
} else if (document.fonts && document.fonts.ready) {
	document.fonts.ready.then(bootReveal);
} else {
	bootReveal();
}
function initHighlightMarkerTextRevealEarly() {
	document.querySelectorAll("h1.heading_h1, .inner-hero_heading-container p").forEach((el) => {
		if (el.hasAttribute("data-anim")) return;
		if (el.hasAttribute("data-highlight-marker-reveal")) return;
		el.setAttribute("data-highlight-marker-reveal", "");
	});
	const defaults = {
		direction: "up",
		theme: "brand",
		scrollStart: "top 90%",
		staggerStart: "start",
		stagger: 100,
		barDuration: 0.78,
		barEase: "power3.inOut",
	};
	const colorMap = {
		brand:
			getComputedStyle(document.body).getPropertyValue("--mapped-surface-action").trim() ||
			"#fe5b2a",
		white: "#FFFFFF",
	};
	const directionMap = {
		right: { prop: "scaleX", origin: "right center" },
		left: { prop: "scaleX", origin: "left center" },
		up: { prop: "scaleY", origin: "center top" },
		down: { prop: "scaleY", origin: "center bottom" },
	};
	function resolveColor(value) {
		if (colorMap[value]) return colorMap[value];
		if (value.startsWith("--")) {
			return getComputedStyle(document.body).getPropertyValue(value).trim() || value;
		}
		return value;
	}
	function createBar(color, origin) {
		const bar = document.createElement("div");
		bar.className = "highlight-marker-bar";
		bar.style.backgroundColor = color;
		bar.style.transformOrigin = origin;
		return bar;
	}
	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	if (reduceMotion) {
		document.querySelectorAll("[data-highlight-marker-reveal]").forEach((el) => {
			window.gsap.set(el, { autoAlpha: 1 });
		});
		return;
	}
	const elements = document.querySelectorAll("[data-highlight-marker-reveal]");
	if (!elements.length) return;
	setTimeout(() => {
		document.querySelectorAll("h1.heading_h1, .inner-hero_heading-container p").forEach((h) => {
			if (getComputedStyle(h).visibility === "hidden") h.style.visibility = "visible";
		});
	}, 4e3);
	elements.forEach((el) => {
		if (el.__highlightMarkerReveal) return;
		// If the CSS fallback animation has already revealed the element (slow 4G,
		// JS more than 2s late) skip the reveal: the text is visible already, and
		// dropping bars over it would cause an ugly flash.
		if (getComputedStyle(el).visibility === "visible") return;
		el.__highlightMarkerReveal = {};
		const direction = el.getAttribute("data-marker-direction") || defaults.direction;
		const theme = el.getAttribute("data-marker-theme") || defaults.theme;
		const scrollStart = el.getAttribute("data-marker-scroll-start") || defaults.scrollStart;
		const staggerStart = el.getAttribute("data-marker-stagger-start") || defaults.staggerStart;
		const staggerOffset =
			(parseFloat(el.getAttribute("data-marker-stagger")) || defaults.stagger) / 1000;
		const color = resolveColor(theme);
		const dirConfig = directionMap[direction] || directionMap.right;
		const split = new window.SplitText(el, {
			type: "lines",
			linesClass: "highlight-marker-line",
		});
		const lines = split.lines;
		const tl = window.gsap.timeline({ paused: true });
		lines.forEach((line, i) => {
			window.gsap.set(line, { position: "relative", overflow: "hidden" });
			const bar = createBar(color, dirConfig.origin);
			line.appendChild(bar);
			const staggerIndex = staggerStart === "end" ? lines.length - 1 - i : i;
			tl.to(
				bar,
				{
					[dirConfig.prop]: 0,
					duration: defaults.barDuration,
					ease: defaults.barEase,
				},
				staggerIndex * staggerOffset,
			);
		});
		window.gsap.set(el, { autoAlpha: 1 });
		const st = window.ScrollTrigger.create({
			trigger: el,
			start: scrollStart,
			once: true,
			onEnter: () => tl.play(),
		});
		el.__highlightMarkerReveal.split = split;
		el.__highlightMarkerReveal.timeline = tl;
		el.__highlightMarkerReveal.scrollTrigger = st;
	});
}

function initHighlightMarkerTextReveal() {
	if (!has.gsap || !has.ScrollTrigger || typeof window.SplitText === "undefined") return;
	// Auto-attach: every main section heading plus the lead paragraph in the inner
	// hero gets the reveal effect. Anything that already has its own scroll effect
	// (data-anim) is excluded.
	document.querySelectorAll("h1.heading_h1, .inner-hero_heading-container p").forEach((el) => {
		if (el.hasAttribute("data-anim")) return;
		if (el.hasAttribute("data-highlight-marker-reveal")) return;
		el.setAttribute("data-highlight-marker-reveal", "");
	});
	const defaults = {
		direction: "left",
		theme: "brand",
		scrollStart: "top 90%",
		staggerStart: "start",
		stagger: 100,
		barDuration: 0.78,
		barEase: "power3.inOut",
	};
	const colorMap = {
		brand:
			getComputedStyle(document.body).getPropertyValue("--mapped-surface-action").trim() ||
			"#fe5b2a",
		white: "#FFFFFF",
	};
	const directionMap = {
		right: { prop: "scaleX", origin: "right center" },
		left: { prop: "scaleX", origin: "left center" },
		up: { prop: "scaleY", origin: "center top" },
		down: { prop: "scaleY", origin: "center bottom" },
	};
	function resolveColor(value) {
		if (colorMap[value]) return colorMap[value];
		if (value.startsWith("--")) {
			return getComputedStyle(document.body).getPropertyValue(value).trim() || value;
		}
		return value;
	}
	function createBar(color, origin) {
		const bar = document.createElement("div");
		bar.className = "highlight-marker-bar";
		bar.style.backgroundColor = color;
		bar.style.transformOrigin = origin;
		return bar;
	}
	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	if (reduceMotion) {
		document.querySelectorAll("[data-highlight-marker-reveal]").forEach((el) => {
			gsap.set(el, { autoAlpha: 1 });
		});
		return;
	}
	const elements = document.querySelectorAll("[data-highlight-marker-reveal]");
	if (!elements.length) return;
	// Fallback: if the reveal did not run for any reason (assets down, SplitText
	// broken, a thrown error), force-show whatever is still hidden after 4s.
	// Without this the user is left staring at an empty layout.
	setTimeout(() => {
		document.querySelectorAll("h1.heading_h1, .inner-hero_heading-container p").forEach((h) => {
			if (getComputedStyle(h).visibility === "hidden") {
				h.style.visibility = "visible";
			}
		});
	}, 4e3);
	elements.forEach((el) => {
		if (el.__highlightMarkerReveal) return;
		el.__highlightMarkerReveal = {};
		const direction = el.getAttribute("data-marker-direction") || defaults.direction;
		const theme = el.getAttribute("data-marker-theme") || defaults.theme;
		const scrollStart = el.getAttribute("data-marker-scroll-start") || defaults.scrollStart;
		const staggerStart = el.getAttribute("data-marker-stagger-start") || defaults.staggerStart;
		const staggerOffset =
			(parseFloat(el.getAttribute("data-marker-stagger")) || defaults.stagger) / 1000;
		const color = resolveColor(theme);
		const dirConfig = directionMap[direction] || directionMap.right;
		// autoSplit: false — the font is settled once document.fonts.ready resolves,
		// so no re-split is needed on resize (these are section headings and always
		// fit). It also removes a duplicated reveal animation.
		const split = new SplitText(el, {
			type: "lines",
			linesClass: "highlight-marker-line",
		});
		const lines = split.lines;
		const tl = gsap.timeline({ paused: true });
		lines.forEach((line, i) => {
			gsap.set(line, { position: "relative", overflow: "hidden" });
			const bar = createBar(color, dirConfig.origin);
			line.appendChild(bar);
			const staggerIndex = staggerStart === "end" ? lines.length - 1 - i : i;
			tl.to(
				bar,
				{
					[dirConfig.prop]: 0,
					duration: defaults.barDuration,
					ease: defaults.barEase,
				},
				staggerIndex * staggerOffset,
			);
		});
		gsap.set(el, { autoAlpha: 1 });
		const st = ScrollTrigger.create({
			trigger: el,
			start: scrollStart,
			once: true,
			onEnter: () => tl.play(),
		});
		el.__highlightMarkerReveal.split = split;
		el.__highlightMarkerReveal.timeline = tl;
		el.__highlightMarkerReveal.scrollTrigger = st;
	});
}
function initScrollTextFill() {
	if (!has.ScrollTrigger) return;
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	document.querySelectorAll('[data-anim="text-fill"]').forEach((el) => {
		const text = el.textContent.trim();
		if (!text) return;
		el.textContent = "";
		const words = text.split(/\s+/).map((word, i) => {
			if (i > 0) el.appendChild(document.createTextNode(" "));
			const span = document.createElement("span");
			span.className = "text-fill-word";
			span.textContent = word;
			el.appendChild(span);
			return span;
		});
		gsap.fromTo(
			words,
			{ opacity: 0.2 },
			{
				opacity: 1,
				ease: "none",
				duration: 1,
				stagger: 0.4,
				scrollTrigger: {
					trigger: el,
					start: "top 80%",
					end: "bottom 60%",
					scrub: true,
				},
			},
		);
	});
}

// Set up the highlight-marker reveal for Barba — SplitText + bars + timeline.
// The mode is mixed, chosen by viewport position:
//  - Above the fold (already in the viewport) → a paused timeline, played
//    manually in pageReady (the bars sit ready under the mask and run scaleX
//    1→0 once the page-transition curtain lifts).
//  - Below the fold → a normal ScrollTrigger with once:true onEnter (it plays
//    when the user scrolls the element into view).
function setupHeadingsRevealDeferred(container) {
	if (!container) return;
	if (typeof window.gsap === "undefined" || typeof window.SplitText === "undefined") return;
	var color =
		getComputedStyle(document.body).getPropertyValue("--mapped-surface-action").trim() || "#fe5b2a";
	var viewportH = window.innerHeight;
	container
		.querySelectorAll(
			"h1.heading_h1, .inner-hero_heading-container p, .hero_heading_container h1, .hero_heading_container p",
		)
		.forEach(function (el) {
			if (el.hasAttribute("data-anim")) return;
			if (el.__highlightMarkerReveal) return;
			el.setAttribute("data-highlight-marker-reveal", "");
			el.__highlightMarkerReveal = {};
			var split = new window.SplitText(el, {
				type: "lines",
				linesClass: "highlight-marker-line",
			});
			var tl = window.gsap.timeline({ paused: true });
			split.lines.forEach(function (line, i) {
				window.gsap.set(line, { position: "relative", overflow: "hidden" });
				var bar = document.createElement("div");
				bar.className = "highlight-marker-bar";
				bar.style.backgroundColor = color;
				// Top-down reveal: the bar collapses downwards (scaleY 1→0 from top
				// center). It used to be scaleX 1→0 from left center (left-to-right).
				bar.style.transformOrigin = "top center";
				line.appendChild(bar);
				tl.to(bar, { scaleY: 0, duration: 0.78, ease: "power3.inOut" }, i * 0.1);
			});
			window.gsap.set(el, { autoAlpha: 1 });
			el.__highlightMarkerReveal.split = split;
			el.__highlightMarkerReveal.timeline = tl;
			// The rule: above the fold → manual play (the deferToManual flag), below
			// the fold → ScrollTrigger onEnter. Measure the bounding rect RELATIVE to
			// the current container's render position (even when that container is
			// fixed at top:0).
			var rect = el.getBoundingClientRect();
			var aboveFold = rect.top < viewportH;
			if (aboveFold) {
				el.__highlightMarkerReveal.deferToManual = true;
			} else if (window.ScrollTrigger) {
				var st = window.ScrollTrigger.create({
					trigger: el,
					start: "top 90%",
					once: true,
					onEnter: function () {
						tl.play();
					},
				});
				el.__highlightMarkerReveal.scrollTrigger = st;
			}
		});
}

// Plays every PAUSED timeline carrying the deferToManual flag (the above-fold
// ones). Those driven by ScrollTrigger play themselves on scroll.
function playHeadingsRevealIn(container) {
	if (!container) return;
	container.querySelectorAll("[data-highlight-marker-reveal]").forEach(function (el) {
		var rev = el.__highlightMarkerReveal;
		if (rev && rev.deferToManual && rev.timeline && rev.timeline.paused()) {
			rev.timeline.play();
		}
	});
}
