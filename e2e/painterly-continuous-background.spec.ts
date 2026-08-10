import { expect, test } from "@playwright/test";

async function waitForImpasto(page) {
	await page.waitForFunction(() => document.documentElement.classList.contains("impasto-ready"));
}

async function backdropState(page) {
	return page.evaluate(() => {
		const canvas = document.querySelector<HTMLElement>("[data-impasto-canvas]");
		const fallback = document.querySelector<HTMLElement>(".impasto-static-fallback");
		if (!canvas || !fallback) throw new Error("Impasto layers missing");
		const canvasStyle = getComputedStyle(canvas);
		const fallbackStyle = getComputedStyle(fallback);
		return {
			canvasOpacity: Number(canvasStyle.opacity),
			fallbackOpacity: Number(fallbackStyle.opacity),
			fallbackVisibility: fallbackStyle.visibility,
			readingClass: document.documentElement.classList.contains("impasto-reading"),
		};
	});
}

test("live Impasto canvas remains dominant from Hero through footer", async ({ browser }) => {
	const context = await browser.newContext({ viewport: { width: 1664, height: 920 } });
	const page = await context.newPage();
	await page.goto("/", { waitUntil: "domcontentloaded" });
	await waitForImpasto(page);

	const waves = page.locator("#header-waves");
	await expect(waves).toBeVisible();

	for (const ratio of [0, 0.52, 1]) {
		await page.evaluate((nextRatio) => {
			const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
			window.scrollTo(0, maxScroll * nextRatio);
		}, ratio);
		await page.waitForTimeout(180);
		const state = await backdropState(page);
		expect(state.readingClass).toBe(false);
		expect(state.canvasOpacity).toBeGreaterThanOrEqual(0.95);
		expect(state.fallbackOpacity).toBeLessThanOrEqual(0.05);
		expect(state.fallbackVisibility).toBe("hidden");
	}

	await context.close();
});

test("banner is bounded while fullscreen remains immersive", async ({ browser }) => {
	const context = await browser.newContext({ viewport: { width: 1664, height: 920 } });
	const page = await context.newPage();
	await page.goto("/", { waitUntil: "domcontentloaded" });

	await page.evaluate(() => {
		localStorage.setItem("wallpaperMode", "banner");
		window.dispatchEvent(new CustomEvent("wallpaper-mode-change", { detail: { mode: "banner" } }));
	});
	await page.waitForTimeout(220);
	const bannerHero = await page.locator(".katelya-hero-stage").boundingBox();
	expect(bannerHero?.height ?? 0).toBeGreaterThan(500);
	expect(bannerHero?.height ?? Number.POSITIVE_INFINITY).toBeLessThan(700);

	await page.evaluate(() => {
		localStorage.setItem("wallpaperMode", "fullscreen");
		window.dispatchEvent(new CustomEvent("wallpaper-mode-change", { detail: { mode: "fullscreen" } }));
	});
	await page.waitForFunction(() => document.body.classList.contains("fullscreen-banner"));
	await page.waitForTimeout(220);
	const fullscreenHero = await page.locator(".katelya-hero-stage").boundingBox();
	expect(fullscreenHero?.height ?? 0).toBeGreaterThanOrEqual(919);
	expect((fullscreenHero?.height ?? 0) - (bannerHero?.height ?? 0)).toBeGreaterThan(250);

	await context.close();
});

test("phone portrait keeps the complete title inside a real visual gutter", async ({ browser }) => {
	const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
	const page = await context.newPage();
	await page.goto("/", { waitUntil: "domcontentloaded" });
	const titleLocator = page.locator(".katelya-hero-title");
	const title = await titleLocator.boundingBox();
	expect(title).not.toBeNull();
	expect(title?.x ?? 0).toBeGreaterThanOrEqual(8);
	expect((title?.x ?? 0) + (title?.width ?? 0)).toBeLessThanOrEqual(382);
	const textFits = await titleLocator.evaluate((element) =>
		element.scrollWidth <= element.clientWidth + 1,
	);
	expect(textFits).toBe(true);
	await context.close();
});
