import { expect, test } from "@playwright/test";

const overviewUrl = "/fosu/2026-freshman-guide/";
const topicUrl = "/fosu/2026-freshman-guide/digital-campus/";

const viewports = [
	{ name: "phone", width: 390, height: 844 },
	{ name: "ipad-portrait", width: 820, height: 1180 },
	{ name: "ipad-landscape", width: 1180, height: 820 },
];

for (const viewport of viewports) {
	test(`freshman guide stays readable without horizontal overflow on ${viewport.name}`, async ({
		page,
	}) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await page.goto(topicUrl, { waitUntil: "domcontentloaded" });

		await expect(
			page.getByText("校园数字生活｜校园网、VPN、100网与企业微信", {
				exact: true,
			}),
		).toBeVisible();
		await expect(page.locator("[data-series-navigation]")).toHaveCount(2);
		await expect(page.getByText("2026级佛山大学新生指南").first()).toBeVisible();
		await expect(page.getByRole("link", { name: "返回总览" }).first()).toBeVisible();

		const hasHorizontalOverflow = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth + 1,
		);
		expect(hasHorizontalOverflow).toBe(false);
	});
}

test("overview is a start-here hub with topic cards and a stable route", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(overviewUrl, { waitUntil: "domcontentloaded" });

	await expect(
		page.getByText("2026级佛山大学新生指南｜从报到、军训到大学生活", {
			exact: true,
		}),
	).toBeVisible();
	await expect(page.locator("[data-series-navigation]")).toHaveCount(0);
	await expect(
		page.getByRole("link", { name: /报到与开学准备/ }).first(),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: /校园数字生活/ }).first(),
	).toBeVisible();

	const hasHorizontalOverflow = await page.evaluate(
		() => document.documentElement.scrollWidth > window.innerWidth + 1,
	);
	expect(hasHorizontalOverflow).toBe(false);
});
