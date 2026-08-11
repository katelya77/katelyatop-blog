import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const ARTIFACT_DIR = "artifacts/ui-v25";

async function usePainterlyMode(
	page: import("@playwright/test").Page,
	mode: "banner" | "fullscreen",
) {
	await page.addInitScript((nextMode) => {
		localStorage.setItem("wallpaperMode", nextMode);
		localStorage.setItem("katelyaWavesRolloutVersion", "impasto-ribbons-v2");
		localStorage.setItem("wavesEnabled", "true");
	}, mode);
}

async function waitForPaint(page: import("@playwright/test").Page) {
	await page.waitForLoadState("load");
	await expect(page.locator("[data-impasto-canvas]")).toBeVisible();
	await page.waitForFunction(
		() =>
			document.documentElement.classList.contains("impasto-ready") ||
			document.documentElement.classList.contains("impasto-static"),
	);
	await page.waitForTimeout(300);
}

test.beforeAll(async () => {
	await mkdir(ARTIFACT_DIR, { recursive: true });
});

for (const sample of [
	{ name: "home-banner-1664", width: 1664, height: 920, mode: "banner" as const },
	{
		name: "home-fullscreen-1664",
		width: 1664,
		height: 920,
		mode: "fullscreen" as const,
	},
	{ name: "home-banner-phone", width: 390, height: 844, mode: "banner" as const },
	{ name: "home-banner-ipad", width: 820, height: 1180, mode: "banner" as const },
]) {
	test(`captures ${sample.name} without clipping or overflow`, async ({ page }) => {
		await usePainterlyMode(page, sample.mode);
		await page.setViewportSize({ width: sample.width, height: sample.height });
		await page.goto("/");
		await waitForPaint(page);
		await expect(page.locator(".katelya-hero-title")).toBeInViewport();
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth - window.innerWidth,
			),
		).toBeLessThanOrEqual(1);
		await page.screenshot({
			path: `${ARTIFACT_DIR}/${sample.name}.png`,
			fullPage: false,
		});
	});
}

test("captures the desktop article safe-area handoff", async ({ page }) => {
	await usePainterlyMode(page, "banner");
	await page.setViewportSize({ width: 1664, height: 920 });
	await page.goto("/posts/katelya-space-online/");
	await waitForPaint(page);
	await expect(page.locator("#page-overlay-title")).toBeVisible();
	await expect(page.locator("#page-overlay-title")).toBeInViewport();
	await page.screenshot({
		path: `${ARTIFACT_DIR}/article-banner-1664.png`,
		fullPage: false,
	});
});
