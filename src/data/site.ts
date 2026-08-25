/**
 * Company-wide facts. Everything that appears in more than one place lives
 * here, so a phone number or an address is changed once rather than hunted for
 * across pages.
 */

export const site = {
	name: "ΙΚΤΕΟ Autovision Ρόδου",
	legalName: "ΙΚΤΕΟ ΔΩΔΕΚΑΝΗΣΟΥ Α.Ε.",
	shortName: "ΙΚΤΕΟ Ρόδου",
	url: "https://kteo-rodos.gr",
	founded: 2002,
	email: "info@kteo-rodos.gr",
	/** Both centres answer on both lines. */
	phones: [
		{ label: "22410 03333", href: "tel:+302241003333" },
		{ label: "22410 67677", href: "tel:+302241067677" },
	],
	/**
	 * "Βρείτε μας στον χάρτη" — one Maps search covering both centres, as used by
	 * the utility bar above the navigation. Same target as the old site used.
	 */
	mapsSearchUrl:
		"https://www.google.com/maps/search/%CE%99%CE%9A%CE%A4%CE%95%CE%9F+Autovision/@36.3936162,28.1983816,12z",
	/** Autovision's own booking system; the site links out to it. */
	bookingUrl: "https://rantevou.autovision.gr:10600/apex/autovision/r/onlinerantevounew/home",
	/** Fallback social image; overridden per page where a better one exists. */
	ogImage: "/assets/img/rodos/kteo-asgourou.jpg",
} as const;

/** Primary line, for the places that show only one. */
export const primaryPhone = site.phones[0];

export const openingHours = [
	{ days: "Δευτέρα – Παρασκευή", hours: "8:00 – 16:00" },
	{ days: "Σάββατο", hours: "8:30 – 14:30" },
	{ days: "Κυριακή", hours: "Κλειστά" },
];

export type Branch = {
	name: string;
	area: string;
	address: string;
	postcode?: string;
	note: string;
	/** What this centre is licensed for, beyond passenger cars. */
	speciality: string;
	/** Google Maps place link, used by the "Οδηγίες" buttons. */
	maps: string;
	/** Decimal degrees. Kept for future use; nothing reads them today. */
	lat: number;
	lng: number;
	photo: string;
	/** An announced site that is not open yet renders as a notice, not a card. */
	upcoming?: boolean;
};

export const branches: Branch[] = [
	{
		name: "ΙΚΤΕΟ Ασγούρου",
		area: "Ασγούρου",
		address: "7ο χιλ. Ρόδου – Λίνδου",
		postcode: "851 00",
		note: "στη διασταύρωση με Νικηφόρου Βρεττάκου",
		speciality: "Επιβατικά και δίκυκλα",
		maps: "https://www.google.com/maps/place/%CE%99%CE%9A%CE%A4%CE%95%CE%9F+Autovision/@36.393618,28.1983816,17z",
		lat: 36.393618,
		lng: 28.1983816,
		photo: "/assets/img/rodos/kteo-asgourou.jpg",
	},
	{
		name: "ΙΚΤΕΟ Τσαϊρι",
		area: "Τσαϊρι",
		address: "1ο χιλ. Τσαϊρι – Αεροδρομίου",
		note: "όπισθεν του ΤΡΟΦΟΚΑΖΑ",
		speciality: "Επιβατικά και βαρέα οχήματα",
		maps: "https://www.google.com/maps/place/AUTOVISION-IKTEO/@36.3759204,28.1902692,17z",
		lat: 36.3759204,
		lng: 28.1902692,
		photo: "/assets/img/rodos/kteo-tsairi-entrance.jpg",
	},
	{
		name: "ΙΚΤΕΟ Αφάντου",
		area: "Αφάντου",
		address: "Αφάντου, Ρόδος",
		note: "σύντομα κοντά σας",
		speciality: "Νέο σημείο τεχνικού ελέγχου",
		maps: "https://www.google.com/maps/search/Autovision+IKTEO+Afantou",
		lat: 36.2903,
		lng: 28.1655,
		photo: "/assets/img/rodos/neo-ikteo-afantou.jpg",
		upcoming: true,
	},
];

/** Only the centres you can actually visit today. */
export const openBranches = branches.filter((b) => !b.upcoming);

/** Headline figures, shown as rolling odometers on the homepage. */
export const stats = [
	{ eyebrow: "από το 2002", value: "23", label: "Χρόνια στον τεχνικό έλεγχο" },
	{ eyebrow: "στη Ρόδο", value: "2", label: "Σημεία τεχνικού ελέγχου" },
	{ eyebrow: "σύντομα", value: "3", label: "Με το νέο ΙΚΤΕΟ στα Αφάντου" },
	{ eyebrow: "πανευρωπαϊκά", value: "1", label: "Δίκτυο Autovision" },
];

/**
 * Company milestones, from the Εταιρεία page of the old site. Used for the
 * timeline and the figures above.
 */
export const milestones = [
	{
		year: "2002",
		title: "Ίδρυση της εταιρείας",
		text: "Η ΙΚΤΕΟ ΔΩΔΕΚΑΝΗΣΟΥ Α.Ε. ιδρύεται με σκοπό να προάγει την οδική ασφάλεια στην Ελλάδα, μέσω του τεχνικού ελέγχου των οχημάτων.",
	},
	{
		year: "2004",
		title: "Άδεια ίδρυσης",
		text: "Τον Νοέμβριο χορηγείται στην εταιρεία η άδεια ίδρυσης ιδιωτικού ΚΤΕΟ στη Ρόδο, από το Υπουργείο Μεταφορών και Επικοινωνιών.",
	},
	{
		year: "2005",
		title: "Πρώτο ΚΤΕΟ στο Τσαϊρι",
		text: "Έντεκα μήνες αργότερα χορηγείται η άδεια λειτουργίας. Από τότε λειτουργεί το πρώτο ΚΤΕΟ στον περιφερειακό Τσαϊρι – Αεροδρομίου.",
	},
	{
		year: "2009",
		title: "Δεύτερο κέντρο στα Ασγούρου",
		text: "Νέο κέντρο στο 7ο χιλ. Ρόδου – Λίνδου, για την καλύτερη εξυπηρέτηση των κατοίκων της πόλεως της Ρόδου.",
	},
	{
		year: "2011",
		title: "Έλεγχος δικύκλων",
		text: "Το ΚΤΕΟ στα Ασγούρου αδειοδοτείται για τον έλεγχο δικύκλων οχημάτων.",
	},
	{
		year: "2012",
		title: "Έλεγχος βαρέων οχημάτων",
		text: "Το ΚΤΕΟ στο Τσαϊρι αδειοδοτείται για τον έλεγχο βαρέων οχημάτων. Πλέον η εταιρεία παρέχει τεχνικό έλεγχο σε όλες τις κατηγορίες.",
	},
];

/**
 * The company profile, verbatim from the Εταιρεία page of the old site.
 *
 * `milestones` above says the same things in summary form, for scanning; this
 * is the operator's own wording, kept intact. Do not paraphrase it.
 */
/**
 * The operator's own profile text from the Εταιρεία page, verbatim. The
 * `title` on each is ours: /company/ shows these as a stack of cards
 * (Orisa's "Services details section 3"), and a card needs a heading.
 *
 * "Το πρότυπο λειτουργίας" is the closing sentence of the AUTOVISION
 * paragraph, split off into a card of its own -- it used to carry the page's
 * standalone "το δίκτυο" section as well, so it was on the page twice. The
 * words are the operator's, unchanged; only where they sit moved.
 */
export const companyProfile = [
	{
		title: "Η ίδρυση, 2002",
		text: "Στην Ελλάδα, ο τεχνικός έλεγχος οχημάτων από ιδιωτικά ΚΤΕΟ θεσμοθετήθηκε τον Νοέμβριο του 2001 με τον νόμο 2963, όταν δηλαδή συνειδητοποιήθηκαν οι μεγάλες δυνατότητες βελτίωσης της μέχρι σήμερα επικρατούσας κατάστασης στον χώρο. Η ΙΚΤΕΟ ΔΩΔΕΚΑΝΗΣΟΥ ΑΕ, ιδρύθηκε το 2002, σκοπό της εταιρίας είναι να προάγει τα θέματα που άπτονται γενικότερα της οδικής ασφάλειας στην Ελλάδα και ειδικότερα μέσω του τεχνικού ελέγχου των οχημάτων.",
	},
	{
		title: "Η πρώτη άδεια, 2004 – 2005",
		text: "Τον Νοέμβριο του 2004, χορηγήθηκε στην εταιρία η άδεια ίδρυσης ιδιωτικού ΚΤΕΟ στην Ρόδο από το Υπουργείο Μεταφορών και Επικοινωνιών. Έντεκα μήνες αργότερα, δηλαδή τον Οκτώμβριο του 2005, χορηγήθηκε η άδεια λειτουργίας και έκτοτε λειτουργεί το πρώτο ΚΤΕΟ στο Τσαϊρι, στον περιφερειακό ΤΣΑΙΡΙ-ΑΕΡΟΔΡΟΜΙΟ όπισθεν του ΤΡΟΦΟΚΑΖΑ.",
	},
	{
		title: "Το δίκτυο AUTOVISION",
		text: "Το νέο αυτό ιδιωτικό ΚΤΕΟ είναι μέλος του πανευρωπαϊκού δικτύου της AUTOVISION CONTROLE TECHNIQUE AUTOMOBILE, της μεγαλύτερης εταιρείας ιδιωτικών KTEO στη Γαλλία. Η νέα πραγματικότητα είναι γεγονός στο χώρο του τεχνικού ελέγχου οχημάτων.",
	},
	{
		title: "Το πρότυπο λειτουργίας",
		text: "Αδιάβλητοι έλεγχοι βασισμένοι σε υψηλά ποιοτικά πρότυπα, άψογα εκπαιδευμένο προσωπικό, υποδειγματική εξυπηρέτηση, πολιτισμένο περιβάλλον και σεβασμός στην ασφάλεια και στον χρόνο του πολίτη.",
	},
	{
		title: "Το δεύτερο κέντρο, 2009",
		text: "Από τον Σεπτέμβριο του 2009 λειτουργεί πλέον και το νέο κέντρο της εταιρείας στο 7ο χιλ. Ρόδου – Λίνδου (διασταύρωση με Νικηφόρου Βρεττάκου) με σκοπό την καλύτερη εξυπηρέτηση των κατοίκων της πόλεως της Ρόδου.",
	},
	{
		title: "Όλες οι κατηγορίες, 2011 – 2012",
		text: "Από τον Μάιο του 2011 αδειοδοτήθηκε το ΚΤΕΟ μας στα Ασγούρου στον έλεγχο των Δικύκλων και από τον Ιανουάριο του 2012 αδειοδοτήθηκε το ΚΤΕΟ στο Τσαϊρι στον έλεγχο Βαρέων Οχημάτων. Πλέον η εταιρεία μας παρέχει τεχνικό έλεγχο σε όλες τις κατηγορίες οχημάτων.",
	},
];
/**
 * Statutory inspection deadlines, per vehicle class, as published on the old
 * site. `first` is years from first registration; `every` is the interval after
 * that. These MUST stay in step with KTEO_RULES in
 * public/assets/js/components/kteo-tools.js, which does the arithmetic.
 *
 * `photo` fills the card's media column on the homepage. These are photographs
 * of the centres, not of the vehicle class -- swap in per-category imagery here
 * when there is any.
 */
export const deadlines = [
	{
		title: "Επιβατικό Ι.Χ.",
		text: "Στα 4 χρόνια ακριβώς από την ημερομηνία έκδοσης της 1ης αδείας και έκτοτε κάθε 2 χρόνια.",
		first: "4 χρόνια",
		every: "κάθε 2 χρόνια",
		photo: "/assets/img/rodos/kteo-asgourou.jpg",
	},
	{
		title: "Δίκυκλο / Τρίκυκλο / Τετράκυκλο",
		text: "Στα 4 χρόνια ακριβώς από την ημερομηνία έκδοσης της 1ης αδείας και έκτοτε κάθε 2 χρόνια.",
		first: "4 χρόνια",
		every: "κάθε 2 χρόνια",
		photo: "/assets/img/rodos/kteo-tsairi-entrance.jpg",
	},
	{
		title: "Επιβατικό Δ.Χ. (ταξί)",
		text: "Στον 1ο χρόνο από την ημερομηνία έκδοσης της 1ης αδείας και έκτοτε κάθε χρόνο.",
		first: "1 χρόνο",
		every: "κάθε χρόνο",
		photo: "/assets/img/rodos/kteo-signage.jpg",
	},
	{
		title: "Φορτηγό έως 3,5 τόνων",
		text: "Στα 4 χρόνια ακριβώς από την ημερομηνία έκδοσης της 1ης αδείας και έκτοτε κάθε 2 χρόνια.",
		first: "4 χρόνια",
		every: "κάθε 2 χρόνια",
		photo: "/assets/img/rodos/kteo-exterior.jpg",
	},
	{
		title: "Φορτηγό άνω 3,5 τόνων",
		text: "Στον 1ο χρόνο από την ημερομηνία έκδοσης της 1ης αδείας και έκτοτε κάθε χρόνο.",
		first: "1 χρόνο",
		every: "κάθε χρόνο",
		photo: "/assets/img/rodos/kteo-asgourou.jpg",
	},
];

/** Vehicle types offered by the reminder form and the calculator. */
export const vehicleTypes = [
	"Επιβατικό",
	"Μοτοσυκλέτα",
	"Τρίκυκλο / Τετράκυκλο",
	"Φορτηγό έως 3,5 τόνων",
	"Φορτηγό άνω 3,5 τόνων",
];
