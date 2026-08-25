/* nav.js -- navbar theme-on-scroll, mobile menu, active link */
"use strict";

function initMobileMenu() {
	// The mobile menu (≤479px): a MENU/X toggle, a panel that slides down from
	// the top, and a dimming scrim. The nav is persistent (it lives outside the
	// Barba container), so this initialises ONCE behind an idempotent guard and
	// its listeners survive Barba navigation.
	if (typeof document === "undefined") return;
	if (window.__appMobileMenuInit) return;
	var nav = document.querySelector(".nav");
	var toggle = document.querySelector("[data-menu-toggle]");
	var panel = document.querySelector("[data-menu-panel]");
	var scrim = document.querySelector("[data-menu-scrim]");
	if (!nav || !toggle || !panel) return;
	window.__appMobileMenuInit = true;

	var items = panel.querySelectorAll(".nav_menu-item");
	var open = false;
	function setInitial() {
		if (!window.gsap) return;
		window.gsap.set(panel, { yPercent: -100, visibility: "hidden" });
		// Items start hidden and fade in one by one on open (see openMenu).
		if (items.length) window.gsap.set(items, { opacity: 0 });
		if (scrim) window.gsap.set(scrim, { autoAlpha: 0 });
	}
	function openMenu() {
		if (open) return;
		open = true;
		// The panel's theme follows the navbar's: light → a light menu, hero/dark →
		// a dark one. data-theme-section switches the mapped tokens.
		var navTheme = nav.getAttribute("data-theme-nav");
		if (navTheme === "light") panel.removeAttribute("data-theme-section");
		else panel.setAttribute("data-theme-section", "dark");
		nav.setAttribute("data-menu-open", "");
		toggle.setAttribute("aria-expanded", "true");
		panel.setAttribute("aria-hidden", "false");
		if (window.__lenis && typeof window.__lenis.stop === "function") window.__lenis.stop();
		if (window.gsap) {
			window.gsap.set(panel, { visibility: "visible" });
			window.gsap.to(panel, {
				yPercent: 0,
				duration: 0.5,
				ease: "smoothOut",
				overwrite: true,
			});
			// Items appear in sequence, top to bottom — the same principle and timing
			// as the scroll section-reveal (opacity 0→1, 0.5s, ease-out cubic,
			// stagger 0.08). Driven by GSAP rather than a CSS class, to avoid the
			// transition-delay race. The 0.1 delay starts them once the panel is
			// already moving.
			if (items.length)
				window.gsap.to(items, {
					opacity: 1,
					duration: 0.5,
					ease: "power2.out",
					stagger: 0.08,
					delay: 0.1,
					overwrite: true,
				});
			if (scrim) window.gsap.to(scrim, { autoAlpha: 1, duration: 0.3, overwrite: true });
		}
	}
	function closeMenu() {
		if (!open) return;
		open = false;
		nav.removeAttribute("data-menu-open");
		toggle.setAttribute("aria-expanded", "false");
		panel.setAttribute("aria-hidden", "true");
		if (window.__lenis && typeof window.__lenis.start === "function") window.__lenis.start();
		if (window.gsap) {
			window.gsap.to(panel, {
				yPercent: -100,
				duration: 0.4,
				ease: "smoothOut",
				overwrite: true,
				onComplete: function () {
					window.gsap.set(panel, { visibility: "hidden" });
					if (items.length) window.gsap.set(items, { opacity: 0 });
				},
			});
			if (scrim) window.gsap.to(scrim, { autoAlpha: 0, duration: 0.3, overwrite: true });
		} else {
			panel.style.visibility = "hidden";
		}
	}
	toggle.addEventListener("click", function (e) {
		e.preventDefault();
		open ? closeMenu() : openMenu();
	});
	if (scrim) scrim.addEventListener("click", closeMenu);
	panel.querySelectorAll("a").forEach(function (a) {
		a.addEventListener("click", function () {
			closeMenu();
		});
	});
	setInitial();
	// Mark the active item on a cold load (Barba goes through applyShellStateFrom).
	syncActiveNavLinks();
}
function initNavContactScroll() {
	// The "get in touch" button in the nav: a smooth scroll to .section_cta via
	// GSAP ScrollToPlugin with a "power3.inOut" ease. Lenis is stopped for the
	// duration — otherwise the pinned sections on the about page (scroller, globe)
	// steal the Lenis tween and it stalls partway down.
	//
	// Two guards against overshooting on pinned pages:
	//  1) refresh + rAF before computing the target, letting the layout settle
	//     after pin-spacing is recalculated.
	//  2) an onComplete correction pass — if the layout shifted mid-animation and
	//     the final position missed the target, close the gap over 0.4s.
	const links = document.querySelectorAll(".nav_contact");
	if (!links.length) return;
	const startScroll = () => {
		const cta = document.querySelector(".section_cta");
		if (!cta) return;
		const targetY = cta.getBoundingClientRect().top + window.scrollY;
		const lenis = window.__lenis;
		const hasScrollTo = typeof gsap !== "undefined" && gsap.plugins && gsap.plugins.scrollTo;
		if (!hasScrollTo) {
			window.scrollTo({ top: targetY, behavior: "smooth" });
			return;
		}
		if (lenis) lenis.stop();
		gsap.to(window, {
			duration: 1.5,
			ease: "power3.inOut",
			scrollTo: { y: targetY, autoKill: false },
			onComplete: () => {
				// Correction pass: if the final position drifted because of
				// pin-spacing, finish the scroll with no further delay.
				const ctaNow = document.querySelector(".section_cta");
				if (!ctaNow) {
					if (lenis) lenis.start();
					return;
				}
				const finalY = ctaNow.getBoundingClientRect().top + window.scrollY;
				const diff = Math.abs(window.scrollY - finalY);
				if (diff > 10) {
					gsap.to(window, {
						duration: 0.4,
						ease: "power2.out",
						scrollTo: { y: finalY, autoKill: false },
						onComplete: () => {
							if (lenis) lenis.start();
						},
					});
				} else if (lenis) {
					lenis.start();
				}
			},
		});
	};
	links.forEach((link) => {
		if (link.dataset.ctaScrollWired) return;
		link.dataset.ctaScrollWired = "1";
		// capture:true + stopImmediatePropagation guarantee this handler runs
		// BEFORE Barba's document-level delegation. Without it Barba catches the
		// click first and navigates to the contacts page — the right fallback on a
		// page with no CTA section, but on pages that have one we want the smooth
		// scroll instead.
		link.addEventListener(
			"click",
			(e) => {
				if (!document.querySelector(".section_cta")) return;
				e.preventDefault();
				e.stopImmediatePropagation();
				if (window.ScrollTrigger) window.ScrollTrigger.refresh();
				requestAnimationFrame(startScroll);
			},
			true,
		);
	});
}
function initNavThemeScroll() {
	// Idempotent: this runs again on every Barba transition (the nav is persistent
	// and lives outside the container). Without a cleanup the old scroll/resize
	// listeners ACCUMULATE — each one holding the previous page's detached
	// sections and the persistent nav → a leak, plus a possible race over
	// data-theme-nav when pages change. So remove the previous listeners first.
	if (window.__appNavThemeCleanup) {
		window.__appNavThemeCleanup();
		window.__appNavThemeCleanup = null;
	}
	const navBar = document.querySelector("[data-nav-bar-height]");
	const offset = navBar ? navBar.offsetHeight : 0;
	// Filter out position:fixed elements — a fixed overlay ALWAYS crosses the
	// navbar line, which pinned the theme to dark for everything below it in the
	// DOM. Only sections in the document flow may decide the navbar theme.
	const sections = Array.from(document.querySelectorAll("[data-theme-section]")).filter(
		(el) => getComputedStyle(el).position !== "fixed",
	);
	const navTargets = document.querySelectorAll("[data-theme-nav]");
	function syncNavHeightVar() {
		const h = navBar ? navBar.offsetHeight : 0;
		document.documentElement.style.setProperty("--nav-height", h + "px");
	}
	syncNavHeightVar();
	if (!sections.length || !navTargets.length) return;
	function setTheme(theme) {
		if (!theme) return;
		navTargets.forEach((el) => {
			if (el.getAttribute("data-theme-nav") !== theme) {
				el.setAttribute("data-theme-nav", theme);
			}
		});
	}
	function update() {
		for (const sec of sections) {
			const rect = sec.getBoundingClientRect();
			if (rect.top <= offset && rect.bottom >= offset) {
				setTheme(sec.getAttribute("data-theme-section"));
				return;
			}
		}
		// Fallback for when no section crosses the navbar line at all (a sub-pixel
		// boundary, the page's padding-top, or the moment before the scroll settles
		// after Barba). Take the FIRST visible section (rect.top < viewport.bottom),
		// i.e. the one at the top — otherwise the theme sticks to the previous
		// page's (it used to stay hero/dark after leaving the homepage).
		const vh = window.innerHeight;
		for (const sec of sections) {
			const rect = sec.getBoundingClientRect();
			if (rect.bottom > offset && rect.top < vh) {
				setTheme(sec.getAttribute("data-theme-section"));
				return;
			}
		}
	}
	let ticking = false;
	function onScroll() {
		if (ticking) return;
		ticking = true;
		requestAnimationFrame(() => {
			update();
			ticking = false;
		});
	}
	update();
	// Repeat the update after things settle: Lenis resets the scroll
	// asynchronously after a Barba arrival, so the first update may have read the
	// OLD position (the wrong section under the navbar → the wrong theme). Re-check.
	requestAnimationFrame(update);
	setTimeout(update, 200);
	setTimeout(update, 500);
	document.addEventListener("scroll", onScroll, { passive: true });
	window.addEventListener("resize", onScroll, { passive: true });
	window.addEventListener("resize", syncNavHeightVar, { passive: true });
	// Keep the cleanup around for the next call (idempotency).
	window.__appNavThemeCleanup = function () {
		document.removeEventListener("scroll", onScroll);
		window.removeEventListener("resize", onScroll);
		window.removeEventListener("resize", syncNavHeightVar);
	};
}
// Marks the active nav link by pathname, in both the desktop nav (.nav_item) and
// the mobile menu (.nav_menu-item). Called from Barba (applyShellStateFrom) and
// on a cold load (initMobileMenu), so the active item stays highlighted and
// unclickable across every transition. Trailing slashes are normalised on both
// the pathname and the href.
function syncActiveNavLinks() {
	var path = window.location.pathname;
	document.querySelectorAll(".nav_item, .nav_menu-item").forEach(function (a) {
		var href = a.getAttribute("href") || "";
		a.classList.toggle("is-active", href === path);
	});
}

// Closes an open desktop dropdown once you click through it.
//
// The panel opens on :hover and :focus-within alone, with no JS -- which is
// what makes it work without scripting and from the keyboard. The catch is
// navigation: Barba swaps <main> without a reload, so after the click the
// pointer is still inside the wrapper and the clicked link still holds focus.
// Both conditions still hold, and the panel stays hanging open over the page
// you just arrived at.
//
// So: on click, suppress that one wrapper with a class, and release it when the
// pointer leaves or focus moves out. The next hover opens it normally again.
// Nothing here overrides the CSS state machine -- it only adds an "and not
// suppressed" term to it.
function initNavSubmenu() {
	var READY = "data-submenu-ready";
	document.querySelectorAll(".nav_item-wrap").forEach(function (wrap) {
		if (wrap.hasAttribute(READY)) return;
		wrap.setAttribute(READY, "");

		function release() {
			wrap.classList.remove("is-suppressed");
		}

		wrap.querySelectorAll("a").forEach(function (a) {
			a.addEventListener("click", function () {
				wrap.classList.add("is-suppressed");
				// Drop focus too: :focus-within would otherwise hold the panel
				// open even after the pointer has left.
				if (typeof a.blur === "function") a.blur();
			});
		});

		wrap.addEventListener("mouseleave", release);
		wrap.addEventListener("focusout", function (e) {
			// relatedTarget is where focus went; null when it left the document.
			if (!e.relatedTarget || !wrap.contains(e.relatedTarget)) release();
		});
	});

	// Escape closes whatever is open, and returns focus to its trigger.
	if (!window.__navSubmenuEscape) {
		window.__navSubmenuEscape = true;
		document.addEventListener("keydown", function (e) {
			if (e.key !== "Escape") return;
			var open = document.querySelector(".nav_item-wrap:focus-within");
			if (!open) return;
			open.classList.add("is-suppressed");
			var trigger = open.querySelector("a.nav_item");
			if (trigger) trigger.blur();
		});
	}
}
