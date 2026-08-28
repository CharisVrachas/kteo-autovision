/* preloader.js -- cold-load preloader (home only) */
"use strict";

function initPreloader() {
	// The loading screen — HOMEPAGE ONLY. A 2×2 grid (orange | pattern /
	// card-left | card-right). The animation sequence:
	//   1) the bottom-left illustration plays its shape rotation forward
	//   2) the bottom-right illustration plays its shape stack forward
	//   3) a ~1s pause
	//   4) bottom-left reverses back to its initial state
	//   5) bottom-right reverses back
	//   6) alongside (1-5) the pattern fill runs to 100% along LOAD_POINTS
	//   7) the pattern pushes the orange cell left (cell width 50%→0%)
	//   8) the bottom cards (text + illustration) slide DOWN and fade, staggered
	//   9) pattern block slide DOWN
	//   10) the percentage switches to "READY"
	//   11) the whole preloader moves yPercent -100 (the curtain lifts) → hero revealed
	if (typeof document === "undefined") return;
	if (window.__appPreloaderInit) return;
	var pre = document.querySelector("[data-preloader]");
	if (!pre) return; // not the homepage
	window.__appPreloaderInit = true;

	// ╔═══ Preloader settings — timings (seconds) + easings. Tune them here. ═══╗
	var CFG = {
		// The loading screen is deliberately shown on EVERY full page load, not
		// once per session: it is the site's first frame of branding and it is
		// short. Barba handles navigation between pages without a reload, so this
		// only costs on a genuine load — an arrival, a refresh, a link from
		// outside. Set to false to go back to once-per-session.
		ALWAYS_SHOW: true,

		// Short on purpose. The fill is simulated, not tied to bytes, so this is
		// simply how long the screen is on show before it lifts.
		FILL_DUR: 2, // the simulated 0→100 fill (LOAD_POINTS curve)

		// ── Bottom-cards illustration sequence (phases 1-5) ──
		// These mirror the shape hover animation on the homepage (HOVER_DURATION=0.3 + stagger).
		ILLU_DUR: 0.5, // duration of one illustration animation (forward or reverse)
		ILLU_GAP: 0.5, // delay between the left and right start (~0.5s)
		ILLU_HOLD: 0.1, // short pause in the end state before reversing

		// ── Reveal phase (after FILL reaches 100%) ──
		SQUEEZE_DUR: 1.4, // the pattern slides over the orange cell
		SQUEEZE_EASE: "smoothOut",
		CARD_DOWN_DUR: 0.5, // bottom card content slides down + fades
		CARD_DOWN_Y: "80%",
		CARD_DOWN_STAGGER: 0.1, // L heading → L illu → R heading → R illu
		CARD_DOWN_EASE: "smoothOut",
		PATTERN_DOWN_DUR: 0.9, // the pattern block moves down
		PATTERN_DOWN_Y: "100%",
		PATTERN_DOWN_EASE: "smoothOut",

		RISE_DUR: 1.4, // the whole preloader rising out of view
		RISE_EASE: "smoothOut",

		DARKEN_FROM: 0.9,
		DARKEN_TO: 0.2,
		DARKEN_DUR: 2.2,
		DARKEN_EASE: "smoothOut",
		SCALE_FROM: 1.4,
		SCALE_DUR: 2.2,
		SCALE_EASE: "smoothOut",

		// *_LEAD is the DELAY measured from the moment the curtain starts rising
		//    (the riseStart label). 0 = together with the rise; RISE_DUR (1.4) = once
		//    the rise has finished. Smaller → the reveal starts earlier, larger →
		//    later. Negative values are allowed, to play BEFORE the rise starts.
		HERO_LEAD: 0.4, // headings reveal 0.4s after the rise starts
		BTN_DUR: 0.8,
		BTN_EASE: "smoothOut",
		BTN_LEAD: 0.7, // the hero button fades up slightly after the headings

		NAV_DUR: 3,
		NAV_EASE: "smoothOut",
		NAV_STAGGER: 0.08,
		NAV_LEAD: 0.9, // nav items, near the end of the rise

		// ── Logo intro (phase 0, before anything else) ──
		LOGO_WIPE_DUR: 0.7, // the white panel opening from the left
		LOGO_SETTLE_DUR: 0.9, // the mark easing back from its overshoot
		LOGO_EASE: "smoothOut",
		LOGO_BREATHE_DUR: 1.8, // the slow idle drift while the fill runs

		// READY_LABEL replaces the percentage at the end of the fill.
		READY_LABEL: "READY",
	};
	// ╚═══════════════════════════════════════════════════════════════════╝

	var gsap = window.gsap;

	var orangeEl = pre.querySelector("[data-preloader-orange]");
	var patternEl = pre.querySelector("[data-preloader-pattern]");
	var overlayEl = pre.querySelector("[data-preloader-overlay]");
	var cardLeftEl = pre.querySelector('[data-preloader-card="left"]');
	var cardRightEl = pre.querySelector('[data-preloader-card="right"]');
	var illuLeftEl = pre.querySelector('[data-preloader-illu="left"]');
	var illuRightEl = pre.querySelector('[data-preloader-illu="right"]');
	var percentEl = pre.querySelector("[data-preloader-percent]");
	var overlayPercentEl = pre.querySelector("[data-preloader-overlay-percent]");
	var dotsEl = pre.querySelector("[data-preloader-dots]");
	var dotsCardLeft = pre.querySelector('[data-preloader-card-dots="left"]');
	var dotsCardRight = pre.querySelector('[data-preloader-card-dots="right"]');
	var progressEl = pre.querySelector(".preloader__progress");
	var logoEl = pre.querySelector("[data-preloader-logo]");
	var logoMarks = logoEl ? logoEl.querySelectorAll("img") : null;
	var nav = document.querySelector(".nav");
	var navItems = nav
		? nav.querySelectorAll(".nav_logo-container, .nav_item, .nav_contact, .nav_menu-toggle")
		: [];
	var heroSection = document.querySelector(".section_hero");
	var heroVideo = heroSection && heroSection.querySelector("video");
	var darkEl = heroSection && heroSection.querySelector(".darken"); // scrim for the "emerging from darkness" reveal
	var heroBtn =
		heroSection &&
		heroSection.querySelector(".hero_heading_container .button-wrap, .hero_heading_container a");
	// smoothOut may not be registered when CustomEase is absent → fall back.
	function ez(e) {
		return e === "smoothOut" && !has.CustomEase ? "power3.out" : e;
	}

	var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	var SHOWN_KEY = "preloaderShown";
	var shownAlready = false;
	try {
		shownAlready = sessionStorage.getItem(SHOWN_KEY) === "1";
	} catch (e) {}

	function removePre() {
		if (pre && pre.parentNode) pre.parentNode.removeChild(pre);
	}
	function unlockScroll() {
		if (window.__lenis && typeof window.__lenis.start === "function") window.__lenis.start();
	}
	function showAllInstant() {
		if (!gsap) return;
		if (navItems.length) gsap.set(navItems, { clearProps: "opacity,visibility,transform" });
		if (heroBtn) gsap.set(heroBtn, { clearProps: "opacity,visibility,transform" });
	}

	// Skip on reduced-motion, when already shown (unless DEV_ALWAYS_SHOW), or with no gsap
	if (reduced || (!CFG.ALWAYS_SHOW && shownAlready) || !gsap) {
		removePre();
		showAllInstant();
		return;
	}
	if (!CFG.ALWAYS_SHOW) {
		try {
			sessionStorage.setItem(SHOWN_KEY, "1");
		} catch (e) {}
	}

	// Lock the scroll. The hero heading and lead are prepared for the bar reveal
	// used across the site — setupHeadingsRevealDeferred lays the bars over the
	// text in a paused state, and phase 5 plays them. The button and nav are
	// hidden for their own fade/stagger.
	if (window.__lenis && typeof window.__lenis.stop === "function") window.__lenis.stop();
	if (heroSection) setupHeadingsRevealDeferred(heroSection);
	if (navItems.length) gsap.set(navItems, { autoAlpha: 0 });
	if (heroBtn) gsap.set(heroBtn, { autoAlpha: 0 });

	// The animated ellipsis on the two card headings. The loading label it used to
	// drive as well is gone — the screen carries the mark and nothing else now —
	// so dotsEl is simply absent and the guard below covers it.
	var dotN = 0;
	var dotsTimer = setInterval(function () {
		dotN = (dotN + 1) % 4;
		var s = new Array(dotN + 1).join(".");
		if (dotsEl) dotsEl.textContent = s;
		if (dotsCardLeft) dotsCardLeft.textContent = s;
		if (dotsCardRight) dotsCardRight.textContent = s;
	}, 350);

	function applyFill(v) {
		var clamped = Math.max(0, Math.min(100, v));
		if (percentEl) percentEl.textContent = Math.round(clamped) + "%";
		if (patternEl) patternEl.style.setProperty("--preloader-load", (clamped / 100).toFixed(4));
	}

	// The two cards carry the site's own drawings now, not abstract shapes: the
	// vehicle queue on the left, Rhodes and its two markers on the right. Their
	// rest positions come from the SAME functions card-shapes.js uses on the
	// homepage -- vehicleRestX, pinRestX, pinRestY, hoisted to file scope there and
	// reachable here because card-shapes.js loads first (see Base.astro). One copy
	// of that geometry, not two: the vehicles only stay clear of one another
	// because their gaps are derived from their own proportions, and a second copy
	// left to drift would stack them back up.
	//
	// The loop then plays a small lift and settle -- the same gesture the cards use
	// on hover. Enough to show the screen is alive, not far enough to collide.
	function buildIlluController(card) {
		if (!card) return null;
		var LIFT = -9; // percent of the element's own height
		var all = [];

		var vehicles = card.querySelectorAll(".shape-vehicle");
		if (vehicles.length) {
			var order = ["moto", "car", "van"]; // is-1, is-2, is-3, as the markup writes them
			Array.prototype.forEach.call(vehicles, function (el, i) {
				var xp = vehicleRestX(order[i]);
				all.push({
					el: el,
					at: i * 0.07,
					rest: { xPercent: xp, yPercent: 0, x: 0, y: 0, opacity: 1 },
					hover: { xPercent: xp, yPercent: LIFT },
				});
			});
		}

		var mapEl = card.querySelector(".shape-map");
		if (mapEl) {
			var ratio = parseFloat(card.dataset.mapRatio);
			var pinK = parseFloat(card.dataset.pinScale);
			all.push({
				el: mapEl,
				at: 0,
				rest: { opacity: 1, scale: 1 },
				hover: { opacity: 1, scale: 1.02 },
			});
			Array.prototype.forEach.call(card.querySelectorAll(".shape-pin"), function (pin, i) {
				var xp = pinRestX(parseFloat(pin.dataset.u), ratio, pinK);
				var yp = pinRestY(parseFloat(pin.dataset.v), pinK);
				all.push({
					el: pin,
					at: 0.08 + i * 0.07,
					rest: { xPercent: xp, yPercent: yp, x: 0, y: 0, opacity: 1 },
					hover: { xPercent: xp, yPercent: yp - 12 },
				});
			});
		}

		if (!all.length) return null;
		// Start at rest: the illustration is already composed when the screen appears.
		all.forEach(function (a) {
			gsap.set(a.el, a.rest);
		});
		var HOVER_DUR = 0.3; // same as hoverTl in js/components/hover.js
		function play(key) {
			all.forEach(function (a) {
				gsap.to(
					a.el,
					Object.assign({}, a[key], {
						duration: HOVER_DUR,
						ease: CARD_EASE,
						delay: a.at,
						overwrite: true,
					}),
				);
			});
		}
		return {
			forward: function () {
				play("hover");
			},
			reverse: function () {
				play("rest");
			},
		};
	}

	var illuTlLeft = buildIlluController(illuLeftEl);
	var illuTlRight = buildIlluController(illuRightEl);

	// Sequence loop: L forward → R forward → pause → L reverse → R reverse → repeat
	// Plain setTimeout: a GSAP outer timeline made only of callback entries plays
	// empty tweens unreliably and does not fire the callbacks. setTimeout is
	// simple and works.
	var illuStopped = false;
	var illuTimers = [];
	function runIlluCycle() {
		if (illuStopped) return;
		var s = 1000; // ms multiplier
		// t=0: L forward
		if (illuTlLeft) illuTlLeft.forward();
		// t=ILLU_GAP: R forward
		illuTimers.push(
			setTimeout(function () {
				if (illuStopped) return;
				if (illuTlRight) illuTlRight.forward();
			}, CFG.ILLU_GAP * s),
		);
		// t=ILLU_GAP + ILLU_DUR + ILLU_HOLD: L reverse
		var revLeftAt = (CFG.ILLU_GAP + CFG.ILLU_DUR + CFG.ILLU_HOLD) * s;
		illuTimers.push(
			setTimeout(function () {
				if (illuStopped) return;
				if (illuTlLeft) illuTlLeft.reverse();
			}, revLeftAt),
		);
		// +ILLU_GAP: R reverse
		illuTimers.push(
			setTimeout(
				function () {
					if (illuStopped) return;
					if (illuTlRight) illuTlRight.reverse();
				},
				revLeftAt + CFG.ILLU_GAP * s,
			),
		);
		// total cycle then loop
		var totalAt = revLeftAt + CFG.ILLU_GAP * s + CFG.ILLU_DUR * s + 200;
		illuTimers.push(setTimeout(runIlluCycle, totalAt));
	}
	function stopIllu() {
		illuStopped = true;
		illuTimers.forEach(clearTimeout);
		illuTimers.length = 0;
	}
	runIlluCycle();

	// ── A simulated load on a custom curve: fast start → a PLATEAU around 50%
	// (it visibly slows) → a sharp acceleration past ~70% → a smooth arrival at
	// 100. It is deliberately NOT tied to bytes, because real progress looked
	// ragged on fast or local connections. The video starts during the rise and
	// the rest of the content keeps loading behind it. The curve is LOAD_POINTS
	// [time 0..1, progress 0..1], following the CSS linear() spec — move the
	// points to shift the plateau or the acceleration. ──
	var LOAD_POINTS = [
		[0.0, 0],
		[0.02, 0.0014],
		[0.04, 0.0062],
		[0.06, 0.0163],
		[0.08, 0.0346],
		[0.1, 0.068],
		[0.12, 0.1295],
		[0.14, 0.2151],
		[0.16, 0.2831],
		[0.18, 0.33],
		[0.2, 0.3641],
		[0.22, 0.3903],
		[0.24, 0.4111],
		[0.26, 0.428],
		[0.28, 0.442],
		[0.3, 0.4536],
		[0.32, 0.4632],
		[0.34, 0.4714],
		[0.36, 0.4781],
		[0.38, 0.4838],
		[0.4, 0.4884],
		[0.42, 0.4921],
		[0.44, 0.4951],
		[0.46, 0.4973],
		[0.48, 0.499],
		[0.5, 0.5],
		[0.52, 0.5004],
		[0.54, 0.5022],
		[0.56, 0.5056],
		[0.58, 0.5114],
		[0.6, 0.5202],
		[0.62, 0.5335],
		[0.64, 0.5541],
		[0.66, 0.5891],
		[0.68, 0.6634],
		[0.7, 0.79],
		[0.72, 0.8568],
		[0.74, 0.8948],
		[0.76, 0.9206],
		[0.78, 0.9395],
		[0.8, 0.9539],
		[0.82, 0.9652],
		[0.84, 0.9741],
		[0.86, 0.9812],
		[0.88, 0.9868],
		[0.9, 0.9912],
		[0.92, 0.9945],
		[0.94, 0.997],
		[0.96, 0.9986],
		[0.98, 0.9996],
		[1.0, 1],
	];
	function fakeLoadEase(t) {
		if (t <= 0) return 0;
		if (t >= 1) return 1;
		for (var i = 0; i < LOAD_POINTS.length - 1; i++) {
			var p0 = LOAD_POINTS[i],
				p1 = LOAD_POINTS[i + 1];
			if (t >= p0[0] && t <= p1[0]) {
				var k = (t - p0[0]) / (p1[0] - p0[0]);
				return p0[1] + k * (p1[1] - p0[1]);
			}
		}
		return 1;
	}
	var fillState = { v: 0 };
	var revealStarted = false;
	applyFill(0);
	gsap.to(fillState, {
		v: 100,
		duration: CFG.FILL_DUR,
		ease: fakeLoadEase, // the custom curve (LOAD_POINTS), not CFG.FILL_EASE
		onUpdate: function () {
			applyFill(fillState.v);
		},
		onComplete: function () {
			startReveal();
		},
	});

	/** Land the mark on its resting values before the curtain moves.
	    The drift itself is started by startLogoIntro() at the bottom of this
	    file, which runs outside initPreloader entirely — the two meet only
	    through window.__preloaderLogoBreathe. */
	function stopLogo() {
		// Tells the cycle below not to start ANOTHER swap: a delayedCall already
		// waiting would otherwise fire after the curtain had begun to move. The
		// first swap has necessarily finished by now — startReveal() gates on it.
		window.__preloaderLogoDone = true;
		if (window.__preloaderLogoTimer) {
			window.__preloaderLogoTimer.kill();
			window.__preloaderLogoTimer = null;
		}
		if (window.__preloaderLogoBreathe) {
			window.__preloaderLogoBreathe.kill();
			window.__preloaderLogoBreathe = null;
		}
		// Every mark, not just the first: after a swap the one on screen is the
		// second, and settling the wrong one left the visible mark mid-breath.
		if (logoMarks && logoMarks.length) {
			gsap.to(logoMarks, { scale: 1, duration: 0.4, ease: ez(CFG.LOGO_EASE) });
		}
	}

	// ── Reveal sequence ──
	function startReveal() {
		if (revealStarted) return;
		// One logo swap always completes before the curtain moves. The loading
		// screen is only up for a couple of seconds, so without this the reveal
		// beat the first swap every time and the marks never changed at all.
		//
		// __preloaderLogoSwapDone defaults to TRUE and is only cleared when the
		// cycle actually starts (two marks, motion allowed, gsap present). A
		// preloader that waits for something which will never happen would hide
		// the whole site, so every failure path has to fall through here.
		if (window.__preloaderLogoSwapDone === false) {
			window.__preloaderLogoAfterSwap = startReveal;
			return;
		}
		revealStarted = true;
		stopIllu(); // stop the illustration cycle + clear its timers
		stopLogo(); // settle the mark before the curtain moves
		clearInterval(dotsTimer);
		gsap.killTweensOf(fillState);
		applyFill(100);
		// percentage → "READY"
		if (percentEl) percentEl.textContent = CFG.READY_LABEL;
		var tl = gsap.timeline({
			onComplete: function () {
				removePre();
				unlockScroll();
				// Removing the curtain, mounting the 3D stage and settling the hero
				// video all change the document height AFTER every ScrollTrigger has
				// measured itself. Anything below the fold — the odometers most
				// visibly — would then be armed against stale positions. Recompute
				// once here, and again a beat later for whatever is still arriving.
				if (window.ScrollTrigger) {
					window.ScrollTrigger.refresh();
					setTimeout(function () {
						window.ScrollTrigger.refresh();
					}, 600);
				}
			},
		});
		// ── Phase 1: the OVERLAY approach (the grid cells are never touched) ──
		// Take the overlay element, which sits outside the grid. Its starting bbox
		// matches the pattern cell exactly (top-right), then it animates out to the
		// full viewport. The grid cells stay where they are and the overlay simply
		// covers them (z=5).
		var parentRect = pre.getBoundingClientRect();
		if (overlayEl && patternEl) {
			var patternRect = patternEl.getBoundingClientRect();
			// Overlay start: exactly over the pattern cell
			gsap.set(overlayEl, {
				display: "flex",
				top: patternRect.top - parentRect.top + "px",
				left: patternRect.left - parentRect.left + "px",
				width: patternRect.width + "px",
				height: patternRect.height + "px",
			});
			// Set the overlay percentage to "READY" up front, so it already reads correctly as it slides
			if (overlayPercentEl) overlayPercentEl.textContent = CFG.READY_LABEL;
			// Hide the original pattern (the overlay already covers it) so there is
			// no visual duplicate during the squeeze
			gsap.set(patternEl, { autoAlpha: 0 });

			// Step 1a: the overlay grows LEFT, closing the width gap from the right
			tl.to(
				overlayEl,
				{
					left: "0px",
					width: parentRect.width + "px",
					duration: CFG.SQUEEZE_DUR,
					ease: ez(CFG.SQUEEZE_EASE),
				},
				">",
			);
			// Step 1b: in parallel, the inner elements of the bottom cards slide DOWN
			// and fade on a 0.1s stagger. Order: left head → left illustration →
			// right head → right illustration.
			var slideTargets = [
				cardLeftEl && cardLeftEl.querySelector(".card_head"),
				cardLeftEl && cardLeftEl.querySelector(".card_illustration-wrap"),
				cardRightEl && cardRightEl.querySelector(".card_head"),
				cardRightEl && cardRightEl.querySelector(".card_illustration-wrap"),
			].filter(Boolean);
			if (slideTargets.length) {
				tl.to(
					slideTargets,
					{
						y: CFG.CARD_DOWN_Y,
						autoAlpha: 0,
						duration: CFG.CARD_DOWN_DUR,
						stagger: CFG.CARD_DOWN_STAGGER,
						ease: ez(CFG.CARD_DOWN_EASE),
					},
					"<+0.1",
				);
			}
			// Step 1c: the overlay grows DOWN — height 50%→100vh, covering the bottom cells
			tl.to(
				overlayEl,
				{
					top: "0px",
					height: parentRect.height + "px",
					duration: CFG.PATTERN_DOWN_DUR,
					ease: ez(CFG.PATTERN_DOWN_EASE),
				},
				">-0.1",
			);
			// Step 1d: a 0.4s pause, showing "READY" centred on the full viewport
			tl.to({}, { duration: 0.4 });
		}
		// ── Phase 2: the video starts and the WHOLE preloader (overlay included)
		// moves yPercent -100 ──
		// The "riseStart" label marks the moment the curtain begins to lift.
		// HERO_LEAD / BTN_LEAD / NAV_LEAD are DELAYS measured from riseStart (not
		// backwards offsets from the end of the long parallel DARKEN_DUR).
		// A smaller LEAD plays earlier, a larger one later; negative values force
		// it to play BEFORE the rise starts.
		tl.add(function () {
			if (heroVideo && heroVideo.play) {
				try {
					heroVideo.play();
				} catch (e) {}
			}
		});
		tl.addLabel("riseStart");
		tl.to(pre, { yPercent: -100, duration: CFG.RISE_DUR, ease: ez(CFG.RISE_EASE) }, "riseStart");
		// the hero emerges from darkness + the video scales 1.4→1.0, alongside the rise
		if (darkEl) {
			tl.fromTo(
				darkEl,
				{ backgroundColor: "rgba(0,0,0," + CFG.DARKEN_FROM + ")" },
				{
					backgroundColor: "rgba(0,0,0," + CFG.DARKEN_TO + ")",
					duration: CFG.DARKEN_DUR,
					ease: ez(CFG.DARKEN_EASE),
				},
				"riseStart",
			);
		}
		if (heroVideo) {
			tl.fromTo(
				heroVideo,
				{ scale: CFG.SCALE_FROM },
				{ scale: 1, duration: CFG.SCALE_DUR, ease: ez(CFG.SCALE_EASE) },
				"riseStart",
			);
		}
		// Phase 5 — the hero heading and lead, revealed behind bars. HERO_LEAD is
		// the delay after riseStart (0 = together with the rise, 1.4 = once the rise
		// has finished, 0.5 = halfway).
		tl.add(function () {
			if (heroSection) playHeadingsRevealIn(heroSection);
		}, "riseStart+=" + CFG.HERO_LEAD);
		// Phase 5b — the hero button fades up. BTN_LEAD is the delay after riseStart.
		tl.add(function () {
			if (heroBtn) {
				gsap.fromTo(
					heroBtn,
					{ autoAlpha: 0, y: "0.6em" },
					{ autoAlpha: 1, y: 0, duration: CFG.BTN_DUR, ease: ez(CFG.BTN_EASE) },
				);
			}
		}, "riseStart+=" + CFG.BTN_LEAD);
		// Phase 6 — the nav. NAV_LEAD is the delay after riseStart.
		tl.add(function () {
			if (navItems.length) {
				gsap.to(navItems, {
					autoAlpha: 1,
					duration: CFG.NAV_DUR,
					stagger: CFG.NAV_STAGGER,
					ease: ez(CFG.NAV_EASE),
				});
			}
		}, "riseStart+=" + CFG.NAV_LEAD);
	}

	// Failsafe: if the fill tween or the reveal never completed (an error), force
	// the page visible. The normal path is fill onComplete → startReveal.
	setTimeout(
		function () {
			showAllInstant();
			if (heroSection) playHeadingsRevealIn(heroSection);
			removePre();
			unlockScroll();
		},
		(CFG.FILL_DUR + CFG.SQUEEZE_DUR + CFG.RISE_DUR + 4) * 1000,
	);
}

/* ── The logo intro, started the moment this file is parsed ──────────────────
 *
 * Deliberately NOT inside initPreloader(). That runs from boot(), which waits on
 * core.js's dynamic import of Lenis — a wait long enough that the loading screen
 * was on show, finished-looking, before the animation began. This file sits
 * after gsap.min.js in the chain and after the markup in the document, so both
 * are ready here and the intro can open on the first frame.
 *
 * The from-state is CSS (see preloader.css), so there is nothing to set up and
 * nothing to flash: this only plays the way out of it.
 */
(function startLogoIntro() {
	if (typeof window === "undefined" || typeof gsap === "undefined") return;
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	var panel = document.querySelector("[data-preloader-logo]");
	var marks = panel ? panel.querySelectorAll("img") : null;
	if (!panel || !marks || !marks.length) return;
	var mark = marks[0];

	var ease = typeof CustomEase !== "undefined" && gsap.parseEase("smoothOut") ? "smoothOut" : "power3.out";
	/* x: 0 is not redundant. The from-state is declared in CSS as
	   translateX(-6%) so the first painted frame is already the start of the
	   animation; GSAP parses that into its own x (-26.3px at this size) and then
	   adds the xPercent below on top of it. The tweens animate xPercent back to
	   0, which leaves the parsed x behind for good -- the mark settled 26px left
	   of where it belongs. Zeroing x here hands the whole offset to xPercent,
	   and the from-state still matches the CSS to the pixel. */
	gsap.set(mark, { scale: 1.18, xPercent: -6, x: 0 });

	/* The two marks alternate while the screen is up. HOLD is how long each one
	   stays; SWAP matches the opening wipe, so a change reads as the same
	   gesture rather than a second, unrelated effect. */
	var HOLD = 2;
	var SWAP = 0.7;
	var current = 0;

	// From here on the reveal waits for a swap. Set only once the cycle is
	// certain to run — every early return above leaves it alone, so a preloader
	// with one mark, or with motion turned down, still lifts on time.
	if (marks.length > 1) window.__preloaderLogoSwapDone = false;

	function breathe(el) {
		window.__preloaderLogoBreathe = gsap.to(el, {
			scale: 1.035,
			duration: 1.8,
			ease: "sine.inOut",
			yoyo: true,
			repeat: -1,
		});
	}

	function queueSwap() {
		if (marks.length < 2 || window.__preloaderLogoDone) return;
		window.__preloaderLogoTimer = gsap.delayedCall(HOLD, function () {
			// The reveal may have begun while this was waiting.
			if (window.__preloaderLogoDone) return;
			if (window.__preloaderLogoBreathe) {
				window.__preloaderLogoBreathe.kill();
				window.__preloaderLogoBreathe = null;
			}
			var from = marks[current];
			current = (current + 1) % marks.length;
			var to = marks[current];

			var swap = gsap.timeline({
				onComplete: function () {
					window.__preloaderLogoSwap = null;
					window.__preloaderLogoSwapDone = true;
					// startReveal() parks itself here when the page finishes loading
					// mid-swap, so the curtain waits for the mark to land.
					var waiting = window.__preloaderLogoAfterSwap;
					if (waiting) {
						window.__preloaderLogoAfterSwap = null;
						waiting();
						return;
					}
					breathe(to);
					queueSwap();
				},
			});
			// The incoming mark arrives exactly the way the first one did: offset
			// and scaled up, easing back as the outgoing one fades.
			// x: 0 for the same reason as the intro above.
			swap.set(to, { opacity: 0, scale: 1.18, xPercent: -6, x: 0 });
			swap.to(from, { opacity: 0, duration: SWAP, ease: ease }, 0);
			swap.to(to, { opacity: 1, scale: 1, xPercent: 0, duration: SWAP, ease: ease }, 0);
			window.__preloaderLogoSwap = swap;
		});
	}

	var tl = gsap.timeline();
	tl.to(panel, { clipPath: "inset(0 0% 0 0)", duration: 0.7, ease: ease });
	tl.to(mark, { opacity: 1, scale: 1, xPercent: 0, duration: 0.9, ease: ease }, "<0.1");
	tl.add(function () {
		// Kept on window so startReveal()'s stopLogo() can land it before the
		// curtain lifts, without the two sharing a scope.
		breathe(mark);
	});

	// Started here rather than at the end of the intro, so the two-second hold
	// runs ALONGSIDE the opening wipe instead of after it. Queued at the end it
	// put the first swap at 3.6s and the screen at 4.3s minimum; in parallel the
	// swap lands at 2.7s, which is what "each mark shows for two seconds" means
	// from the visitor's side. The mark's own intro tween is done by 1.6s, so
	// the swap never interrupts it.
	queueSwap();
})();
