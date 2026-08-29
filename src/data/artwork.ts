/**
 * Proportions of the blueprint artwork, and the one rule that makes a row of it
 * look like a set.
 *
 * Every ratio here is measured off the trimmed drawing by
 * tools/make-blueprint-icons.py — not guessed, and not the source file's own
 * canvas, which carries whatever margin the artist left.
 *
 * `areaScale` exists because equal height is not equal size. The car is 2.37
 * times wider than it is tall and the van only 1.50, so drawn to one height the
 * car covered 94px of the card and the van 60 — and the van read as a toy beside
 * it even though a ruler said they matched. What the eye compares is the area a
 * drawing covers. Hold `ratio × height²` constant and the height falls out as
 * `1 / √ratio`; across the five vehicles that pulls the width spread from
 * 1.50–2.37 down to 1.23–1.54.
 *
 * One copy of these numbers, deliberately: the pillar card lays its queue out
 * from them in JavaScript, the deadline cards size their artwork from them in
 * CSS, and a second set left to drift would put the vehicles back on top of one
 * another.
 */

export const ART_RATIO = {
	moto: 1.583,
	car: 2.374,
	taxi: 2.376,
	van: 1.502,
	lorry: 1.981,
	rhodes: 0.924,
	europe: 1.252,
} as const;

export type ArtKey = keyof typeof ART_RATIO;

/**
 * Height multipliers that give every listed drawing the same area, averaging 1
 * so the group keeps whatever base size its container already sets.
 */
export function areaScale(keys: readonly ArtKey[]): Record<string, number> {
	const inv = keys.map((k) => 1 / Math.sqrt(ART_RATIO[k]));
	const mean = inv.reduce((a, b) => a + b, 0) / inv.length;
	const out: Record<string, number> = {};
	keys.forEach((k, i) => {
		out[k] = inv[i] / mean;
	});
	return out;
}
