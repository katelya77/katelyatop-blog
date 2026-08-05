import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("boot surface is neutral and generated SVG artwork is static-mode only", async () => {
	const backdrop = await read("src/styles/impasto-backdrop.css");
	const defaultFallback = backdrop.match(
		/\.impasto-static-fallback\s*\{([\s\S]*?)\n\}/,
	)?.[1] ?? "";

	assert.match(defaultFallback, /background-image:\s*var\(--impasto-boot-underpaint\)/);
	assert.doesNotMatch(defaultFallback, /impasto-(?:day|night)\.svg/);
	assert.match(
		backdrop,
		/html\.impasto-static \.impasto-static-fallback\s*\{[\s\S]*impasto-day\.svg[\s\S]*\}/,
	);
	assert.match(
		backdrop,
		/html\.dark\.impasto-static \.impasto-static-fallback\s*\{[\s\S]*impasto-night\.svg[\s\S]*\}/,
	);
});

test("ready swap is immediate after a successfully painted frame", async () => {
	const backdrop = await read("src/styles/impasto-backdrop.css");

	assert.match(
		backdrop,
		/html\.impasto-ready \.impasto-backdrop canvas\s*\{[^}]*opacity:\s*1[^}]*transition:\s*none/s,
	);
	assert.match(
		backdrop,
		/html\.impasto-ready \.impasto-static-fallback\s*\{[^}]*opacity:\s*0[^}]*visibility:\s*hidden[^}]*transition:\s*none/s,
	);
});
