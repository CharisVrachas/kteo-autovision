/* hover.js -- button / nav / footer / case-card hover effects */
"use strict";

function initButtonHover() {
	if (!has.gsap) return;
	document.querySelectorAll(".button-wrap").forEach((btn) => {
		const arrow = btn.querySelector(".icon-arrow:not(.is-absolute)");
		const arrowNew = btn.querySelector(".icon-arrow.is-absolute");
		const text = btn.querySelector(".button-text:not(.is-absolute)");
		const textNew = btn.querySelector(".button-text.is-absolute");
		const hoverTl = gsap.timeline({ paused: true });
		if (arrow && arrowNew) {
			hoverTl.to([arrow, arrowNew], { x: "100%", duration: 0.4, ease: CARD_EASE }, 0);
		}
		if (text && textNew) {
			hoverTl.to([text, textNew], { y: "-100%", duration: 0.4, ease: CARD_EASE }, 0);
		}
		btn.addEventListener("mouseenter", () => hoverTl.play());
		btn.addEventListener("mouseleave", () => hoverTl.reverse());
	});
}
function initHoverTextMirror() {
	document.querySelectorAll(".nav_item, .nav_contact").forEach((el) => {
		if (el.hasAttribute("data-text")) return;
		const inner = el.querySelector(".nav_item-text");
		const text = (inner ? inner.textContent : el.textContent).trim();
		if (text) el.setAttribute("data-text", text);
	});
}
function initFooterLinkHover() {
	document.querySelectorAll(".footer-link").forEach((link) => {
		if (link.querySelector(".footer-link_dup")) return;
		const text = link.querySelector(".text_size-small");
		if (!text) return;
		const dup = text.cloneNode(true);
		dup.classList.add("footer-link_dup");
		dup.setAttribute("aria-hidden", "true");
		link.appendChild(dup);
	});
}
