import { expect, test } from "@playwright/test";

async function setStoredTheme(page, theme: "light" | "dark") {
	await page.addInitScript((nextTheme) => localStorage.setItem("theme", nextTheme), theme);
}

async function setWallpaperMode(page, mode: "banner" | "fullscreen") {
	await page.evaluate((nextMode) => {
		localStorage.setItem("wallpaperMode", nextMode);
		window.dispatchEvent(
			new CustomEvent("wallpaper-mode-change", { detail: { mode: nextMode } }),
		);
	}, mode);
	await page.waitForFunction(
		(nextMode) =>
			document.body.classList.contains("fullscreen-banner") ===
			(nextMode === "fullscreen"),
		mode,
	);
	await page.waitForTimeout(220);
}

test("banner and fullscreen have visibly different Hero geometry and visible handoff waves", async ({ browser }) => {
	const context = await browser.newContext({ viewport: { width: 1664, height: 920 } });
	const page = await context.newPage();
	await setStoredTheme(page, "light");
	await page.goto("/", { waitUntil: "domcontentloaded" });

	await setWallpaperMode(page, "banner");
	const bannerHero = await page.locator(".katelya-hero-stage").boundingBox();
	const bannerWave = page.locator("#header-waves");
	await expect(bannerWave).toBeVisible();
	const bannerWaveStyle = await bannerWave.evaluate((element) => getComputedStyle(element).display);
	expect(bannerWaveStyle).not.toBe("none");
	expect(bannerHero?.height ?? 0).toBeGreaterThan(480);
	expect(bannerHero?.height ?? Number.POSITIVE_INFINITY).toBeLessThan(700);

	await setWallpaperMode(page, "fullscreen");
	const fullscreenHero = await page.locator(".katelya-hero-stage").boundingBox();
	expect(fullscreenHero?.height ?? 0).toBeGreaterThanOrEqual(919);
	expect((fullscreenHero?.height ?? 0) - (bannerHero?.height ?? 0)).toBeGreaterThan(250);

	await context.close();
});

test("cold boot shows a complete painterly poster while renderer is delayed", async ({ browser }) => {
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await context.newPage();
	await page.route("**/*impasto-renderer*.js", async (route) => {
		await new Promise((resolve) => setTimeout(resolve, 1200));
		await route.continue();
	});
	await page.goto("/", { waitUntil: "domcontentloaded" });
	const fallback = page.locator(".impasto-static-fallback");
	await expect(fallback).toBeVisible();
	const style = await fallback.evaluate((element) => {
		const computed = getComputedStyle(element);
		return { image: computed.backgroundImage, opacity: computed.opacity };
	});
	expect(style.image).toContain("impasto-day.svg");
	expect(Number(style.opacity)).toBeGreaterThan(0.9);
	await page.screenshot({ path: "test-results/painterly-v2-1-cold-boot.png", fullPage: false });
	await context.close();
});

for (const viewport of [
	{ name: "mobile", width: 390, height: 844, touch: true },
	{ name: "ipad", width: 820, height: 1180, touch: true },
	{ name: "desktop", width: 1920, height: 1080, touch: false },
]) {
	test(`${viewport.name} remains overflow-safe in banner and fullscreen`, async ({ browser }) => {
		const context = await browser.newContext({
			viewport: { width: viewport.width, height: viewport.height },
			hasTouch: viewport.touch,
			isMobile: false,
		});
		const page = await context.newPage();
		await page.goto("/", { waitUntil: "domcontentloaded" });
		for (const mode of ["banner", "fullscreen"] as const) {
			await setWallpaperMode(page, mode);
			const overflow = await page.evaluate(() =>
				document.documentElement.scrollWidth - document.documentElement.clientWidth,
			);
			expect(overflow).toBeLessThanOrEqual(1);
			await expect(page.locator(".katelya-hero-stage")).toBeVisible();
		}
		await context.close();
	});
}
