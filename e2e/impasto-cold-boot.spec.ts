import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const ARTIFACT_DIR = "artifacts/ui";

test("cold boot never exposes the generated day or night fallback artwork", async ({
	page,
}) => {
	await mkdir(ARTIFACT_DIR, { recursive: true });
	await page.setViewportSize({ width: 1664, height: 920 });

	let releaseScripts = () => {};
	const scriptGate = new Promise<void>((resolve) => {
		releaseScripts = resolve;
	});

	await page.route("**/*.js", async (route) => {
		await scriptGate;
		await route.continue();
	});

	await page.goto("/", { waitUntil: "commit" });
	await page.waitForSelector(".impasto-static-fallback", { state: "attached" });
	await page.waitForTimeout(160);

	const bootSurface = await page.evaluate(() => {
		const root = document.documentElement;
		const fallback = document.querySelector<HTMLElement>(
			".impasto-static-fallback",
		);
		const style = fallback ? getComputedStyle(fallback) : null;
		return {
			ready: root.classList.contains("impasto-ready"),
			backgroundImage: style?.backgroundImage ?? "",
			opacity: style?.opacity ?? "",
			visibility: style?.visibility ?? "",
		};
	});

	await page.screenshot({
		path: `${ARTIFACT_DIR}/impasto-cold-boot-before-js.png`,
		fullPage: false,
	});

	releaseScripts();
	await page.waitForFunction(() =>
		document.documentElement.classList.contains("impasto-ready"),
	);

	expect(bootSurface.ready).toBe(false);
	expect(bootSurface.opacity).toBe("1");
	expect(bootSurface.visibility).toBe("visible");
	expect(bootSurface.backgroundImage).not.toContain("impasto-day.svg");
	expect(bootSurface.backgroundImage).not.toContain("impasto-night.svg");
	await expect(page.locator("[data-impasto-canvas]")).toHaveCSS("opacity", "1");
	await expect(page.locator(".impasto-static-fallback")).toHaveCSS(
		"visibility",
		"hidden",
	);
});
