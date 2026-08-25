/* orisa-portfolio.js — the two effects Orisa's "Home 2 Section 6" runs.
 *
 * Source: Orisa v1.1.0, main.js §20 (scale-img-from-to) and §38
 * (fade-class-active). Both were already plain GSAP there, so the bodies below
 * are Orisa's, unchanged — same attribute names, same defaults, same triggers.
 *
 * Two of the section's other behaviours are deliberately NOT here:
 *
 *   · §17 `at-hover-item` is a WebGL displacement hover that needs the
 *     `hoverEffect` library and an `.at-hover-img` wrapper around each image.
 *     Neither exists in this project, and the markup carries no `.at-hover-img`,
 *     so in Orisa itself this code would find nothing to bind. Bringing the
 *     library across for it would mean another vendor bundle for a hover.
 *   · nothing else. §18, which pins the heading and flies it diagonally across
 *     the section, IS included below -- the title block came across with the
 *     markup, so there is a `.portfolio-text` for it to act on.
 *
 * Wiring, as with the card stack: app.js calls this on every page rather than
 * once at DOMContentLoaded, because Barba swaps <main> without a reload. The
 * per-element guard makes the repeat calls harmless.
 */
"use strict";

function initOrisaPortfolio() {
	if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

	// ── Orisa §20: scale-img-from-to ──
	const scaleImage = document.querySelectorAll(".scale-img-from-to");
	scaleImage.forEach((section) => {
		if (!section || section.__orisaScaleInit) return;
		section.__orisaScaleInit = true;
		var value1 = section.getAttribute("data-value-1");
		var value2 = section.getAttribute("data-value-2");

		if (window.innerWidth < 1200) {
			value1 = Math.max(0.95, value1);
		}

		gsap.fromTo(
			section,
			{
				ease: "sine",
				scale: value1,
			},
			{
				scale: value2,
				scrollTrigger: {
					trigger: section,
					scrub: true,
					toggleActions: "play none none reverse",
				},
			},
		);
	});

	// ── Orisa §18: section-to-title zoom, desktop only ──
	if (!window.__orisaPortfolioPinned) {
		window.__orisaPortfolioPinned = true;
		gsap.matchMedia().add("(min-width: 1200px)", () => {
			const portfolioArea = document.querySelector(".portfolio-area");
			const portfolioText = document.querySelector(".portfolio-text");

			if (portfolioArea && portfolioText) {
				let portfolioline = gsap.timeline({
					scrollTrigger: {
						trigger: portfolioArea,
						start: "top center-=200",
						pin: portfolioText,
						end: "bottom bottom+=10",
						markers: false,
						pinSpacing: false,
						scrub: 1,
					},
				});

				const areaRect = portfolioArea.getBoundingClientRect();
				const textRect = portfolioText.getBoundingClientRect();
				const endX = areaRect.width - textRect.width - 50;
				const endY = areaRect.height - textRect.height - 50;

				portfolioline.fromTo(portfolioText, { x: 0, y: 0, scale: 1 }, { x: endX, y: endY, scale: 1, duration: 1, ease: "none" });

				gsap.to(portfolioText, {
					scrollTrigger: {
						trigger: portfolioArea,
						start: "top center-=100",
						end: "bottom bottom+=10",
						scrub: 1,
					},
					opacity: 0,
				});
			}
		});
	}

	// ── This project's own: alternating slide-in on phones and tablets ──
	//
	// Below 992px the three cards lose their offsets and stack in one column, so
	// the diagonal that carries the desktop layout is gone and they arrive as a
	// plain list. This gives each one a direction instead: the first from the
	// left, the second from the right, the third from the left again.
	//
	// gsap.matchMedia() rather than a width check, so it binds and unbinds itself
	// as the viewport crosses the breakpoint and leaves no stale triggers behind.
	if (!window.__orisaPortfolioSlide) {
		window.__orisaPortfolioSlide = true;
		gsap.matchMedia().add("(max-width: 991px)", () => {
			const cards = document.querySelectorAll(".orisa-portfolio .alt-portfolio-item");
			cards.forEach((card, i) => {
				gsap.from(card, {
					autoAlpha: 0,
					// 48px, not a percentage: a transform still counts towards the
					// document's scroll width, and a card sliding a third of its own
					// width would put a horizontal scrollbar on a phone.
					x: i % 2 === 0 ? -48 : 48,
					duration: 0.8,
					ease: "power2.out",
					scrollTrigger: {
						trigger: card,
						start: "top 85%",
					},
				});
			});
		});
	}

	// ── Orisa §38: fade-class-active ──
	gsap.utils.toArray(".at_fade_anim").forEach((item) => {
		if (!item || item.__orisaFadeInit) return;
		item.__orisaFadeInit = true;
		let tp_fade_offset = item.getAttribute("data-fade-offset") || 40,
			tp_duration_value = item.getAttribute("data-duration") || 0.75,
			tp_fade_direction = item.getAttribute("data-fade-from") || "bottom",
			tp_onscroll_value = item.getAttribute("data-on-scroll") || 1,
			tp_delay_value = item.getAttribute("data-delay") || 0.15,
			tp_ease_value = item.getAttribute("data-ease") || "power2.out",
			tp_anim_setting = {
				opacity: 0,
				ease: tp_ease_value,
				duration: tp_duration_value,
				delay: tp_delay_value,
				x: tp_fade_direction == "left" ? -tp_fade_offset : tp_fade_direction == "right" ? tp_fade_offset : 0,
				y: tp_fade_direction == "top" ? -tp_fade_offset : tp_fade_direction == "bottom" ? tp_fade_offset : 0,
			};
		if (tp_onscroll_value == 1) {
			tp_anim_setting.scrollTrigger = {
				trigger: item,
				start: "top 85%",
			};
		}
		gsap.from(item, tp_anim_setting);
	});
}
