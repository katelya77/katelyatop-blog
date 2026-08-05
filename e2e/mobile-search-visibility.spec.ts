import { expect, test } from "@playwright/test";

test("mobile navbar exposes exactly one visible search trigger", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/");
	await page.waitForLoadState("load");
	await page.waitForSelector("#search-panel", { state: "attached" });

	await expect(page.locator("#search-switch")).toBeVisible();
	await expect(page.locator("#search-bar")).toBeHidden();

	const visibleTriggers = await page.locator("[data-search-trigger]").evaluateAll((triggers) =>
		triggers.filter((trigger) => trigger.getClientRects().length > 0).length,
	);
	expect(visibleTriggers, "mobile viewport must render one search button").toBe(1);

	await page.locator("#search-switch").click();
	await expect(page.locator("#search-panel")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.locator("#search-panel")).toBeHidden();
});
