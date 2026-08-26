/**
 * The validation rules every form on the site shares.
 *
 * There are two field presentations -- the template's own forms label with a
 * placeholder, the tool forms with a visible <span> -- and before this they
 * each carried their own constraints inline, which is how /contact-us/ ended up
 * with no phone pattern and optional name fields while the homepage had both.
 * The rules live here once; Field.astro and PlaceholderField.astro read them.
 *
 * TWO TRAPS, both learned on the homepage form:
 *
 *  1. `pattern` is compiled with the regex `v` flag, where an unescaped `-`
 *     (or a parenthesis) inside a character class is a SYNTAX ERROR. An invalid
 *     pattern is not reported -- it is silently IGNORED, and the field then
 *     accepts anything at all, Greek prose included. Escape the dash.
 *  2. Write the patterns with String.raw. A plain "..." literal turns
 *     backslash-dash into a bare dash before it ever reaches the attribute,
 *     which lands you straight back in trap 1 with no visible sign of it.
 *     Check the BUILT html, not the source, when changing these.
 */

/** Greek numbers are ten digits; +30, spaces and dashes are tolerated so a
 *  pasted number is not rejected for its formatting. */
export const PHONE_PATTERN = String.raw`[0-9+][0-9 +\-]{9,19}`;
export const PHONE_TITLE = "Δέκα ψηφία, π.χ. 2241003333 ή +30 2241003333";

/** Greek plates are three letters and four digits, written with a space, a dash
 *  or neither, in Greek or Latin capitals. Deliberately loose on separators and
 *  case -- the length is what actually catches typos. */
export const PLATE_PATTERN = String.raw`[A-Za-zΆ-ώ0-9 \-]{5,12}`;
export const PLATE_TITLE = "Τρία γράμματα και τέσσερα ψηφία, π.χ. ΡΟΔ 1234";

/** At least two non-space characters, anywhere in the value.
 *  `minlength` alone is not enough: the tooShort constraint only applies once
 *  the value has been edited by a real person, so a single letter arriving any
 *  other way passes. A pattern is checked whatever set the value, and it also
 *  rejects a field holding nothing but spaces, which minlength counts as long
 *  enough. Written to accept "Α Β" -- two initials -- as well as a full name. */
export const NAME_PATTERN = String.raw`[\s\S]*\S[\s\S]*\S[\s\S]*`;
export const NAME_TITLE = "Τουλάχιστον δύο χαρακτήρες";

/** type="email" alone accepts "a@b": the HTML spec deliberately allows a domain
 *  with no dot, which is legal for intranet addresses and never what someone
 *  types into a public contact form. This requires a dot and a two-letter tail.
 */
export const EMAIL_PATTERN = String.raw`[^@\s]+@[^@\s]+\.[^@\s]{2,}`;
export const EMAIL_TITLE = "Π.χ. onoma@example.gr";

export type FieldRule = {
	minlength?: number;
	maxlength?: number;
	pattern?: string;
	title?: string;
	autocomplete?: string;
	inputmode?: string;
};

/** What a field earns from its input type. */
export const rulesByType: Record<string, FieldRule> = {
	text: { minlength: 2, maxlength: 256, pattern: NAME_PATTERN, title: NAME_TITLE },
	email: {
		maxlength: 256,
		autocomplete: "email",
		inputmode: "email",
		pattern: EMAIL_PATTERN,
		title: EMAIL_TITLE,
	},
	tel: {
		maxlength: 256,
		autocomplete: "tel",
		inputmode: "tel",
		pattern: PHONE_PATTERN,
		title: PHONE_TITLE,
	},
	date: {},
	number: {},
};

/** What a field earns from its name, whatever its type. */
export const rulesByName: Record<string, FieldRule> = {
	firstName: { autocomplete: "given-name" },
	lastName: { autocomplete: "family-name" },
	name: { autocomplete: "name" },
	email: { autocomplete: "email" },
	mobile: { autocomplete: "tel" },
	phone: { autocomplete: "tel" },
	plate: {
		minlength: 5,
		maxlength: 12,
		pattern: PLATE_PATTERN,
		title: PLATE_TITLE,
		autocomplete: "off",
	},
};

/** The attributes a given field should carry, type defaults then name defaults. */
export function rulesFor(name: string, type: string): FieldRule {
	return { ...(rulesByType[type] || {}), ...(rulesByName[name] || {}) };
}
