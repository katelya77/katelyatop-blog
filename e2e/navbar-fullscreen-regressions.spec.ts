import { expect, type Page, test } from "@playwright/test";

async function gotoHome(page: Page) {
	await page.goto("/");
	await page.waitForLoadState("load");
	await page.waitForSelector("#display-setting", { state: "attached" });
	await page.waitForSelector("#search-panel", { state: "attached" });
}

async function setWallpaperMode(page: Page, mode: "banner" | "fullscreen") {
	await page.evaluate((nextMode) => {
		localStorage.setItem("wallpaperMode", nextMode);
		window.dispatchEvent(
			new CustomEvent("wallpaper-mode-change", {
				detail: { mode: nextMode },
			}),
		);
	}, mode);
	await page.waitForFunction(
		(nextMode) =>
			document.body.classList.contains("fullscreen-banner") ===
			(nextMode === "fullscreen"),
		mode,
	);
	await page.waitForTimeout(250);
}

async function scrollNavbarIntoSolidState(page: Page) {
	await page.evaluate(() => window.scrollTo({ top: 420, behavior: "instant" }));
	await page.waitForFunction(() =>
		document.getElementById("navbar")?.classList.contains("scrolled"),
	);
	await page.waitForTimeout(200);
}

test.describe("navbar and fullscreen geometry regressions", () => {
	for (const mode of ["banner", "fullscreen"] as const) {
		test(`${mode}: scrolled navbar links remain an unpainted layout strip`, async ({
			page,
		}) => {
			await page.setViewportSize({ width: 1664, height: 920 });
			await gotoHome(page);
			await setWallpaperMode(page, mode);
			await scrollNavbarIntoSolidState(page);

			const appearance = await page.locator(".katelya-navbar-links").evaluate((element) => {
				const style = getComputedStyle(element);
				return {
					backgroundColor: style.backgroundColor,
					backgroundImage: style.backgroundImage,
					borderTopWidth: style.borderTopWidth,
					boxShadow: style.boxShadow,
					backdropFilter: style.backdropFilter,
				};
			});

			expect(appearance.backgroundColor).toBe("rgba(0, 0, 0, 0)");
			expect(appearance.backgroundImage).toBe("none");
			expect(appearance.borderTopWidth).toBe("0px");
			expect(appearance.boxShadow).toBe("none");
			expect(appearance.backdropFilter).toBe("none");
		});
	}

	test("fullscreen: content begins after the complete viewport-height hero", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1664, height: 920 });
		await gotoHome(page);
		await setWallpaperMode(page, "fullscreen");
		await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
		await page.waitForTimeout(250);

		const geometry = await page.evaluate(() => {
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

		expect(geometry).not.toBeNull();
		if (!geometry) return;
		expect(Math.abs(geometry.heroHeight - geometry.viewportHeight)).toBeLessThanOrEqual(2);
		expect(
			geometry.shellTop,
			"main content shell must not overlap any part of the fullscreen hero",
		).toBeGreaterThanOrEqual(geometry.heroBottom - 1);
		expect(
			geometry.gridTop - geometry.heroBottom,
			"main grid should begin shortly after the fullscreen hero without a dead band",
		).toBeGreaterThanOrEqual(0);
		expect(geometry.gridTop - geometry.heroBottom).toBeLessThanOrEqual(48);
	});
});
