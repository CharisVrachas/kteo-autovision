/* orisa-scroll-zoom.js — the image that opens up as you scroll.
 *
 * Source: Orisa v1.1.0, main.js §24 "postbox-scroll-zoom", used by "Home 2
 * Section 11" of index-2.html. The timeline below is Orisa's: pin the
 * 100vh `.postbox-item`, and scrub the `.postbox-thumb` from 20% × 20% to
 * 100% × 100% over one viewport of scroll.
 *
 * One difference. Orisa's block is a video showreel, so its version bails out
 * unless it finds a `.postbox-scroll-zoom-play` button and fades that in at
 * 78% of the timeline. There is no video here — just the photograph — so the
 * button is optional: the guard drops to the thumb alone and the play step is
 * skipped when there is nothing to play.
 */
"use strict";

function initOrisaScrollZoom() {
	if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;
	// Pinning a viewport and scrubbing a 5x scale is exactly the kind of motion
	// this setting asks to be spared. The CSS counterpart shows the photograph at
	// full size instead of leaving it at the 20% starting box.
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	// Defined in orisa-vcards.js, which Base.astro loads first; see there for why
	// the em-based clearance token cannot be trusted inside an Orisa scope.
	if (typeof publishNavClearance === "function") publishNavClearance();

	document.querySelectorAll(".postbox-scroll-zoom").forEach((section) => {
		if (section.__orisaZoomInit) return;
		section.__orisaZoomInit = true;

		const itemwrap = section.querySelector(".postbox-item");
		const thumb = section.querySelector(".postbox-thumb");
		const playBtn = section.querySelector(".postbox-scroll-zoom-play");
		if (!thumb) return;

		const tl = gsap.timeline({
			scrollTrigger: {
				trigger: itemwrap,
				start: "top top",
				end: "bottom top",
				pin: true,
				scrub: 1,
				toggleActions: "play none none reverse",
				invalidateOnRefresh: true,
				markers: false,
			},
		});
		tl.fromTo(
			thumb,
			{ width: "20%", height: "20%", duration: 1, ease: "none" },
			{ width: "100%", height: "100%", duration: 1, ease: "none" },
			"<",
		);
		if (playBtn) {
			tl.fromTo(playBtn, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, ease: "none" }, 0.78);
		}
		tl.call(() => section.classList.add("postbox-scroll-zoom-ready"), [], 0.78);
	});
}
