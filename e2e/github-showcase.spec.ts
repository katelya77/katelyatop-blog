import { expect, test } from "@playwright/test";

test("GitHub showcase renders public projects and switches between four Ovio-inspired worlds", async ({ page }) => {
	await page.goto("/github/", { waitUntil: "domcontentloaded" });
	await expect(page.locator(".github-showcase-shell")).toHaveAttribute("data-hydrated", "true");

	await expect(page.locator(".gh-id-name h2")).toContainText("Katelya");
	await expect(page.locator(".gh-repo-card").first()).toBeVisible();
	await expect(page.locator(".gh-section-heading h2").filter({ hasText: "近期公开活动" })).toBeVisible();

	for (const world of ["craft", "retro", "toy", "minimal"]) {
		await page.locator('[data-world-tab="' + world + '"]').click();
		await expect(page.locator(".github-showcase-shell")).toHaveAttribute("data-world", world);
		await expect(page.locator('[data-world-tab="' + world + '"]')).toHaveAttribute("aria-selected", "true");
	}

	await expect(page.locator(".gh-insights-grid")).toBeVisible();
	// Before the first scheduled GraphQL refresh, the page has an explicit pending state.
	if (await page.locator(".gh-activity-kpis").count()) {
		await expect(page.locator(".gh-activity-kpis")).toBeVisible();
	} else {
		await expect(page.locator(".gh-contributions-pending")).toBeVisible();
	}
	const heatmap = page.locator(".gh-activity-grid");
	if (await heatmap.count()) {
		const heatmapGeometry = await heatmap.evaluate((element) => {
			const firstCell = element.querySelector<HTMLElement>(".gh-activity-cell");
			return {
				width: element.getBoundingClientRect().width,
				cellWidth: firstCell?.getBoundingClientRect().width ?? 0,
				parentWidth: element.parentElement?.getBoundingClientRect().width ?? 1,
			};
		});
		expect(heatmapGeometry.cellWidth).toBeGreaterThan(12);
		expect(heatmapGeometry.width / heatmapGeometry.parentWidth).toBeGreaterThan(0.9);
		await page.locator(".gh-activity-cell").first().hover();
		await expect(page.locator(".gh-activity-readout")).not.toContainText("将鼠标移至方格");
		await page.locator(".gh-activity-cell").last().click();
		await expect(page.locator(".gh-activity-cell").last()).toHaveAttribute("aria-pressed", "true");
		await page.locator(".gh-year-tabs button").last().click();
		await expect(page.locator(".gh-year-tabs button").last()).toHaveAttribute("aria-pressed", "true");
	} else {
		await expect(page.locator(".gh-contributions-pending")).toContainText("尚未同步");
	}

	const toolsTab = page.locator('[data-filter-value="tools"]');
	if (await toolsTab.count()) {
		await toolsTab.click();
		await expect(page.locator('.gh-repo-card[data-category="tools"]')).toBeVisible();
		await expect(page.locator('.gh-repo-card[data-category="web"]').first()).toBeHidden();
	}

	await page.locator('[data-filter-value="all"]').click();
	await expect(page.locator(".gh-repo-card").first()).toBeVisible();
});

test("GitHub showcase stays within phone and tablet viewports", async ({ page }) => {
	const viewports = [
		{ width: 360, height: 800 },
		{ width: 390, height: 844 },
		{ width: 768, height: 1024 },
		{ width: 820, height: 1180 },
		{ width: 1280, height: 900 },
	];

	for (const viewport of viewports) {
		await page.setViewportSize(viewport);
		await page.goto("/github/", { waitUntil: "domcontentloaded" });
		await expect(page.locator(".github-showcase-shell")).toHaveAttribute("data-hydrated", "true");

		const dimensions = await page.evaluate(() => {
			const root = document.querySelector<HTMLElement>(".github-showcase-shell");
			return {
				documentOverflow:
					document.documentElement.scrollWidth - document.documentElement.clientWidth,
				pageOverflow: root ? root.scrollWidth - root.clientWidth : Number.POSITIVE_INFINITY,
			};
		});

		expect(dimensions.documentOverflow, "document overflow at " + viewport.width + "px").toBeLessThanOrEqual(1);
		expect(dimensions.pageOverflow, "GitHub page overflow at " + viewport.width + "px").toBeLessThanOrEqual(1);
		await expect(page.locator(".gh-hero")).toBeVisible();
		await expect(page.locator(".gh-repo-card").first()).toBeVisible();
	}
});
