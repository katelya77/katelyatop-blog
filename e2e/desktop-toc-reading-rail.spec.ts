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

test("1664px desktop uses a compact rail that expands inward without overflow", async ({
	page,
}) => {
	await mkdir(ARTIFACT_DIR, { recursive: true });
	await gotoArticle(page, 1664, 900);

	const rail = page.locator("#desktop-toc-rail");
	const surface = rail.locator(".desktop-toc-surface");
	const compactBox = await surface.boundingBox();
	expect(compactBox).not.toBeNull();
	if (!compactBox) return;

	expect(compactBox.width).toBeLessThan(120);
	expect(await documentWidth(page)).toBeLessThanOrEqual(1665);

	await rail.hover();
	await page.waitForTimeout(320);

	const expandedBox = await surface.boundingBox();
	expect(expandedBox).not.toBeNull();
	if (!expandedBox) return;

	expect(expandedBox.width).toBeGreaterThanOrEqual(220);
	expect(expandedBox.x).toBeGreaterThanOrEqual(0);
	expect(expandedBox.x + expandedBox.width).toBeLessThanOrEqual(1664);
	expect(await visibleLabelWidth(page)).toBeGreaterThanOrEqual(120);
	expect(await documentWidth(page)).toBeLessThanOrEqual(1665);

	const overlapLayer = await page.evaluate(() => {
		const surfaceElement = document.querySelector<HTMLElement>(
			"#desktop-toc-rail .desktop-toc-surface",
		);
		const categories = document.getElementById("categories");
		if (!surfaceElement || !categories) {
			return { overlaps: false, railOnTop: false };
		}

		const surfaceRect = surfaceElement.getBoundingClientRect();
		const categoriesRect = categories.getBoundingClientRect();
		const left = Math.max(surfaceRect.left, categoriesRect.left);
		const right = Math.min(surfaceRect.right, categoriesRect.right);
		const top = Math.max(surfaceRect.top, categoriesRect.top);
		const bottom = Math.min(surfaceRect.bottom, categoriesRect.bottom);
		if (left >= right || top >= bottom) {
			return { overlaps: false, railOnTop: false };
		}

		const x = (left + right) / 2;
		const y = (top + bottom) / 2;
		const topElement = document.elementFromPoint(x, y);
		return {
			overlaps: true,
			railOnTop: Boolean(topElement?.closest("#desktop-toc-rail")),
		};
	});
	expect(overlapLayer.overlaps).toBe(true);
	expect(overlapLayer.railOnTop).toBe(true);

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

test("1920px desktop keeps the full reading rail persistently readable", async ({
	page,
}) => {
	await mkdir(ARTIFACT_DIR, { recursive: true });
	await gotoArticle(page, 1920, 1080);

	const surface = page.locator("#desktop-toc-rail .desktop-toc-surface");
	const box = await surface.boundingBox();
	expect(box).not.toBeNull();
	if (!box) return;

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
