/* dom.js — the stage's furniture.

   Both stages draw the same picture by different means: one renders the car live
   in WebGL, the other plays frames that were rendered offline. Everything around
   that picture is identical — the sticky track, the captions, the tick marks, the
   callout chips and their leader lines — so it is built once, here, and neither
   stage owns it.

   Nothing in this file knows about three.js, which is what lets the frame stage
   run without downloading a renderer at all.
*/

const TEMPLATE = `
<div class="kc-sticky">
	<canvas class="kc-canvas"></canvas>
	<div class="kc-scrim"></div>
	<svg class="kc-leaders"></svg>
	<div class="kc-labels"></div>
	<div class="kc-caps"></div>
	<div class="kc-ticks"></div>
	<div class="kc-hint">
		<div class="kc-chevrons">
			<svg viewBox="0 0 22 8" fill="none"><path d="M1 1l10 6 10-6" stroke="currentColor" stroke-width="2"/></svg>
			<svg viewBox="0 0 22 8" fill="none"><path d="M1 1l10 6 10-6" stroke="currentColor" stroke-width="2"/></svg>
			<svg viewBox="0 0 22 8" fill="none"><path d="M1 1l10 6 10-6" stroke="currentColor" stroke-width="2"/></svg>
		</div>
	</div>
	<div class="kc-ui">
		<button class="kc-restart" type="button">↵ Από την αρχή</button>
		<span class="kc-status">Φόρτωση…</span>
		<button class="kc-skip" type="button">Παράλειψη ↳</button>
	</div>
	<pre class="kc-hud"></pre>
</div>`;

export function buildDom(container) {
	container.classList.add("kc-track");
	container.innerHTML = TEMPLATE;
	const q = (sel) => container.querySelector(sel);
	return {
		track: container,
		sticky: q(".kc-sticky"),
		canvas: q(".kc-canvas"),
		leaders: q(".kc-leaders"),
		labels: q(".kc-labels"),
		caps: q(".kc-caps"),
		ticks: q(".kc-ticks"),
		hint: q(".kc-hint"),
		hud: q(".kc-hud"),
		status: q(".kc-status"),
		skip: q(".kc-skip"),
		restart: q(".kc-restart"),
	};
}

/** Captions, tick marks and one chip-plus-leader per callout, in script order. */
export function buildChrome(dom, STOPS) {
	const capEls = STOPS.map((s) => {
		const el = document.createElement("div");
		el.className = "kc-cap";
		el.innerHTML = `
			<div class="kc-cap-text">
				<div class="kc-eyebrow"><span class="kc-eyebrow__sq"></span>${s.eyebrow}</div>
				<div class="kc-heading">${s.heading}</div>
				${s.sub ? `<div class="kc-sub">${s.sub}</div>` : ""}
			</div>`;
		dom.caps.appendChild(el);
		return el;
	});

	const tickEls = STOPS.map(() => {
		const t = document.createElement("div");
		t.className = "kc-tick";
		dom.ticks.appendChild(t);
		return t;
	});

	const NS = "http://www.w3.org/2000/svg";
	const callouts = [];
	STOPS.forEach((s, si) => {
		(s.labels || []).forEach((cfg) => {
			const chip = document.createElement("div");
			chip.className = "kc-lbl";
			chip.innerHTML = `<i>${cfg.n}</i>${cfg.t}${cfg.s ? `<s>${cfg.s}</s>` : ""}`;
			dom.labels.appendChild(chip);

			const line = document.createElementNS(NS, "polyline");
			const dot = document.createElementNS(NS, "circle");
			dot.setAttribute("r", "2.5");
			dom.leaders.append(line, dot);

			callouts.push({ stop: si, cfg, chip, line, dot, w: 180 });
		});
	});

	return { capEls, tickEls, callouts };
}

/** Chip widths, measured once. Reading offsetWidth in the frame loop forces a
    synchronous reflow, and with fourteen chips that is fourteen layout flushes a
    frame — it shows up as stutter the moment you scroll. */
export function measureChips(callouts) {
	for (const c of callouts) {
		const shown = c.chip.style.display;
		c.chip.style.display = "flex";
		c.chip.style.visibility = "hidden";
		c.w = c.chip.offsetWidth || 180;
		c.chip.style.visibility = "";
		c.chip.style.display = shown;
	}
}

/** Where a chip sits and how its leader reaches the part, given the part's
    position on screen. Shared so both stages place a chip the same way. */
export function placeCallout(c, sx, sy, o, vw, vh) {
	// The offsets are authored against a 1280-wide stage. Scale them down on
	// narrow viewports, then clamp, so a chip never walks off the edge.
	const k = Math.max(0.42, Math.min(1, vw / 1280));
	const dx = c.cfg.off[0] * k;
	const dy = c.cfg.off[1] * k;
	const cx = Math.min(vw - 10, Math.max(dx >= 0 ? 10 : c.w + 10, sx + dx));
	const cy = Math.min(vh - 24, Math.max(24, sy + dy));

	c.chip.style.display = "flex";
	c.chip.style.opacity = o;
	c.chip.style.left = `${cx}px`;
	c.chip.style.top = `${cy}px`;
	// anchor the chip on the edge the elbow arrives at, so the line always lands
	c.chip.style.transform = dx >= 0 ? "translate(0,-50%)" : "translate(-100%,-50%)";

	c.line.style.display = "";
	c.dot.style.display = "";
	c.line.setAttribute("points", `${sx},${sy} ${sx + (cx - sx) * 0.42},${cy} ${cx},${cy}`);
	c.line.setAttribute("opacity", o);
	c.dot.setAttribute("cx", sx);
	c.dot.setAttribute("cy", sy);
	c.dot.setAttribute("opacity", o);
}

export function hideCallout(c) {
	c.chip.style.display = "none";
	c.line.style.display = "none";
	c.dot.style.display = "none";
}
