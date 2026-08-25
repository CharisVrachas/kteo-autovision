/* sliders.js -- product image slider and the pinned fullscreen scroller */
"use strict";

function initScroller() {
	if (!has.ScrollTrigger) return;
	const SHOWN = "inset(0% 0% 0% 0%)";
	const HIDDEN = "inset(100% 0% 0% 0%)";
	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	// ≤479px: the pinned scrub is unnecessary — show the static .scroller_mobile
	// instead (CSS hides .scroller_slides). Skip the scrub exactly as
	// reduced-motion does.
	const isMobile = window.matchMedia("(max-width: 479px)").matches;
	document.querySelectorAll("[data-scroller]").forEach((root) => {
		const media = root.querySelectorAll("[data-scroller-media]");
		const track = root.querySelector("[data-scroller-track]");
		const outer = root.parentElement;
		const n = media.length;
		if (n < 2 || !track || !outer) return;
		media.forEach((m, i) => gsap.set(m, { clipPath: i === 0 ? SHOWN : HIDDEN, zIndex: i }));
		gsap.set(track, { yPercent: 0 });
		if (reduced || isMobile) {
			outer.style.height = "auto";
			return;
		}
		const navHeight = () => {
			var _a;
			return ((_a = document.querySelector(".nav")) == null ? void 0 : _a.offsetHeight) || 0;
		};
		const tl = gsap.timeline({
			scrollTrigger: {
				trigger: outer,
				start: () => "top top+=" + navHeight(),
				end: "bottom bottom",
				scrub: true,
			},
		});
		for (let i = 1; i < n; i++) {
			tl.to(media[i], { clipPath: SHOWN, ease: "none", duration: 1 }, i - 1);
			tl.to(track, { yPercent: (-100 / n) * i, ease: "none", duration: 1 }, i - 1);
		}
	});
}
