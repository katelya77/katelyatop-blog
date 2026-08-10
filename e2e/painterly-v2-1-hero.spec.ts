import { expect, test } from "@playwright/test";

const setMode = async (page, mode: "banner" | "fullscreen", theme: "light" | "dark") => {
	await page.addInitScript(({ nextMode, nextTheme }) => {
		localStorage.setItem("wallpaperMode", nextMode);
		localStorage.setItem("theme", nextTheme);
	}, { nextMode: mode, nextTheme: theme });
};

test("banner and fullscreen have visibly different Hero geometry and visible handoff waves", async ({ browser }) => {
	const context = await browser.newContext({ viewport: { width: 1664, height: 920 } });
	const page = await context.newPage();

	await setMode(page, "banner", "light");
	await page.goto("/", { waitUntil: "domcontentloaded" });
	const bannerHero = await page.locator(".katelya-hero-stage").boundingBox();
	const bannerWave = page.locator("#header-waves");
	await expect(bannerWave).toBeVisible();
	const bannerWaveStyle = await bannerWave.evaluate((element) => getComputedStyle(element).display);
	expect(bannerWaveStyle).not.toBe("none");
	expect(bannerHero?.height ?? 0).toBeGreaterThan(280);
	expect(bannerHero?.height ?? Number.POSITIVE_INFINITY).toBeLessThan(700);

	await page.evaluate(() => localStorage.setItem("wallpaperMode", "fullscreen"));
	await page.reload({ waitUntil: "domcontentloaded" });
	const fullscreenHero = await page.locator(".katelya-hero-stage").boundingBox();
	expect(fullscreenHero?.height ?? 0).toBeGreaterThanOrEqual(919);
	expect((fullscreenHero?.height ?? 0) - (bannerHero?.height ?? 0)).toBeGreaterThan(220);

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
		for (const mode of ["banner", "fullscreen"] as const) {
			await page.addInitScript((nextMode) => localStorage.setItem("wallpaperMode", nextMode), mode);
			await page.goto("/", { waitUntil: "domcontentloaded" });
			const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
			expect(overflow).toBeLessThanOrEqual(1);
			await expect(page.locator(".katelya-hero-stage")).toBeVisible();
		}
		await context.close();
	});
}
