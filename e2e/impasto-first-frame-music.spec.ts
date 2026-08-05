import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const ARTIFACT_DIR = "artifacts/ui";

test("impasto first frame keeps fallback until the first successful WebGL paint", async ({
	page,
}) => {
	await mkdir(ARTIFACT_DIR, { recursive: true });
	await page.addInitScript(() => {
		const classAdds: string[] = [];
		const originalAdd = DOMTokenList.prototype.add;
		DOMTokenList.prototype.add = function (...tokens: string[]) {
			for (const token of tokens) {
				if (token.startsWith("impasto-")) classAdds.push(token);
			}
			return originalAdd.apply(this, tokens);
		};
		Object.defineProperty(window, "__impastoClassAdds", {
			value: classAdds,
			configurable: true,
		});
	});

	await page.setViewportSize({ width: 1664, height: 920 });
	await page.goto("/", { waitUntil: "domcontentloaded" });
	await page.waitForFunction(() =>
		document.documentElement.classList.contains("impasto-ready"),
	);

	const result = await page.evaluate(() => {
		const fallback = document.querySelector<HTMLElement>(
			".impasto-static-fallback",
		);
		const canvas = document.querySelector<HTMLCanvasElement>(
			"[data-impasto-canvas]",
		);
		const classAdds = (
			window as Window & { __impastoClassAdds?: string[] }
		).__impastoClassAdds ?? [];
		return {
			classAdds,
			ready: document.documentElement.classList.contains("impasto-ready"),
			fallbackOpacity: fallback ? getComputedStyle(fallback).opacity : null,
			fallbackVisibility: fallback
				? getComputedStyle(fallback).visibility
				: null,
			canvasOpacity: canvas ? getComputedStyle(canvas).opacity : null,
			canvasSize: canvas ? [canvas.width, canvas.height] : [0, 0],
			bodyBackgroundImage: getComputedStyle(document.body).backgroundImage,
		};
	});

	expect(result.ready).toBe(true);
	expect(result.classAdds.indexOf("impasto-booting")).toBeGreaterThanOrEqual(0);
	expect(result.classAdds.indexOf("impasto-ready")).toBeGreaterThan(
		result.classAdds.indexOf("impasto-booting"),
	);
	expect(result.canvasSize[0]).toBeGreaterThan(0);
	expect(result.canvasSize[1]).toBeGreaterThan(0);
	expect(Number(result.canvasOpacity)).toBeGreaterThan(0.9);
	expect(result.fallbackOpacity).toBe("0");
	expect(result.fallbackVisibility).toBe("hidden");
	expect(result.bodyBackgroundImage).toBe("none");

	await page.screenshot({
		path: `${ARTIFACT_DIR}/impasto-day-first-frame.png`,
		fullPage: false,
	});

	await page.locator("#scheme-switch").click();
	await page.waitForFunction(() =>
		document.documentElement.classList.contains("dark"),
	);
	await page.waitForTimeout(360);
	await page.screenshot({
		path: `${ARTIFACT_DIR}/impasto-night-first-frame.png`,
		fullPage: false,
	});
});

test("hero depth responds within bounded layers and respects reduced motion", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/");
	const hero = page.locator("[data-katelya-orbit]");
	await expect(hero).toBeVisible();
	const box = await hero.boundingBox();
	expect(box).not.toBeNull();
	if (!box) return;

	await page.mouse.move(box.x + box.width * 0.82, box.y + box.height * 0.24);
	await page.waitForTimeout(420);
	const activeDepth = await hero.evaluate((element) => {
		const style = getComputedStyle(element as HTMLElement);
		return {
			deepX: Number.parseFloat(style.getPropertyValue("--hero-deep-x")),
			deepY: Number.parseFloat(style.getPropertyValue("--hero-deep-y")),
			lightX: style.getPropertyValue("--hero-light-x").trim(),
		};
	});
	expect(Math.abs(activeDepth.deepX)).toBeGreaterThan(2);
	expect(Math.abs(activeDepth.deepX)).toBeLessThanOrEqual(19.1);
	expect(Math.abs(activeDepth.deepY)).toBeLessThanOrEqual(13.1);
	expect(activeDepth.lightX).toMatch(/%$/);

	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.reload();
	const reducedHero = page.locator("[data-katelya-orbit]");
	await expect(reducedHero).toBeVisible();
	const reducedBox = await reducedHero.boundingBox();
	if (!reducedBox) return;
	await page.mouse.move(
		reducedBox.x + reducedBox.width * 0.85,
		reducedBox.y + reducedBox.height * 0.2,
	);
	await page.waitForTimeout(250);
	const reducedDepth = await reducedHero.evaluate((element) =>
		getComputedStyle(element as HTMLElement)
			.getPropertyValue("--hero-deep-x")
			.trim(),
	);
	expect(reducedDepth).toBe("0px");
});

test("music control center exposes the supplied 21-track playlist", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/");
	const musicButton = page.getByRole("button", {
		name: /打开音乐控制中心：我知道/,
	});
	await expect(musicButton).toBeVisible();
	await musicButton.click();
	const panel = page.locator(".fab-music-panel");
	await expect(panel).toBeVisible();
	await expect(panel).toContainText("我知道");
	await panel.getByRole("button", { name: "Playlist" }).click();
	const playlist = panel.getByRole("listbox", { name: "Playlist" });
	await expect(playlist).toBeVisible();
	await expect(playlist.getByRole("option")).toHaveCount(21);
	await expect(
		playlist.getByRole("option", { name: "播放 鼓楼 - 赵雷" }),
	).toBeAttached();
	await mkdir(ARTIFACT_DIR, { recursive: true });
	await page.screenshot({
		path: `${ARTIFACT_DIR}/music-playlist-21-tracks.png`,
		fullPage: false,
	});
});
