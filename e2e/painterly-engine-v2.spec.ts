import { expect, test } from "@playwright/test";

test("iPad portrait keeps every orbit card inside the painted content edge", async ({
	browser,
}) => {
	const context = await browser.newContext({
		viewport: { width: 820, height: 1180 },
		hasTouch: true,
		deviceScaleFactor: 1,
	});
	const page = await context.newPage();
	await page.goto("/");
	await page.waitForFunction(() =>
		document.documentElement.classList.contains("impasto-ready"),
	);

	const geometry = await page.evaluate(() => ({
		paintedRight:
			document
				.querySelector<HTMLElement>(".katelya-hero-stage")
				?.getBoundingClientRect().right ?? document.documentElement.clientWidth,
		cards: [
			...document.querySelectorAll<HTMLElement>(".katelya-orbit-card"),
		].map((card) => {
			const rect = card.getBoundingClientRect();
			return { left: rect.left, right: rect.right };
		}),
	}));

	expect(geometry.cards).toHaveLength(4);
	for (const card of geometry.cards) {
		expect(card.left).toBeGreaterThanOrEqual(4);
		expect(card.right).toBeLessThanOrEqual(geometry.paintedRight - 4);
	}
	await context.close();
});

test("Hero exposes four discontinuous aura strokes and unified depth variables", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1664, height: 920 });
	await page.goto("/");
	const hero = page.locator("[data-katelya-orbit]");
	await expect(hero).toBeVisible();
	await expect(page.locator(".katelya-aura-stroke")).toHaveCount(4);

	const box = await hero.boundingBox();
	expect(box).not.toBeNull();
	if (!box) return;
	await page.mouse.move(box.x + box.width * 0.78, box.y + box.height * 0.28);

	await expect
		.poll(() =>
			hero.evaluate((element) => ({
				x: (element as HTMLElement).style.getPropertyValue("--hero-pointer-x"),
				y: (element as HTMLElement).style.getPropertyValue("--hero-pointer-y"),
			})),
		)
		.toEqual(
			expect.objectContaining({
				x: expect.stringMatching(/-?\d/),
				y: expect.stringMatching(/-?\d/),
			}),
		);
});

test("live renderer publishes a bounded adaptive quality tier", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1664, height: 920 });
	await page.goto("/");
	await page.waitForFunction(() =>
		document.documentElement.classList.contains("impasto-ready"),
	);
	await expect
		.poll(() => page.locator("html").getAttribute("data-impasto-quality"))
		.toMatch(/^(high|medium|low)$/);
});
