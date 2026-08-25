/* odometer.js -- rolling-digit number reveal */
"use strict";

// Number odometer — a rolling-digit reveal on scroll. The logic, easings and
// timings are unchanged from the original snippet. Two adaptations: (1) it is
// initialised from initPageAnimations (cold start + Barba re-init) rather than
// its own DOMContentLoaded, with a per-group init flag making repeat calls
// safe; (2) the resize listener sits behind a one-shot guard so it does not
// accumulate on every Barba transition.
function initNumberOdometer() {
	const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const initFlag = "data-odometer-initialized";
	const activeTweens = new WeakMap();

	// Configuration
	const defaults = {
		duration: 1,
		ease: "power3.out",
		elementStagger: 0.1,
		digitStagger: 0.04,
		revealDuration: 0.5,
		revealEase: "power2.out",
		triggerStart: "top 80%",
		staggerOrder: "left",
		digitCycles: 2,
	};

	// Scroll-triggered groups
	document.querySelectorAll("[data-odometer-group]").forEach((group) => {
		if (group.hasAttribute(initFlag)) return;
		group.setAttribute(initFlag, "");

		const elements = Array.from(group.querySelectorAll("[data-odometer-element]"));
		if (!elements.length || prefersReducedMotion) return;

		const staggerOrder = group.getAttribute("data-odometer-stagger-order") || defaults.staggerOrder;
		const triggerStart = group.getAttribute("data-odometer-trigger-start") || defaults.triggerStart;
		const elementStagger =
			parseFloat(group.getAttribute("data-odometer-stagger")) || defaults.elementStagger;

		const elementData = elements.map((el) => {
			const originalText = el.textContent.trim();
			const hasExplicitStart = el.hasAttribute("data-odometer-start");
			const startValue = parseFloat(el.getAttribute("data-odometer-start")) || 0;
			const duration = parseFloat(el.getAttribute("data-odometer-duration")) || defaults.duration;
			const step = getLineHeightRatio(el);

			let segments = parseSegments(originalText);
			segments = mapStartDigits(segments, startValue);
			segments = markHiddenSegments(segments, startValue);

			const grow = shouldGrow(el, hasExplicitStart, startValue, segments);
			const { rollers, revealEls } = buildRollerDOM(el, segments, step, grow);

			const fontSize = parseFloat(getComputedStyle(el).fontSize);
			const revealData = revealEls.map((revealEl) => {
				const widthEm = revealEl.offsetWidth / fontSize;
				gsap.set(revealEl, { width: 0, overflow: "hidden" });
				return { el: revealEl, widthEm };
			});

			return { el, rollers, duration, step, revealData, originalText };
		});

		const ordered = applyStaggerOrder(elementData, staggerOrder);

		// `once` is right for the roll ITSELF: the timeline drives roller markup
		// that onComplete then tears down, restoring the plain number, so it
		// cannot simply be replayed.
		let rolled = false;
		// Same reasoning as the watcher below: a re-arm rebuilds this group, so the
		// PREVIOUS roll's timeline and its trigger have to go with it. `once: true`
		// disposes of the trigger after a completed roll, but a roll interrupted
		// half way — scrolled past and back before it finished — leaves one behind.
		if (group.__odometerTl) {
			if (group.__odometerTl.scrollTrigger) group.__odometerTl.scrollTrigger.kill();
			group.__odometerTl.kill();
		}
		const tl = gsap.timeline({
			scrollTrigger: {
				trigger: group,
				start: triggerStart,
				once: true,
			},
			onComplete() {
				elementData.forEach(({ el, originalText, step }) => {
					cleanupElement(el, originalText);
				});
				rolled = true;
			},
		});

		// ...but the numbers should count up every time they are scrolled to, not
		// only on the first load. A second, cheap trigger watches for the user
		// leaving the group upwards and re-arms it: clearing the init flag and
		// calling the initialiser again rebuilds this group (and only this one --
		// every other group still carries its flag) from the text that onComplete
		// put back.
		//
		// Guarded on `rolled` because scrolling back out mid-roll leaves the roller
		// markup in place and the number not yet restored; rebuilding from that
		// would parse the markup as the value.
		// Each re-arm rebuilds this group, which would stack a fresh watcher on top
		// of the previous one every cycle. Keep the handle on the element and kill
		// the old one first, so a group carries exactly one at any time.
		if (group.__odometerRearm) group.__odometerRearm.kill();
		group.__odometerRearm = ScrollTrigger.create({
			trigger: group,
			start: triggerStart,
			// `self`, not `this`. ScrollTrigger passes the instance as the first
			// ARGUMENT; this file is "use strict", so `this` is undefined in a plain
			// function call and the callback threw every single time the user
			// scrolled back above the group — which is exactly the path that was
			// supposed to re-arm it, so the numbers only ever rolled once.
			onLeaveBack(self) {
				if (!rolled) return;
				self.kill();
				group.removeAttribute(initFlag);
				initNumberOdometer();
			},
		});

		group.__odometerTl = tl;

		ordered.forEach((data, orderIdx) => {
			const { rollers, duration, step, revealData } = data;
			const offset = orderIdx * elementStagger;

			revealData.forEach(({ el, widthEm }) => {
				tl.to(
					el,
					{
						width: widthEm + "em",
						opacity: 1,
						duration: defaults.revealDuration,
						ease: defaults.revealEase,
					},
					offset,
				);
			});

			rollers.forEach(({ roller, targetPos }, digitIdx) => {
				const reversedIdx = rollers.length - 1 - digitIdx;
				tl.to(
					roller,
					{
						y: -targetPos * step + "em",
						duration,
						ease: defaults.ease,
						force3D: true,
					},
					offset + reversedIdx * defaults.digitStagger,
				);
			});
		});
	});

	// Programmatic update (optional add-on)
	const update = function updateOdometer(el, newText, options = {}) {
		const currentText = el.textContent.trim();
		if (currentText === newText) return;

		const duration = options.duration || defaults.duration;
		const ease = options.ease || defaults.ease;
		const step = getLineHeightRatio(el);

		// Kill any running animation and clear its inline style locks
		const existing = activeTweens.get(el);
		if (existing) {
			existing.kill();
			gsap.set(el, { clearProps: "width,overflow" });
		}

		// Measure current width before rebuilding (in em for responsive scaling)
		const fontSize = parseFloat(getComputedStyle(el).fontSize);
		const oldWidthEm = el.getBoundingClientRect().width / fontSize;

		// Parse current text as start, new text as end
		const startSegments = parseSegments(currentText);
		const startDigitsStr = startSegments
			.filter((s) => s.type === "digit")
			.map((s) => s.char)
			.join("");
		const startValue = parseInt(startDigitsStr, 10) || 0;

		let segments = parseSegments(newText);
		segments = mapStartDigits(segments, startValue);
		segments = markHiddenSegments(segments, startValue);
		const { rollers, revealEls } = buildRollerDOM(el, segments, step, true);

		// Measure new natural width (in em)
		const newWidthEm = el.getBoundingClientRect().width / fontSize;
		const widthChanged = Math.abs(oldWidthEm - newWidthEm) > 0.01;

		// Lock to old width for smooth transition
		if (widthChanged) {
			gsap.set(el, { width: oldWidthEm + "em", overflow: "hidden" });
		}

		const tl = gsap.timeline({
			onComplete() {
				cleanupElement(el, newText);
				activeTweens.delete(el);
			},
		});
		activeTweens.set(el, tl);

		// Animate element width
		if (widthChanged) {
			tl.to(
				el,
				{
					width: newWidthEm + "em",
					duration: defaults.revealDuration,
					ease: defaults.revealEase,
				},
				0,
			);
		}

		// Fade in hidden statics
		revealEls.forEach((revealEl) => {
			if (revealEl.getAttribute("data-odometer-part") === "static") {
				tl.to(revealEl, { opacity: 1, duration: 0.2 }, 0);
			}
		});

		// Roll digits
		rollers.forEach(({ roller, targetPos }, digitIdx) => {
			const reversedIdx = rollers.length - 1 - digitIdx;
			tl.to(
				roller,
				{
					y: -targetPos * step + "em",
					duration,
					ease,
					force3D: true,
				},
				reversedIdx * defaults.digitStagger,
			);
		});
	};

	// Helpers
	function getLineHeightRatio(el) {
		const cs = getComputedStyle(el);
		const lh = cs.lineHeight;
		if (lh === "normal") return 1.2;
		return parseFloat(lh) / parseFloat(cs.fontSize);
	}

	function parseSegments(text) {
		return [...text].map((char) => ({
			type: /\d/.test(char) ? "digit" : "static",
			char,
		}));
	}

	function mapStartDigits(segments, startValue) {
		const digitSlots = segments.filter((s) => s.type === "digit");
		const padded = String(Math.floor(Math.abs(startValue)))
			.padStart(digitSlots.length, "0")
			.slice(-digitSlots.length);
		let di = 0;
		return segments.map((s) =>
			s.type === "digit" ? { ...s, startDigit: parseInt(padded[di++], 10) } : s,
		);
	}

	function markHiddenSegments(segments, startValue) {
		const totalDigits = segments.filter((s) => s.type === "digit").length;
		const absStart = Math.floor(Math.abs(startValue));
		const startDigitCount = absStart === 0 ? 1 : String(absStart).length;
		const leadingZeros = Math.max(0, totalDigits - startDigitCount);
		if (leadingZeros === 0) return segments;
		let digitsSeen = 0;
		let firstDigitSeen = false;
		let prevDigitHidden = false;
		return segments.map((seg) => {
			if (seg.type === "digit") {
				firstDigitSeen = true;
				const hidden = digitsSeen < leadingZeros;
				prevDigitHidden = hidden;
				digitsSeen++;
				return { ...seg, hidden };
			}
			const hidden = firstDigitSeen && prevDigitHidden;
			return { ...seg, hidden };
		});
	}

	function shouldGrow(el, hasExplicitStart, startValue, segments) {
		if (el.hasAttribute("data-odometer-grow")) {
			return el.getAttribute("data-odometer-grow") !== "false";
		}
		if (!hasExplicitStart) return false;
		const absStart = Math.floor(Math.abs(startValue));
		const startDigitCount = absStart === 0 ? 1 : String(absStart).length;
		const endDigitCount = segments.filter((s) => s.type === "digit").length;
		return startDigitCount < endDigitCount;
	}

	function buildRollerDOM(el, segments, step, grow) {
		el.innerHTML = "";
		el.style.height = "";
		const rollers = [];
		const revealEls = [];
		const totalCells = 10 * defaults.digitCycles;
		segments.forEach((seg) => {
			if (seg.type === "static") {
				const span = document.createElement("span");
				span.setAttribute("data-odometer-part", "static");
				span.style.height = step + "em";
				span.style.lineHeight = step;
				span.textContent = seg.char;
				el.appendChild(span);
				if (grow && seg.hidden) {
					gsap.set(span, { opacity: 0 });
					revealEls.push(span);
				}
				return;
			}
			const mask = document.createElement("span");
			mask.setAttribute("data-odometer-part", "mask");
			mask.style.height = step + "em";
			mask.style.lineHeight = step;
			const roller = document.createElement("span");
			roller.setAttribute("data-odometer-part", "roller");
			roller.style.lineHeight = step;

			const digits = [];
			for (let d = 0; d < totalCells; d++) {
				digits.push(d % 10);
			}
			roller.textContent = digits.join("\n");
			mask.appendChild(roller);
			el.appendChild(mask);
			const startDigit = seg.startDigit || 0;
			const isReveal = grow && seg.hidden;
			gsap.set(roller, {
				y: isReveal ? step + "em" : -startDigit * step + "em",
			});
			const endDigit = parseInt(seg.char, 10);
			const targetPos = endDigit > startDigit ? endDigit : 10 + endDigit;
			rollers.push({ roller, targetPos });
			if (isReveal) revealEls.push(mask);
		});
		return { rollers, revealEls };
	}

	function cleanupElement(el, originalText) {
		el.style.overflow = "";
		el.style.height = "";

		// Remove rollers, set final digit, clear inline bloat (but preserve width)
		const digits = [...originalText].filter((c) => /\d/.test(c));
		let di = 0;

		el.querySelectorAll('[data-odometer-part="mask"]').forEach((mask) => {
			const roller = mask.querySelector('[data-odometer-part="roller"]');
			if (roller) roller.remove();
			mask.textContent = digits[di++] || "";
			mask.style.opacity = "";
			mask.style.overflow = "";
		});

		el.querySelectorAll('[data-odometer-part="static"]').forEach((stat) => {
			stat.style.opacity = "";
		});
	}

	function recalcOnResize() {
		document.querySelectorAll("[data-odometer-element]").forEach((el) => {
			// Force-complete any running programmatic animation
			const running = activeTweens.get(el);
			if (running) {
				running.progress(1);
				activeTweens.delete(el);
			}

			const hasRollers = el.querySelector('[data-odometer-part="roller"]');

			if (hasRollers) {
				// Pre-triggered: recalculate step-based inline styles
				const step = getLineHeightRatio(el);
				el.querySelectorAll('[data-odometer-part="mask"]').forEach((mask) => {
					mask.style.height = step + "em";
					mask.style.lineHeight = step;
				});
				el.querySelectorAll('[data-odometer-part="roller"]').forEach((roller) => {
					roller.style.lineHeight = step;
				});
				el.querySelectorAll('[data-odometer-part="static"]').forEach((stat) => {
					stat.style.lineHeight = step;
				});
			}
			// Completed elements: width is em-based, scales automatically, don't touch
		});
		ScrollTrigger.refresh();
	}

	// Bind the resize listener ONCE (initNumberOdometer is called again on every
	// Barba re-init, so listeners would otherwise pile up). recalcOnResize reads
	// the live DOM, so the closure from the first call stays correct.
	if (!window.__appOdometerResizeBound) {
		window.__appOdometerResizeBound = true;
		let resizeTimer;
		let lastWidth = window.innerWidth;
		window.addEventListener("resize", () => {
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(() => {
				if (window.innerWidth === lastWidth) return;
				lastWidth = window.innerWidth;
				recalcOnResize();
			}, 250);
		});
	}

	function applyStaggerOrder(items, order) {
		const arr = [...items];
		if (order === "right") return arr.reverse();
		if (order === "random") return shuffleArray(arr);
		return arr;
	}

	function shuffleArray(arr) {
		for (let i = arr.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[arr[i], arr[j]] = [arr[j], arr[i]];
		}
		return arr;
	}

	return update;
}
