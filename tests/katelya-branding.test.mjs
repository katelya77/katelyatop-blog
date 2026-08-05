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
	const wallpaper = await read("src/config/backgroundWallpaper.ts");
	assert.match(siteConfig, /Katelya · 思囿随笔/);
	assert.match(siteConfig, /https:\/\/blog\.katelya\.top\//);
	assert.match(siteConfig, /katelya-van-gogh-day\.svg/);
	assert.match(siteConfig, /katelya-van-gogh-night\.svg/);
	assert.match(wallpaper, /katelya-van-gogh-day\.svg/);
	assert.match(wallpaper, /katelya-van-gogh-night\.svg/);
});

test("home document title stays exactly on the public brand", async () => {
	const layout = await read("src/layouts/Layout.astro");
	assert.match(
		layout,
		/const pageTitle = title[\s\S]*\? `\$\{title\} - \$\{siteConfig\.title\}`[\s\S]*: siteConfig\.title;/,
	);
	assert.doesNotMatch(
		layout,
		/\? `\$\{siteConfig\.title\} - \$\{siteConfig\.subtitle\}`/,
	);
});

test("footer exposes a polished official ICP filing link", async () => {
	const footer = await read("src/components/organisms/footer/Footer.astro");
	assert.match(footer, /赣ICP备2025074096号/);
	assert.match(footer, /https:\/\/beian\.miit\.gov\.cn\//);
	assert.match(footer, /target="_blank"/);
	assert.match(footer, /rel="noopener noreferrer"/);
	assert.match(footer, /aria-label="赣ICP备2025074096号/);
	assert.match(footer, /katelya-icp-badge/);
});

test("Katelya profile links are present", async () => {
	const profile = await read("src/config/profileConfig.ts");
	assert.match(profile, /https:\/\/github\.com\/katelya77/);
	assert.match(profile, /https:\/\/t\.me\/katelya77/);
	assert.match(profile, /https:\/\/x\.com\/katelya77/);
	assert.match(profile, /mailto:katelya77@gmail\.com/);
});

test("day-night gallery hero and accessibility fallbacks exist", async () => {
	const gridLayout = await read("src/layouts/MainGridLayout.astro");
	const layout = await read("src/layouts/Layout.astro");
	const galleryTheme = await read("src/styles/katelya-van-gogh-gallery.css");
	const dayArtwork = await read("public/assets/art/katelya-van-gogh-day.svg");
	const nightArtwork = await read("public/assets/art/katelya-van-gogh-night.svg");

	assert.match(gridLayout, /KatelyaOrbitHero/);
	assert.match(gridLayout, /showTextOverlay=\{false\}/);
	assert.match(gridLayout, /katelya-van-gogh-gallery\.css/);
	assert.match(layout, /katelya-art-theme/);
	assert.match(galleryTheme, /prefers-reduced-motion:\s*reduce/);
	assert.match(galleryTheme, /max-width:\s*767px/);
	assert.match(dayArtwork, /<filter/);
	assert.match(dayArtwork, /feTurbulence/);
	assert.match(nightArtwork, /<filter/);
	assert.match(nightArtwork, /feTurbulence/);
});

test("legacy demo identity is removed from edited user-facing files", async () => {
	const contents = await Promise.all(userFacingFiles.map(read));
	const combined = contents.join("\n");

	assert.doesNotMatch(combined, /matsuzaka-yuki/i);
	assert.doesNotMatch(combined, /まつざか/);
	assert.doesNotMatch(combined, /mizuki\.mysqil\.com/i);
});
