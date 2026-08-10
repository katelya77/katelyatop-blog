import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readTheme = async () => {
	const [gallery, safety, geometry, backdrop] = await Promise.all([
		read("src/styles/katelya-van-gogh-gallery.css"),
		read("src/styles/katelya-van-gogh-safety.css"),
		read("src/styles/impasto-geometry.css"),
		read("src/styles/impasto-backdrop.css"),
	]);
	return `${gallery}\n${safety}\n${geometry}\n${backdrop}`;
};

test("legacy banner title cannot reappear over the gallery hero", async () => {
	const hero = await read("src/components/layout/KatelyaOrbitHero.astro");
	const grid = await read("src/layouts/MainGridLayout.astro");

	assert.match(grid, /showTextOverlay=\{false\}/);
	assert.match(hero, /legacyTitle\.classList\.add\("hidden"\)/);
	assert.match(hero, /aria-hidden=\{active \? "false" : "true"\}/);
});

test("hero follows route state and uses shared gallery geometry", async () => {
	const hero = await read("src/components/layout/KatelyaOrbitHero.astro");
	const grid = await read("src/layouts/MainGridLayout.astro");
	const theme = await readTheme();

	assert.match(hero, /active\??:\s*boolean/);
	assert.match(hero, /is-home-active/);
	assert.match(hero, /function syncKatelyaHomeState\(isHomePage\)/);
	assert.match(hero, /katelya-home-page/);
	assert.match(grid, /katelya-hero-stage/);
	assert.match(grid, /katelya-main-shell/);
	assert.match(grid, /is-home-layout/);
	assert.match(theme, /--impasto-home-space:/);
	assert.match(theme, /--impasto-article-space:/);
	assert.match(theme, /\.katelya-hero-stage\.is-home-hero/);
	assert.match(theme, /#main-grid\s*\{[\s\S]*?transform:\s*none\s*!important/);
});

test("full page uses day-night painterly artwork and clips overflow", async () => {
	const theme = await readTheme();
	const dayArtwork = await read("public/assets/art/katelya-van-gogh-day.svg");
	const nightArtwork = await read(
		"public/assets/art/katelya-van-gogh-night.svg",
	);

	assert.match(theme, /impasto-day\.svg/);
	assert.match(theme, /impasto-night\.svg/);
	assert.match(theme, /overflow-x:\s*clip/);
	assert.match(theme, /background-attachment:\s*scroll/);
	assert.match(dayArtwork, /stroke-linecap="round"/);
	assert.match(nightArtwork, /stroke-linecap="round"/);
});

test("desktop navigation is centered and keeps a stable primary order", async () => {
	const navConfig = await read("src/config/navBarConfig.ts");
	const navbar = await read("src/components/organisms/navigation/Navbar.astro");
	const theme = await readTheme();

	assert.match(navConfig, /LinkPreset\.Home[\s\S]*LinkPreset\.Archive/);
	assert.match(navConfig, /name:\s*"项目"/);
	assert.match(navConfig, /name:\s*"时间线"/);
	assert.match(navConfig, /name:\s*"关于"/);
	assert.match(navbar, /katelya-gallery-header/);
	assert.match(navbar, /katelya-navbar-links/);
	assert.doesNotMatch(navbar, /hideLinks/);
	assert.match(
		theme,
		/grid-template-columns:\s*minmax\(11\.5rem,\s*1fr\)\s+auto\s+minmax\(11\.5rem,\s*1fr\)/,
	);
	assert.match(
		theme,
		/\.katelya-navbar-links[\s\S]*?opacity:\s*1\s*!important/,
	);
});

test("display settings close invisibly and stay inside the viewport", async () => {
	const config = await read("src/config/siteConfig.ts");
	const theme = await readTheme();
	const animation = await read("src/styles/panel-animations.css");

	assert.match(config, /themeColor:\s*\{[\s\S]*?fixed:\s*true/);
	assert.match(config, /pageScaling:\s*\{[\s\S]*?enable:\s*false/);
	assert.match(theme, /#display-setting[\s\S]*?position:\s*fixed\s*!important/);
	assert.match(theme, /max-width:\s*calc\(100vw\s*-\s*2rem\)\s*!important/);
	assert.match(theme, /max-height:\s*calc\(100dvh\s*-\s*7rem\)\s*!important/);
	assert.match(animation, /\.float-panel-closed[\s\S]*opacity:\s*0/);
	assert.match(animation, /\.float-panel-closed[\s\S]*visibility:\s*hidden/);
	assert.doesNotMatch(animation, /scaleX\(0\.6\)/);
});

test("hero stage reserves banner height exactly once", async () => {
	const safety = await read("src/styles/katelya-van-gogh-safety.css");
	const geometry = await read("src/styles/impasto-geometry.css");

	assert.doesNotMatch(safety, /\.katelya-main-shell::before/);
	assert.doesNotMatch(safety, /\.katelya-main-shell\.is-home-layout::before/);
	assert.doesNotMatch(safety, /fullscreen-banner/);
	assert.match(
		geometry,
		/--katelya-active-hero-height:\s*var\(--impasto-article-space\)/,
	);
	assert.match(
		geometry,
		/body\.fullscreen-banner \.katelya-hero-stage\s*\{[\s\S]*?--katelya-active-hero-height:\s*100svh/,
	);
	assert.match(
		geometry,
		/\.katelya-hero-stage\s*\{[\s\S]*?height:\s*var\(--katelya-active-hero-height\)/,
	);
	assert.doesNotMatch(
		geometry,
		/padding-top:\s*var\(--katelya-active-hero-height\)/,
	);
});

test("navbar panel and content use one DOM grid", async () => {
	const layout = await read("src/layouts/Layout.astro");
	const navbar = await read("src/components/organisms/navigation/Navbar.astro");
	const geometry = await read("src/styles/impasto-geometry.css");

	assert.doesNotMatch(layout, /mobile-navbar\.css/);
	assert.doesNotMatch(layout, /wallpaper-navbar-transparent\.css/);
	assert.match(
		navbar,
		/id="navbar"[\s\S]*class="katelya-gallery-header katelya-navbar-shell z-50"/,
	);
	assert.doesNotMatch(
		navbar,
		/<div class:list=\{\[className, "katelya-navbar-shell"\]\}>/,
	);
	assert.match(
		geometry,
		/#navbar\.katelya-navbar-shell\s*\{[\s\S]*?display:\s*grid\s*!important/,
	);
	assert.match(
		geometry,
		/#navbar\.katelya-navbar-shell\s*>\s*\.katelya-navbar-brand/,
	);
	assert.match(
		geometry,
		/#navbar\.katelya-navbar-shell\s*>\s*\.katelya-navbar-links/,
	);
	assert.match(
		geometry,
		/#navbar\.katelya-navbar-shell\s*>\s*\.katelya-navbar-tools/,
	);
});

test("fixed gallery header does not animate vertically on page load", async () => {
	const navbar = await read("src/components/organisms/navigation/Navbar.astro");
	assert.doesNotMatch(navbar, /katelya-gallery-header z-50 onload-animation/);
});

test("settings and menu triggers invoke native popovers without portal reparenting", async () => {
	const navbar = await read("src/components/organisms/navigation/Navbar.astro");
	const settings = await read(
		"src/components/features/settings/SettingsPanel.svelte",
	);
	const menu = await read(
		"src/components/organisms/navigation/NavMenuPanel.astro",
	);

	assert.match(navbar, /popovertarget="display-setting"/);
	assert.match(navbar, /popovertarget="nav-menu-panel"/);
	assert.match(settings, /popover="auto"/);
	assert.match(menu, /popover="auto"/);
	assert.doesNotMatch(navbar, /getSettingsPanel/);
	assert.doesNotMatch(navbar, /overlayRoot/);
});

test("hero route sync avoids observing every DOM mutation", async () => {
	const hero = await read("src/components/layout/KatelyaOrbitHero.astro");
	assert.doesNotMatch(hero, /new MutationObserver/);
	assert.match(
		hero,
		/document\.addEventListener\("swup:page:view", queueHomeStateSync\)/,
	);
});

test("only the current gallery theme stylesheet is loaded", async () => {
	const layout = await read("src/layouts/Layout.astro");
	const grid = await read("src/layouts/MainGridLayout.astro");

	assert.doesNotMatch(layout, /katelya-impressionist\.css/);
	assert.match(grid, /katelya-van-gogh-gallery\.css/);
});

test("closed overlays leave no composited rectangle and overlays are exclusive", async () => {
	const search = await read(
		"src/components/organisms/navigation/Search.svelte",
	);
	const navbar = await read("src/components/organisms/navigation/Navbar.astro");
	const settings = await read(
		"src/components/features/settings/SettingsPanel.svelte",
	);
	const menu = await read(
		"src/components/organisms/navigation/NavMenuPanel.astro",
	);
	const panels = await read("src/styles/panel-animations.css");

	assert.match(search, /popover="auto"/);
	assert.match(search, /showPopover\(\)/);
	assert.match(search, /hidePopover\(\)/);
	assert.match(search, /clearSearchPanelGeometry/);
	assert.match(search, /katelya:overlay-open/);
	assert.match(settings, /popover="auto"/);
	assert.match(settings, /katelya:overlay-open/);
	assert.match(menu, /popover="auto"/);
	assert.match(menu, /katelya:overlay-open/);
	assert.doesNotMatch(navbar, /getSearchPanel/);
	assert.doesNotMatch(navbar, /overlayRoot/);
	assert.doesNotMatch(settings, /float-panel-closed/);
	assert.doesNotMatch(menu, /float-panel-closed/);
	assert.match(
		panels,
		/\.katelya-search-desktop-panel:not\(:popover-open\):not\(\[data-fallback-open="true"\]\)[\s\S]*?display:\s*none\s*!important/,
	);
	assert.match(
		panels,
		/#display-setting:not\(:popover-open\)[\s\S]*?display:\s*none\s*!important/,
	);
	assert.match(
		panels,
		/#nav-menu-panel:not\(:popover-open\)[\s\S]*?display:\s*none\s*!important/,
	);
	assert.match(
		panels,
		/#mobile-toc-panel:not\(:popover-open\)[\s\S]*?display:\s*none\s*!important/,
	);
	assert.doesNotMatch(panels, /\.float-panel\s*\{[^}]*will-change/);
	assert.match(panels, /\.float-panel:popover-open[^{]*\{[^}]*will-change/);
});

test("navbar tools keep search away from More at every desktop width", async () => {
	const navbar = await read("src/components/organisms/navigation/Navbar.astro");
	const geometry = await read("src/styles/impasto-geometry.css");
	const toolsStart = navbar.indexOf('<div class="katelya-navbar-tools">');
	const toolsEnd = navbar.indexOf("</div>\n</nav>", toolsStart);
	const tools = navbar.slice(toolsStart, toolsEnd);

	assert.ok(
		tools.indexOf("display-settings-switch") < tools.indexOf("ThemeSwitch"),
	);
	assert.ok(tools.indexOf("ThemeSwitch") < tools.indexOf("search-container"));
	assert.match(geometry, /\.katelya-navbar-links[\s\S]*?max-width:\s*100%/);
	assert.match(
		geometry,
		/\.katelya-navbar-tools[\s\S]*?margin-inline-start:\s*clamp\(/,
	);
});

test("abstract starry cypress seal replaces the plain K mark", async () => {
	const config = await read("src/config/siteConfig.ts");
	const seal = await read(
		"public/assets/brand/katelya-starry-cypress-seal.svg",
	);

	assert.match(config, /katelya-starry-cypress-seal\.svg/g);
	assert.match(seal, /data-motif="cypress"/);
	assert.match(seal, /data-motif="star-track"/);
	assert.match(seal, /id="k-negative"/);
	assert.doesNotMatch(seal, /<feTurbulence|<animate/);
});

test("mobile toc panel is a native popover without panel manager", async () => {
	const toc = await read("src/components/features/toc/MobileTOC.svelte");
	const handler = await read("src/scripts/handlers/panel-handler.ts");

	assert.match(toc, /popover="auto"/);
	assert.match(toc, /popovertarget="mobile-toc-panel"/);
	assert.match(toc, /showPopover\(\)/);
	assert.match(toc, /hidePopover\(\)/);
	assert.match(toc, /katelya:overlay-open/);
	assert.doesNotMatch(toc, /panelManager/);
	assert.doesNotMatch(toc, /float-panel-closed/);
	// The panel-handler comment may mention the migration, but the panel must
	// not be registered for class-based click-outside management.
	assert.doesNotMatch(handler, /id:\s*"mobile-toc-panel"/);
});

test("navbar paint rules exclude shell children and retired art stays inert", async () => {
	// These pre-art-theme rules paint every direct child div of #navbar with a
	// translucent background — the source of the scrolled ghost rectangle when
	// the in-flow mobile toc panel inflated .katelya-navbar-tools.
	const files = [
		"src/styles/katelya-impressionist.css",
		"src/styles/mobile-navbar.css",
		"src/styles/wallpaper-navbar-transparent.css",
		"src/styles/main.css",
	];
	for (const file of files) {
		const css = await read(file);
		const bare = css.matchAll(
			/#navbar(?:\.scrolled)?\s*>\s*div([^{]*)\{([^}]*)\}/g,
		);
		let count = 0;
		for (const m of bare) {
			const body = m[2];
			// Only paint rules (background / box-shadow, incl. @apply bg-/shadow
			// utilities) can produce the ghost rectangle; transition guards like
			// `.is-theme-transitioning` are benign.
			if (!/background|box-shadow|bg-\(|shadow/.test(body)) continue;
			count += 1;
			assert.ok(
				m[1].includes(":not(.katelya-navbar-links)") &&
					m[1].includes(":not(.katelya-navbar-tools)"),
				`${file}: legacy navbar paint rule must exclude shell children: ${m[0].slice(0, 120)}`,
			);
		}
		if (file === "src/styles/katelya-impressionist.css") {
			assert.equal(count, 0, "retired theme must not retain navbar paint");
			assert.doesNotMatch(css, /background|box-shadow|backdrop-filter/);
			continue;
		}
		assert.ok(
			count > 0,
			`${file}: expected at least one bare #navbar > div paint rule`,
		);
	}
});
