import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const userFacingFiles = [
	"src/config/siteConfig.ts",
	"src/config/profileConfig.ts",
	"src/config/navBarConfig.ts",
	"src/config/announcementConfig.ts",
	"src/data/projects.ts",
	"src/content/spec/about.md",
];

test("Katelya branding and canonical domain are configured", async () => {
	const siteConfig = await read("src/config/siteConfig.ts");
	assert.match(siteConfig, /Katelya · 思囿随笔/);
	assert.match(siteConfig, /https:\/\/blog\.katelya\.top\//);
	assert.match(siteConfig, /katelya-impression\.svg/);
});

test("Katelya profile links are present", async () => {
	const profile = await read("src/config/profileConfig.ts");
	assert.match(profile, /https:\/\/github\.com\/katelya77/);
	assert.match(profile, /https:\/\/t\.me\/katelya77/);
	assert.match(profile, /https:\/\/x\.com\/katelya77/);
	assert.match(profile, /mailto:katelya77@gmail\.com/);
});

test("impressionist hero and accessibility fallbacks exist", async () => {
	const gridLayout = await read("src/layouts/MainGridLayout.astro");
	const layout = await read("src/layouts/Layout.astro");
	const theme = await read("src/styles/katelya-impressionist.css");
	const artwork = await read("public/assets/art/katelya-impression.svg");

	assert.match(gridLayout, /KatelyaOrbitHero/);
	assert.match(gridLayout, /showTextOverlay=\{false\}/);
	assert.match(layout, /katelya-impressionist\.css/);
	assert.match(layout, /katelya-art-theme/);
	assert.match(theme, /prefers-reduced-motion:\s*reduce/);
	assert.match(theme, /max-width:\s*767px/);
	assert.match(artwork, /<filter/);
	assert.match(artwork, /feTurbulence/);
});

test("legacy demo identity is removed from edited user-facing files", async () => {
	const contents = await Promise.all(userFacingFiles.map(read));
	const combined = contents.join("\n");

	assert.doesNotMatch(combined, /matsuzaka-yuki/i);
	assert.doesNotMatch(combined, /まつざか/);
	assert.doesNotMatch(combined, /mizuki\.mysqil\.com/i);
});
