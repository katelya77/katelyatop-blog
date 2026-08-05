import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const ARTIFACT_DIR = "artifacts/ui";
const MOBILE_VIEWPORT = { width: 390, height: 844 };

type MusicProbeState = {
	currentSong?: { url?: string };
	playlist?: unknown[];
};

type MediaProbeWindow = Window & {
	__katelyaMediaPlayCalls?: string[];
	__katelyaMusicState?: MusicProbeState | null;
};

test.describe("mobile loading performance", () => {
	test.use({
		viewport: MOBILE_VIEWPORT,
		hasTouch: true,
		isMobile: true,
		deviceScaleFactor: 3,
	});

	test("touch clients render a detailed live impasto canvas instead of being forced static", async ({
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

		const canvas = page.locator<HTMLCanvasElement>("[data-impasto-canvas]");
		await expect(canvas).toHaveCSS("opacity", "1");
		await expect(page.locator(".impasto-static-fallback")).toHaveCSS(
			"visibility",
			"hidden",
		);
		expect(
			await page.evaluate(() =>
				document.documentElement.classList.contains("impasto-static"),
			),
		).toBe(false);

		const renderMetrics = await canvas.evaluate((element) => ({
			renderScale:
				element.width / Math.max(document.documentElement.clientWidth, 1),
			pixelCount: element.width * element.height,
		}));
		expect(
			renderMetrics.renderScale,
			"touch artwork should retain fine brush detail on high-density screens",
		).toBeGreaterThanOrEqual(1.45);
		expect(renderMetrics.renderScale).toBeLessThanOrEqual(1.51);
		expect(
			renderMetrics.pixelCount,
			"touch rendering must remain within the bounded GPU pixel budget",
		).toBeLessThanOrEqual(2_400_000);

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

		await page.addInitScript(() => {
			const probeWindow = window as MediaProbeWindow;
			const calls: string[] = [];
			Object.defineProperty(window, "__katelyaMediaPlayCalls", {
				configurable: true,
				value: calls,
			});
			Object.defineProperty(window, "__katelyaMusicState", {
				configurable: true,
				writable: true,
				value: null,
			});
			window.addEventListener("music-sidebar:state", (event) => {
				probeWindow.__katelyaMusicState = (
					event as CustomEvent<MusicProbeState>
				).detail;
			});

			const nativePlay = HTMLMediaElement.prototype.play;
			HTMLMediaElement.prototype.play = function () {
				probeWindow.__katelyaMediaPlayCalls?.push(this.currentSrc || this.src);
				return nativePlay.call(this);
			};
		});

		const readPlayCalls = () =>
			page.evaluate(
				() => (window as MediaProbeWindow).__katelyaMediaPlayCalls ?? [],
			);

		await page.goto("/", { waitUntil: "domcontentloaded" });
		await page.waitForFunction(
			() => {
				const state = (window as MediaProbeWindow).__katelyaMusicState;
				return (
					(state?.playlist?.length ?? 0) > 0 && Boolean(state?.currentSong?.url)
				);
			},
			undefined,
			{ timeout: 12000 },
		);

		const playButtons = page.getByRole("button", { name: "播放" });
		await expect(playButtons.last()).toBeVisible();
		await expect(playButtons.last()).toBeEnabled();
		await page.waitForTimeout(1200);

		expect(
			audioRequests,
			"playlist metadata may load, but idle hydration must not request a remote song",
		).toHaveLength(0);
		expect(await readPlayCalls()).toHaveLength(0);

		await playButtons.last().click();
		await expect
			.poll(async () => (await readPlayCalls()).length, { timeout: 5000 })
			.toBeGreaterThan(0);

		const calls = await readPlayCalls();
		expect(calls.at(-1)).toContain("pan.katelya.eu.org/file/");
	});
});
