/**
 * Proportions of the blueprint artwork, and the one rule that makes a row of it
 * look like a set.
 *
 * Every ratio here is measured off the trimmed drawing by
 * tools/make-blueprint-icons.py — not guessed, and not the source file's own
 * canvas, which carries whatever margin the artist left.
 *
 * `sizeScale` exists because equal height is not equal size. The car is 2.37
 * times wider than it is tall and the van only 1.50, so drawn to one height the
 * car covered 94px of the card and the van 60 — and the van read as a toy beside
 * it even though a ruler said they matched.
 *
 * Height is set to `ratio ^ SIZE_EXPONENT`, which is one dial between two rules:
 * 0 gives every drawing the same height (where this started, and the van looked
 * tiny), −1 gives every drawing the same WIDTH, and −0.5 gives every drawing the
 * same area. Equal area was measurably fair and still read wrong, because in a
 * row what the eye compares is how much of the row each one takes. −0.75 sits
 * near equal width without shrinking the long car to a sliver: the widths come
 * out 1.71, 1.89 and 1.69 height-units instead of 1.50, 2.37 and 1.50.
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

/** See above: 0 = equal height, −0.5 = equal area, −1 = equal width. */
export const SIZE_EXPONENT = -0.75;

/**
 * Height multipliers that even the listed drawings out, averaging 1 so the group
 * keeps whatever base size its container already sets.
 */
export function sizeScale(keys: readonly ArtKey[]): Record<string, number> {
	const raw = keys.map((k) => Math.pow(ART_RATIO[k], SIZE_EXPONENT));
	const mean = raw.reduce((a, b) => a + b, 0) / raw.length;
	const out: Record<string, number> = {};
	keys.forEach((k, i) => {
		out[k] = raw[i] / mean;
	});
	return out;
}
