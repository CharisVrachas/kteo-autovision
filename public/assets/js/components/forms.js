/* forms.js -- contact form submit + validation feedback */
"use strict";

// The visible label for a field, for the payload: the tool forms wrap each
// control in a <label> whose first <span> is the caption.
function fieldLabel(field) {
	const wrapper = field.closest("label");
	if (!wrapper) return "";
	const span = wrapper.querySelector("span");
	return span ? span.textContent.trim() : "";
}

/* ── Everything the visitor types comes out in capitals ───────────────────────
   Two halves, and both are needed. text-transform in form.css makes the letters
   LOOK capital as they are typed; it does not touch the value, so the form would
   still submit whatever was on the keyboard. This uppercases the value itself.

   Greek is the reason this is not just toUpperCase(). Greek drops its accent in
   capitals -- Γιώργος becomes ΓΙΩΡΓΟΣ, not ΓΙΏΡΓΟΣ -- but toUpperCase() keeps
   the tonos, so the value would come out looking wrong to any Greek reader. The
   dialytika is NOT an accent and stays: ΑΫΛΟΣ keeps its two dots.

   Email is deliberately left alone. The domain half is case-insensitive but the
   local half is not, by the spec; providers almost all ignore that, but writing
   a stranger's address back to them in capitals is the kind of thing that works
   until one day it does not.
   ──────────────────────────────────────────────────────────────────────────── */
// date and time inputs render their own picker text, which is not the
// visitor's typing and not ours to rewrite.
const UPPERCASE_SKIP = ["email", "password", "url", "hidden", "date", "time", "datetime-local", "month", "week"];

function toGreekUpper(value) {
	return value
		.toUpperCase()
		.normalize("NFD")
		// tonos, varia, perispomeni -- the accents capitals drop. U+0308, the
		// dialytika, is not in this list on purpose.
		.replace(/[̀́͂]/g, "")
		.normalize("NFC");
}

function initUppercaseFields() {
	const fields = document.querySelectorAll(
		'input.cta-field, input.form-field, textarea.cta-field, textarea.form-field',
	);
	fields.forEach((field) => {
		const type = (field.getAttribute("type") || "text").toLowerCase();
		if (UPPERCASE_SKIP.indexOf(type) !== -1) return;
		if (field.dataset.uppercaseBound) return; // Barba re-runs init on every page
		field.dataset.uppercaseBound = "1";

		field.addEventListener("input", () => {
			const before = field.value;
			const after = toGreekUpper(before);
			if (after === before) return;
			// Putting the caret back only works when the length is unchanged, which
			// it is for Greek and Latin. Anything that grows under uppercasing (the
			// German ß becomes SS) falls through to the end of the field rather than
			// landing the caret in the wrong place.
			const start = field.selectionStart;
			const end = field.selectionEnd;
			field.value = after;
			if (after.length === before.length && start !== null) {
				try {
					field.setSelectionRange(start, end);
				} catch (e) {
					/* input types that do not support selection */
				}
			}
		});
	});
}

function initForms() {
	// Every form on the site posts JSON here and shows success or failure in
	// place -- no mailto, no page reload.
	//
	// TODO: /api/contact does not exist. Point ENDPOINT at your own handler,
	// or swap this for whatever form service you use. Until then every
	// submission fails and the user sees the error message.
	//
	// form.dataset.formSource tags which form it came from (cta / contacts /
	// footer-subscribe) so the handler can tell them apart.
	//
	// The submit control is an <a href="#">, not a <button>, so a click on it
	// does not fire the form's submit event by itself -- it is intercepted
	// below and dispatched manually.
	const ENDPOINT = "/api/contact";

	// A date that cannot be in the future gets today as its max. Applied across
	// the document rather than per wired form, because the calculator's form is
	// deliberately outside this handler -- it answers locally -- and its two
	// date fields need the same bound. Set here rather than in the markup: a
	// build-time date goes stale the day after the site is deployed.
	const today = new Date();
	const todayISO =
		today.getFullYear() +
		"-" +
		String(today.getMonth() + 1).padStart(2, "0") +
		"-" +
		String(today.getDate()).padStart(2, "0");
	document.querySelectorAll('input[type="date"][data-no-future]').forEach((field) => {
		field.max = todayISO;
	});
	const forms = document.querySelectorAll(
		".cta-form, .contacts_form, #wf-form-Email-subscribe-form",
	);
	forms.forEach((form) => {
		if (form.dataset.formWired) return;
		form.dataset.formWired = "1";
		// The visible control is a link, so the form has no native submit
		// button and pressing Enter in a text field does nothing. Add a real
		// one, kept out of sight and out of the tab order, purely so the
		// browser's own "Enter submits the form" behaviour works.
		if (!form.querySelector('button[type="submit"], input[type="submit"]')) {
			const implicit = document.createElement("button");
			implicit.type = "submit";
			implicit.tabIndex = -1;
			implicit.setAttribute("aria-hidden", "true");
			implicit.style.cssText =
				"position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0";
			form.appendChild(implicit);
		}

		form.querySelectorAll('a.button[href="#"]').forEach((btn) => {
			btn.addEventListener("click", (e) => {
				e.preventDefault();
				if (typeof form.requestSubmit === "function") {
					form.requestSubmit();
				} else {
					form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
				}
			});
		});
		// Consent checkbox, unticked by default. While it is unticked the
		// submit control is shown as inactive, and the submit handler checks
		// it again -- see the note there.
		const consentBox = form.querySelector('input[name="consent"][type="checkbox"]');
		if (consentBox) {
			const consentBtns = form.querySelectorAll(
				'a.button, button[type="submit"], input[type="submit"]',
			);
			const syncConsentState = () => {
				const ok = consentBox.checked;
				consentBtns.forEach((b) => {
					b.style.pointerEvents = ok ? "" : "none";
					b.style.opacity = ok ? "" : "0.4";
					b.setAttribute("aria-disabled", ok ? "false" : "true");
				});
			};
			consentBox.addEventListener("change", syncConsentState);
			syncConsentState();
		}
		// Drop the invalid mark the moment a field is put right, rather than making
		// the visitor submit again to find out.
		form.querySelectorAll("input, textarea, select").forEach((field) => {
			field.addEventListener("input", () => {
				if (typeof field.checkValidity === "function" && field.checkValidity()) {
					field.classList.remove("is-invalid");
				}
			});
		});

		form.addEventListener("submit", async (e) => {
			e.preventDefault();
			// Checked here as well as in the markup: the click handler above
			// dispatches submit programmatically, which bypasses the browser's
			// own `required` validation.
			if (consentBox && !consentBox.checked) {
				if (typeof consentBox.reportValidity === "function") consentBox.reportValidity();
				return;
			}
			// The rest of the fields, for the same reason. The visible control is an
			// <a>, and the click handler above submits the form programmatically —
			// requestSubmit() does run constraint validation, but the dispatchEvent
			// fallback does not, so nothing guaranteed it. Check here, mark what
			// failed so the styling can show it, and put the caret in the first one.
			if (typeof form.checkValidity === "function" && !form.checkValidity()) {
				form.querySelectorAll(".is-invalid").forEach((f) => f.classList.remove("is-invalid"));
				form.querySelectorAll("input, textarea, select").forEach((f) => {
					if (typeof f.checkValidity === "function" && !f.checkValidity()) f.classList.add("is-invalid");
				});
				if (typeof form.reportValidity === "function") form.reportValidity();
				const firstBad = form.querySelector(".is-invalid");
				if (firstBad && typeof firstBad.focus === "function") firstBad.focus();
				return;
			}
			// Which form this came from, for the handler to route on.
			const source =
				form.dataset.formSource ||
				(form.id === "wf-form-Email-subscribe-form"
					? "footer-subscribe"
					: form.classList.contains("contacts_form")
						? "contacts"
						: "cta");
			// Honeypot: a hidden field named "website". A human never fills it
			// in, so the handler can drop anything that arrives with it set.
			const honeypot = form.querySelector('input[name="website"]');
			const fields = {};
			form.querySelectorAll("input, textarea, select").forEach((field) => {
				if (field.type === "submit" || field.type === "hidden") return;
				if (field.type === "checkbox") return; // consent is recorded separately below
				if (field.name === "website") return; // skip honeypot from payload
				// Readable labels rather than input names. The template's own forms
				// label their fields with a placeholder; the tool forms use a visible
				// <span> inside the wrapping <label> instead, so that is checked too
				// before falling back to the name.
				const label = field.placeholder || fieldLabel(field) || field.name || "Field";
				const value = (field.value || "").trim();
				if (value) fields[label] = value;
			});
			// Record that consent was given, so whoever receives the message has
			// it alongside the rest of the submission.
			if (consentBox && consentBox.checked) {
				fields["Consent given"] = "yes (checkbox on the site)";
			}
			const successEl = form.parentElement && form.parentElement.querySelector(".form-success");
			const errorEl = form.parentElement && form.parentElement.querySelector(".form-error");
			// Clear any error left over from a previous attempt.
			if (errorEl) errorEl.style.display = "none";
			// Show the submit control as busy while the request is in flight.
			const submitBtns = form.querySelectorAll(
				'a.button, button[type="submit"], input[type="submit"]',
			);
			submitBtns.forEach((b) => {
				b.style.pointerEvents = "none";
				b.style.opacity = "0.6";
			});
			try {
				const res = await fetch(ENDPOINT, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						source,
						fields,
						website: honeypot ? honeypot.value : "",
					}),
				});
				if (!res.ok) throw new Error("http " + res.status);
				const data = await res.json().catch(() => ({ ok: false }));
				if (!data.ok) throw new Error("not ok");
				// On success, swap the form out for the confirmation block.
				form.style.display = "none";
				if (successEl) successEl.style.display = "block";
			} catch (err) {
				if (errorEl) errorEl.style.display = "block";
				submitBtns.forEach((b) => {
					b.style.pointerEvents = "";
					b.style.opacity = "";
				});
			}
		});
	});
}
