import { mkdir } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";

/**
 * Overlay / geometry acceptance tests.
 *
 * Covers the two regressions fixed in the root-overlay + fullscreen-layout
 * refactor:
 *  1. Semi-transparent ghost rectangles near the navbar after scrolling —
 *     floating panels must be fully hidden (no compositor leftovers, no
 *     hit-testable elements) while closed.
 *  2. A ~100svh dead band between the fullscreen hero and the article cards —
 *     the hero stage owns its height in normal flow and the main shell
 *     overlaps the hero's closing edge by --katelya-fullscreen-content-overlap.
 */

const PANEL_IDS = [
	"#display-setting",
	"#nav-menu-panel",
	"#search-panel",
	// Native popover since the overlay refactor; absent from the DOM is fine.
	"#mobile-toc-panel",
];
const ARTIFACT_DIR = "artifacts/ui";

async function gotoHome(page: Page) {
	await page.goto("/");
	await page.waitForLoadState("load");
	// SettingsPanel / Search are client:only Svelte islands — wait for hydration.
	await page.waitForSelector("#display-setting", { state: "attached" });
	await page.waitForSelector("#search-panel", { state: "attached" });
}

async function scrollToFraction(page: Page, fraction: number) {
	await page.evaluate((f) => {
		const max = document.documentElement.scrollHeight - window.innerHeight;
		window.scrollTo({ top: Math.max(0, max * f), behavior: "instant" });
	}, fraction);
	await page.waitForTimeout(300);
}

async function expectPanelsHidden(page: Page) {
	for (const id of PANEL_IDS) {
		await expect(page.locator(id)).toBeHidden();
	}
}

/**
 * Ghost-overlay probe: hit-test the strip right of the navigation tools.
 * Allowed: the navbar/header stage and its descendants, plus background
 * content (hero, banner, body). Forbidden: any *visible* element that is a
 * floating panel or a native popover — those would be the ghost rectangles.
 */
async function expectNoGhostOverlay(
	page: Page,
	label: string,
	points?: Array<[number, number]>,
) {
	const offenders = await page.evaluate((probePoints) => {
		const describe = (el: Element) => {
			const rect = el.getBoundingClientRect();
			return `${el.tagName.toLowerCase()}#${el.id || "?"}.${[...el.classList].join(".")} ${Math.round(rect.width)}x${Math.round(rect.height)}`;
		};
		const pts: Array<[number, number]> = probePoints ?? [
			[window.innerWidth - 250, 70],
		];
		const bad: string[] = [];
		for (const [x, y] of pts) {
			const hits = document.elementsFromPoint(x, y);
			for (const el of hits) {
				const panel = el.closest(".float-panel, [popover]");
				if (!panel) continue;
				const style = window.getComputedStyle(panel);
				const visible =
					style.display !== "none" &&
					style.visibility !== "hidden" &&
					Number(style.opacity) > 0;
				if (visible)
					bad.push(`(${Math.round(x)},${Math.round(y)}) ${describe(panel)}`);
			}
		}
		return bad;
	}, points ?? null);
	expect(
		offenders,
		`[${label}] ghost probe hit visible overlay panel(s) — ghost rectangle regression`,
	).toEqual([]);
}

/**
 * Probe points around the navbar's right end, derived from the live navbar
 * rect: just below the tools strip (where the 2560px ghost rectangle used to
 * appear) plus the original fixed points.
 */
async function navbarProbePoints(page: Page): Promise<Array<[number, number]>> {
	return page.evaluate(() => {
		const nav = document.getElementById("navbar");
		if (!nav) return [[window.innerWidth - 250, 70]] as Array<[number, number]>;
		const r = nav.getBoundingClientRect();
		return [
			[r.right - 120, r.bottom + 20],
			[r.right - 300, r.bottom + 20],
			[r.right - 120, r.bottom + 50],
			[window.innerWidth - 250, 70],
			[window.innerWidth - 350, 130],
		] as Array<[number, number]>;
	});
}

/**
 * Switch wallpaper mode through the exact production path used by
 * `setWallpaperMode()` in src/utils/setting-utils.ts: persist the
 * `wallpaperMode` localStorage key, then dispatch `wallpaper-mode-change`,
 * which GridScripts.astro's applyWallpaperMode() listens to.
 */
async function setWallpaperMode(page: Page, mode: "banner" | "fullscreen") {
	await page.evaluate((m) => {
		localStorage.setItem("wallpaperMode", m);
		window.dispatchEvent(
			new CustomEvent("wallpaper-mode-change", { detail: { mode: m } }),
		);
	}, mode);
	await page.waitForFunction(
		(m) =>
			document.body.classList.contains("fullscreen-banner") ===
			(m === "fullscreen"),
		mode,
	);
	await page.waitForTimeout(200);
}

/** Fullscreen-mode geometry: hero = 100svh, main content overlaps its edge. */
async function expectFullscreenGeometry(page: Page, label: string) {
	await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
	await page.waitForTimeout(250);

	const m = await page.evaluate(() => {
		const hero = document.querySelector(".katelya-hero-stage");
		const shell = document.querySelector(".katelya-main-shell");
		const grid = document.getElementById("main-grid");
		if (!hero || !shell || !grid) return null;
		const heroRect = hero.getBoundingClientRect();
		const shellRect = shell.getBoundingClientRect();
		const gridRect = grid.getBoundingClientRect();
		return {
			heroHeight: heroRect.height,
			heroBottom: heroRect.bottom,
			shellTop: shellRect.top,
			gridTop: gridRect.top,
			viewportHeight: window.innerHeight,
		};
	});
	expect(
		m,
		`[${label}] hero stage / main shell / main grid must exist`,
	).not.toBeNull();
	if (!m) return;

	expect(
		Math.abs(m.heroHeight - m.viewportHeight),
		`[${label}] hero stage height ${m.heroHeight} should equal viewport height ${m.viewportHeight} (±2px)`,
	).toBeLessThanOrEqual(2);
	expect(
		m.shellTop - m.heroBottom,
		`[${label}] main shell must not sit below the hero's bottom edge (dead band)`,
	).toBeLessThanOrEqual(32);
	expect(
		m.gridTop - m.heroBottom,
		`[${label}] mainGridTop - heroBottom must be <= 32px (overlap, not gap)`,
	).toBeLessThanOrEqual(32);

	// After the hero bottom leaves the viewport, an article card is visible.
	await page.evaluate(() => {
		const hero = document.querySelector(".katelya-hero-stage");
		const heroHeight = hero?.getBoundingClientRect().height ?? 0;
		window.scrollTo({ top: heroHeight * 1.2, behavior: "instant" });
	});
	await page.waitForTimeout(300);
	const cardVisible = await page.evaluate(() => {
		const cards = [
			...document.querySelectorAll(
				"#main-grid .katelya-post-card, #main-grid article.card-base",
			),
		];
		return cards.some((card) => {
			const r = card.getBoundingClientRect();
			return r.bottom > 0 && r.top < window.innerHeight && r.height > 0;
		});
	});
	expect(
		cardVisible,
		`[${label}] no article card in viewport right after the hero — dead band regression`,
	).toBe(true);
	await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
	await page.waitForTimeout(200);
}

/** Toggle theme through the real navbar switch and wait for the flip. */
async function toggleTheme(page: Page) {
	const wasDark = await page.evaluate(() =>
		document.documentElement.classList.contains("dark"),
	);
	await page.locator("#scheme-switch").click();
	await page.waitForFunction(
		(prev) => document.documentElement.classList.contains("dark") !== prev,
		wasDark,
	);
	// ThemeSwitch debounces re-clicks for 200ms; the transition lasts ~180ms.
	await page.waitForTimeout(250);
}

test.describe("desktop viewports", () => {
	for (const viewport of [
		{ width: 1664, height: 920 },
		{ width: 1440, height: 900 },
	]) {
		test(`A. no ghost overlay while scrolling (${viewport.width}x${viewport.height})`, async ({
			page,
		}) => {
			await page.setViewportSize(viewport);
			await gotoHome(page);
			await scrollToFraction(page, 0);
			for (const fraction of [0.25, 0.5, 0.75, 1]) {
				await scrollToFraction(page, fraction);
				await expectPanelsHidden(page);
				await expectNoGhostOverlay(page, `scroll ${fraction * 100}%`);
			}
		});
	}

	test("B. open/close cycles leave no ghost overlay", async ({ page }) => {
		await page.setViewportSize({ width: 1664, height: 920 });
		await gotoHome(page);

		const settingsPanel = page.locator("#display-setting");
		const settingsSwitch = page.locator("#display-settings-switch");
		for (let i = 0; i < 5; i++) {
			await settingsSwitch.click();
			await expect(settingsPanel).toBeVisible();
			await settingsSwitch.click();
			await expect(settingsPanel).toBeHidden();
		}

		const searchPanel = page.locator("#search-panel");
		for (let i = 0; i < 5; i++) {
			await page.locator("#search-bar").click();
			await expect(searchPanel).toBeVisible();
			await page.keyboard.press("Escape");
			await expect(searchPanel).toBeHidden();
		}

		// Mutual exclusion: opening search closes the settings panel.
		await settingsSwitch.click();
		await expect(settingsPanel).toBeVisible();
		await page.locator("#search-bar").click();
		await expect(searchPanel).toBeVisible();
		await expect(settingsPanel).toBeHidden();
		await page.keyboard.press("Escape");
		await expect(searchPanel).toBeHidden();

		for (const fraction of [0.25, 0.5, 0.75, 1]) {
			await scrollToFraction(page, fraction);
			await expectPanelsHidden(page);
			await expectNoGhostOverlay(
				page,
				`after cycles, scroll ${fraction * 100}%`,
			);
		}
	});

	test("C. fullscreen wallpaper mode has no dead band", async ({ page }) => {
		await page.setViewportSize({ width: 1664, height: 920 });
		await gotoHome(page);
		await setWallpaperMode(page, "fullscreen");
		await expectFullscreenGeometry(page, "fullscreen");
	});

	test("D. theme toggling leaves no ghost overlay", async ({ page }) => {
		await page.setViewportSize({ width: 1664, height: 920 });
		await gotoHome(page);
		for (let i = 0; i < 3; i++) {
			await toggleTheme(page);
			await expectPanelsHidden(page);
			await scrollToFraction(page, 0.5);
			await expectNoGhostOverlay(page, `theme toggle ${i + 1}`);
			await scrollToFraction(page, 0);
		}
	});

	test("E. wallpaper mode round trip keeps geometry and no ghosts", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1664, height: 920 });
		await gotoHome(page);

		await setWallpaperMode(page, "fullscreen");
		await expectFullscreenGeometry(page, "banner -> fullscreen");
		await scrollToFraction(page, 0.5);
		await expectNoGhostOverlay(page, "fullscreen scrolled");

		await setWallpaperMode(page, "banner");
		// Banner mode: hero is shorter than the viewport again.
		const heroHeight = await page.evaluate(
			() =>
				document.querySelector(".katelya-hero-stage")?.getBoundingClientRect()
					.height ?? 0,
		);
		expect(
			heroHeight,
			"banner mode hero should shrink back below viewport height",
		).toBeLessThan(920 - 2);
		await expectNoGhostOverlay(page, "back to banner");

		await setWallpaperMode(page, "fullscreen");
		await expectFullscreenGeometry(page, "banner -> fullscreen (2nd)");
	});

	test("F. swup round trip closes panels and syncs is-home-hero", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1664, height: 920 });
		await gotoHome(page);
		// @swup/astro initializes on idle — navigating before window.swup
		// exists causes a full reload, wiping the swup:page:view counter.
		await page.waitForFunction(() =>
			document.documentElement.classList.contains("swup-enabled"),
		);
		await expect(
			page.locator(".katelya-hero-stage"),
			"home hero stage should start with is-home-hero",
		).toHaveClass(/is-home-hero/);

		await page.evaluate(() => {
			const w = window as unknown as { __swupPageViews: number };
			w.__swupPageViews = 0;
			document.addEventListener("swup:page:view", () => {
				w.__swupPageViews += 1;
			});
		});

		// Open a panel first — navigation must close it.
		await page.locator("#display-settings-switch").click();
		await expect(page.locator("#display-setting")).toBeVisible();

		await page.locator('#main-grid a[href^="/posts/"]').first().click();
		await page.waitForURL(/\/posts\/[^/]+\/?$/);
		await page.waitForTimeout(400);

		await expectPanelsHidden(page);
		await expectNoGhostOverlay(page, "post page");
		await expect(
			page.locator(".katelya-hero-stage"),
			"article page hero stage must lose is-home-hero",
		).not.toHaveClass(/is-home-hero/);

		await page.locator(".katelya-navbar-brand").click();
		await page.waitForURL("http://127.0.0.1:4321/");
		await page.waitForTimeout(400);

		await expect(
			page.locator(".katelya-hero-stage"),
			"back home hero stage must regain is-home-hero",
		).toHaveClass(/is-home-hero/);
		await expectPanelsHidden(page);
		await expectNoGhostOverlay(page, "back home");

		const swupPageViews = await page.evaluate(
			() =>
				(window as unknown as { __swupPageViews?: number }).__swupPageViews ??
				0,
		);
		expect(
			swupPageViews,
			"navigations should go through swup (swup:page:view events), not full reloads",
		).toBeGreaterThanOrEqual(2);
	});

	test("H. 2560x1418 scroll leaves no ghost overlay near navbar tools", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 2560, height: 1418 });
		await gotoHome(page);

		for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
			await scrollToFraction(page, fraction);
			await expectPanelsHidden(page);
			await expectNoGhostOverlay(
				page,
				`2560 scroll ${fraction * 100}%`,
				await navbarProbePoints(page),
			);

			// The tools strip must stay inside the navbar and unpainted — the
			// ghost rectangle was this box, stretched and filled by legacy
			// `#navbar > div` rules.
			const tools = await page.evaluate(() => {
				const nav = document.getElementById("navbar");
				const strip = document.querySelector(".katelya-navbar-tools");
				if (!nav || !strip) return null;
				const navRect = nav.getBoundingClientRect();
				const stripRect = strip.getBoundingClientRect();
				const style = window.getComputedStyle(strip);
				return {
					navBottom: navRect.bottom,
					navTop: navRect.top,
					stripBottom: stripRect.bottom,
					stripTop: stripRect.top,
					backgroundColor: style.backgroundColor,
				};
			});
			expect(
				tools,
				`[${fraction}] navbar / tools strip must exist`,
			).not.toBeNull();
			if (!tools) continue;
			expect(
				tools.stripBottom,
				`[2560 scroll ${fraction * 100}%] tools strip must not protrude below the navbar (was the ghost rectangle)`,
			).toBeLessThanOrEqual(tools.navBottom + 1);
			expect(
				tools.stripTop,
				`[2560 scroll ${fraction * 100}%] tools strip must not protrude above the navbar`,
			).toBeGreaterThanOrEqual(tools.navTop - 1);
			expect(
				tools.backgroundColor,
				`[2560 scroll ${fraction * 100}%] tools strip must stay transparent`,
			).toBe("rgba(0, 0, 0, 0)");
		}
	});

	test("I. dropdown menu open/close and mutual exclusion (2560x1418)", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 2560, height: 1418 });
		await gotoHome(page);

		const trigger = page.locator("[data-dropdown-trigger]").first();
		const menu = page.locator("[data-dropdown-menu]").first();

		// Open via click, close via Esc. The pointer must move away first —
		// the menu also opens on :hover, which is intended.
		await trigger.click();
		await expect(menu).toBeVisible();
		await page.mouse.move(1280, 600);
		await page.keyboard.press("Escape");
		await expect(menu).toBeHidden();

		// Open via click, close via outside click.
		await trigger.click();
		await expect(menu).toBeVisible();
		await page.mouse.click(1280, 600);
		await expect(menu).toBeHidden();

		// Mutual exclusion: opening search closes the dropdown.
		await trigger.click();
		await expect(menu).toBeVisible();
		await page.locator("#search-bar").click();
		await expect(page.locator("#search-panel")).toBeVisible();
		await expect(menu).toBeHidden();
		await page.keyboard.press("Escape");
		await expect(page.locator("#search-panel")).toBeHidden();

		// No ghost left behind after the cycles.
		for (const fraction of [0.5, 1]) {
			await scrollToFraction(page, fraction);
			await expectNoGhostOverlay(
				page,
				`after dropdown cycles, scroll ${fraction * 100}%`,
				await navbarProbePoints(page),
			);
		}
	});

	test("J. navbar right-side buttons do not overlap (2560 / 1440)", async ({
		page,
	}) => {
		for (const viewport of [
			{ width: 2560, height: 1418 },
			{ width: 1440, height: 900 },
		]) {
			await page.setViewportSize(viewport);
			await gotoHome(page);

			const m = await page.evaluate(() => {
				const nav = document.getElementById("navbar");
				const strip = document.querySelector(".katelya-navbar-tools");
				const selectors = [
					"[data-dropdown-trigger]",
					"#display-settings-switch",
					"#scheme-switch",
					"#search-bar",
				];
				if (!nav || !strip) return null;
				const rects = selectors.map((sel) => {
					const el = document.querySelector(sel);
					if (!el) return null;
					const r = el.getBoundingClientRect();
					return {
						sel,
						top: r.top,
						bottom: r.bottom,
						left: r.left,
						right: r.right,
					};
				});
				if (rects.some((r) => r === null)) return null;
				const navRect = nav.getBoundingClientRect();
				const stripRect = strip.getBoundingClientRect();
				return {
					nav: {
						top: navRect.top,
						bottom: navRect.bottom,
						left: navRect.left,
						right: navRect.right,
					},
					strip: {
						top: stripRect.top,
						bottom: stripRect.bottom,
						left: stripRect.left,
						right: stripRect.right,
					},
					rects: rects as Array<{
						sel: string;
						top: number;
						bottom: number;
						left: number;
						right: number;
					}>,
				};
			});
			expect(
				m,
				`[${viewport.width}] navbar geometry targets must exist`,
			).not.toBeNull();
			if (!m) continue;

			// The tools strip is contained by the navbar on both axes.
			expect(
				m.strip.bottom,
				`[${viewport.width}] tools strip must not protrude below the navbar`,
			).toBeLessThanOrEqual(m.nav.bottom + 1);
			expect(
				m.strip.top,
				`[${viewport.width}] tools strip must not protrude above the navbar`,
			).toBeGreaterThanOrEqual(m.nav.top - 1);
			expect(m.strip.right).toBeLessThanOrEqual(m.nav.right + 1);
			expect(m.strip.left).toBeGreaterThanOrEqual(m.nav.left - 1);

			for (const r of m.rects) {
				expect(
					r.top,
					`[${viewport.width}] ${r.sel} must sit inside the navbar vertically`,
				).toBeGreaterThanOrEqual(m.nav.top - 1);
				expect(
					r.bottom,
					`[${viewport.width}] ${r.sel} must sit inside the navbar vertically`,
				).toBeLessThanOrEqual(m.nav.bottom + 1);
			}
			for (let i = 0; i < m.rects.length; i++) {
				for (let j = i + 1; j < m.rects.length; j++) {
					const a = m.rects[i];
					const b = m.rects[j];
					const overlap =
						a.left < b.right - 1 &&
						b.left < a.right - 1 &&
						a.top < b.bottom - 1 &&
						b.top < a.bottom - 1;
					expect(
						overlap,
						`[${viewport.width}] ${a.sel} and ${b.sel} must not overlap`,
					).toBe(false);
				}
			}
		}
	});

	test("G. screenshot artifacts", async ({ page }) => {
		await mkdir(ARTIFACT_DIR, { recursive: true });
		await page.setViewportSize({ width: 1664, height: 920 });
		await gotoHome(page);
		await page.waitForTimeout(500);

		await page.screenshot({
			path: `${ARTIFACT_DIR}/home-light-banner.png`,
			fullPage: true,
		});

		await setWallpaperMode(page, "fullscreen");
		await page.waitForTimeout(400);
		await page.screenshot({
			path: `${ARTIFACT_DIR}/home-light-fullscreen.png`,
			fullPage: true,
		});

		await toggleTheme(page); // -> dark
		await page.waitForTimeout(300);
		await page.screenshot({
			path: `${ARTIFACT_DIR}/home-dark-fullscreen.png`,
			fullPage: true,
		});

		await toggleTheme(page); // -> light
		await setWallpaperMode(page, "banner");
		await scrollToFraction(page, 0.5);
		await page.screenshot({
			path: `${ARTIFACT_DIR}/scrolled-no-overlays.png`,
			fullPage: true,
		});

		await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
		await page.locator("#display-settings-switch").click();
		await expect(page.locator("#display-setting")).toBeVisible();
		await page.waitForTimeout(300);
		await page.screenshot({ path: `${ARTIFACT_DIR}/settings-open.png` });

		await page.keyboard.press("Escape");
		await expect(page.locator("#display-setting")).toBeHidden();
		await page.locator("#search-bar").click();
		await expect(page.locator("#search-panel")).toBeVisible();
		await page.waitForTimeout(300);
		await page.screenshot({ path: `${ARTIFACT_DIR}/search-open.png` });

		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto("/");
		await page.waitForLoadState("load");
		await page.waitForSelector("#display-setting", { state: "attached" });
		await page.waitForTimeout(500);
		await page.screenshot({ path: `${ARTIFACT_DIR}/mobile-home.png` });
	});
});

test("A(mobile). no ghost overlay while scrolling (390x844)", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await gotoHome(page);
	for (const fraction of [0.25, 0.5, 0.75, 1]) {
		await scrollToFraction(page, fraction);
		await expectPanelsHidden(page);
		await expectNoGhostOverlay(page, `mobile scroll ${fraction * 100}%`);
	}
});

test("B(mobile). mobile toc popover open/close and mutual exclusion", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await gotoHome(page);

	const toc = page.locator("#mobile-toc-panel");
	await expect(toc).toBeHidden();

	await page.locator("#mobile-toc-switch").click();
	await expect(toc).toBeVisible();
	// Migrated to a native popover: fully out of flow, fixed positioning.
	const position = await toc.evaluate((el) => getComputedStyle(el).position);
	expect(position, "mobile toc panel must be position:fixed").toBe("fixed");

	// Mutual exclusion: opening the nav menu closes the toc panel.
	await page.locator("#nav-menu-switch").click();
	await expect(page.locator("#nav-menu-panel")).toBeVisible();
	await expect(toc).toBeHidden();

	// Close the menu again and confirm no ghost remains after scrolling.
	await page.locator("#nav-menu-switch").click();
	await expect(page.locator("#nav-menu-panel")).toBeHidden();
	await scrollToFraction(page, 0.5);
	await expectPanelsHidden(page);
	await expectNoGhostOverlay(page, "mobile after toc cycles");
});
