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
const VEHICLE_RATIO = { moto: 1.72, car: 2.86, van: 1.96 }; // width / height, from the SVG viewBoxes
const VEHICLE_GAP = 0.42; // clear space between two vehicles, in heights
const VEHICLE_ORIGIN_H = -3.2; // where they all set off from, in heights from centre
const VEHICLE_STEP = 0.4; // seconds between one vehicle setting off and the next
const VEHICLE_ORDER = ["van", "car", "moto"]; // left to right at rest

const vehicleSpan =
	VEHICLE_ORDER.reduce((sum, k) => sum + VEHICLE_RATIO[k], 0) +
	VEHICLE_GAP * (VEHICLE_ORDER.length - 1);
const vehicleCentre = {};
let vehicleCursor = -vehicleSpan / 2;
for (const k of VEHICLE_ORDER) {
	vehicleCentre[k] = vehicleCursor + VEHICLE_RATIO[k] / 2;
	vehicleCursor += VEHICLE_RATIO[k] + VEHICLE_GAP;
}
const vehicleRestX = (k) => (100 * vehicleCentre[k]) / VEHICLE_RATIO[k];
const vehicleFromX = (k) => (100 * VEHICLE_ORIGIN_H) / VEHICLE_RATIO[k];

/* Where a map marker's tip has to sit, given a point (u, v) on the map's own box.
   Both are shares of the MARKER's box, so the map height cancels out and the
   pair holds at any size -- same trick as the vehicle queue above. */
const PIN_RATIO = 0.57; // width / height of map-pin.svg, from make-map-drawings.py
const pinRestX = (u, ratio, pinK) => (100 * (u - 0.5) * ratio) / (PIN_RATIO * pinK);
const pinRestY = (v, pinK) => 100 * ((v - 0.5) / pinK - 0.5);

function initScrollCardShapes() {
	if (!has.ScrollTrigger) return;
	const shapes = [
		{ sel: ".shape.is-1", scale: 1, x: 0, position: 0 },
		{ sel: ".shape.is-2", scale: 11 / 12, x: 25, position: 0.02 },
		{ sel: ".shape.is-3", scale: 10 / 12, x: 45, position: 0.04 },
		{ sel: ".shape.is-4", scale: 11 / 12, x: -25, position: 0.02 },
		{ sel: ".shape.is-5", scale: 10 / 12, x: -45, position: 0.04 },
	];
	// Vehicles: a queue that files in from the left. The motorbike enters alone
	// and drives the whole width; the car pulls out behind it once it is clear,
	// then the van. All three set off from the same point, so what the visitor
	// sees is one vehicle becoming three rather than three things appearing at
	// once.
	//
	// The layout is worked out in multiples of the drawings' shared HEIGHT, not in
	// pixels, and then expressed as xPercent. That is the whole trick: xPercent is
	// a share of the element's own width, and every width here is (ratio x height),
	// so the height cancels out and one constant holds at every screen size. The
	// drawings are sized in em, so pixel offsets would have drifted apart from them
	// on every viewport but the one they were measured at -- and the three would
	// touch, which is exactly what they must not do now that none of them is opaque
	// enough to hide an overlap.
	const vehicleShapes = [
		{ sel: ".shape-vehicle.is-1", key: "moto", position: 0, lead: true }, // in front
		{ sel: ".shape-vehicle.is-2", key: "car", position: VEHICLE_STEP },
		{ sel: ".shape-vehicle.is-3", key: "van", position: VEHICLE_STEP * 2 }, // at the back
	];
	// Map cards: the drawing arrives first, then the markers drop onto it one at a
	// time, west to east. Same reading as the vehicle queue -- one thing, then the
	// next, then the next -- told with a different gesture, because a map cannot
	// drive across the card.
	const PIN_STEP = 0.3; // seconds between one marker landing and the next
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
		vehicleShapes.forEach(({ sel, key, position, lead }) => {
			const el = card.querySelector(sel);
			if (!el) return;
			tl.fromTo(
				el,
				{ xPercent: vehicleFromX(key), x: 0, opacity: lead ? 1 : 0 },
				{ xPercent: vehicleRestX(key), x: 0, opacity: 1, duration: 1.1, ease: CARD_EASE },
				position,
			);
		});
		// Rest positions are wanted twice, by the scroll timeline and by the hover,
		// so they are worked out once here.
		const pinRest = [];
		const mapEl = card.querySelector(".shape-map");
		if (mapEl) {
			const wrap = mapEl.parentElement;
			const ratio = parseFloat(wrap.dataset.mapRatio);
			const pinK = parseFloat(wrap.dataset.pinScale);
			tl.fromTo(
				mapEl,
				{ opacity: 0, scale: 0.94 },
				{ opacity: 1, scale: 1, duration: 0.8, ease: CARD_EASE },
				0,
			);
			card.querySelectorAll(".shape-pin").forEach((pin, i) => {
				const u = parseFloat(pin.dataset.u);
				const v = parseFloat(pin.dataset.v);
				// xPercent and yPercent are shares of the MARKER's own box, and every
				// length involved is a multiple of the map height, so the height cancels
				// out: one pair of constants puts the marker on its point at any screen
				// size. Same trick as the vehicle queue. The y term also lifts the marker
				// by half its height, because what has to sit on the point is its tip,
				// not its middle.
				const xp = pinRestX(u, ratio, pinK);
				const yp = pinRestY(v, pinK);
				pinRest.push({ el: pin, xp: xp, yp: yp });
				tl.fromTo(
					pin,
					{ xPercent: xp, yPercent: yp - 70, x: 0, y: 0, opacity: 0, scale: 0.85 },
					{ xPercent: xp, yPercent: yp, x: 0, y: 0, opacity: 1, scale: 1, duration: 0.5, ease: CARD_EASE },
					0.45 + i * PIN_STEP,
				);
			});
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
		vehicleShapes.forEach((v, i) => {
			const el = card.querySelector(v.sel);
			if (!el) return;
			hoverTl.to(
				el,
				{ yPercent: VEHICLE_LIFT, duration: HOVER_DURATION, ease: CARD_EASE },
				i * 0.07,
			);
		});
		// Marker hover: each one lifts off its point a little, on a stagger, the way
		// the other cards' shapes drift. Kept small -- a marker that leaves its
		// location stops meaning anything.
		pinRest.forEach((pin, i) => {
			hoverTl.to(
				pin.el,
				{ yPercent: pin.yp - 12, duration: HOVER_DURATION, ease: CARD_EASE },
				i * 0.07,
			);
		});
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
