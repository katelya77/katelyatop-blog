import { expect, test } from "@playwright/test";

const viewports = [
	{ name: "iphone-portrait", width: 390, height: 844, touch: true },
	{ name: "iphone-landscape", width: 844, height: 390, touch: true },
	{ name: "android-portrait", width: 412, height: 915, touch: true },
	{ name: "android-landscape", width: 915, height: 412, touch: true },
	{ name: "ipad-small-portrait", width: 768, height: 1024, touch: true },
	{ name: "ipad-small-landscape", width: 1024, height: 768, touch: true },
	{ name: "ipad-air-portrait", width: 820, height: 1180, touch: true },
	{ name: "ipad-air-landscape", width: 1180, height: 820, touch: true },
	{ name: "ipad-pro-portrait", width: 1024, height: 1366, touch: true },
	{ name: "ipad-pro-landscape", width: 1366, height: 1024, touch: true },
	{ name: "compact-laptop", width: 1280, height: 800, touch: false },
	{ name: "desktop-1440", width: 1440, height: 900, touch: false },
	{ name: "desktop-1664", width: 1664, height: 920, touch: false },
	{ name: "desktop-1920", width: 1920, height: 1080, touch: false },
	{ name: "desktop-2560", width: 2560, height: 1440, touch: false },
] as const;

const scenarios = [
	{ theme: "light", mode: "banner" },
	{ theme: "dark", mode: "banner" },
	{ theme: "light", mode: "fullscreen" },
	{ theme: "dark", mode: "fullscreen" },
] as const;

for (const viewport of viewports) {
	test(`${viewport.name} preserves painterly hero geometry in every theme and mode`, async ({
		browser,
	}) => {
		test.setTimeout(90_000);
		const context = await browser.newContext({
			viewport: { width: viewport.width, height: viewport.height },
			hasTouch: viewport.touch,
			isMobile: false,
			deviceScaleFactor: 1,
		});
		const page = await context.newPage();
		await page.goto("/", { waitUntil: "domcontentloaded" });

		for (const scenario of scenarios) {
			const expectedOrbitCardCount =
				viewport.width >= 768 && viewport.height >= 600 ? 4 : 0;
			await page.evaluate(({ theme, mode }) => {
				localStorage.setItem("theme", theme);
				localStorage.setItem("wallpaperMode", mode);
			}, scenario);
			await page.reload({ waitUntil: "domcontentloaded" });
			await page.locator("html.impasto-ready, html.impasto-static").waitFor();

			const geometry = await page.evaluate(() => {
				const rect = (selector: string) =>
					document.querySelector(selector)?.getBoundingClientRect().toJSON() ??
					null;
				const visibleRects = (selector: string) =>
					[...document.querySelectorAll<HTMLElement>(selector)]
						.filter((element) => {
							const style = getComputedStyle(element);
							return style.display !== "none" && style.visibility !== "hidden";
						})
						.map((element) => element.getBoundingClientRect().toJSON())
						.filter((rect) => rect.width > 0 && rect.height > 0);
				const overlaps = (first: DOMRect, second: DOMRect) =>
					Math.min(first.right, second.right) - Math.max(first.left, second.left) > 1 &&
					Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top) > 1;

				const hero = rect(".katelya-hero-stage");
				const title = rect("#katelya-hero-title");
				const shell = rect(".katelya-main-shell");
				const cards = visibleRects(".katelya-orbit-card");
				const links = visibleRects(".katelya-hero-links a");
				const canvas = document.querySelector<HTMLCanvasElement>("[data-impasto-canvas]");

				return {
					dark: document.documentElement.classList.contains("dark"),
					fullscreen: document.body.classList.contains("fullscreen-banner"),
					documentOverflow:
						document.documentElement.scrollWidth - document.documentElement.clientWidth,
					hero,
					title,
					shell,
					cards,
					cardCollision: title
						? cards.some((card) => overlaps(card as DOMRect, title as DOMRect))
						: true,
					linkCollision: cards.some((card) =>
						links.some((link) => overlaps(card as DOMRect, link as DOMRect)),
					),
					canvas: canvas ? { width: canvas.width, height: canvas.height } : null,
					quality: document.documentElement.dataset.impastoQuality ?? null,
				};
			});

			expect(geometry.dark, `${viewport.name} ${scenario.theme}`).toBe(
				scenario.theme === "dark",
			);
			expect(geometry.fullscreen, `${viewport.name} ${scenario.mode}`).toBe(
				scenario.mode === "fullscreen",
			);
			expect(geometry.documentOverflow).toBeLessThanOrEqual(1);
			expect(geometry.hero).not.toBeNull();
			expect(geometry.title).not.toBeNull();
			expect(geometry.shell).not.toBeNull();
			expect(geometry.cardCollision).toBe(false);
			expect(geometry.linkCollision).toBe(false);
			expect(
				geometry.cards,
				`${viewport.name} ${scenario.theme} ${scenario.mode} orbit cards`,
			).toHaveLength(expectedOrbitCardCount);
			expect(geometry.title?.left ?? -1).toBeGreaterThanOrEqual(-1);
			expect(geometry.title?.right ?? viewport.width + 2).toBeLessThanOrEqual(
				viewport.width + 1,
			);
			expect(geometry.title?.bottom ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
				(geometry.hero?.bottom ?? 0) + 1,
			);

			if (scenario.mode === "fullscreen") {
				expect(geometry.hero?.height ?? 0).toBeGreaterThanOrEqual(viewport.height - 1);
				const overlap = (geometry.hero?.bottom ?? 0) - (geometry.shell?.top ?? 0);
				expect(overlap).toBeGreaterThanOrEqual(20);
				expect(overlap).toBeLessThanOrEqual(96);
			} else {
				expect(geometry.shell?.top ?? 0).toBeGreaterThanOrEqual(
					(geometry.hero?.bottom ?? 0) - 1,
				);
			}

			for (const card of geometry.cards) {
				expect(card.left).toBeGreaterThanOrEqual(-1);
				expect(card.right).toBeLessThanOrEqual(viewport.width + 1);
				expect(card.top).toBeGreaterThanOrEqual(-1);
				expect(card.bottom).toBeLessThanOrEqual((geometry.hero?.bottom ?? 0) + 1);
			}
			expect(geometry.canvas).not.toBeNull();
			expect(geometry.canvas?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
				viewport.touch ? viewport.width : Math.ceil(viewport.width * 1.4),
			);
			expect(geometry.quality).toMatch(/^(high|medium|low)$/);
		}

		await context.close();
	});
}
