import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const ARTIFACT_DIR = "artifacts/ui";
const MOBILE_VIEWPORT = { width: 390, height: 844 };

test.describe("mobile loading performance", () => {
	test.use({
		viewport: MOBILE_VIEWPORT,
		hasTouch: true,
		isMobile: true,
		deviceScaleFactor: 3,
	});

	test("touch clients render the live impasto canvas instead of being forced static", async ({
		page,
	}) => {
		await mkdir(ARTIFACT_DIR, { recursive: true });
		await page.goto("/", { waitUntil: "domcontentloaded" });

		const coarsePointer = await page.evaluate(() =>
			window.matchMedia("(pointer: coarse)").matches,
		);
		expect(coarsePointer).toBe(true);

		await page.waitForFunction(
			() => document.documentElement.classList.contains("impasto-ready"),
			undefined,
			{ timeout: 7000 },
		);

		await expect(page.locator("[data-impasto-canvas]")).toHaveCSS(
			"opacity",
			"1",
		);
		await expect(page.locator(".impasto-static-fallback")).toHaveCSS(
			"visibility",
			"hidden",
		);
		expect(
			await page.evaluate(() =>
				document.documentElement.classList.contains("impasto-static"),
			),
		).toBe(false);

		await page.screenshot({
			path: `${ARTIFACT_DIR}/mobile-live-impasto.png`,
			fullPage: false,
		});
	});

	test("the first remote audio file is not requested until the user presses play", async ({
		page,
	}) => {
		const audioRequests: string[] = [];
		page.on("request", (request) => {
			const url = request.url();
			if (url.includes("pan.katelya.eu.org/file/")) audioRequests.push(url);
		});

		await page.goto("/", { waitUntil: "domcontentloaded" });
		await page.waitForSelector("button.music-fab", { state: "visible" });
		await page.waitForTimeout(2500);

		expect(
			audioRequests,
			"idle hydration must not keep the mobile browser loading a remote song",
		).toHaveLength(0);

		await page.locator("button.music-fab").click();
		const floatingPlayer = page.locator(".music-player-fab-anchor");
		await expect(floatingPlayer).toBeVisible();
		await floatingPlayer.getByRole("button", { name: "播放" }).click();
		await expect
			.poll(() => audioRequests.length, { timeout: 5000 })
			.toBeGreaterThan(0);
	});
});
