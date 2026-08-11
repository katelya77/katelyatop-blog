import { expect, test } from "@playwright/test";

async function waitForArt(page: import("@playwright/test").Page) {
	await page.locator("html.impasto-ready, html.impasto-static").waitFor();
}

test("one Impasto canvas remains dominant from Hero through footer", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1664, height: 920 });
	await page.goto("/", { waitUntil: "domcontentloaded" });
	await page.waitForFunction(() =>
		document.documentElement.classList.contains("impasto-ready"),
	);
	await expect(page.locator("[data-impasto-canvas]")).toHaveCount(1);

	for (const ratio of [0, 0.52, 1]) {
		const state = await page.evaluate((nextRatio) => {
			const maxScroll = Math.max(
				document.documentElement.scrollHeight - window.innerHeight,
				0,
			);
			window.scrollTo(0, maxScroll * nextRatio);
			const canvas = document.querySelector<HTMLElement>("[data-impasto-canvas]");
			const fallback = document.querySelector<HTMLElement>(
				".impasto-static-fallback",
			);
			return {
				canvasOpacity: canvas ? Number(getComputedStyle(canvas).opacity) : 0,
				fallbackOpacity: fallback
					? Number(getComputedStyle(fallback).opacity)
					: 1,
				fallbackVisibility: fallback
					? getComputedStyle(fallback).visibility
					: "visible",
			};
		}, ratio);
		expect(state.canvasOpacity).toBeGreaterThanOrEqual(0.95);
		expect(state.fallbackOpacity).toBeLessThanOrEqual(0.05);
		expect(state.fallbackVisibility).toBe("hidden");
	}
});

test("banner and fullscreen keep normal-flow geometry without negative offsets", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1664, height: 920 });
	await page.goto("/", { waitUntil: "domcontentloaded" });
	await waitForArt(page);

	for (const mode of ["banner", "fullscreen"] as const) {
		await page.evaluate((nextMode) => {
			localStorage.setItem("wallpaperMode", nextMode);
			window.dispatchEvent(new CustomEvent("wallpaper-mode-change"));
		}, mode);
		await page.waitForFunction(
			(nextMode) =>
				document.body.classList.contains("fullscreen-banner") ===
				(nextMode === "fullscreen"),
			mode,
		);

		const geometry = await page.evaluate(() => {
			const hero = document.querySelector<HTMLElement>(
				"[data-katelya-hero-stage]",
			);
			const shell = document.querySelector<HTMLElement>(
				"[data-katelya-main-shell]",
			);
			const banner = document.getElementById("banner-wrapper");
			if (!hero || !shell || !banner) return null;
			const heroRect = hero.getBoundingClientRect();
			const shellRect = shell.getBoundingClientRect();
			const bannerRect = banner.getBoundingClientRect();
			const shellStyle = getComputedStyle(shell);
			return {
				heroHeight: heroRect.height,
				heroBottom: heroRect.bottom,
				shellTop: shellRect.top,
				bannerTopDelta: Math.abs(bannerRect.top - heroRect.top),
				bannerBottomDelta: Math.abs(bannerRect.bottom - heroRect.bottom),
				shellInlineTop: shell.style.top,
				shellInlineMarginTop: shell.style.marginTop,
				shellMarginTop: Number.parseFloat(shellStyle.marginTop),
			};
		});

		expect(geometry).not.toBeNull();
		if (!geometry) continue;
		expect(geometry.bannerTopDelta).toBeLessThanOrEqual(2);
		expect(geometry.bannerBottomDelta).toBeLessThanOrEqual(2);
		expect(geometry.shellTop).toBeGreaterThanOrEqual(geometry.heroBottom - 1);
		expect(geometry.shellInlineTop).toBe("");
		expect(geometry.shellInlineMarginTop).toBe("");
		expect(geometry.shellMarginTop).toBeGreaterThanOrEqual(0);
		if (mode === "banner") {
			expect(geometry.heroHeight).toBeGreaterThanOrEqual(510);
			expect(geometry.heroHeight).toBeLessThan(700);
		} else {
			expect(Math.abs(geometry.heroHeight - 920)).toBeLessThanOrEqual(2);
		}
	}
});

test("disabled painterly edge does not change Hero or shell geometry", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/", { waitUntil: "domcontentloaded" });

	const readGeometry = () =>
		page.evaluate(() => {
			const hero = document.querySelector<HTMLElement>(
				"[data-katelya-hero-stage]",
			);
			const shell = document.querySelector<HTMLElement>(
				"[data-katelya-main-shell]",
			);
			return hero && shell
				? {
						heroHeight: hero.getBoundingClientRect().height,
						shellTop: shell.getBoundingClientRect().top,
					}
				: null;
		});

	const before = await readGeometry();
	await page.evaluate(() =>
		document.documentElement.setAttribute("data-waves-enabled", "false"),
	);
	await expect(page.locator("#header-waves")).toBeHidden();
	const after = await readGeometry();
	expect(after).toEqual(before);
});

test("reduced motion retains a complete static painterly surface", async ({
	page,
}) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/", { waitUntil: "domcontentloaded" });
	await page.waitForFunction(() =>
		document.documentElement.classList.contains("impasto-static"),
	);
	await expect(page.locator(".impasto-static-fallback")).toHaveCSS(
		"visibility",
		"visible",
	);
	await expect(page.locator(".impasto-static-fallback")).toHaveCSS("opacity", "1");
	await expect(page.locator("#header-waves")).toBeVisible();
	await expect(page.locator(".katelya-pigment-ribbon").first()).toHaveCSS(
		"animation-name",
		"none",
	);
});
