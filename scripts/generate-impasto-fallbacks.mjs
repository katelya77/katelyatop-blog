import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const ROOT = new URL("../", import.meta.url);
const FIELD_URL = new URL("../src/data/impasto-field.json", import.meta.url);
const OUTPUT_URL = new URL("../public/assets/impasto/", import.meta.url);
const field = JSON.parse(await readFile(FIELD_URL, "utf8"));
const bytes = Uint8Array.from(Buffer.from(field.data, "base64"));
const WIDTH = 1920;
const HEIGHT = 1080;

function mulberry32(seed) {
	return () => {
		let value = (seed += 0x6d2b79f5);
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

function sample(x, y) {
	const ix = Math.max(0, Math.min(field.width - 1, Math.floor((x / WIDTH) * field.width)));
	const iy = Math.max(0, Math.min(field.height - 1, Math.floor((y / HEIGHT) * field.height)));
	const offset = (iy * field.width + ix) * 4;
	return {
		dx: bytes[offset] / 255 * 2 - 1,
		dy: bytes[offset + 1] / 255 * 2 - 1,
		coherence: bytes[offset + 2] / 255,
		energy: bytes[offset + 3] / 255,
	};
}

function buildSvg(dark) {
	const random = mulberry32(dark ? 260805 : 260804);
	const palette = dark
		? ["#123a6c", "#1d5c8c", "#2e7f9c", "#79b9b8", "#f0c85c", "#f5e8b3", "#4b4f9d"]
		: ["#2e7774", "#55a49a", "#8ac8ba", "#d9eadb", "#f3ebcb", "#7255a9", "#9b7fc8"];
	const background = dark
		? ["#061839", "#123f72", "#0d6d78"]
		: ["#174f55", "#69ada5", "#e3efe3"];
	const light = dark ? "#f4ca61" : "#f1d778";
	const title = dark ? "Katelya nocturne impasto field" : "Katelya daylight impasto field";
	const strokes = [];

	for (let index = 0; index < 520; index += 1) {
		const x = random() * (WIDTH + 160) - 80;
		const y = random() * (HEIGHT + 100) - 50;
		const tensor = sample(x, y);
		const theta = Math.atan2(tensor.dy, tensor.dx);
		const nx = (x - WIDTH * 0.5) / (WIDTH * 0.31);
		const ny = (y - HEIGHT * 0.43) / (HEIGHT * 0.25);
		const calm = Math.exp(-(nx * nx + ny * ny) * 1.7);
		const length = (55 + random() * 125) * (0.55 + tensor.coherence * 0.7) * (1 - calm * 0.45);
		const width = (7 + random() * 21) * (0.55 + tensor.energy * 0.75) * (1 - calm * 0.36);
		const bend = (random() - 0.5) * 1.1 * (1 - tensor.coherence * 0.45);
		const dx = Math.cos(theta) * length;
		const dy = Math.sin(theta) * length;
		const px = -Math.sin(theta);
		const py = Math.cos(theta);
		const c1x = x + dx * 0.32 + px * bend * length * 0.2;
		const c1y = y + dy * 0.32 + py * bend * length * 0.2;
		const c2x = x + dx * 0.7 - px * bend * length * 0.12;
		const c2y = y + dy * 0.7 - py * bend * length * 0.12;
		const colourIndex = Math.floor((tensor.energy * 0.55 + tensor.coherence * 0.35 + random() * 0.2) * (palette.length - 1)) % palette.length;
		const opacity = (0.2 + 0.58 * tensor.coherence) * (1 - calm * 0.5);
		strokes.push(`<path d="M${x.toFixed(1)} ${y.toFixed(1)} C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${(x + dx).toFixed(1)} ${(y + dy).toFixed(1)}" stroke="${palette[colourIndex]}" stroke-width="${width.toFixed(1)}" opacity="${opacity.toFixed(3)}"/>`);
	}

	const accents = dark
		? `<g opacity=".76" filter="url(#impasto)"><path d="M105 1080 C132 860 117 620 172 330" stroke="#061d32" stroke-width="66" fill="none" stroke-linecap="round"/><path d="M1775 1080 C1740 830 1762 590 1708 286" stroke="#09283b" stroke-width="72" fill="none" stroke-linecap="round"/></g>`
		: `<g opacity=".55" filter="url(#impasto)"><path d="M120 1080 C144 820 132 650 184 390" stroke="#18484a" stroke-width="52" fill="none" stroke-linecap="round"/><path d="M1760 1080 C1730 838 1752 622 1698 360" stroke="#205557" stroke-width="58" fill="none" stroke-linecap="round"/></g><g fill="#6f55a8" opacity=".66" filter="url(#impasto)"><path d="M70 690 C-15 575 70 480 176 558 C250 446 348 560 270 670 C210 748 126 754 70 690Z"/><path d="M1628 642 C1540 530 1622 430 1732 512 C1804 400 1902 520 1816 624 C1750 702 1680 708 1628 642Z"/></g>`;

	const stars = dark
		? Array.from({ length: 26 }, () => {
			const x = 100 + random() * 1720;
			const y = 80 + random() * 570;
			const radius = 2.8 + random() * 6.7;
			return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" fill="#f2c85b" opacity="${(0.35 + random() * 0.53).toFixed(2)}" filter="url(#impasto)"/>`;
		}).join("")
		: "";

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${title}"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${background[0]}"/><stop offset=".5" stop-color="${background[1]}"/><stop offset="1" stop-color="${background[2]}"/></linearGradient><radialGradient id="glow" cx="52%" cy="38%" r="58%"><stop stop-color="${light}" stop-opacity=".24"/><stop offset="1" stop-color="${light}" stop-opacity="0"/></radialGradient><filter id="canvas" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".006 .035" numOctaves="3" seed="47" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G" result="d"/><feBlend in="d" in2="n" mode="soft-light"/></filter><filter id="impasto" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="turbulence" baseFrequency=".012 .08" numOctaves="2" seed="71" result="grain"/><feDiffuseLighting in="grain" surfaceScale="3.2" diffuseConstant=".65" lighting-color="${light}" result="diff"><feDistantLight azimuth="225" elevation="48"/></feDiffuseLighting><feSpecularLighting in="grain" surfaceScale="4.2" specularConstant=".45" specularExponent="18" lighting-color="#fff8dc" result="spec"><feDistantLight azimuth="220" elevation="54"/></feSpecularLighting><feComposite in="spec" in2="SourceAlpha" operator="in" result="spec2"/><feBlend in="SourceGraphic" in2="diff" mode="soft-light" result="lit"/><feBlend in="lit" in2="spec2" mode="screen"/></filter></defs><rect width="1920" height="1080" fill="url(#bg)"/><rect width="1920" height="1080" fill="url(#glow)"/><g fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#canvas)">${strokes.join("")}</g>${accents}${stars}<rect x="18" y="18" width="1884" height="1044" rx="38" fill="none" stroke="#f0d98c" stroke-opacity=".22" stroke-width="3"/></svg>`;
}

await mkdir(OUTPUT_URL, { recursive: true });
const day = buildSvg(false);
const night = buildSvg(true);
await writeFile(new URL("impasto-day.svg", OUTPUT_URL), day);
await writeFile(new URL("impasto-night.svg", OUTPUT_URL), night);
const metadata = {
	generator: "katelya-impasto-svg-v1",
	fieldGenerator: field.generator,
	sourceSha256: field.sourceSha256,
	sourcePathCount: field.sourcePathCount,
	fieldWidth: field.width,
	fieldHeight: field.height,
	dayBytes: Buffer.byteLength(day),
	nightBytes: Buffer.byteLength(night),
	fieldSha256: createHash("sha256").update(Buffer.from(field.data, "base64")).digest("hex"),
};
await writeFile(new URL("impasto-metadata.json", OUTPUT_URL), `${JSON.stringify(metadata, null, 2)}\n`);
console.log(`Generated impasto fallbacks in ${new URL("public/assets/impasto/", ROOT).pathname}`);
