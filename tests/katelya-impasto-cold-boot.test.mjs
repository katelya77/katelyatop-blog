import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("boot surface is the complete generated painterly poster", async () => {
	const backdrop = await read("src/styles/impasto-backdrop.css");
	const defaultFallback =
		backdrop.match(/\.impasto-static-fallback\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";

	assert.match(
		defaultFallback,
		/background-image:\s*var\(--impasto-boot-wash\),\s*var\(--impasto-boot-poster\)/,
	);
	assert.match(backdrop, /--impasto-boot-poster:\s*url\("\/assets\/impasto\/impasto-day\.svg"\)/);
	assert.match(backdrop, /--impasto-boot-poster:\s*url\("\/assets\/impasto\/impasto-night\.svg"\)/);
	assert.match(defaultFallback, /opacity:\s*1/);
	assert.match(defaultFallback, /visibility:\s*visible/);
});

test("ready handoff cross-fades Canvas over the completed poster", async () => {
	const backdrop = await read("src/styles/impasto-backdrop.css");

	assert.match(
		backdrop,
		/\[data-impasto-canvas\]\s*\{[^}]*transition:[^}]*opacity 180ms/s,
	);
	assert.match(
		backdrop,
		/html\.impasto-ready \[data-impasto-canvas\]\s*\{[^}]*opacity:\s*1/s,
	);
	assert.match(
		backdrop,
		/html\.impasto-ready \.impasto-static-fallback\s*\{[^}]*opacity:\s*0\.16[^}]*visibility:\s*visible/s,
	);
	assert.doesNotMatch(backdrop, /html\.impasto-ready[\s\S]{0,240}transition:\s*none/);
});