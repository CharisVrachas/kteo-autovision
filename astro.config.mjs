// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

/**
 * The site is fully static: no server routes, no client framework.
 *
 * `trailingSlash: "always"` plus `build.format: "directory"` reproduce the URL
 * shape of the old WordPress site (/company/, /kteo-reminder/), so existing inbound links
 * and search results keep resolving without redirects.
 *
 * The animation stack (GSAP, Lenis, Barba, the WebGL stage) ships as plain
 * files under public/assets/js and is loaded with <script> tags from the
 * layout. It is a chain of classic scripts sharing globals, in a fixed order —
 * bundling it would break that, and there is nothing to gain: the files are
 * already minified and version-pinned.
 */
export default defineConfig({
	site: "https://kteo-rodos.gr",
	trailingSlash: "always",
	build: {
		format: "directory",
	},
	// Generates sitemap-index.xml at build time, so a new page never has to be
	// remembered in a hand-written list.
	integrations: [sitemap()],
});
