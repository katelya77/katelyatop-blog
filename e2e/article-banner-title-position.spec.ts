import { expect, test } from "@playwright/test";

const ARTICLE_PATH = "/posts/katelya-space-online/";

async function openArticleInBannerMode(page: import("@playwright/test").Page) {
	await page.addInitScript(() => {
		localStorage.setItem("wallpaperMode", "banner");
		localStorage.setItem("katelyaWavesRolloutVersion", "impasto-handoff-v1");
		localStorage.setItem("wavesEnabled", "true");
	});
	await page.goto(ARTICLE_PATH, { waitUntil: "load" });
	await expect(page.locator("#page-overlay-title")).toContainText("思囿随笔正式上线");
	await expect(page.locator("#banner-page-overlay")).toBeVisible();
}

for (const viewport of [
	{ width: 1664, height: 920 },
	{ width: 1440, height: 900 },
]) {
	test(`article banner title sits in the lower visual center (${viewport.width}x${viewport.height})`, async ({
		page,
	}) => {
		await page.setViewportSize(viewport);
		await openArticleInBannerMode(page);

		const geometry = await page.evaluate(() => {
			const hero = document.querySelector<HTMLElement>(".katelya-hero-stage");
			const overlayContent = document.querySelector<HTMLElement>(
				"#banner-page-overlay > div",
			);
			const navbar = document.getElementById("navbar");
			if (!hero || !overlayContent || !navbar) return null;

			const heroRect = hero.getBoundingClientRect();
			const overlayRect = overlayContent.getBoundingClientRect();
			const navbarRect = navbar.getBoundingClientRect();
			const overlayCenter = (overlayRect.top + overlayRect.bottom) / 2;

			return {
				heroTop: heroRect.top,
				heroBottom: heroRect.bottom,
				heroHeight: heroRect.height,
				overlayTop: overlayRect.top,
				overlayBottom: overlayRect.bottom,
				overlayCenterRatio: (overlayCenter - heroRect.top) / heroRect.height,
				navbarBottom: navbarRect.bottom,
			};
		});

		expect(geometry).not.toBeNull();
		if (!geometry) return;

		expect(
			geometry.overlayCenterRatio,
			"article title/meta block should sit below the mathematical center of the banner",
		).toBeGreaterThanOrEqual(0.58);
		expect(geometry.overlayCenterRatio).toBeLessThanOrEqual(0.7);
		expect(
			geometry.overlayTop - geometry.navbarBottom,
			"article title must retain breathing room below the fixed navbar",
		).toBeGreaterThanOrEqual(24);
		expect(geometry.overlayBottom).toBeLessThan(geometry.heroBottom - 24);

		await page.screenshot({
			path: `artifacts/ui/article-banner-title-${viewport.width}.png`,
			fullPage: false,
		});
	});
}
