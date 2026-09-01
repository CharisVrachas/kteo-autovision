/* card-shapes.js -- the illustrations inside the three pillar cards */
"use strict";

/* Two kinds of card carry artwork on this site:

     the vehicle queue -- a row of drawings that files in from the left
     the maps          -- one drawing that fades and settles

   Everything is driven from the drawings' own proportions, which arrive on the
   elements as data-ratio and data-scale. src/data/artwork.ts is the one place
   those numbers are written down; nothing is worked out twice here, because a
   second copy left to drift would put the vehicles back on top of each other.

   preloader.js reuses placeVehicles for the loading screen, and card-shapes.js
   loads before it (see the list in Base.astro), so the function exists by the
   time it runs. */

const VEHICLE_GAP = 0.42; // clear space between two vehicles, in height units
const VEHICLE_STEP = 0.35; // seconds between one vehicle appearing and the next
const VEHICLE_BASE_EM = 3.4; // average height of a vehicle; the scale varies it
const VEHICLE_FIT = 0.9; // share of the card the row may take before it shrinks
const VEHICLE_LIFT = -9; // hover rise, as a percent of each vehicle's own height

/* Lay a row of vehicles out. `items` arrive left to right as
   { el, ratio, scale }, both numbers read off the element. See artwork.ts for
   why the heights are evened out rather than shared -- equal height is not
   equal size. */
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

/* Read the queue out of a card, size it, place it. Returns the laid out items
   so the hover can reuse the same numbers. */
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
	document.querySelectorAll(".card_wrap").forEach((card) => {
		const tl = gsap.timeline({ paused: true });

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

		// The maps: one drawing, which fades and settles. Their markers are part of
		// the artwork, so there is nothing to position.
		const mapEl = card.querySelector(".shape-map");
		if (mapEl) {
			tl.fromTo(
				mapEl,
				{ opacity: 0, scale: 0.94 },
				{ opacity: 1, scale: 1, duration: 0.8, ease: CARD_EASE },
				0,
			);
		}

		if (!vehicles.length && !mapEl) return;

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

		// Vehicles lift a little, in the order they arrived. This used to close the
		// queue up instead, which was wrong twice over: xPercent is a share of the
		// element's OWN width, so mixing the car's percentage with the motorbike's
		// compares two different rulers -- a nudge meant to be 12% of the gap came
		// out as a 26px shove and parked the car on the bike. And closing gaps
		// tangles linework that has no opaque fill to hide an overlap. A lift
		// cannot collide, whatever the widths are.
		vehicles.forEach((it, i) => {
			hoverTl.to(
				it.el,
				{ yPercent: VEHICLE_LIFT, duration: HOVER_DURATION, ease: CARD_EASE },
				i * 0.07,
			);
		});

		// The maps lost their hover when the markers stopped being separate
		// elements -- it had lived on the markers, so removing them left the two map
		// cards as the only ones that did nothing under the pointer.
		if (mapEl) {
			hoverTl.to(
				mapEl,
				{ scale: 1.04, y: -6, duration: HOVER_DURATION, ease: CARD_EASE },
				0,
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
