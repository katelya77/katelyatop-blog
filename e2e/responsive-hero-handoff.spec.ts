import { mkdir } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";

const ARTIFACT_DIR = "artifacts/ui";

type ViewportCase = {
	name: string;
	width: number;
	height: number;
	minBannerRatio: number;
};

const viewports: ViewportCase[] = [
	{ name: "mobile-portrait", width: 390, height: 844, minBannerRatio: 0.62 },
	{ name: "mobile-landscape", width: 844, height: 390, minBannerRatio: 0.98 },
	{ name: "ipad-portrait", width: 820, height: 1180, minBannerRatio: 0.62 },
	{ name: "ipad-landscape", width: 1180, height: 820, minBannerRatio: 0.64 },
];

async function gotoHome(page: Page) {
	await page.goto("/");
	await page.waitForLoadState("load");
	await page.waitForSelector(".katelya-hero-stage.is-home-hero", {
		state: "attached",
	});
	await page.waitForSelector(".katelya-hero-copy", { state: "visible" });
	await page.waitForTimeout(250);
}

async function setWallpaperMode(page: Page, mode: "banner" | "fullscreen") {
	await page.evaluate((nextMode) => {
		localStorage.setItem("wallpaperMode", nextMode);
		window.dispatchEvent(
			new CustomEvent("wallpaper-mode-change", {
				detail: { mode: nextMode },
			}),
		);
	}, mode);
	await page.waitForFunction(
		(nextMode) =>
			document.body.classList.contains("fullscreen-banner") ===
			(nextMode === "fullscreen"),
		mode,
	);
	await page.waitForTimeout(250);
}

async function readHeroGeometry(page: Page) {
	return page.evaluate(() => {
		const hero = document.querySelector<HTMLElement>(".katelya-hero-stage");
		const copy = document.querySelector<HTMLElement>(".katelya-hero-copy");
		const header = document.querySelector<HTMLElement>(".katelya-header-stage");
		const shell = document.querySelector<HTMLElement>(".katelya-main-shell");
		const grid = document.getElementById("main-grid");
		if (!hero || !copy || !header || !shell || !grid) return null;

		const heroRect = hero.getBoundingClientRect();
		const copyRect = copy.getBoundingClientRect();
		const headerRect = header.getBoundingClientRect();
		const shellRect = shell.getBoundingClientRect();
		const gridRect = grid.getBoundingClientRect();
		const gridStyle = getComputedStyle(grid);
		const gridContentTop = gridRect.top + Number.parseFloat(gridStyle.paddingTop || "0");

		return {
			viewportWidth: window.innerWidth,
			viewportHeight: window.innerHeight,
			documentWidth: document.documentElement.scrollWidth,
			heroTop: heroRect.top,
			heroBottom: heroRect.bottom,
			heroHeight: heroRect.height,
			copyTop: copyRect.top,
			copyBottom: copyRect.bottom,
			headerBottom: headerRect.bottom,
			shellTop: shellRect.top,
			gridTop: gridRect.top,
			gridContentTop,
		};
	});
}

function expectContained(
	geometry: NonNullable<Awaited<ReturnType<typeof readHeroGeometry>>>,
) {
	expect(
		geometry.documentWidth,
		"responsive hero must not create horizontal overflow",
	).toBeLessThanOrEqual(geometry.viewportWidth + 1);
	expect(
		geometry.copyTop,
		"hero copy must begin below the fixed navigation shell",
	).toBeGreaterThanOrEqual(geometry.headerBottom - 2);
	expect(
		geometry.copyBottom,
		"hero copy must remain inside the visual hero stage",
	).toBeLessThanOrEqual(geometry.heroBottom - 12);
}

function expectBannerHandoff(
	geometry: NonNullable<Awaited<ReturnType<typeof readHeroGeometry>>>,
) {
	expect(
		geometry.shellTop,
		"banner content should begin after the bounded Hero frame",
	).toBeGreaterThanOrEqual(geometry.heroBottom - 1);
	expect(
		geometry.gridContentTop - geometry.heroBottom,
		"banner handoff should not leave a dead band",
	).toBeGreaterThanOrEqual(0);
	expect(geometry.gridContentTop - geometry.heroBottom).toBeLessThanOrEqual(64);
}

function expectFullscreenHandoff(
	geometry: NonNullable<Awaited<ReturnType<typeof readHeroGeometry>>>,
) {
	const overlap = geometry.heroBottom - geometry.shellTop;
	expect(
		overlap,
		"fullscreen content shell should intentionally overlap the Hero tail",
	).toBeGreaterThanOrEqual(24);
	expect(overlap).toBeLessThanOrEqual(90);
	expect(
		geometry.gridContentTop - geometry.heroBottom,
		"padded grid content should emerge after the painterly overlap zone",
	).toBeGreaterThanOrEqual(0);
	expect(geometry.gridContentTop - geometry.heroBottom).toBeLessThanOrEqual(72);
}

test.describe("responsive banner and fullscreen hero handoff", () => {
	for (const viewport of viewports) {
		test(`${viewport.name}: banner hero keeps readable proportions`, async ({
			page,
		}) => {
			await mkdir(ARTIFACT_DIR, { recursive: true });
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await gotoHome(page);
			await setWallpaperMode(page, "banner");

			const geometry = await readHeroGeometry(page);
			expect(geometry).not.toBeNull();
			if (!geometry) return;

			expectContained(geometry);
			expectBannerHandoff(geometry);
			expect(
				geometry.heroHeight / geometry.viewportHeight,
				"banner hero must preserve a complete composition",
			).toBeGreaterThanOrEqual(viewport.minBannerRatio);

			await page.screenshot({
				path: `${ARTIFACT_DIR}/${viewport.name}-banner.png`,
				fullPage: false,
			});
		});

		test(`${viewport.name}: fullscreen hero matches the visual viewport`, async ({
			page,
		}) => {
			await mkdir(ARTIFACT_DIR, { recursive: true });
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await gotoHome(page);
			await setWallpaperMode(page, "fullscreen");

			const geometry = await readHeroGeometry(page);
			expect(geometry).not.toBeNull();
			if (!geometry) return;

			expectContained(geometry);
			expectFullscreenHandoff(geometry);
			expect(
				Math.abs(geometry.heroHeight - geometry.viewportHeight),
				"fullscreen artwork should occupy exactly one visual viewport",
			).toBeLessThanOrEqual(2);

			await page.screenshot({
				path: `${ARTIFACT_DIR}/${viewport.name}-fullscreen.png`,
				fullPage: false,
			});
		});
	}
});