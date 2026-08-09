import { mkdir } from "node:fs/promises";
import { expect, test, type Browser } from "@playwright/test";

const ARTIFACT_DIR = "artifacts/ui";

async function openTouchPage(
	browser: Browser,
	viewport: { width: number; height: number },
) {
	const context = await browser.newContext({
		viewport,
		hasTouch: true,
		isMobile: viewport.width < 768,
	});
	const page = await context.newPage();
	return { context, page };
}

test("phone touch client keeps the live Impasto canvas", async ({ browser }) => {
	await mkdir(ARTIFACT_DIR, { recursive: true });
	const { context, page } = await openTouchPage(browser, {
		width: 390,
		height: 844,
	});
	try {
		await page.goto("/", { waitUntil: "domcontentloaded" });
		expect(
			await page.evaluate(() => matchMedia("(pointer: coarse)").matches),
		).toBe(true);
		await page.waitForFunction(
			() => document.documentElement.classList.contains("impasto-ready"),
			undefined,
			{ timeout: 8000 },
		);
		const canvas = page.locator("[data-impasto-canvas]");
		await expect(canvas).toHaveCSS("display", "block");
		await expect(canvas).toHaveCSS("opacity", "1");
		expect(await canvas.evaluate((el) => el.width)).toBeGreaterThan(0);
		await page.screenshot({
			path: `${ARTIFACT_DIR}/impasto-phone-dynamic.png`,
			fullPage: false,
		});
	} finally {
		await context.close();
	}
});

test("iPad touch client keeps the same live Impasto canvas", async ({ browser }) => {
	await mkdir(ARTIFACT_DIR, { recursive: true });
	const { context, page } = await openTouchPage(browser, {
		width: 1024,
		height: 1366,
	});
	try {
		await page.goto("/", { waitUntil: "domcontentloaded" });
		expect(
			await page.evaluate(() => matchMedia("(pointer: coarse)").matches),
		).toBe(true);
		await page.waitForFunction(
			() => document.documentElement.classList.contains("impasto-ready"),
			undefined,
			{ timeout: 8000 },
		);
		const canvas = page.locator("[data-impasto-canvas]");
		await expect(canvas).toHaveCSS("display", "block");
		await expect(canvas).toHaveCSS("opacity", "1");
		await page.screenshot({
			path: `${ARTIFACT_DIR}/impasto-ipad-dynamic.png`,
			fullPage: false,
		});
	} finally {
		await context.close();
	}
});

test("reduced-motion touch clients intentionally keep the static fallback", async ({
	browser,
}) => {
	const { context, page } = await openTouchPage(browser, {
		width: 390,
		height: 844,
	});
	try {
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.goto("/", { waitUntil: "domcontentloaded" });
		await page.waitForFunction(
			() => document.documentElement.classList.contains("impasto-static"),
		);
		await expect(page.locator(".impasto-static-fallback")).toHaveCSS(
			"visibility",
			"visible",
		);
		await expect(page.locator("[data-impasto-canvas]")).toHaveCSS(
			"display",
			"none",
		);
	} finally {
		await context.close();
	}
});
