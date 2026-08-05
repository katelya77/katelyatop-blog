import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

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
	const ix = Math.max(
		0,
		Math.min(field.width - 1, Math.floor((x / WIDTH) * field.width)),
	);
	const iy = Math.max(
		0,
		Math.min(field.height - 1, Math.floor((y / HEIGHT) * field.height)),
	);
	const offset = (iy * field.width + ix) * 4;
	return {
		dx: (bytes[offset] / 255) * 2 - 1,
		dy: (bytes[offset + 1] / 255) * 2 - 1,
		coherence: bytes[offset + 2] / 255,
		energy: bytes[offset + 3] / 255,
	};
}

function vortexVector(x, y, centerX, centerY, strength, radius) {
	const dx = x - centerX;
	const dy = y - centerY;
	const distance = Math.max(1, Math.hypot(dx, dy));
	const falloff = Math.exp(-((distance / radius) ** 2));
	return {
		x: (-dy / distance) * strength * falloff,
		y: (dx / distance) * strength * falloff,
	};
}

function flowDirection(x, y, tensor, dark, random) {
	const first = vortexVector(x, y, WIDTH * 0.21, HEIGHT * 0.30, dark ? 1.05 : 0.66, 540);
	const second = vortexVector(x, y, WIDTH * 0.72, HEIGHT * 0.19, dark ? -0.82 : -0.46, 390);
	const third = vortexVector(x, y, WIDTH * 0.61, HEIGHT * 0.73, dark ? 0.59 : 0.38, 310);
	const wobble = (random() - 0.5) * (dark ? 0.48 : 0.34);
	return Math.atan2(
		tensor.dy + first.y + second.y + third.y + Math.sin(x * 0.0037 + y * 0.0021) * wobble,
		tensor.dx + first.x + second.x + third.x + Math.cos(y * 0.0041 - x * 0.0018) * wobble,
	);
}

function buildStroke({ x, y, theta, length, width, bend, colour, opacity, random }) {
	const dx = Math.cos(theta) * length;
	const dy = Math.sin(theta) * length;
	const px = -Math.sin(theta);
	const py = Math.cos(theta);
	const firstJitter = (random() - 0.5) * length * 0.13;
	const secondJitter = (random() - 0.5) * length * 0.12;
	const c1x = x + dx * 0.28 + px * bend * length * 0.22 + firstJitter;
	const c1y = y + dy * 0.28 + py * bend * length * 0.22;
	const c2x = x + dx * 0.69 - px * bend * length * 0.15 + secondJitter;
	const c2y = y + dy * 0.69 - py * bend * length * 0.15;
	return `<path d="M${x.toFixed(1)} ${y.toFixed(1)} C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${(x + dx).toFixed(1)} ${(y + dy).toFixed(1)}" stroke="${colour}" stroke-width="${width.toFixed(1)}" opacity="${opacity.toFixed(3)}"/>`;
}

function buildSvg(dark) {
	const random = mulberry32(dark ? 260805 : 260804);
	const palette = dark
		? ["#071a46", "#123d79", "#1c5792", "#287f9a", "#4a3d84", "#72b9b3", "#edbe4f"]
		: ["#185d62", "#2f8984", "#63ada2", "#a4d0bc", "#e1ead5", "#68519a", "#d7b759"];
	const background = dark
		? ["#061333", "#123b72", "#075667"]
		: ["#174f55", "#66aaa1", "#dfece0"];
	const light = dark ? "#f1bd4d" : "#ead06c";
	const title = dark
		? "Katelya asymmetric nocturne impasto field"
		: "Katelya asymmetric daylight impasto field";
	const strokes = [];

	for (let index = 0; index < 740; index += 1) {
		const x = random() * (WIDTH + 120) - 60;
		const y = random() * (HEIGHT + 90) - 45;
		const tensor = sample(x, y);
		const theta = flowDirection(x, y, tensor, dark, random);
		const nx = (x - WIDTH * 0.5) / (WIDTH * 0.30);
		const ny = (y - HEIGHT * 0.42) / (HEIGHT * 0.25);
		const calm = Math.exp(-(nx * nx + ny * ny) * 1.78);
		const length =
			(28 + random() * 92) *
			(0.58 + tensor.coherence * 0.62) *
			(1 - calm * 0.42) *
			(0.72 + random() * 0.42);
		const width =
			(4.2 + random() * 15.5) *
			(0.60 + tensor.energy * 0.76) *
			(1 - calm * 0.33);
		const bend = (random() - 0.5) * (dark ? 1.48 : 1.12) * (1 - tensor.coherence * 0.32);
		const colourIndex =
			Math.floor(
				(tensor.energy * 0.45 + tensor.coherence * 0.30 + random() * 0.37) *
					(palette.length - 1),
			) % palette.length;
		const opacity = (0.18 + 0.58 * tensor.coherence) * (1 - calm * 0.52) * (0.75 + random() * 0.25);
		strokes.push(
			buildStroke({
				x,
				y,
				theta,
				length,
				width,
				bend,
				colour: palette[colourIndex],
				opacity,
				random,
			}),
		);
	}

	const underpainting = dark
		? `<g fill="none" stroke-linecap="round" opacity=".28"><path d="M-80 370 C260 92 470 330 742 180 C1020 26 1212 245 1510 92 C1690 0 1818 44 1990 -42" stroke="#49aeb2" stroke-width="58"/><path d="M-130 702 C210 534 434 731 710 584 C1002 430 1162 582 1450 414 C1645 301 1810 334 2024 244" stroke="#31549a" stroke-width="73"/><path d="M30 896 C302 742 552 905 807 786 C1090 654 1322 826 1590 688 C1760 600 1870 604 1974 556" stroke="#172653" stroke-width="92"/></g>`
		: `<g fill="none" stroke-linecap="round" opacity=".24"><path d="M-70 346 C238 126 482 320 746 194 C1016 65 1230 234 1490 112 C1694 16 1840 72 1994 -18" stroke="#9ad0c2" stroke-width="62"/><path d="M-110 706 C184 532 438 724 718 590 C1014 448 1196 592 1456 472 C1648 384 1828 400 2012 300" stroke="#5a9f99" stroke-width="76"/></g>`;

	const accents = dark
		? `<g opacity=".88"><path d="M66 1080 C98 836 88 650 136 414 C151 340 170 258 198 192 C230 420 223 594 264 790 C287 900 301 990 300 1080Z" fill="#04172b"/><path d="M1580 1080 C1588 912 1570 806 1604 640 C1623 548 1646 490 1671 448 C1690 620 1717 781 1749 927 C1762 986 1770 1036 1768 1080Z" fill="#08283a" opacity=".72"/></g>`
		: `<g fill="#65509b" opacity=".37"><path d="M78 720 C8 646 52 536 154 580 C214 485 304 555 276 650 C250 736 148 775 78 720Z"/><path d="M1530 670 C1462 610 1514 522 1598 558 C1643 474 1722 530 1704 606 C1687 676 1592 718 1530 670Z"/></g>`;

	const stars = dark
		? Array.from({ length: 17 }, (_, index) => {
			const x = 90 + random() * 1740;
			const y = 54 + random() * 520;
			const radius = 2.2 + random() * (index % 5 === 0 ? 10 : 5.4);
			const halo = radius * (2.1 + random() * 1.8);
			return `<g opacity="${(0.34 + random() * 0.52).toFixed(2)}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${halo.toFixed(1)}" fill="none" stroke="#e5b84b" stroke-width="${(1.3 + random() * 2.2).toFixed(1)}"/><circle cx="${(x + (random() - 0.5) * 4).toFixed(1)}" cy="${(y + (random() - 0.5) * 4).toFixed(1)}" r="${radius.toFixed(1)}" fill="#f2c85b"/></g>`;
		}).join("")
		: "";

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${title}"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${background[0]}"/><stop offset=".52" stop-color="${background[1]}"/><stop offset="1" stop-color="${background[2]}"/></linearGradient><radialGradient id="glow" cx="49%" cy="39%" r="55%"><stop stop-color="${light}" stop-opacity=".20"/><stop offset="1" stop-color="${light}" stop-opacity="0"/></radialGradient><filter id="canvas" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".007 .032" numOctaves="3" seed="47" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" result="d"/><feBlend in="d" in2="n" mode="soft-light"/></filter><filter id="impasto" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="turbulence" baseFrequency=".016 .075" numOctaves="2" seed="71" result="grain"/><feDiffuseLighting in="grain" surfaceScale="2.8" diffuseConstant=".60" lighting-color="${light}" result="diff"><feDistantLight azimuth="218" elevation="46"/></feDiffuseLighting><feSpecularLighting in="grain" surfaceScale="3.8" specularConstant=".38" specularExponent="16" lighting-color="#fff8dc" result="spec"><feDistantLight azimuth="214" elevation="51"/></feSpecularLighting><feComposite in="spec" in2="SourceAlpha" operator="in" result="spec2"/><feBlend in="SourceGraphic" in2="diff" mode="soft-light" result="lit"/><feBlend in="lit" in2="spec2" mode="screen"/></filter></defs><rect width="1920" height="1080" fill="url(#bg)"/><rect width="1920" height="1080" fill="url(#glow)"/>${underpainting}<g fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#canvas)">${strokes.join("")}</g><g filter="url(#impasto)">${accents}${stars}</g><rect x="18" y="18" width="1884" height="1044" rx="38" fill="none" stroke="#e5c970" stroke-opacity=".18" stroke-width="3"/></svg>`;
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
	fieldSha256: createHash("sha256")
		.update(Buffer.from(field.data, "base64"))
		.digest("hex"),
};
await writeFile(
	new URL("impasto-metadata.json", OUTPUT_URL),
	`${JSON.stringify(metadata, null, 2)}\n`,
);
console.log(
	`Generated impasto fallbacks in ${new URL("public/assets/impasto/", ROOT).pathname}`,
);
