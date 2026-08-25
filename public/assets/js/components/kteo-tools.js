/* kteo-tools.js -- the "when is my KTEO due" calculator.

   Loaded only by pages/pote-pernaw-kteo.html. It is a classic script like the
   rest of assets/js/components/, but it shares no globals with them, so it can
   sit after app.js in the list without touching the core.js -> app.js chain.

   THE RULES, as published by the operator on its "Προθεσμίες ΚΤΕΟ" page. Two
   numbers per category: how long after first registration the FIRST inspection
   falls due, and the interval between inspections after that. They must stay in
   step with `deadlines` in src/data/site.ts, which states the same rules in
   prose next to the calculator.
   Everything else -- leap years, month lengths -- is left to Date, which is
   why the arithmetic below adds years to a date object rather than adding
   days to a timestamp. */
"use strict";

var KTEO_RULES = {
	// Passenger cars and light trucks: first inspection at 4 years, then every 2.
	epivatiko: { first: 4, every: 2, label: "Επιβατικό Ι.Χ." },
	fortigo_light: { first: 4, every: 2, label: "Φορτηγό έως 3,5 τόνων" },
	// Taxis and heavy trucks: annually, from year one.
	taxi: { first: 1, every: 1, label: "Επιβατικό Δ.Χ. (ταξί)" },
	fortigo: { first: 1, every: 1, label: "Φορτηγό άνω 3,5 τόνων" },
	// Two-, three- and four-wheelers follow the passenger-car schedule.
	motosikleta: { first: 4, every: 2, label: "Δίκυκλο" },
	trikyklo: { first: 4, every: 2, label: "Τρίκυκλο / Τετράκυκλο" },
};

var KTEO_MONTHS = [
	"Ιανουαρίου",
	"Φεβρουαρίου",
	"Μαρτίου",
	"Απριλίου",
	"Μαΐου",
	"Ιουνίου",
	"Ιουλίου",
	"Αυγούστου",
	"Σεπτεμβρίου",
	"Οκτωβρίου",
	"Νοεμβρίου",
	"Δεκεμβρίου",
];

function kteoFormatDate(d) {
	return d.getDate() + " " + KTEO_MONTHS[d.getMonth()] + " " + d.getFullYear();
}

/** Add whole years to a date. Feb 29 + 1 year has no Feb 29 to land on, so the
    browser rolls it to Mar 1; that is the same answer a registry gives, and it
    keeps the result a real calendar date. */
function kteoAddYears(date, years) {
	var d = new Date(date.getTime());
	d.setFullYear(d.getFullYear() + years);
	return d;
}

function kteoCalculate(kind, firstLicence, lastCheck) {
	var rule = KTEO_RULES[kind];
	if (!rule) return null;
	// A previous inspection, when there is one, always supersedes the
	// first-registration clock: the periodic interval runs from it.
	if (lastCheck) {
		return {
			due: kteoAddYears(lastCheck, rule.every),
			basis: "periodic",
			every: rule.every,
			label: rule.label,
		};
	}
	if (firstLicence) {
		return {
			due: kteoAddYears(firstLicence, rule.first),
			basis: "initial",
			every: rule.first,
			label: rule.label,
		};
	}
	return null;
}

function initKteoCalculator() {
	var form = document.querySelector("[data-kteo-calc]");
	if (!form || form.hasAttribute("data-kteo-calc-ready")) return;
	form.setAttribute("data-kteo-calc-ready", "");

	var out = form.parentNode.querySelector("[data-kteo-result]");
	if (!out) return;
	var headline = out.querySelector("[data-kteo-result-headline]");
	var dateEl = out.querySelector("[data-kteo-result-date]");
	var noteEl = out.querySelector("[data-kteo-result-note]");

	function readDate(name) {
		var el = form.querySelector('[name="' + name + '"]');
		if (!el || !el.value) return null;
		var d = new Date(el.value);
		return isNaN(d.getTime()) ? null : d;
	}

	function show(head, date, note) {
		headline.textContent = head;
		dateEl.textContent = date || "";
		noteEl.textContent = note || "";
		out.classList.add("is-visible");
	}

	form.addEventListener("submit", function (e) {
		e.preventDefault();
		var kind = form.querySelector('[name="kind"]').value;
		var first = readDate("first");
		var last = readDate("last");

		if (!first && !last) {
			show(
				"Συμπληρώστε τουλάχιστον μία ημερομηνία",
				"",
				"Χρειαζόμαστε είτε την ημερομηνία πρώτης άδειας κυκλοφορίας, είτε την ημερομηνία του τελευταίου ελέγχου.",
			);
			return;
		}

		var res = kteoCalculate(kind, first, last);
		if (!res) {
			show("Δεν μπορέσαμε να υπολογίσουμε", "", "Ελέγξτε τα στοιχεία που συμπληρώσατε.");
			return;
		}
		var today = new Date();
		today.setHours(0, 0, 0, 0);
		var overdue = res.due < today;
		// "1 χρόνια" is wrong in Greek; the singular takes the accusative.
		var years = res.every === 1 ? "1 χρόνο" : res.every + " χρόνια";
		var basis =
			res.basis === "initial"
				? "Αρχικός έλεγχος, " + years + " από την πρώτη άδεια κυκλοφορίας."
				: "Περιοδικός έλεγχος, " + years + " από τον προηγούμενο έλεγχο.";

		show(
			overdue ? res.label + " — ο έλεγχος έχει λήξει" : res.label,
			kteoFormatDate(res.due),
			basis +
				(overdue
					? " Κλείστε ραντεβού το συντομότερο: η κυκλοφορία χωρίς ισχύον δελτίο επισύρει πρόστιμο."
					: " Η ένδειξη είναι ενημερωτική — το δεσμευτικό στοιχείο είναι το Δελτίο Τεχνικού Ελέγχου σας."),
		);
	});
}

/* Cold start, plus Barba re-entry: navigation swaps <main>, so the listener has
   to be attached again on the new node. The ready flag above keeps that idempotent. */
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initKteoCalculator, { once: true });
} else {
	initKteoCalculator();
}
(function hookBarba(attempt) {
	attempt = attempt || 0;
	if (window.barba && window.barba.hooks) {
		window.barba.hooks.afterEnter(initKteoCalculator);
		return;
	}
	if (attempt < 40) setTimeout(function () { hookBarba(attempt + 1); }, 250);
})();
