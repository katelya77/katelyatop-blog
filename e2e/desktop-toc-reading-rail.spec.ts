import { mkdir } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";

const ARTIFACT_DIR = "artifacts/ui";
const ARTICLE = "/fosu/2026-freshman-guide/campus-growth/";

async function gotoArticle(page: Page, width: number, height: number) {
	await page.setViewportSize({ width, height });
	await page.goto(ARTICLE);
	await page.waitForLoadState("load");
	await page.waitForSelector("#post-container", { state: "attached" });
	await page.evaluate(() => window.scrollTo(0, Math.max(900, window.innerHeight)));
	await page.waitForTimeout(250);
	await page.waitForSelector("#desktop-toc-rail", { state: "visible" });
	await page.waitForFunction(
		() => document.querySelectorAll("#desktop-toc-rail .sidebar-toc-item").length > 3,
	);
}

async function documentWidth(page: Page) {
	return page.evaluate(() => document.documentElement.scrollWidth);
}

async function visibleLabelWidth(page: Page) {
	return page
		.locator("#desktop-toc-rail .sidebar-toc-label")
		.first()
		.evaluate((element) => element.getBoundingClientRect().width);
}

test("1664px desktop reveals the full TOC without resizing the rail", async ({
	page,
}) => {
	await mkdir(ARTIFACT_DIR, { recursive: true });
	await gotoArticle(page, 1664, 900);

	const rail = page.locator("#desktop-toc-rail");
	const compact = rail.locator(".desktop-toc-compact");
	const panel = rail.locator(".desktop-toc-panel");
	const initialRailBox = await rail.boundingBox();
	const panelBox = await panel.boundingBox();
	expect(initialRailBox).not.toBeNull();
	expect(panelBox).not.toBeNull();
	if (!initialRailBox || !panelBox) return;

	expect(initialRailBox.width).toBeLessThan(120);
	expect(panelBox.width).toBeGreaterThanOrEqual(220);
	await expect(compact).toHaveCSS("opacity", "1");
	await expect(panel).toHaveCSS("opacity", "0");
	expect(await documentWidth(page)).toBeLessThanOrEqual(1665);

	await rail.hover();
	await expect(panel).toHaveCSS("opacity", "1");
	await page.waitForTimeout(260);

	const expandedRailBox = await rail.boundingBox();
	const expandedPanelBox = await panel.boundingBox();
	expect(expandedRailBox).not.toBeNull();
	expect(expandedPanelBox).not.toBeNull();
	if (!expandedRailBox || !expandedPanelBox) return;

	expect(Math.abs(expandedRailBox.width - initialRailBox.width)).toBeLessThan(1);
	expect(expandedPanelBox.x).toBeGreaterThanOrEqual(0);
	expect(expandedPanelBox.x + expandedPanelBox.width).toBeLessThanOrEqual(1664);
	expect(await visibleLabelWidth(page)).toBeGreaterThanOrEqual(120);
	expect(await documentWidth(page)).toBeLessThanOrEqual(1665);

	const overlapLayerIsSafe = await page.evaluate(() => {
		const surfaceElement = document.querySelector<HTMLElement>(
			"#desktop-toc-rail .desktop-toc-panel",
		);
		const categories = document.getElementById("categories");
		if (!surfaceElement || !categories) return false;

		const surfaceRect = surfaceElement.getBoundingClientRect();
		const categoriesRect = categories.getBoundingClientRect();
		const left = Math.max(surfaceRect.left, categoriesRect.left);
		const right = Math.min(surfaceRect.right, categoriesRect.right);
		const top = Math.max(surfaceRect.top, categoriesRect.top);
		const bottom = Math.min(surfaceRect.bottom, categoriesRect.bottom);
		if (left >= right || top >= bottom) return true;

		const x = (left + right) / 2;
		const y = (top + bottom) / 2;
		return Boolean(
			document.elementFromPoint(x, y)?.closest("#desktop-toc-rail"),
		);
	});
	expect(overlapLayerIsSafe).toBe(true);

	await page.evaluate(() => {
		const target = document.querySelectorAll<HTMLElement>("#post-container h2[id]")[1];
		target?.scrollIntoView({ block: "start" });
	});
	await page.waitForTimeout(300);
	expect(
		await rail.locator(".sidebar-toc-item.visible").count(),
	).toBeGreaterThan(0);

	await page.screenshot({
		path: `${ARTIFACT_DIR}/desktop-toc-1664-expanded.png`,
		fullPage: false,
	});
});

test("1920px desktop keeps the full reading panel persistently readable", async ({
	page,
}) => {
	await mkdir(ARTIFACT_DIR, { recursive: true });
	await gotoArticle(page, 1920, 1080);

	const panel = page.locator("#desktop-toc-rail .desktop-toc-panel");
	const box = await panel.boundingBox();
	expect(box).not.toBeNull();
	if (!box) return;

	await expect(panel).toHaveCSS("opacity", "1");
	expect(box.width).toBeGreaterThanOrEqual(180);
	expect(box.x).toBeGreaterThanOrEqual(0);
	expect(box.x + box.width).toBeLessThanOrEqual(1920);
	expect(await visibleLabelWidth(page)).toBeGreaterThanOrEqual(120);
	expect(await documentWidth(page)).toBeLessThanOrEqual(1921);

	await page.screenshot({
		path: `${ARTIFACT_DIR}/desktop-toc-1920-persistent.png`,
		fullPage: false,
	});
});
