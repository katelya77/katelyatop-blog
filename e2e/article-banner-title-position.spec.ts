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
	test(`article banner title remains centered inside the actual Hero (${viewport.width}x${viewport.height})`, async ({
		page,
	}) => {
		await page.setViewportSize(viewport);
		await openArticleInBannerMode(page);

		const geometry = await page.evaluate(() => {
			const hero = document.querySelector<HTMLElement>(".katelya-hero-stage");
			const banner = document.getElementById("banner-wrapper");
			const overlayContent = document.querySelector<HTMLElement>(
				"#banner-page-overlay > div",
			);
			const navbar = document.getElementById("navbar");
			if (!hero || !banner || !overlayContent || !navbar) return null;

			const heroRect = hero.getBoundingClientRect();
			const bannerRect = banner.getBoundingClientRect();
			const overlayRect = overlayContent.getBoundingClientRect();
			const navbarRect = navbar.getBoundingClientRect();
			const overlayCenter = (overlayRect.top + overlayRect.bottom) / 2;

			return {
				heroTop: heroRect.top,
				heroBottom: heroRect.bottom,
				heroHeight: heroRect.height,
				bannerTop: bannerRect.top,
				bannerBottom: bannerRect.bottom,
				overlayTop: overlayRect.top,
				overlayBottom: overlayRect.bottom,
				overlayCenterRatio: (overlayCenter - heroRect.top) / heroRect.height,
				navbarBottom: navbarRect.bottom,
			};
		});

		expect(geometry).not.toBeNull();
		if (!geometry) return;

		expect(
			Math.abs(geometry.bannerTop - geometry.heroTop),
			"the Banner wrapper must start at the Hero top instead of inheriting the legacy -30vh offset",
		).toBeLessThanOrEqual(2);
		expect(
			Math.abs(geometry.bannerBottom - geometry.heroBottom),
			"the Banner wrapper must fill the Hero stage exactly",
		).toBeLessThanOrEqual(2);
		expect(
			geometry.overlayCenterRatio,
			"article title/meta block should remain around the Hero visual center",
		).toBeGreaterThanOrEqual(0.44);
		expect(geometry.overlayCenterRatio).toBeLessThanOrEqual(0.58);
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
