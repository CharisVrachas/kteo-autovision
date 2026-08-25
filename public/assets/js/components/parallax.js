/* parallax.js -- global, hero-darken and footer parallax */
"use strict";

function initFooterParallax() {
	document.querySelectorAll("[data-footer-parallax]").forEach((el) => {
		const tl = gsap.timeline({
			scrollTrigger: {
				trigger: el,
				start: "clamp(top bottom)",
				end: "clamp(top top)",
				scrub: true,
			},
		});
		const inner = el.querySelector("[data-footer-parallax-inner]");
		const dark = el.querySelector("[data-footer-parallax-dark]");
		if (inner) tl.from(inner, { yPercent: -50, ease: "linear" });
		if (dark) tl.from(dark, { opacity: 0.5, ease: "linear" }, "<");
	});
}
function initHeroScrollDarken() {
	if (!has.ScrollTrigger) return;
	document.querySelectorAll(".section_hero").forEach((section) => {
		const overlay = section.querySelector(".hero_scroll-darken");
		if (!overlay) return;
		gsap.fromTo(
			overlay,
			{ opacity: 0 },
			{
				opacity: 0.95,
				ease: "none",
				scrollTrigger: {
					trigger: section,
					start: "top top",
					end: "bottom 20%",
					// animation completes when bottom of hero reaches 20% from top of viewport ≈ 80% scrolled
					scrub: true,
				},
			},
		);
	});
}
function initGlobalParallax() {
	if (!has.gsap || !has.ScrollTrigger) return;
	const mm = gsap.matchMedia();
	mm.add(
		{
			isMobile: "(max-width:479px)",
			isMobileLandscape: "(max-width:767px)",
			isTablet: "(max-width:991px)",
			isDesktop: "(min-width:992px)",
		},
		(context) => {
			const { isMobile, isMobileLandscape, isTablet } = context.conditions;
			const ctx = gsap.context(() => {
				document.querySelectorAll('[data-parallax="trigger"]').forEach((trigger) => {
					const disable = trigger.getAttribute("data-parallax-disable");
					if (
						(disable === "mobile" && isMobile) ||
						(disable === "mobileLandscape" && isMobileLandscape) ||
						(disable === "tablet" && isTablet)
					)
						return;
					const target = trigger.querySelector('[data-parallax="target"]') || trigger;
					const direction = trigger.getAttribute("data-parallax-direction") || "vertical";
					const prop = direction === "horizontal" ? "xPercent" : "yPercent";
					const scrubAttr = trigger.getAttribute("data-parallax-scrub");
					const scrub = scrubAttr ? parseFloat(scrubAttr) : true;
					const startAttr = trigger.getAttribute("data-parallax-start");
					const startVal = startAttr !== null ? parseFloat(startAttr) : 20;
					const endAttr = trigger.getAttribute("data-parallax-end");
					const endVal = endAttr !== null ? parseFloat(endAttr) : -20;
					const scrollStart = `clamp(${trigger.getAttribute("data-parallax-scroll-start") || "top bottom"})`;
					const scrollEnd = `clamp(${trigger.getAttribute("data-parallax-scroll-end") || "bottom top"})`;
					gsap.fromTo(
						target,
						{ [prop]: startVal },
						{
							[prop]: endVal,
							ease: "none",
							scrollTrigger: {
								trigger,
								start: scrollStart,
								end: scrollEnd,
								scrub,
							},
						},
					);
				});
			});
			return () => ctx.revert();
		},
	);
}
