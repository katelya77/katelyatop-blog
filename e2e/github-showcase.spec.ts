import { expect, test } from "@playwright/test";

test("GitHub showcase renders featured projects and category filters", async ({ page }) => {
	await page.goto("/github/", { waitUntil: "domcontentloaded" });

	await expect(page.locator(".github-identity h1")).toContainText("Katelya");
	await expect(page.locator(".github-repo-card").first()).toBeVisible();
	await expect(page.locator(".github-section-heading h2").filter({ hasText: "近期公开活动" })).toBeVisible();

	await page.locator('.filter-tabs-item[data-filter-value="tools"]').click();
	await expect(page.locator('.github-repo-card[data-category="tools"]')).toBeVisible();
	await expect(page.locator('.github-repo-card[data-category="web"]')).toHaveClass(/filtered-out/);

	await page.locator('.filter-tabs-item[data-filter-value="all"]').click();
	await expect(page.locator('.github-repo-card[data-category="web"]').first()).toBeVisible();
});

test("GitHub showcase stays within phone and tablet viewports", async ({ page }) => {
	const viewports = [
		{ width: 390, height: 844 },
		{ width: 768, height: 1024 },
		{ width: 820, height: 1180 },
	];

	for (const viewport of viewports) {
		await page.setViewportSize(viewport);
		await page.goto("/github/", { waitUntil: "domcontentloaded" });

		const dimensions = await page.evaluate(() => {
			const root = document.querySelector<HTMLElement>(".github-page");
			return {
				documentOverflow:
					document.documentElement.scrollWidth - document.documentElement.clientWidth,
					pageOverflow: root ? root.scrollWidth - root.clientWidth : Number.POSITIVE_INFINITY,
			};
		});

		expect(dimensions.documentOverflow, `document overflow at ${viewport.width}px`).toBeLessThanOrEqual(1);
		expect(dimensions.pageOverflow, `GitHub page overflow at ${viewport.width}px`).toBeLessThanOrEqual(1);
		await expect(page.locator(".github-hero")).toBeVisible();
		await expect(page.locator(".github-repo-card").first()).toBeVisible();
	}
});
