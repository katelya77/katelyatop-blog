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

const PANEL_IDS = ["#display-setting", "#nav-menu-panel", "#search-panel"];
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
async function expectNoGhostOverlay(page: Page, label: string) {
	const offenders = await page.evaluate(() => {
		const describe = (el: Element) => {
			const rect = el.getBoundingClientRect();
			return `${el.tagName.toLowerCase()}#${el.id || "?"}.${[...el.classList].join(".")} ${Math.round(rect.width)}x${Math.round(rect.height)}`;
		};
		const hits = document.elementsFromPoint(window.innerWidth - 250, 70);
		const bad: string[] = [];
		for (const el of hits) {
			const panel = el.closest(".float-panel, [popover]");
			if (!panel) continue;
			const style = window.getComputedStyle(panel);
			const visible =
				style.display !== "none" &&
				style.visibility !== "hidden" &&
				Number(style.opacity) > 0;
			if (visible) bad.push(describe(panel));
		}
		return bad;
	});
	expect(
		offenders,
		`[${label}] elementsFromPoint(innerWidth-250, 70) hit visible overlay panel(s) — ghost rectangle regression`,
	).toEqual([]);
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
