/* stage-live.js — the car rendered live, in the browser. This is the default.

   The car here is about seven thousand triangles, which changes the arithmetic
   completely. The previous version of this project drove a quarter-million-
   triangle model and had to bake the whole scroll to an image sequence in Cycles
   to stay smooth — an hour on a rented GPU for every change to the script, and a
   sequence that silently went stale the moment anyone edited a caption. At this
   weight none of that is necessary: the scene is a handful of draw calls and one
   static shadow map, so it simply runs, and nothing can go out of date because
   nothing is pre-computed.

   stage-frames.js is still here and still works — bake the sequence when you
   want Cycles' lighting rather than the browser's. It is an option now, not the
   shipping path.

   No import map. The vendored three.js and its addons import each other by
   relative path, so the host page needs nothing but this folder on disk. That is
   deliberate: the import map was the one piece of boilerplate the previous
   version could not drop, and getting it wrong fails as a bare-specifier error
   with no hint as to which page is missing what.

   Renders on **transparent**: no background, no visible floor, nothing behind
   the car but the shadow it casts, so the stage takes the host page's own
   background.

   The script itself lives in content.js. This file is the machinery.

   Options
     basePath   where this folder sits. Defaults to this module's own folder.
     lenis      an existing Lenis instance to ride. Defaults to window.__lenis if
                the host already runs one, otherwise a private instance.
     debug      set false to keep window.__kteo clean.
*/

import * as THREE from "./vendor/three.module.js";
import { GLTFLoader } from "./vendor/loaders/GLTFLoader.js";
import { DRACOLoader } from "./vendor/loaders/DRACOLoader.js";
import Lenis from "./vendor/lenis.min.js";
import { STOPS, TUNING } from "./content.js";
import { buildDom, buildChrome } from "./dom.js";

const ORANGE = 0xfe5b2a;

export function mountLive(container, opts = {}) {
	const base = opts.basePath || new URL("./", import.meta.url).href;
	const dom = buildDom(container);
	const {
		CAR_YAW, HOOD_OPEN, WHEEL_SLIDE, WHEEL_BACK,
		DWELL, MOVE, VH_PER_UNIT, SEQ_FRAMES,
	} = TUNING;
	let stopped = false;
	const teardown = [];
	const dispose = () => {
		stopped = true;
		teardown.forEach((fn) => fn());
		container.innerHTML = "";
	};

	/* ─────────────────────── renderer, scene, lights ─────────────────────── */
	const canvas = dom.canvas;
	// alpha, and cleared to nothing: the host page's own background shows through,
	// exactly as it does under the baked frames.
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
	renderer.setClearColor(0x000000, 0);
	// Full device pixel ratio (capped at 2) on top of 8x MSAA — this is what takes
	// the last of the stair-stepping off the panel edges. The budget is there: the
	// scene is one static shadow map and a handful of draw calls.
	// Resolution is chosen at run time, not guessed from the hardware.
	//
	// A fixed cap cannot be right for both machines: the same number that keeps a
	// laptop's integrated graphics above 60 fps leaves a desktop GPU rendering a
	// softer picture than it could afford. And the thing that actually costs on
	// an integrated part is pixels, not triangles — this scene is 113k triangles
	// in 41 draw calls, which is nothing, but every one of those pixels is a
	// clearcoat and an environment lookup.
	//
	// So the stage starts optimistic, watches how long a frame really takes, and
	// walks the resolution down until it fits — or up, if there is room. Above
	// 1.0 it is supersampling: rendering larger than the canvas and letting the
	// browser downscale, which is what takes the last of the stair-stepping off
	// the roof line and the wheel spokes.
	const DPR_LEVELS = [0.85, 1, 1.25, 1.5, 1.75, 2];
	const dprCeil = Math.min(2, (devicePixelRatio || 1) * 1.5);
	let dprLevel = DPR_LEVELS.reduce(
		(best, v, i) => (v <= dprCeil ? i : best),
		0,
	);
	renderer.setPixelRatio(DPR_LEVELS[dprLevel]);
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	// 0.78 was set against an HDRI that is no longer there; with the gradient dome
	// alone it left the car reading as a silhouette on a dark page.
	renderer.toneMappingExposure = 1.05;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;

	const scene = new THREE.Scene();
	// Nothing behind the car. No background colour and no fog — fog needs
	// something to fade into, and on alpha it only greys out the car's own edges.
	scene.background = null;

	const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);

	// Every framing was composed on a 16:9 stage. On a narrower viewport a plain
	// vertical fov crops the sides off and parts drop out of frame, so widen the
	// fov instead — the HORIZONTAL field stays put and a phone just sees more sky.
	const REF_ASPECT = 16 / 9;
	// How far left of centre the car sits on a wide screen, as a fraction of the
	// stage width. The caption column is min(34em, 46vw) hard against the right
	// edge; this clears it without cropping the car at the left.
	const CAPTION_SHIFT = 0.19;
	// How much closer to come once the caption is no longer beside the car.
	// 0.75 is the most that can be taken back before the establishing shot
	// starts losing the nose of the car off the right-hand edge.
	const NARROW_FILL = 0.75;
	// The widest vertical fov worth using. Past this a perspective camera stops
	// looking like a camera: straight edges bow, the near corner of the car
	// swells, and the whole thing reads as a fisheye photograph of a toy.
	const FOV_MAX = 52;

	/** How to frame `base` on this viewport: a fov, and how far to back off.
	 *
	 *  Every stop was composed on a 16:9 stage. Narrower than that and the sides
	 *  would be cropped, taking parts out of frame, so the field has to widen.
	 *  Widening the fov alone is fine down to about 4:3 and grotesque beyond it —
	 *  on a 375x812 phone it asked for 95 degrees, which is a fisheye.
	 *
	 *  So the fov opens as far as FOV_MAX and the rest is taken by moving the
	 *  camera back, which buys exactly the same framing with none of the
	 *  distortion. `dolly` is the factor to scale the stop's distance by.
	 */
	function fitFrame(base) {
		if (camera.aspect >= REF_ASPECT) return { fov: base, dolly: 1 };
		const want = Math.tan((base * Math.PI) / 360) * (REF_ASPECT / camera.aspect);
		const capped = Math.tan((FOV_MAX * Math.PI) / 360);
		// Every framing reserves the right-hand third of a WIDE screen for the
		// caption. Below 900px the stylesheet moves the caption to the bottom
		// instead, so that third is just empty air beside the car — which is why
		// the closing shot came out occupying nine per cent of the height of a
		// 375x812 screen. Close the gap, but only where the caption has actually
		// moved: gating this on aspect alone catches a 1425x810 desktop too, since
		// that is 1.76 against 16:9's 1.78, and quietly enlarges every framing on
		// the machine they were composed on.
		const fill = vw < 900 ? NARROW_FILL : 1;
		if (want <= capped) {
			return { fov: (2 * Math.atan(want) * 180) / Math.PI, dolly: fill };
		}
		return { fov: FOV_MAX, dolly: (want / capped) * fill };
	}

	// The lighting is the environment. Everything on this car reflects it — the
	// paint through its clearcoat, the glass, the lamp lenses, the rims — so what
	// the environment CONTAINS is what the car looks like.
	//
	// It used to be a vertical gradient, 16 pixels wide, and that is why the car
	// read as plastic however glossy the paint was set. A gradient has no
	// horizontal structure, so a curved panel reflecting it gets a smooth even
	// wash and nothing else. Gloss is not a material setting you can turn up: it
	// is the reflection of a SHAPE with an edge on it, rolling across the panel
	// as the camera moves. No shapes in the environment, no gloss.
	//
	// So this is a room: a bright ceiling, a horizon, a dark floor, and four soft
	// strip lights at different azimuths around the car — which is how a studio
	// is actually lit and why studio car photographs look the way they do. The
	// whole thing is 1024×512 of canvas, costs nothing to download, and unlike an
	// HDRI photograph it has no hard edges to print stripes onto the bodywork.
	function studioTexture() {
		const W = 1024;
		const H = 512;
		const c = document.createElement("canvas");
		c.width = W;
		c.height = H;
		const x = c.getContext("2d");

		const g = x.createLinearGradient(0, 0, 0, H);
		g.addColorStop(0.0, "#dfe4ea"); // ceiling
		g.addColorStop(0.34, "#8e959d");
		g.addColorStop(0.5, "#4a5058"); // horizon
		g.addColorStop(0.72, "#23262b");
		g.addColorStop(1.0, "#0d0f12"); // floor
		x.fillStyle = g;
		x.fillRect(0, 0, W, H);

		// azimuth (0..1 round the car), half width, top, bottom, brightness
		const BOXES = [
			[0.12, 0.055, 0.1, 0.44, 1.0],
			[0.38, 0.045, 0.14, 0.42, 0.85],
			[0.63, 0.06, 0.08, 0.46, 1.0],
			[0.87, 0.04, 0.16, 0.4, 0.7],
		];
		x.globalCompositeOperation = "lighter";
		for (const [az, hw, top, bot, b] of BOXES) {
			const cx = az * W;
			const w = hw * W;
			const grad = x.createLinearGradient(cx - w, 0, cx + w, 0);
			grad.addColorStop(0, "rgba(255,255,255,0)");
			grad.addColorStop(0.5, `rgba(255,255,255,${b * 0.85})`);
			grad.addColorStop(1, "rgba(255,255,255,0)");
			x.fillStyle = grad;
			x.fillRect(cx - w, top * H, 2 * w, (bot - top) * H);
		}
		x.globalCompositeOperation = "source-over";

		// Soften the boxes. Straight off the 2-D context their vertical ends are
		// hard lines, and a hard line in the environment is a hard line drawn
		// across the paint — the exact fault the HDRI was dropped for.
		const soft = document.createElement("canvas");
		soft.width = W;
		soft.height = H;
		const sx = soft.getContext("2d");
		sx.filter = "blur(8px)";
		sx.drawImage(c, 0, 0);

		const t = new THREE.CanvasTexture(soft);
		t.mapping = THREE.EquirectangularReflectionMapping;
		t.colorSpace = THREE.SRGBColorSpace;
		return t;
	}
	{
		const pmrem = new THREE.PMREMGenerator(renderer);
		const tex = studioTexture();
		scene.environment = pmrem.fromEquirectangular(tex).texture;
		tex.dispose();
		pmrem.dispose();
	}

	// Intensities are roughly triple what they were. Three has been on physically
	// based light units since r155, so these numbers are lux-like rather than the
	// 0..1 multipliers they read as — and the values inherited here were balanced
	// against an HDRI carrying most of the load.
	const key = new THREE.DirectionalLight(0xffffff, 2.1);
	key.position.set(5, 7, 4);
	key.castShadow = true;
	key.shadow.mapSize.set(1024, 1024); // soft contact shadow on an invisible
	// plane — 2048 was four times the cost for a blur nobody can resolve
	// Tight to the car. The map was spread over a 10 m square for a 4.5 m car, so
	// three quarters of its resolution fell on empty floor and the shadow edge
	// arrived soft and vague — a car with a vague shadow looks pasted on.
	Object.assign(key.shadow.camera, { left: -3.2, right: 3.2, top: 3.2, bottom: -3.2, near: 1, far: 18 });
	key.shadow.bias = -0.0012;
	key.shadow.normalBias = 0.02;
	// Nothing in the scene moves except the wheels and the two mechanisms, so the
	// shadow map is re-rendered on demand instead of once per frame. That alone is
	// most of the frame budget back.
	key.shadow.autoUpdate = false;
	key.shadow.needsUpdate = true;
	scene.add(key);

	const fillBack = new THREE.DirectionalLight(0xf2f4f7, 0.95);
	fillBack.position.set(-5.5, 3.5, -3.5);
	scene.add(fillBack);

	const fillFront = new THREE.DirectionalLight(0xdfe6f0, 0.8);
	fillFront.position.set(-2, 3, 7);
	scene.add(fillFront);

	// a broad ambient floor-bounce keeps the shadow sides open
	scene.add(new THREE.HemisphereLight(0xb9c2cc, 0x3a3d40, 1.2));

	// A practical down into the engine bay, the one a photographer would clamp
	// under the bonnet. With the bonnet up the bay is a box open at the top, and
	// every lamp in the rig arrives at too shallow an angle to reach the bottom of
	// it: the stop that exists to show the engine was showing a black hole. Short
	// range, so it does nothing to the rest of the car.
	// Weak, high, and with linear falloff. At intensity 6 with physical (squared)
	// decay this sat 20 cm under the raised panel and blew the underside of the
	// bonnet and the near wall of the bay to pure white — which the bloom pass
	// then smeared into the halo that appeared every time the bonnet opened. The
	// job here is only to stop the bay reading as a black hole.
	const bayLight = new THREE.PointLight(0xf2f6ff, 2.2, 4.0, 1.0);
	bayLight.position.set(1.37, 1.62, 0);
	scene.add(bayLight);

	/* ─────────────────────── the ground, such as it is ─────────────────────── */
	// There is no floor any more, only the shadow one would have caught.
	//
	// The old stage had a 70 m textured plane and, on top of it, a painted
	// vignette to stop three lamps turning that plane into one enormous gradient.
	// Both existed to make a visible floor behave. On alpha neither has anything to
	// do: `ShadowMaterial` renders nothing except what is cast onto it, so the car
	// keeps its shadow and the host page keeps its background.
	//
	// This is also what the bake does — `build_floor()` in
	// a bake would leave the sheet in the scene as
	// `is_shadow_catcher`. Same picture, same reason: without the shadow the car
	// floats, and the shadow is the only thing that makes it stand ON the page
	// rather than sit pasted over it.
	const ground = new THREE.Mesh(
		new THREE.PlaneGeometry(70, 70),
		new THREE.ShadowMaterial({ opacity: 0.55 }),
	);
	ground.rotation.x = -Math.PI / 2;
	ground.receiveShadow = true;
	scene.add(ground);

	function contactTexture() {
		const c = document.createElement("canvas");
		c.width = c.height = 256;
		const x = c.getContext("2d");
		const g = x.createRadialGradient(128, 128, 8, 128, 128, 124);
		g.addColorStop(0, "rgba(0,0,0,0.62)");
		g.addColorStop(0.45, "rgba(0,0,0,0.32)");
		g.addColorStop(1, "rgba(0,0,0,0)");
		x.fillStyle = g;
		x.fillRect(0, 0, 256, 256);
		const t = new THREE.CanvasTexture(c);
		t.colorSpace = THREE.SRGBColorSpace;
		return t;
	}
	const contact = new THREE.Mesh(
		new THREE.PlaneGeometry(6.4, 3.2),
		new THREE.MeshBasicMaterial({
			map: contactTexture(),
			transparent: true,
			depthWrite: false,
			toneMapped: false,
		}),
	);
	contact.rotation.x = -Math.PI / 2;
	contact.position.y = 0.006;
	contact.renderOrder = 2;
	scene.add(contact);


	/* ─────────────────────── loading the car and the rig ─────────────────────── */
	const car = new THREE.Group();
	car.rotation.y = CAR_YAW;
	scene.add(car);

	// Callout anchors resolve to live meshes, so a label always sits on the part it
	// names — including the ones that move when a mechanism runs.
	const anchors = {};

	const rig = {
		body: null,
		hood: null,
		wheels: [],
		frontWheel: null,
		engine: null,
	};

	const draco = new DRACOLoader().setDecoderPath(base + `vendor/draco/`);
	const gltf = new GLTFLoader().setDRACOLoader(draco);

	// The pack is textured for a bright game scene — flat colour maps, a yellow
	// hatchback, tyres the same grey as the paint. None of that survives being
	// dropped onto an arbitrary page, so every slot is retoned here into one
	// deliberate palette.
	//
	// Matched on the base name, because Blender appends `.002` to the material of
	// every car after the first in the pack — the hatchback's paint arrives as
	// `Body.002`, the coupé's as `Body.001`. Stripping the suffix means picking a
	// different car out of the pack does not silently leave it untoned.
	// The car arrives fully textured — base colour, normal, roughness, metallic
	// and ambient occlusion, authored for this body — and that texture set is the
	// whole reason it reads as a real car rather than a shaded shape. So nothing
	// here REPLACES a material, which is what this function used to do: the
	// previous car had a single flat colour per part and no maps at all, so
	// swapping the lot for a hand-tuned palette was an improvement. Doing that
	// now would throw away the panel creases, the shut lines, the brushed rims
	// and the worn plastics, and hand back exactly the plastic look we started
	// from. Everything below only adjusts what the glTF cannot carry.
	function retone(o) {
		const m = o.material;
		if (!m) return;
		const n = m.name;

		if (/car paint/i.test(n)) {
			// The paint arrives at metalness 1, and a fully metallic surface has
			// no diffuse at all — it is nothing but a reflection of its
			// surroundings. Against a quiet studio dome that renders as a black
			// car, which is exactly how this model first came up: the base colour
			// map is a perfectly reasonable mid grey (94, 98, 106) and none of it
			// was reaching the screen. Real car paint is a dielectric with metal
			// flake suspended in it, so it belongs down here with the clearcoat
			// carrying the gloss.
			m.metalness = 0.35;
			m.roughness = 0.16;
			// glTF cannot carry clearcoat, so the lacquer goes back on here. It is
			// what gives the horizon strip light something to sit in.
			m.clearcoat = 1.0;
			m.clearcoatRoughness = 0.02;
			m.envMapIntensity = 2.0;
		} else if (/^glass ext/i.test(n)) {
			// windscreen and windows: see the interior through them, but not so
			// clearly that the cabin competes with the bodywork
			m.transparent = true;
			m.opacity = /tinted/i.test(n) ? 0.42 : 0.3;
			m.roughness = 0.03;
			m.metalness = 0;
			m.envMapIntensity = 2.0;
			m.depthWrite = false;
		} else if (/glass - red/i.test(n)) {
			m.transparent = true;
			m.opacity = 0.9;
			m.roughness = 0.12;
			m.envMapIntensity = 1.6;
			m.emissive = new THREE.Color(0x3a0605);
			m.emissiveIntensity = 1;
		} else if (/glass - clear/i.test(n)) {
			m.transparent = true;
			m.opacity = 0.55;
			m.roughness = 0.05;
			m.envMapIntensity = 2.4;
		} else if (/tire/i.test(n) || /rubber/i.test(n)) {
			// A brighter room lights the tyres too, and a grey tyre reads as
			// plastic. These stay deliberately out of it.
			m.roughness = 0.95;
			m.metalness = 0;
			m.envMapIntensity = 0.3;
		} else if (/interior/i.test(n)) {
			m.roughness = 0.85;
			m.envMapIntensity = 0.5;
		} else if (/chrome|stainless/i.test(n)) {
			// The rims are the second most reflective thing on the car and go
			// white before the paint does.
			m.envMapIntensity = 0.9;
		}
	}

	// Scratch space for the callout projection below.
	const _box = new THREE.Box3();
	const _size = new THREE.Vector3();
	const _mid = new THREE.Vector3();

	const statusEl = dom.status;
	// One file. The car arrives with its bonnet, wheels, brake discs, calipers,
	// engine, exhaust, interior and lamps already modelled, separated and in
	// place, so there is nothing to assemble here — which is why this block is
	// a load and a dozen lookups rather than the assembly line it used to be.
	gltf
		.loadAsync(base + `assets/models/car.glb`)
		.then((carGltf) => {
			const model = carGltf.scene;
			model.traverse((o) => {
				if (!o.isMesh) return;
				o.castShadow = true;
				o.receiveShadow = true;
				retone(o);
			});
			car.add(model);

			const named = (n) => model.getObjectByName(n) || null;
			rig.body = named("body");
			rig.hood = named("hood");
			for (const n of ["wheel_fl", "wheel_fr", "wheel_rl", "wheel_rr"]) {
				const w = named(n);
				if (w) rig.wheels.push(w);
			}
			rig.frontWheel = named("wheel_fr");
			if (rig.frontWheel) {
				rig.frontWheel.userData.x0 = rig.frontWheel.position.x;
				rig.frontWheel.userData.z0 = rig.frontWheel.position.z;
			}

			// The disc and the caliper are their own objects sitting behind the
			// wheel, not parented to it, so revealing them is only a matter of
			// moving the wheel out of the way. The previous car had neither, and
			// most of this file used to be the kit that stood in for them.
			anchors.rotor = named("brake_disc");
			anchors.caliper = named("brake_caliper");
			anchors.engine = named("engine");
			anchors.exhaust = named("exhaust");
			anchors.steering = named("steering");
			anchors.seats = named("seats");
			anchors.suspension = named("suspension");
			anchors.headlight = named("headlight");
			anchors.taillight = named("taillight");

			const missing = Object.entries(anchors)
				.filter(([, v]) => !v)
				.map(([k]) => k);
			if (missing.length) console.warn("[kteo-stage] no anchor for:", missing.join(", "));

			statusEl.textContent = "Κύλιση";
		})
		.catch((err) => {
			console.error(err);
			statusEl.textContent = "το μοντέλο δεν φορτώθηκε";
		});

	/* ─────────────────────── captions, ticks, callouts ─────────────────────── */
	const svg = dom.leaders;
	const { capEls, tickEls, callouts } = buildChrome(dom, STOPS);
	// the live stage projects each anchor itself, so every chip carries a scratch
	// vector to project into
	for (const c of callouts) c.v = new THREE.Vector3();

	/* ─────────────────────── drawing ─────────────────────── */
	// Straight to the canvas. There used to be an EffectComposer here, and it
	// earned its place while there was a bloom pass to run. Once bloom went, the
	// chain was RenderPass -> OutputPass, which means: draw the scene into an
	// offscreen target at 8x MSAA, resolve it, then draw a full-screen quad to
	// copy the result onto the canvas — all to end up with what
	// `renderer.render()` produces on its own, since the renderer was already
	// built with `antialias: true`.
	//
	// On a 1265x720 canvas that offscreen target was resolving 7.3 megapixels of
	// samples every frame, plus a full-screen pass, for no visible difference.
	// It is the single most expensive thing this stage was doing, and it was
	// doing it for nothing. Tone mapping and the colour-space conversion that
	// OutputPass handled are done by the renderer itself.
	const render = () => renderer.render(scene, camera);

	/* ─────────────────────── the scroll timeline ─────────────────────── */
	const N = STOPS.length;
	const TOTAL = N * DWELL + (N - 1) * MOVE;

	const track = dom.track;
	const sticky = dom.sticky;
	const layout = () => (track.style.height = (TOTAL * VH_PER_UNIT + 1) * 100 + "vh");
	layout();

	// smootherstep: zero velocity AND zero acceleration at both ends, so a stop is
	// entered and left without the little kick a cosine ease still leaves behind
	const easeInOut = (q) => q * q * q * (q * (q * 6 - 15) + 10);

	// Flights ORBIT the car instead of running straight between two stops. A straight
	// line from the front-right lamp stop to the rear-left exhaust stop ploughs
	// through the bodywork; interpolating azimuth, radius and height around the car's
	// axis arcs around it instead, and always the short way round. Because the ease
	// has zero velocity at both ends of every segment, the joins at a stop cannot
	// kink even though each segment is computed independently.
	const ORBIT_C = new THREE.Vector3(0, 0.7, 0);

	// A stop may carry a second framing for narrow screens, under `narrow`. It is
	// not a general-purpose override and should stay rare: the widening in
	// fitFrame already adapts every stop to the viewport, and one framing that
	// behaves differently on a phone is one more thing to keep in step. It exists
	// because the closing shot has a job the others do not — show the WHOLE car —
	// and on a wide screen it also has to keep out from under the caption column.
	// On a phone the caption is at the bottom, that constraint disappears, and the
	// framing that satisfied both ends up small and off to one side for no reason.
	let narrowFrames = false;
	const framings = () =>
		STOPS.map((s) => (narrowFrames && s.narrow ? { ...s, ...s.narrow } : s));

	let stops = framings();
	let polar = [];
	let tgtCurve = null;
	function buildPath() {
		stops = framings();
		polar = stops.map((s) => {
			const dx = s.pos[0] - ORBIT_C.x;
			const dz = s.pos[2] - ORBIT_C.z;
			return { r: Math.hypot(dx, dz), a: Math.atan2(dz, dx), y: s.pos[1] };
		});
		// Rebuilt, not patched: the flight into a stop is interpolated from these,
		// so a swapped framing has to be in the path as well as at the stop, or the
		// camera flies to one place and lands at another.
		tgtCurve = new THREE.CatmullRomCurve3(
			stops.map((s) => new THREE.Vector3().fromArray(s.target)),
			false,
			"centripetal",
		);
	}
	function orbitBetween(i, e, out) {
		const A = polar[i];
		const B = polar[i + 1];
		let da = B.a - A.a;
		while (da > Math.PI) da -= 2 * Math.PI; // always the short way round
		while (da < -Math.PI) da += 2 * Math.PI;
		const a = A.a + da * e;
		// widen the arc a little on big swings so it does not clip the corners
		const bulge = 1 + (Math.abs(da) / Math.PI) * 0.12 * Math.sin(Math.PI * e);
		const r = (A.r + (B.r - A.r) * e) * bulge;
		out.set(ORBIT_C.x + Math.cos(a) * r, A.y + (B.y - A.y) * e, ORBIT_C.z + Math.sin(a) * r);
	}

	buildPath();

	// One long flight (rear-low to front-high) used to cut straight through the car.
	// Rather than hand-place a via point, keep the camera outside a safety ellipsoid:
	// every stop already sits outside it, so this only bends the middle of a flight,
	// and the push fades to zero at the surface so the motion stays smooth.
	const SAFE = { c: new THREE.Vector3(0, 0.7, 0), rx: 3.4, ry: 1.5, rz: 2.3 };
	const MIN_HEIGHT = 0.14;
	const PUSH_SOFTEN = 0.25; // over what penetration depth the correction ramps in
	function keepClear(p) {
		const dx = (p.x - SAFE.c.x) / SAFE.rx;
		const dy = (p.y - SAFE.c.y) / SAFE.ry;
		const dz = (p.z - SAFE.c.z) / SAFE.rz;
		const d = Math.hypot(dx, dy, dz);
		if (d > 1e-4 && d < 1) {
			// ramp the push in with a smoothstep on penetration depth — a hard
			// projection onto the surface puts a visible kink in the flight
			const t = Math.min(1, (1 - d) / PUSH_SOFTEN);
			const w = t * t * (3 - 2 * t);
			const k = 1 + (1 / d - 1) * w;
			p.set(
				SAFE.c.x + dx * SAFE.rx * k,
				SAFE.c.y + dy * SAFE.ry * k,
				SAFE.c.z + dz * SAFE.rz * k,
			);
		}
		if (p.y < MIN_HEIGHT) p.y = MIN_HEIGHT;
	}

	const _pos = new THREE.Vector3();
	const _dolly = new THREE.Vector3();
	const _tgt = new THREE.Vector3();
	const state = {
		active: 0,
		opacity: new Array(N).fill(0), // captions and callouts — a hard cross-cut
		mech: new Array(N).fill(0), // mechanisms — travel the whole flight
		fov: STOPS[0].fov,
	};

	function sampleTimeline(u) {
		let cursor = 0;
		state.opacity.fill(0);
		state.mech.fill(0);
		for (let i = 0; i < N; i++) {
			if (u <= cursor + DWELL || i === N - 1) {
				_pos.fromArray(stops[i].pos);
				_tgt.fromArray(stops[i].target);
				state.fov = stops[i].fov;
				state.active = i;
				state.opacity[i] = 1;
				state.mech[i] = 1;
				return;
			}
			cursor += DWELL;
			if (u <= cursor + MOVE) {
				const q = (u - cursor) / MOVE;
				const e = easeInOut(q);
				const a = stops[i];
				const b = stops[i + 1];
				orbitBetween(i, e, _pos);
				tgtCurve.getPoint((i + e) / (N - 1), _tgt);
				keepClear(_pos); // safety net; the orbit should never need it
				state.fov = a.fov + (b.fov - a.fov) * e;
				state.active = q < 0.5 ? i : i + 1;
				state.opacity[i] = q < 0.35 ? 1 - q / 0.35 : 0;
				state.opacity[i + 1] = q > 0.65 ? (q - 0.65) / 0.35 : 0;
				state.mech[i] = 1 - e;
				state.mech[i + 1] = e;
				return;
			}
			cursor += MOVE;
		}
	}

	const MECH_INDEX = {};
	STOPS.forEach((s, i) => {
		if (s.mech) MECH_INDEX[s.mech] = i;
	});
	const mechOf = (name) => (name in MECH_INDEX ? state.mech[MECH_INDEX[name]] : 0);

	/* ──────────────────────── smooth scroll + loop ──────────────────────── */
	// Ride the host page's smooth scroll if it already runs one — two Lenis
	// instances on the same document fight each other.
	const ownsLenis = !(opts.lenis || window.__lenis);
	const lenis =
		opts.lenis ||
		window.__lenis ||
		new Lenis({ lerp: 0.075, smoothWheel: true, wheelMultiplier: 0.9 });
	function raf(time) {
			if (stopped) return;
			if (ownsLenis) lenis.raf(time);
			requestAnimationFrame(raf);
		}
		requestAnimationFrame(raf);

	let seqMode = false;
	let hudOn = false;
	const hud = dom.hud;
	const hint = dom.hint;

	const onKey = (e) => {
		const k = e.key.toLowerCase();
		if (k === "d") hud.classList.toggle("is-on", (hudOn = !hudOn));
		if (k === "f") seqMode = !seqMode;
	};
	addEventListener("keydown", onKey);
	teardown.push(() => removeEventListener("keydown", onKey));
	dom.skip.onclick = () =>
		lenis.scrollTo(track.offsetTop + track.offsetHeight - innerHeight, { duration: 1.1 });
	dom.restart.onclick = () =>
		lenis.scrollTo(track.offsetTop, { duration: 1.1 });

	let vw = 1;
	let vh = 1;
	// Reading offsetWidth inside the frame loop forces a synchronous reflow — with
	// fourteen chips that is fourteen layout flushes per frame, and it shows up as
	// stutter the moment you scroll. Measure once here instead.
	function measureChips() {
		for (const c of callouts) {
			const shown = c.chip.style.display;
			c.chip.style.display = "flex";
			c.chip.style.visibility = "hidden";
			c.w = c.chip.offsetWidth || 180;
			c.chip.style.visibility = "";
			c.chip.style.display = shown;
		}
	}
	if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureChips);

	// The margin the callouts keep from the edges of their band.
	const CHIP_MARGIN = 26;
	// The host page may have something fixed over the top of the stage -- this one
	// has a navbar with a logo panel hanging below it, and chips projected near
	// the top-left were landing underneath it. The page says how much room to
	// leave via --kc-chip-top-inset on the track; without it nothing changes.
	// Read per resize, not per frame: getComputedStyle forces a style flush.
	let chipCeiling = CHIP_MARGIN;

	// Resolving those two properties needs a probe element, not
	// getComputedStyle: a CUSTOM property computes to its token, so
	// getPropertyValue returns "7.5em" or "calc(... + 1.75em)" and parseFloat
	// gives 7.5 or NaN. Assigning the var to a real `height` and reading the
	// element back is what makes the browser do the arithmetic, in whatever unit
	// the page chose to write it in.
	const inset = document.createElement("div");
	inset.setAttribute("aria-hidden", "true");
	inset.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;width:0;top:0;left:0";
	dom.track.appendChild(inset);
	teardown.push(() => inset.remove());
	function readInset(name) {
		inset.style.height = `var(${name}, 0px)`;
		return inset.getBoundingClientRect().height || 0;
	}
	let chipFloor = 0;

	let frameCost = 6;
	let costSamples = 0;
	function setDpr(level) {
		if (level === dprLevel) return;
		dprLevel = level;
		renderer.setPixelRatio(DPR_LEVELS[dprLevel]);
		renderer.setSize(vw, vh, false);
		// The shadow map lives in its own target and is not affected, but it does
		// have to be redrawn once the framebuffer has been rebuilt.
		key.shadow.needsUpdate = true;
	}

	function resize() {
		const w = sticky.clientWidth;
		const h = sticky.clientHeight;
		if (!w || !h) return;
		vw = w;
		vh = h;
		renderer.setSize(w, h, false);
		svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
		measureChips();
		camera.aspect = w / h;

		// Slide the whole view left so the car never sits under the caption.
		// The caption owns the right-hand column on a wide screen, and every
		// framing here was composed with the car centred — which put the tail of
		// it straight through the heading. Offsetting the frustum moves the
		// picture rather than the camera, so the framings stay as composed and
		// the callouts follow automatically: they are projected through this same
		// matrix, so they cannot drift off their parts.
		//
		// Below 900px the stylesheet moves the caption to the bottom of the
		// frame, so there is nothing to dodge and the car goes back to centre.
		// Swap the narrow framings in or out when the breakpoint is crossed, and
		// rebuild the flight path with them. Same 900px the stylesheet uses.
		const wantNarrow = w < 900;
		if (wantNarrow !== narrowFrames) {
			narrowFrames = wantNarrow;
			buildPath();
		}

		const shift = w >= 900 ? w * CAPTION_SHIFT : 0;
		if (shift > 0) camera.setViewOffset(w, h, shift, 0, w, h);
		else camera.clearViewOffset();

		camera.fov = fitFrame(state.fov).fov;
		camera.updateProjectionMatrix();

		// Where the chips are allowed to end. Reading the caption's box here, once
		// per resize, rather than in the frame loop, because getBoundingClientRect
		// forces a synchronous layout and there are thirteen chips.
		chipCeiling = Math.max(CHIP_MARGIN, readInset("--kc-chip-top-inset"));

		// Same idea at the bottom: this page draws its own "Από την αρχή" and
		// "Παράλειψη" buttons over the lower corners, and a chip clamped only
		// against the frame landed on top of them.
		chipFloor = h - Math.max(CHIP_MARGIN, readInset("--kc-chip-bottom-inset"));
		const capText = dom.caps.querySelector(".kc-cap-text");
		if (capText && w < 900) {
			const capTop = capText.getBoundingClientRect().top - sticky.getBoundingClientRect().top;
			if (capTop > 80) chipFloor = capTop - CHIP_MARGIN;
		}

		layout();
	}
	addEventListener("resize", resize);
	teardown.push(() => removeEventListener("resize", resize));

	// Watch the element, not just the window. A component that is dropped into
	// somebody else's page gets resized by things the window knows nothing about:
	// a sidebar opening, a tab panel becoming visible, a font finally loading and
	// reflowing the column it sits in. And the case that actually breaks it is
	// mounting while the container is still 0x0 — `resize()` bails on a zero
	// size, so the canvas keeps whatever it was born with and there is no second
	// chance until somebody drags the window. The observer fires the moment the
	// element has a size, whatever gave it one.
	if (typeof ResizeObserver !== "undefined") {
		const ro = new ResizeObserver(resize);
		ro.observe(sticky);
		teardown.push(() => ro.disconnect());
	}
	resize();

	/* ─────────────────────── callout projection ─────────────────────── */
	// `_box` / `_mid` are declared up with the engine-bay fitting, which needs them
	// first; both are plain scratch space and are safe to share.

	// `from` names a mesh; the engine gets three points spread along its own length
	// so "belts" lands at the front of it and "fluid levels" at the back.
	// Box3.setFromObject walks every descendant. The engine bay is ~120 meshes, so
	// doing that per frame is the single biggest hitch in the loop — measure it once
	// and just follow the group's own offset afterwards.
	const engineBounds = { ready: false, centre: new THREE.Vector3(), front: 0, back: 0, top: 0 };

	function anchorPoint(name, out) {
		if (name === "engineFront" || name === "engineRear" || name === "engine") {
			const bay = anchors.engine;
			if (!bay) return false;
			if (!engineBounds.ready) {
				const y0 = bay.position.y;
				bay.position.y = 0;
				bay.updateWorldMatrix(true, true);
				_box.setFromObject(bay);
				_box.getCenter(engineBounds.centre);
				engineBounds.front = _box.max.x - 0.12;
				engineBounds.back = _box.min.x + 0.12;
				engineBounds.top = _box.max.y - 0.05;
				engineBounds.ready = true;
				bay.position.y = y0;
			}
			out.copy(engineBounds.centre);
			out.y += bay.position.y;
			if (name !== "engine") {
				out.x = name === "engineFront" ? engineBounds.front : engineBounds.back;
				out.y = engineBounds.top + bay.position.y;
			}
			return true;
		}
		const obj = anchors[name];
		if (!obj) return false;
		_box.setFromObject(obj);
		_box.getCenter(out);
		return true;
	}

	function updateCallouts() {
		for (const c of callouts) {
			const o = state.opacity[c.stop];
			if (o <= 0.01) {
				c.chip.style.display = "none";
				c.line.style.display = "none";
				c.dot.style.display = "none";
				continue;
			}
			if (c.cfg.from) {
				if (!anchorPoint(c.cfg.from, _mid)) {
					c.chip.style.display = "none";
					c.line.style.display = "none";
					c.dot.style.display = "none";
					continue;
				}
				c.v.copy(_mid).project(camera);
			} else {
				c.v.fromArray(c.cfg.at).project(camera);
			}
			const sx = (c.v.x * 0.5 + 0.5) * vw;
			const sy = (-c.v.y * 0.5 + 0.5) * vh;
			// The offsets are authored against a 1280-wide stage. Scale them down on
			// narrow viewports, then clamp, so a chip never walks off the edge.
			const k = Math.max(0.42, Math.min(1, vw / 1280));
			const dx = c.cfg.off[0] * k;
			const dy = c.cfg.off[1] * k;
			const w = c.w;
			// The chip is anchored on the edge its leader arrives at: with dx < 0 it
			// is translate(-100%), so cx IS its right edge; with dx >= 0 it is
			// translate(0) and cx is its LEFT edge, putting its right edge at cx + w.
			// The upper bound has to account for that, or a right-anchored chip
			// clamps its left edge to the frame and hangs its whole width outside.
			// Nothing exercised this until the first positive off[0] was authored.
			const maxX = dx >= 0 ? vw - w - 10 : vw - 10;
			const cx = Math.min(maxX, Math.max(dx >= 0 ? 10 : w + 10, sx + dx));
			// Keep the chips inside the band that is theirs. `chipFloor` is the top
			// of the caption block, measured in resize(): on a wide screen the
			// caption is a column down the right-hand side and the band is the
			// whole height, but on a phone the stylesheet moves it to the bottom of
			// the frame, and a chip clamped only against the viewport walks
			// straight into the heading. The top margin matters just as much —
			// without it the first chip sits half off the top edge.
			const cy = Math.min(chipFloor, Math.max(chipCeiling, sy + dy));

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
	}

	/* ─────────────────────────── mechanisms ─────────────────────────── */
	// Pulled out of the frame loop so the sampler below can drive them too. It
	// has to: a callout anchored to `padOut` follows the pad as it comes off the
	// disc, so the 2-D position baked into frames.json is only right if the
	// mechanism was in its frame-accurate pose when the anchor was projected.
	// Sampling with the parts at rest bakes every brake-stop chip onto the spot
	// the pad occupies when it is closed, and the error only shows up as chips
	// sitting slightly off their parts in the finished sequence.
	let shadowStep = -1;
	function applyMechanisms(hoodT, brakeT, spin) {
		// About the node's own X. Blender's glTF export leaves the bonnet's local X
		// lying along the hinge line — across the car — so this is the axis it
		// actually swings on, and a positive angle lifts the leading edge. Driving
		// `rotation.y` instead, as this did, is a yaw: the panel stays flat and
		// swivels sideways out of the wing, which looks like a glitch rather than
		// a bonnet. Worth checking against the model rather than assuming, since
		// which local axis ends up where depends on how the part was exported.
		if (rig.hood && Math.abs(rig.hood.rotation.x - hoodT * HOOD_OPEN) > 1e-4) {
			rig.hood.rotation.x = hoodT * HOOD_OPEN;
			// Refresh the shadow in steps, not continuously. The test above is
			// true on very nearly every frame of the flight in and out of the
			// engine stop, and each refresh is a full depth pass over the whole
			// car — which lands precisely on top of a scroll animation, which is
			// where the stutter was. Eight steps across the whole travel is far
			// more than the eye can follow on a soft ground shadow, and costs
			// eight passes instead of sixty.
			const step = Math.round(hoodT * 8);
			if (step !== shadowStep) {
				shadowStep = step;
				key.shadow.needsUpdate = true;
			}
		}

		// The wheel comes off its axle along the axle — the node's local X, which
		// the export leaves pointing across the car. Nothing has to be countered:
		// the disc and caliper stand on their own behind it.
		// Local +x runs out along the axle; local +z runs towards the tail. Both
		// were read off the node rather than assumed — which axis lands where
		// depends on how the part was exported.
		if (rig.frontWheel) {
			rig.frontWheel.position.x = rig.frontWheel.userData.x0 + brakeT * WHEEL_SLIDE;
			rig.frontWheel.position.z = rig.frontWheel.userData.z0 + brakeT * WHEEL_BACK;
		}
		// wheels always turning, except the one that is off its axle
		for (const w of rig.wheels) {
			w.rotation.x = w === rig.frontWheel ? -spin * (1 - brakeT) : -spin;
		}
	}

	/* ─────────────────────────── frame loop ─────────────────────────── */
	let frameIdx = 0;
	function tick() {
			if (stopped) return;
			requestAnimationFrame(tick);

		const rect = track.getBoundingClientRect();
		const span = rect.height - innerHeight;
		let p = span > 0 ? -rect.top / span : 0;
		p = Math.min(1, Math.max(0, p));

		let u = p * TOTAL;
		frameIdx = Math.round(p * (SEQ_FRAMES - 1));
		if (seqMode) u = (frameIdx / (SEQ_FRAMES - 1)) * TOTAL;

		sampleTimeline(u);
		const frame = fitFrame(state.fov);
		// Back off along the line from the target, so the stop keeps its angle and
		// only its distance changes.
		if (frame.dolly !== 1) {
			camera.position.copy(_tgt).addScaledVector(
				_dolly.copy(_pos).sub(_tgt),
				frame.dolly,
			);
		} else {
			camera.position.copy(_pos);
		}
		camera.lookAt(_tgt);
		if (Math.abs(camera.fov - frame.fov) > 0.001) {
			camera.fov = frame.fov;
			camera.updateProjectionMatrix();
		}
		// `lookAt` sets the camera's rotation but not its matrixWorldInverse, and
		// that is what `Vector3.project` reads. The renderer refreshes it — but not
		// until the draw, which happens after the callouts are placed.
		// Without this the chips are positioned with the previous frame's camera:
		// they sit still at a stop, and lag a frame behind the part they name for
		// the whole of every flight.
		camera.updateMatrixWorld(true);

		for (let i = 0; i < N; i++) {
			const o = state.opacity[i];
			const el = capEls[i];
			el.style.opacity = o;
			el.style.visibility = o > 0.01 ? "visible" : "hidden";
			el.style.transform = `translateY(${(1 - o) * 14}px)`;
			tickEls[i].classList.toggle("is-on", state.active === i);
		}

		// ── mechanisms ──
		const hoodT = mechOf("hood");
		const brakeT = mechOf("brake");
		applyMechanisms(hoodT, brakeT, performance.now() * 0.00035);

		hint.style.opacity = p > 0.015 ? 0 : 1;
		updateCallouts();

		if (rect.top < innerHeight && rect.bottom > 0) {
			const t0 = performance.now();
			render();
			// Time the draw itself, not the gap between frames. The gap tells you
			// what the browser decided to do — it is 16.7 ms whenever we are
			// keeping up, whatever the headroom, and it goes to hundreds of
			// milliseconds in a background tab for reasons that have nothing to do
			// with this scene. What the draw costs is the number worth steering on.
			frameCost = frameCost * 0.9 + (performance.now() - t0) * 0.1;
			if (++costSamples > 45) {
				costSamples = 0;
				// One step at a time, with a wide dead zone in the middle, so the
				// resolution settles instead of hunting between two levels.
				if (frameCost > 11 && dprLevel > 0) setDpr(dprLevel - 1);
				else if (frameCost < 4.5 && dprLevel < DPR_LEVELS.length - 1) setDpr(dprLevel + 1);
			}
		}

		if (hudOn) {
			hud.innerHTML =
				`progress   <b>${p.toFixed(4)}</b>\n` +
				`timeline u <b>${u.toFixed(3)}</b> / ${TOTAL.toFixed(2)}\n` +
				`stop       <b>${state.active}</b> — ${STOPS[state.active].eyebrow}\n` +
				`mode       <b>${seqMode ? "FRAME SEQUENCE (" + SEQ_FRAMES + ")" : "live render"}</b>\n` +
				`frame      <b>${frameIdx + 1}</b>\n` +
				`hood       ${hoodT.toFixed(2)}   brake ${brakeT.toFixed(2)}\n` +
				`cam pos    [${_pos.x.toFixed(2)}, ${_pos.y.toFixed(2)}, ${_pos.z.toFixed(2)}]\n` +
				`cam target [${_tgt.x.toFixed(2)}, ${_tgt.y.toFixed(2)}, ${_tgt.z.toFixed(2)}]\n` +
				`fov        ${state.fov.toFixed(1)}
` +
				`draw       <b>${frameCost.toFixed(1)} ms</b>  at ${DPR_LEVELS[dprLevel]}x`;
		}
	}
	tick();

	const api = {
		THREE,
		renderer,
		render,
		scene,
		camera,
		car,
		rig,
		lenis,
		STOPS,
		state,
		anchors,
		sampleTimeline,
		camPath: _pos,
		camAim: _tgt,
		dispose,
		shot() {
			render();
			return renderer.domElement;
		},
	};
	if (opts.debug !== false) window.__kteo = api;
	return api;

}
