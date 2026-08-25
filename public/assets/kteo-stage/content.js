/* content.js — the script of the stage. Edit this file, not the engine.

   Each stop is one hold in the scroll:
     pos / target / fov        where the camera parks and what it looks at
     eyebrow / heading / sub   the caption
     mech                      optional mechanism: "hood" or "brake"
     narrow                    optional second framing (pos / target / fov) used
                               below 900px, where the caption sits at the bottom
                               of the frame instead of beside the car
     labels[]                  callouts. `from` names a live part so the label
                               follows it even while it moves; `at` is a fixed
                               world point. `off` is the chip offset in pixels,
                               authored against a 1280-wide stage and scaled
                               down automatically on narrow screens.

   COORDINATES. Metres, car at the origin: +x is the nose, +y is up, +z the near
   side. This car measures 4.98 × 2.10 × 1.50, so x runs ±2.49 and z runs ±1.05.

   Every `at` below is MEASURED on the built model — `blender/02-anchors.py`
   prints the set. Two things about this particular car matter before you move a
   camera: it is left-hand drive, so the steering wheel sits at z −0.38, on the
   FAR side from every other stop; and the brake disc, the headlamp and the tail
   lamp are all on the near side at about z +0.7. That is why the interior stop
   is shot from the left and everything else from the right.

   Two layout rules keep the callouts readable:
     · keep off[0] negative — the captions own the right half of the frame
     · order the chips top-to-bottom the same way their anchors sit top-to-bottom.
       (This used to say "the way the parts run left-to-right", which is not the
       condition: every leader leaves its anchor heading left, so two of them
       cross when their VERTICAL order is reversed, whatever their x. Checking
       against x flagged three stops here that were laid out perfectly well.)
*/

/* ─────────────────────────── tunables ─────────────────────────── */
// The model is exported nose-along -Z; this puts the nose on +X.
const CAR_YAW = -Math.PI / 2;

// How far the bonnet lifts, in radians. The hinge is the panel's own origin,
// put on its rear edge against the scuttle by blender/01-build-assets.py.
const HOOD_OPEN = 0.95;

// How the front wheel comes off. It leaves along the axle (SLIDE) and also
// walks towards the tail (BACK), and the second part is what makes the stop
// work: the brake stop is shot square onto the disc, and the axle points
// straight at the camera, so a wheel that only slid outwards would come at the
// lens and sit exactly in front of the thing it moved aside to reveal.
const WHEEL_SLIDE = 0.45;
const WHEEL_BACK = 0.95;

const DWELL = 1.0; // how long a stop holds
const MOVE = 1.25; // and how long the flight to the next one takes
const VH_PER_UNIT = 0.46; // scroll height per unit of that timeline
const SEQ_FRAMES = 120; // frames the optional baked sequence is sampled at

export const TUNING = {
	CAR_YAW,
	HOOD_OPEN,
	WHEEL_SLIDE,
	WHEEL_BACK,
	DWELL,
	MOVE,
	VH_PER_UNIT,
	SEQ_FRAMES,
};

/* ─────────────────────────── the story ─────────────────────────── */
export const STOPS = [
	{
		pos: [5.6, 2.3, 5.0],
		target: [0, 0.8, 0],
		fov: 32,
		eyebrow: "ΚΤΕΟ",
		heading: "Ο έλεγχος καλύπτει κάθε σύστημα του οχήματος — από τον κινητήρα ως τα καυσαέρια",
		sub: "",
	},
	{
		pos: [3.6, 2.35, 2.6],
		target: [1.6, 0.75, 0],
		fov: 34,
		mech: "hood",
		eyebrow: "Κινητήρας",
		heading: "Διαρροές, ιμάντες, στάθμες και κατάσταση του κινητήρα με ανοιχτό καπό",
		sub: "",
		labels: [
			{ from: "engine", off: [-235, -55], n: "01", t: "Κινητήρας", s: "διαρροές" },
			{ at: [2.05, 0.72, 0.36], off: [-330, 90], n: "02", t: "Ιμάντες", s: "φθορά" },
			// The only chip on this stage with a POSITIVE off[0], against the rule
			// above. Three callouts do not fit down the left of this stop: 01 and 02
			// already take the upper and lower left, and -150 put this one so high it
			// clamped against the top of the frame and sat behind the site header.
			// Sending it right and down puts it in the empty band under the caption.
			// Its leader crosses the frame as a result, which the left-hand chips
			// avoid -- the trade for having it visible at all.
			{ at: [1.35, 0.86, -0.34], off: [300, 200], n: "03", t: "Στάθμες", s: "λάδι / ψυκτικό" },
		],
	},
	{
		// Square onto the disc, which is the only angle it reads from — the disc
		// is a flat circle facing outwards, and from anywhere else it is an
		// ellipse behind a wheel arch. The wheel gets out of the way by walking
		// backwards as well as outwards; see WHEEL_BACK.
		pos: [2.1, 0.7, 3.6],
		target: [1.58, 0.4, 0.79],
		fov: 28,
		mech: "brake",
		eyebrow: "Φρένα",
		heading: "Δισκόπλακες, τακάκια και απόδοση πέδησης στο φρενόμετρο",
		sub: "",
		labels: [
			// the car's own disc and caliper, standing behind the wheel that has
			// just walked off the hub — neither is parented to it
			{ from: "rotor", off: [-200, 110], n: "01", t: "Δισκόπλακα", s: "πάχος / αυλάκια" },
			{ from: "caliper", off: [-225, -120], n: "02", t: "Δαγκάνα", s: "στεγανότητα" },
		],
	},
	{
		pos: [0.3, 1.0, 4.6],
		target: [0, 0.6, 0],
		fov: 34,
		eyebrow: "Ελαστικά & Ανάρτηση",
		heading: "Βάθος πέλματος και κατάσταση ελαστικών, απόσβεση αναρτήσεων",
		sub: "",
		labels: [
			// Both on the rear corner. The strut itself is inside the bodywork and
			// cannot be seen from the side at all — anchored to it, the callout
			// projected onto the door and ran a leader right across the car — and
			// the front arch sits under the caption anyway. The rear arch is
			// visible, is the axle being measured, and leaves the right half free.
			{ at: [-1.338, 0.06, 0.94], off: [-190, 45], n: "01", t: "Πέλμα", s: "≥ 1,6 mm" },
			{ at: [-1.338, 0.74, 0.86], off: [-215, -95], n: "02", t: "Ανάρτηση", s: "απόσβεση" },
		],
	},
	{
		pos: [4.6, 1.3, 2.2],
		target: [1.9, 0.8, 0.35],
		fov: 32,
		eyebrow: "Φώτα & Ορατότητα",
		heading: "Ρύθμιση δέσμης φώτων, φλας, φώτα πέδησης και υαλοκαθαριστήρες",
		sub: "",
		labels: [
			// the lamp unit, and the scuttle where the wipers park
			{ from: "headlight", off: [-215, 105], n: "01", t: "Προβολέας", s: "ύψος δέσμης" },
			{ at: [1.05, 1.1, 0.55], off: [-205, -115], n: "02", t: "Υαλοκαθαριστήρες", s: "επαφή" },
		],
	},
	{
		pos: [-4.6, 1.1, 2.8],
		target: [-2.1, 0.55, 0.35],
		fov: 32,
		eyebrow: "Καυσαέρια",
		heading: "Μέτρηση εκπομπών ρύπων και έκδοση Κάρτας Ελέγχου Καυσαερίων",
		sub: "",
		labels: [
			// the tail end of the exhaust run, not its centre: the pipe is four
			// metres long and its midpoint is under the middle of the car
			{ at: [-2.35, 0.34, 0.3], off: [-215, 85], n: "01", t: "Εξάτμιση", s: "CO / HC" },
			{ from: "taillight", off: [-235, -105], n: "02", t: "Πίσω φώτα", s: "λειτουργία" },
		],
	},
	{
		// High and forward, looking down through the windscreen. The cabin is
		// behind glass and below a roof, so a low camera sees bonnet and sky and
		// nothing of what this stop is about.
		pos: [3.2, 2.6, -1.6],
		target: [0.4, 0.85, -0.2],
		fov: 30,
		eyebrow: "Διεύθυνση & Εσωτερικό",
		heading: "Τζόγος στο σύστημα διεύθυνσης, ζώνες ασφαλείας, όργανα και ορατότητα",
		sub: "",
		labels: [
			{ from: "steering", off: [-250, 105], n: "01", t: "Τιμόνι", s: "τζόγος" },
			{ from: "seats", off: [-300, -95], n: "02", t: "Καθίσματα", s: "στερέωση" },
		],
	},
	{
		// The closing shot is the only one that has to show the WHOLE car, so it is
		// the only one framed against the caption column rather than just shifted
		// away from it. Measured at 1425px wide the caption starts at 0.60 of the
		// frame; from here the car spans roughly 0.09 to 0.62, so it is complete
		// with only its nose reaching the empty margin at the start of the text
		// column. Every other stop is a detail and can run under the column.
		//
		// If you move this, change the DISTANCE and leave the fov alone. Pulling
		// back while narrowing the fov cancels itself out — four attempts at that
		// moved the car's width on screen from 0.68 to 0.67.
		pos: [3.07, 1.77, 11.83],
		target: [-0.5, 0.78, 0],
		fov: 26,
		// Below 900px the caption drops to the bottom of the frame and stops
		// competing for the width, so the compromise above — car pushed left, held
		// small enough to leave the column free — buys nothing and costs a lot: on
		// a 375px phone it left the car occupying 71% of the width, off to one
		// side, eleven per cent of the height. Centred on the car and brought in,
		// it fills 92% of the width and is still complete. Closer than this and
		// the bumpers start going off the edges.
		narrow: {
			pos: [2.74, 1.51, 9.07],
			target: [0, 0.75, 0],
		},
		eyebrow: "Ραντεβού",
		heading: "Ο πλήρης έλεγχος ολοκληρώνεται σε 20 λεπτά",
		sub: "Κλείσε ραντεβού online — χωρίς αναμονή στην ουρά",
	},
];
