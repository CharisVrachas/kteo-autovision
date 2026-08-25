/**
 * The menu, defined once.
 *
 * Three places render it — the desktop bar, the mobile slide-down panel and
 * the footer column — and they all read this array, so they cannot drift.
 *
 * `children` would turn a bar item into a hover dropdown and indent the same
 * links in the mobile panel. Nothing needs one here: the site is flat, exactly
 * as the old menu was.
 *
 * Paths mirror the old WordPress URLs so inbound links keep resolving.
 */

export type NavLink = {
	label: string;
	href: string;
	children?: { label: string; href: string }[];
};

export const mainNav: NavLink[] = [
	{ label: "Εταιρεία", href: "/company/" },
	{ label: "Υπενθύμιση ΚΤΕΟ", href: "/kteo-reminder/" },
	{ label: "Πότε περνάω ΚΤΕΟ", href: "/online-calculator/" },
	{ label: "Επικοινωνία", href: "/contact-us/" },
];

/** The action button at the right end of the bar. */
export const navCta = { label: "ραντεβού", href: "/online-rantevou/" };

/** Footer "Σελίδες" column — flattened, because the footer has no dropdowns. */
export const footerNav: { label: string; href: string }[] = [
	...mainNav.flatMap((item) => [
		{ label: item.label, href: item.href },
		...(item.children ?? []),
	]),
	{ label: "Online ραντεβού", href: "/online-rantevou/" },
	{ label: "Πολιτική Απορρήτου", href: "/privacy-policy/" },
];
