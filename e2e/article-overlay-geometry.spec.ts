import { expect, type Page, test } from "@playwright/test";

const ARTICLE = "/posts/katelya-space-online/";

async function useBannerMode(page: Page) {
	await page.addInitScript(() => {
		localStorage.setItem("wallpaperMode", "banner");
		localStorage.setItem("katelyaWavesRolloutVersion", "impasto-ribbons-v2");
		localStorage.setItem("wavesEnabled", "true");
	});
}

async function waitForArticleOverlay(page: Page) {
	await expect(page.locator("#banner-page-overlay")).toBeVisible();
	await expect(page.locator("#page-overlay-title")).not.toHaveText("");
}

async function waitForSwupIdle(page: Page, requireTop = true) {
	await page.waitForFunction(
		() => !document.documentElement.classList.contains("is-page-transitioning"),
	);
	if (requireTop) {
		await page.waitForFunction(() => Math.abs(window.scrollY) <= 1);
	}
}

async function overlayGeometry(page: Page) {
	return page.evaluate(() => {
		const nav = document.getElementById("navbar");
		const hero = document.querySelector<HTMLElement>(
			"[data-katelya-hero-stage]",
		);
		const overlay = document.querySelector<HTMLElement>(
			"#banner-page-overlay > .banner-page-overlay__content",
		);
		const shell = document.querySelector<HTMLElement>(
			"[data-katelya-main-shell]",
		);
		if (!nav || !hero || !overlay || !shell) return null;
		const navRect = nav.getBoundingClientRect();
		const heroRect = hero.getBoundingClientRect();
		const overlayRect = overlay.getBoundingClientRect();
		return {
			navBottom: navRect.bottom,
			heroBottom: heroRect.bottom,
			overlayTop: overlayRect.top,
			overlayBottom: overlayRect.bottom,
			shellTop: shell.getBoundingClientRect().top,
			title: document.getElementById("page-overlay-title")?.textContent ?? "",
			overflow:
				document.documentElement.scrollWidth -
				document.documentElement.clientWidth,
			semanticShell: shell.matches("[data-katelya-main-shell]"),
		};
	});
}

for (const viewport of [
	{ width: 1366, height: 768 },
	{ width: 1440, height: 900 },
	{ width: 1664, height: 920 },
	{ width: 1920, height: 1080 },
]) {
	test(`direct article overlay respects navbar safe area (${viewport.width}x${viewport.height})`, async ({
		page,
	}) => {
		await useBannerMode(page);
		await page.setViewportSize(viewport);
		await page.goto(ARTICLE, { waitUntil: "domcontentloaded" });
		await waitForArticleOverlay(page);
		const geometry = await overlayGeometry(page);
		expect(geometry).not.toBeNull();
		if (!geometry) return;
		expect(geometry.overlayTop - geometry.navBottom).toBeGreaterThanOrEqual(16);
		expect(geometry.overlayBottom).toBeLessThanOrEqual(geometry.heroBottom - 48);
		expect(geometry.shellTop).toBeGreaterThanOrEqual(geometry.heroBottom - 1);
		expect(geometry.overflow).toBeLessThanOrEqual(1);
		expect(geometry.semanticShell).toBe(true);
	});
}

for (const mode of ["banner", "fullscreen"] as const) {
	test(`Swup home to article matches direct-load overlay geometry in ${mode} mode`, async ({
		page,
	}) => {
		await page.addInitScript((wallpaperMode) => {
			localStorage.setItem("wallpaperMode", wallpaperMode);
			localStorage.setItem("katelyaWavesRolloutVersion", "impasto-ribbons-v2");
			localStorage.setItem("wavesEnabled", "true");
		}, mode);
		await page.setViewportSize({ width: 1664, height: 920 });
		await page.goto(ARTICLE, { waitUntil: "domcontentloaded" });
		await waitForArticleOverlay(page);
		const direct = await overlayGeometry(page);

		await page.goto("/", { waitUntil: "domcontentloaded" });
		await page.waitForFunction(() =>
			document.documentElement.classList.contains("swup-enabled"),
		);
		await page
			.locator('#main-grid a[href="/posts/katelya-space-online/"]')
			.first()
			.click();
		await page.waitForURL(/\/posts\/katelya-space-online\/?$/);
		await waitForArticleOverlay(page);
		await waitForSwupIdle(page);
		const swup = await overlayGeometry(page);

		expect(direct).not.toBeNull();
		expect(swup).not.toBeNull();
		if (!direct || !swup) return;
		expect(swup.title).toBe(direct.title);
		expect(Math.abs(swup.overlayTop - direct.overlayTop)).toBeLessThanOrEqual(2);
		expect(Math.abs(swup.overlayBottom - direct.overlayBottom)).toBeLessThanOrEqual(2);
		expect(swup.overlayTop - swup.navBottom).toBeGreaterThanOrEqual(16);
	});
}

test("Swup home, article, archive, Back and Forward retain one geometry contract", async ({
	page,
}) => {
	await useBannerMode(page);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/", { waitUntil: "domcontentloaded" });
	await page.waitForFunction(() =>
		document.documentElement.classList.contains("swup-enabled"),
	);

	const openArticleAndCheck = async (requireTop = true) => {
		await page.waitForURL(/\/posts\/katelya-space-online\/?$/);
		await waitForArticleOverlay(page);
		await waitForSwupIdle(page, requireTop);
		if (!requireTop) {
			// History may restore its saved scroll position. Move to the Hero only
			// for the geometry observation below.
			await page.evaluate(() => window.scrollTo(0, 0));
		}
		const geometry = await overlayGeometry(page);
		expect(geometry).not.toBeNull();
		if (geometry) {
			expect(geometry.overlayTop - geometry.navBottom).toBeGreaterThanOrEqual(16);
			expect(geometry.shellTop).toBeGreaterThanOrEqual(geometry.heroBottom - 1);
		}
	};

	await page.locator('#main-grid a[href="/posts/katelya-space-online/"]').first().click();
	await openArticleAndCheck();

	await page.locator('.katelya-navbar-links a[href="/"]').click();
	await page.waitForURL(/\/$/);
	await expect(page.locator(".katelya-hero-title")).toBeVisible();
	await expect(page.locator("#banner-page-overlay")).toBeHidden();

	await page.locator('.katelya-navbar-links a[href="/archive/"]').click();
	await page.waitForURL(/\/archive\/?$/);
	await page.locator('#main-grid a[href="/posts/katelya-space-online/"]').first().click();
	await openArticleAndCheck();

	await page.goBack();
	await page.waitForURL(/\/archive\/?$/);
	await page.goForward();
	await openArticleAndCheck(false);
});

test("mobile and iPad article routes hide the collapsed Hero overlay without overflow", async ({
	page,
}) => {
	await useBannerMode(page);
	for (const viewport of [
		{ width: 390, height: 844 },
		{ width: 820, height: 1180 },
		{ width: 1024, height: 768 },
	]) {
		await page.setViewportSize(viewport);
		await page.goto(ARTICLE, { waitUntil: "domcontentloaded" });
		await expect(page.locator("#banner-page-overlay")).toBeHidden();
		await expect(page.locator('#post-container [data-pagefind-meta="title"]')).toBeVisible();
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth - window.innerWidth,
			),
		).toBeLessThanOrEqual(1);
	}
});
