/* card-shapes.js -- animated shape stacks inside cards */
"use strict";


/* ── Shared layout for the drawn cards ────────────────────────────────────────
   Hoisted out of initScrollCardShapes so preloader.js can place the very same
   drawings the very same way. card-shapes.js loads before preloader.js (see the
   list in Base.astro), so the globals below exist by the time it runs. Keeping
   one copy matters: the queue only stays clear of itself because the gaps are
   derived from the drawings' own proportions, and a second, drifting copy of
   those numbers would put the vehicles back on top of each other.
   ──────────────────────────────────────────────────────────────────────────── */
const VEHICLE_GAP = 0.42; // clear space between two vehicles, in height units
const VEHICLE_STEP = 0.35; // seconds between one vehicle appearing and the next
const VEHICLE_BASE_EM = 3.4; // average height of a vehicle; the scale varies it
const VEHICLE_FIT = 0.9; // share of the card the row may take before it shrinks

/* Lay a row of vehicles out from their own proportions.
   `items` arrive left to right as { el, ratio, scale }, both read off the
   element. Nothing is worked out here: src/data/artwork.ts is the one place
   those numbers are written down and it hands them to the markup, so a second
   copy in this file could only drift away from it. See that file for why the
   heights are evened out rather than shared -- equal height is not equal size. */
function layOutVehicles(items) {
	items.forEach((it) => {
		it.width = it.ratio * it.scale; // in height units, AFTER evening out
	});
	const span =
		items.reduce((s, it) => s + it.width, 0) + VEHICLE_GAP * (items.length - 1);
	let cursor = -span / 2;
	for (const it of items) {
		it.centre = cursor + it.width / 2;
		cursor += it.width + VEHICLE_GAP;
		// xPercent is a share of the element's OWN width, and every length here is
		// a multiple of the shared height, so the height cancels: one number holds
		// at every screen size.
		it.restX = (100 * it.centre) / it.width;
	}
	return items;
}

/* Read the queue out of a card, left to right, and place it. Returns the laid
   out items so a hover can reuse the same numbers. */
function placeVehicles(card) {
	const items = [".shape-vehicle.is-3", ".shape-vehicle.is-2", ".shape-vehicle.is-1"]
		.map((sel) => {
			const el = card.querySelector(sel);
			const ratio = el && parseFloat(el.dataset.ratio);
			const scale = el && parseFloat(el.dataset.scale);
			return el && ratio && scale ? { el: el, ratio: ratio, scale: scale } : null;
		})
		.filter(Boolean);
	if (!items.length) return items;
	layOutVehicles(items);

	// Fit the row to the card it is in. The span is known in height units, so one
	// measurement of the rendered height turns it into pixels; if that overruns
	// the wrap the whole row is scaled down together, which keeps the gaps and
	// the evening-out intact. Without this the queue simply grew past the card on
	// a phone -- the em sizes are viewport-relative but the card is not, and the
	// two do not move at the same rate.
	const wrap = items[0].el.parentElement;
	let em = VEHICLE_BASE_EM;
	items[0].el.style.height = em + "em";
	const perEm = items[0].el.getBoundingClientRect().height / em;
	const room = wrap.getBoundingClientRect().width * VEHICLE_FIT;
	const span = items.reduce((s, it) => s + it.width, 0) + VEHICLE_GAP * (items.length - 1);
	if (perEm > 0 && span * perEm * em > room) em = room / (span * perEm);

	for (const it of items) {
		it.el.style.height = (em * it.scale).toFixed(3) + "em";
	}
	return items;
}


function initScrollCardShapes() {
	if (!has.ScrollTrigger) return;
	const shapes = [
		{ sel: ".shape.is-1", scale: 1, x: 0, position: 0 },
		{ sel: ".shape.is-2", scale: 11 / 12, x: 25, position: 0.02 },
		{ sel: ".shape.is-3", scale: 10 / 12, x: 45, position: 0.04 },
		{ sel: ".shape.is-4", scale: 11 / 12, x: -25, position: 0.02 },
		{ sel: ".shape.is-5", scale: 10 / 12, x: -45, position: 0.04 },
	];
	const engShapes = [
		{ sel: ".shape-engineering.is-1", rotation: 45 },
		{ sel: ".shape-engineering.is-2", rotation: -45 },
		{ sel: ".shape-engineering.is-3", rotation: 0 },
		{ sel: ".shape-engineering.is-4", rotation: 90 },
	];
	const vaultShapes = [
		{ sel: ".shape-vault.is-1", rotation: 0 },
		{ sel: ".shape-vault.is-2", rotation: 45 },
		{ sel: ".shape-vault.is-3", rotation: 90 },
		{ sel: ".shape-vault.is-4", rotation: -135 },
	];
	// Stack: three copies at different sizes, offset diagonally. The scale/x/y
	// coordinates come from the reference composition.
	const stackShapes = [
		{ sel: ".shape-stack.is-1", scale: 1.0, x: 21.5, y: 9 },
		{ sel: ".shape-stack.is-2", scale: 0.79, x: -9.5, y: 21 },
		{ sel: ".shape-stack.is-3", scale: 0.64, x: -35.5, y: 30.5 },
	];
	// Bloom: four concentric copies. They start at scale 0.6 (medium) and spread
	// out to the extremes on a stagger — is-1/is-2 shrink, is-3/is-4 grow.
	const bloomShapes = [
		{ sel: ".shape-bloom.is-1", scale: 0.25 },
		{ sel: ".shape-bloom.is-2", scale: 0.47 },
		{ sel: ".shape-bloom.is-3", scale: 0.69 },
		{ sel: ".shape-bloom.is-4", scale: 1.0 },
	];
	const BLOOM_START_SCALE = 0.6;
	const BLOOM_HOVER_SHRINK = 0.92;
	// Trace: two shield copies (solid is-1 = actual, dashed is-2 = forecast). A
	// step-forward reveal: they start overlapping in the centre, the dashed one
	// moves left first and the solid one right, on a 0.15s stagger. Coordinates
	// come from the reference composition.
	const traceShapes = [
		{ sel: ".shape-trace.is-1", x: 7, delay: 0.15 }, // solid = actual
		{ sel: ".shape-trace.is-2", x: -31, delay: 0 }, // dashed = forecast, moves first
	];
	const serviceShapes = [
		{ sel: ".shape-service.is-1", x: 60, y: 0 },
		{ sel: ".shape-service.is-2", x: 40, y: 5 },
		{ sel: ".shape-service.is-3", x: 20, y: 10 },
		{ sel: ".shape-service.is-4", x: 0, y: 15 },
	];
	document.querySelectorAll(".card_wrap").forEach((card) => {
		const tl = gsap.timeline({ paused: true });
		shapes.forEach(({ sel, scale, x, position }) => {
			const el = card.querySelector(sel);
			if (!el) return;
			tl.fromTo(el, { scale: 0.8, x: 0 }, { scale, x, duration: 0.6, ease: CARD_EASE }, position);
		});
		// The queue: each vehicle appears where it belongs, one after another from
		// the left. They used to drive in from a shared point off-screen, which
		// meant that for the first second all three were stacked on one spot -- and
		// these drawings are transparent, so that read as a tangle, not an entrance.
		const vehicles = placeVehicles(card);
		vehicles.forEach((it, i) => {
			tl.fromTo(
				it.el,
				{ xPercent: it.restX, x: 0, y: 10, opacity: 0 },
				{ xPercent: it.restX, x: 0, y: 0, opacity: 1, duration: 0.7, ease: CARD_EASE },
				i * VEHICLE_STEP,
			);
		});
		// Map cards: one drawing, which fades and settles into place. The markers
		// used to be separate elements placed on it by measured coordinates; they
		// are part of the artwork now, so there is nothing left to position.
		const mapEl = card.querySelector(".shape-map");
		if (mapEl) {
			tl.fromTo(
				mapEl,
				{ opacity: 0, scale: 0.94 },
				{ opacity: 1, scale: 1, duration: 0.8, ease: CARD_EASE },
				0,
			);
		}
		engShapes.forEach(({ sel, rotation }) => {
			const el = card.querySelector(sel);
			if (!el) return;
			tl.fromTo(
				el,
				{ scale: 0.8, rotation: 0 },
				{ scale: 1, rotation, duration: 0.6, ease: CARD_EASE },
				0.2,
			);
		});
		vaultShapes.forEach(({ sel, rotation }) => {
			const el = card.querySelector(sel);
			if (!el) return;
			tl.fromTo(
				el,
				{ scale: 0.8, rotation: 0 },
				{ scale: 1, rotation, duration: 0.6, ease: CARD_EASE },
				0.2,
			);
		});
		stackShapes.forEach(({ sel, scale, x, y }) => {
			const el = card.querySelector(sel);
			if (!el) return;
			tl.fromTo(
				el,
				{ scale: 0.8, x: 0, y: 0 },
				{ scale, x, y, duration: 0.8, ease: CARD_EASE },
				0.4,
			);
		});
		bloomShapes.forEach(({ sel, scale }, i) => {
			const el = card.querySelector(sel);
			if (!el) return;
			tl.fromTo(
				el,
				{ scale: BLOOM_START_SCALE },
				{ scale, duration: 0.6, ease: CARD_EASE },
				0.2 + i * 0.05,
			);
		});
		traceShapes.forEach(({ sel, x, delay }) => {
			const el = card.querySelector(sel);
			if (!el) return;
			tl.fromTo(
				el,
				{ scale: 0.8, x: 0 },
				{ scale: 1, x, duration: 0.6, ease: CARD_EASE },
				0.2 + delay,
			);
		});
		serviceShapes.forEach(({ sel, x, y }) => {
			const el = card.querySelector(sel);
			if (!el) return;
			tl.fromTo(
				el,
				{ x: 0, y: 0, rotation: 0 },
				{ x, y, rotation: 45, duration: 0.8, ease: CARD_EASE },
				0.4,
			);
		});
		ScrollTrigger.create({
			trigger: card,
			start: "center bottom",
			end: "bottom top",
			animation: tl,
			// enter → play forward; leave → play reverse (smooth retreat, no snap).
			// `play`/`reverse` continue from current time so rapid scroll just flips
			// direction instead of jumping to an endpoint.
			toggleActions: "play reverse play reverse",
		});
		const HOVER_DURATION = 0.3;
		const hoverTl = gsap.timeline({ paused: true });
		const DRIFT_RATIO = 0.7;
		const sh2 = card.querySelector(".shape.is-2");
		const sh3 = card.querySelector(".shape.is-3");
		const sh4 = card.querySelector(".shape.is-4");
		const sh5 = card.querySelector(".shape.is-5");
		if (sh2) hoverTl.to(sh2, { x: 25 * DRIFT_RATIO, duration: HOVER_DURATION, ease: CARD_EASE }, 0);
		if (sh4)
			hoverTl.to(sh4, { x: -25 * DRIFT_RATIO, duration: HOVER_DURATION, ease: CARD_EASE }, 0);
		if (sh3)
			hoverTl.to(sh3, { x: 45 * DRIFT_RATIO, duration: HOVER_DURATION, ease: CARD_EASE }, 0.1);
		if (sh5)
			hoverTl.to(sh5, { x: -45 * DRIFT_RATIO, duration: HOVER_DURATION, ease: CARD_EASE }, 0.1);
		// Vehicle hover: each one lifts a little, in the order it arrived.
		//
		// This used to close the queue up, and that was wrong twice over. xPercent
		// is a share of the element's OWN width, so mixing the car's percentage
		// with the motorbike's compares two different rulers: a nudge meant to be
		// 12% of the gap came out as a 26px shove and parked the car on the bike.
		// And the idea fought the spacing anyway -- these drawings are transparent
		// now, so anything closing the gaps tangles their linework. A lift cannot
		// collide, whatever the widths are.
		const VEHICLE_LIFT = -9; // percent of each vehicle's own height
		vehicles.forEach((it, i) => {
			hoverTl.to(
				it.el,
				{ yPercent: VEHICLE_LIFT, duration: HOVER_DURATION, ease: CARD_EASE },
				i * 0.07,
			);
		});
		// Map hover. The maps lost theirs when the markers stopped being separate
		// elements -- the hover lived on the markers, so removing them left the two
		// map cards as the only ones that did nothing under the pointer.
		if (mapEl) {
			hoverTl.to(
				mapEl,
				{ scale: 1.04, y: -6, duration: HOVER_DURATION, ease: CARD_EASE },
				0,
			);
		}
		const eng1 = card.querySelector(".shape-engineering.is-1");
		const eng2 = card.querySelector(".shape-engineering.is-2");
		if (eng1) hoverTl.to(eng1, { scale: 0.8, duration: HOVER_DURATION, ease: CARD_EASE }, 0);
		if (eng2) hoverTl.to(eng2, { scale: 0.9, duration: HOVER_DURATION, ease: CARD_EASE }, 0.05);
		vaultShapes.forEach(({ sel, rotation }, i) => {
			const el = card.querySelector(sel);
			if (!el) return;
			hoverTl.to(
				el,
				{ rotation: rotation + 15, duration: HOVER_DURATION, ease: CARD_EASE },
				i * 0.05,
			);
		});
		const SERVICE_PULL = 0.3;
		const is1Rest = { x: 60, y: 0 };
		const svcStagger = [
			{ sel: ".shape-service.is-2", rest: { x: 40, y: 5 }, at: 0 },
			{ sel: ".shape-service.is-3", rest: { x: 20, y: 10 }, at: 0.1 },
			{ sel: ".shape-service.is-4", rest: { x: 0, y: 15 }, at: 0.15 },
		];
		svcStagger.forEach(({ sel, rest, at }) => {
			const el = card.querySelector(sel);
			if (!el) return;
			hoverTl.to(
				el,
				{
					x: rest.x + (is1Rest.x - rest.x) * SERVICE_PULL,
					y: rest.y + (is1Rest.y - rest.y) * SERVICE_PULL,
					duration: HOVER_DURATION,
					ease: CARD_EASE,
				},
				at,
			);
		});
		// Stack hover: is-2 and is-3 pull toward is-1 (the anchor) by SERVICE_PULL,
		// on a 0/0.1s stagger. Same principle as the service hover, but for three copies.
		const stackAnchor = stackShapes[0];
		[stackShapes[1], stackShapes[2]].forEach((s, i) => {
			const el = card.querySelector(s.sel);
			if (!el) return;
			hoverTl.to(
				el,
				{
					x: s.x + (stackAnchor.x - s.x) * SERVICE_PULL,
					y: s.y + (stackAnchor.y - s.y) * SERVICE_PULL,
					duration: HOVER_DURATION,
					ease: CARD_EASE,
				},
				i * 0.1,
			);
		});
		// Bloom hover: every copy scales by 0.92 (a light ~8% contraction), on a
		// 0/0.05/0.10/0.15s stagger by index.
		bloomShapes.forEach(({ sel, scale }, i) => {
			const el = card.querySelector(sel);
			if (!el) return;
			hoverTl.to(
				el,
				{
					scale: scale * BLOOM_HOVER_SHRINK,
					duration: HOVER_DURATION,
					ease: CARD_EASE,
				},
				i * 0.05,
			);
		});
		// Trace hover: they pull together — dashed (is-2) moves right, solid (is-1)
		// left, both closing on the midpoint between them by SERVICE_PULL=0.3, on a
		// 0/0.1s stagger.
		const traceSolid = traceShapes[0]; // is-1
		const traceDashed = traceShapes[1]; // is-2
		const traceDashedEl = card.querySelector(traceDashed.sel);
		const traceSolidEl = card.querySelector(traceSolid.sel);
		if (traceDashedEl) {
			hoverTl.to(
				traceDashedEl,
				{
					x: traceDashed.x + (traceSolid.x - traceDashed.x) * SERVICE_PULL,
					duration: HOVER_DURATION,
					ease: CARD_EASE,
				},
				0,
			);
		}
		if (traceSolidEl) {
			hoverTl.to(
				traceSolidEl,
				{
					x: traceSolid.x + (traceDashed.x - traceSolid.x) * SERVICE_PULL,
					duration: HOVER_DURATION,
					ease: CARD_EASE,
				},
				0.1,
			);
		}
		card.addEventListener("mouseenter", () => {
			if (tl.isActive() || tl.progress() < 1) return;
			hoverTl.play();
		});
		card.addEventListener("mouseleave", () => {
			if (hoverTl.progress() > 0) hoverTl.reverse();
		});
	});
}
