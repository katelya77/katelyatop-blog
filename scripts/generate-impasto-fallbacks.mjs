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
	const regionAngle =
		Math.sin(x * 0.0023 + y * 0.0011) * 1.08 +
		Math.cos(y * 0.0031 - x * 0.0014) * 0.62;
	const regionX = Math.cos(regionAngle);
	const regionY = Math.sin(regionAngle);
	const wobble = (random() - 0.5) * (dark ? 0.72 : 0.58);
	return Math.atan2(
		tensor.dy * 0.24 + first.y + second.y + third.y + regionY * 0.52 + wobble,
		tensor.dx * 0.24 + first.x + second.x + third.x + regionX * 0.52 - wobble * 0.38,
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

function buildUnderpaintingBands(dark, random) {
	const colours = dark
		? ["#123b72", "#075667", "#302b69", "#1c5792"]
		: ["#8fc9b8", "#4f9b92", "#d8dfbd", "#67549a"];
	return Array.from({ length: 7 }, (_, index) => {
		const startX = -180 + random() * 260;
		const startY = 80 + index * 156 + (random() - 0.5) * 125;
		const endX = WIDTH + 140 + random() * 180;
		const endY = startY + (random() - 0.5) * 430;
		const c1x = WIDTH * (0.20 + random() * 0.18);
		const c1y = startY + (random() - 0.5) * 360;
		const c2x = WIDTH * (0.62 + random() * 0.22);
		const c2y = endY + (random() - 0.5) * 330;
		const width = 112 + random() * 146;
		return `<path d="M${startX.toFixed(1)} ${startY.toFixed(1)} C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}" stroke="${colours[index % colours.length]}" stroke-width="${width.toFixed(1)}" opacity="${(0.035 + random() * 0.045).toFixed(3)}"/>`;
	}).join("");
}

function buildBrokenHalo(x, y, radius, opacity, random) {
	const arcs = Array.from({ length: 3 }, (_, index) => {
		const start = random() * Math.PI * 2 + index * 1.7;
		const sweep = 0.44 + random() * 0.76;
		const r = radius * (1.5 + random() * 1.2);
		const x1 = x + Math.cos(start) * r;
		const y1 = y + Math.sin(start) * r * 0.72;
		const x2 = x + Math.cos(start + sweep) * r;
		const y2 = y + Math.sin(start + sweep) * r * 0.72;
		const controlAngle = start + sweep * 0.5;
		const cx = x + Math.cos(controlAngle) * r * (1.13 + random() * 0.18);
		const cy = y + Math.sin(controlAngle) * r * 0.78;
		return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="#e5b84b" stroke-width="${(1.2 + random() * 2.6).toFixed(1)}" stroke-linecap="round"/>`;
	}).join("");
	const markLength = radius * (0.8 + random() * 1.5);
	return `<g opacity="${opacity.toFixed(2)}">${arcs}<path d="M${(x - markLength * 0.45).toFixed(1)} ${(y + random() * 2).toFixed(1)} Q${x.toFixed(1)} ${(y - radius * 0.34).toFixed(1)} ${(x + markLength * 0.55).toFixed(1)} ${(y - random() * 3).toFixed(1)}" fill="none" stroke="#f2c85b" stroke-width="${Math.max(2.2, radius * 0.54).toFixed(1)}" stroke-linecap="round"/></g>`;
}

function compositionPoint(random) {
	const pick = random();
	if (pick < 0.3) {
		const angle = random() * Math.PI * 2;
		const radius = 90 + Math.sqrt(random()) * 560;
		return {
			x: WIDTH * 0.22 + Math.cos(angle) * radius,
			y: HEIGHT * 0.3 + Math.sin(angle) * radius * 0.64,
		};
	}
	if (pick < 0.54) {
		const angle = random() * Math.PI * 1.7 - 0.5;
		const radius = 80 + Math.sqrt(random()) * 430;
		return {
			x: WIDTH * 0.73 + Math.cos(angle) * radius,
			y: HEIGHT * 0.2 + Math.sin(angle) * radius * 0.72,
		};
	}
	if (pick < 0.7) {
		const angle = random() * Math.PI * 1.85 + 0.4;
		const radius = 55 + Math.sqrt(random()) * 350;
		return {
			x: WIDTH * 0.61 + Math.cos(angle) * radius,
			y: HEIGHT * 0.73 + Math.sin(angle) * radius * 0.68,
		};
	}
	return {
		x: random() * (WIDTH + 120) - 60,
		y: random() * (HEIGHT + 90) - 45,
	};
}

function buildSvg(dark) {
	const random = mulberry32(dark ? 260805 : 260804);
	const palette = dark
		? ["#071a46", "#123d79", "#1c5792", "#287f9a", "#4a3d84", "#72b9b3", "#edbe4f"]
		: ["#185d62", "#2f8984", "#63ada2", "#a4d0bc", "#e1ead5", "#68519a", "#d7b759"];
	const background = dark
		? ["#061333", "#123b72", "#075667"]
		: ["#164b52", "#3f918b", "#b7d5c3"];
	const light = dark ? "#f1bd4d" : "#ead06c";
	const title = dark
		? "Katelya asymmetric nocturne impasto field"
		: "Katelya asymmetric daylight impasto field";
	const strokes = [];

	for (let index = 0; index < 740; index += 1) {
		const point = compositionPoint(random);
		const x = point.x;
		const y = point.y;
		const tensor = sample(x, y);
		const theta = flowDirection(x, y, tensor, dark, random);
		const nx = (x - WIDTH * 0.5) / (WIDTH * 0.30);
		const ny = (y - HEIGHT * 0.42) / (HEIGHT * 0.25);
		const calm = Math.exp(-(nx * nx + ny * ny) * 1.78);
		const length =
			(24 + random() ** 0.68 * 138) *
			(0.78 + tensor.coherence * 0.22) *
			(1 - calm * 0.48) *
			(0.66 + random() * 0.52);
		const width =
			(3.4 + random() ** 1.35 * 17.5) *
			(0.60 + tensor.energy * 0.76) *
			(1 - calm * 0.38);
		const bend = (random() - 0.5) * (dark ? 1.62 : 1.28) * (0.88 + tensor.coherence * 0.12);
		const colourIndex =
			Math.floor(
				(tensor.energy * 0.20 + tensor.coherence * 0.08 + random() * 0.82) *
					(palette.length - 1),
			) % palette.length;
		const opacity = (0.24 + 0.34 * tensor.energy) * (1 - calm * 0.58) * (0.68 + random() * 0.32);
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
		if (index % 6 === 0) {
			const splitOffset = (random() - 0.5) * width * 1.35;
			strokes.push(
				buildStroke({
					x: x - Math.sin(theta) * splitOffset,
					y: y + Math.cos(theta) * splitOffset,
					theta: theta + (random() - 0.5) * 0.12,
					length: length * (0.42 + random() * 0.36),
					width: Math.max(1.6, width * (0.28 + random() * 0.24)),
					bend: bend * 0.7,
					colour: palette[(colourIndex + 1 + (index % 3)) % palette.length],
					opacity: opacity * (0.48 + random() * 0.24),
					random,
				}),
			);
		}
	}

	const underpainting = `<g fill="none" stroke-linecap="round">${buildUnderpaintingBands(dark, random)}</g>`;

	const accentColour = dark ? "#07162f" : "#66509a";
	const accents = `<g fill="none" stroke="${accentColour}" stroke-linecap="round" opacity="${dark ? ".54" : ".34"}">${Array.from(
		{ length: 18 },
		(_, index) => {
			const leftCluster = index < 9;
			const x = leftCluster ? 72 + random() * 230 : 1530 + random() * 250;
			const y = 570 + random() * 470;
			const theta = (leftCluster ? -1.28 : -1.82) + (random() - 0.5) * 0.72;
			return buildStroke({
				x,
				y,
				theta,
				length: 70 + random() * 210,
				width: 7 + random() * 24,
				bend: (random() - 0.5) * 1.3,
				colour: accentColour,
				opacity: 0.35 + random() * 0.45,
				random,
			});
		},
	).join("")}</g>`;

	const stars = dark
		? Array.from({ length: 17 }, (_, index) => {
			const x = 90 + random() * 1740;
			const y = 54 + random() * 520;
			const radius = 2.2 + random() * (index % 5 === 0 ? 10 : 5.4);
			return buildBrokenHalo(x, y, radius, 0.34 + random() * 0.52, random);
		}).join("")
		: "";

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${title}"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${background[0]}"/><stop offset=".52" stop-color="${background[1]}"/><stop offset="1" stop-color="${background[2]}"/></linearGradient><radialGradient id="glow" cx="49%" cy="39%" r="55%"><stop stop-color="${light}" stop-opacity=".20"/><stop offset="1" stop-color="${light}" stop-opacity="0"/></radialGradient><filter id="canvas" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".007 .032" numOctaves="3" seed="47" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter><filter id="impasto" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="turbulence" baseFrequency=".016 .075" numOctaves="2" seed="71" result="grain"/><feDiffuseLighting in="grain" surfaceScale="2.8" diffuseConstant=".60" lighting-color="${light}" result="diff"><feDistantLight azimuth="218" elevation="46"/></feDiffuseLighting><feSpecularLighting in="grain" surfaceScale="3.8" specularConstant=".38" specularExponent="16" lighting-color="#fff8dc" result="spec"><feDistantLight azimuth="214" elevation="51"/></feSpecularLighting><feComposite in="spec" in2="SourceAlpha" operator="in" result="spec2"/><feBlend in="SourceGraphic" in2="diff" mode="soft-light" result="lit"/><feBlend in="lit" in2="spec2" mode="screen"/></filter></defs><rect width="1920" height="1080" fill="url(#bg)"/><rect width="1920" height="1080" fill="url(#glow)"/>${underpainting}<g fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#canvas)">${strokes.join("")}</g><g filter="url(#impasto)">${accents}${stars}</g></svg>`;
}

await mkdir(OUTPUT_URL, { recursive: true });
const day = buildSvg(false);
const night = buildSvg(true);
await writeFile(new URL("impasto-day.svg", OUTPUT_URL), day);
await writeFile(new URL("impasto-night.svg", OUTPUT_URL), night);
const metadata = {
	generator: "katelya-impasto-svg-v2",
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
