import field from "../data/impasto-field.json";

type ImpastoWindow = Window & {
	__katelyaImpastoCleanup?: () => void;
};

type NetworkInformationLike = {
	saveData?: boolean;
};

type NavigatorWithConnection = Navigator & {
	connection?: NetworkInformationLike;
};

type ThemeChangeDetail = {
	dark?: boolean;
};

type QualityLevel = "high" | "medium" | "low";

type QualityGovernorState = {
	level: QualityLevel;
	averageCost: number;
	samples: number;
	slowSamples: number;
	fastSamples: number;
	lastSwitchAt: number;
};

const THEME_BURST_MS = 220;
const POINTER_BURST_MS = 650;
const MAX_DPR = 1.4;
const MIN_DPR = 0.85;
const MAX_RENDER_PIXELS = 3_200_000;
const POINTER_FPS = 48;
const THEME_FPS = 36;
const IDLE_FPS = 14;
const TOUCH_MAX_DPR = 1.0;
const TOUCH_MIN_DPR = 0.55;
const TOUCH_MAX_RENDER_PIXELS = 1_150_000;
const TOUCH_POINTER_FPS = 30;
const TOUCH_THEME_FPS = 24;
const TOUCH_IDLE_FPS = 10;
const QUALITY_SWITCH_COOLDOWN_MS = 8_000;
const QUALITY_DOWNGRADE_THRESHOLD_MS = 20;
const QUALITY_UPGRADE_THRESHOLD_MS = 11;
const QUALITY_MIN_SAMPLES = 36;

const VERTEX_SHADER = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
	vec2 point = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
	vUv = point * 0.5;
	gl_Position = vec4(point * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uField;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uTime;
uniform float uDark;
uniform float uMotion;
uniform float uMicroDetail;

float hash21(vec2 point) {
	point = fract(point * vec2(123.34, 456.21));
	point += dot(point, point + 45.32);
	return fract(point.x * point.y);
}

float noise(vec2 point) {
	vec2 index = floor(point);
	vec2 fraction = fract(point);
	fraction = fraction * fraction * (3.0 - 2.0 * fraction);
	return mix(
		mix(hash21(index), hash21(index + vec2(1.0, 0.0)), fraction.x),
		mix(hash21(index + vec2(0.0, 1.0)), hash21(index + vec2(1.0)), fraction.x),
		fraction.y
	);
}

float fbm(vec2 point) {
	float value = 0.0;
	float amplitude = 0.56;
	mat2 rotation = mat2(0.80, -0.60, 0.60, 0.80);
	for (int octave = 0; octave < 4; octave++) {
		value += noise(point) * amplitude;
		point = rotation * point * 2.03 + 13.7;
		amplitude *= 0.47;
	}
	return value;
}

float curlNoise(vec2 point) {
	float epsilon = 0.035;
	float dx = fbm(point + vec2(epsilon, 0.0)) - fbm(point - vec2(epsilon, 0.0));
	float dy = fbm(point + vec2(0.0, epsilon)) - fbm(point - vec2(0.0, epsilon));
	return (dy - dx) / (2.0 * epsilon);
}

vec2 vortexWarp(vec2 point, vec2 center, float strength, float radius) {
	vec2 delta = point - center;
	float distanceToCenter = max(length(delta), 0.0001);
	float falloff = exp(-pow(distanceToCenter / radius, 2.0));
	vec2 tangent = vec2(-delta.y, delta.x) / distanceToCenter;
	return tangent * strength * falloff;
}

float brokenStroke(vec2 brush, float seed) {
	float frequency = 3.2 + seed * 4.8;
	float along = fract(brush.x * frequency + seed * 3.71);
	float start = 0.06 + seed * 0.12;
	float finish = 0.58 + seed * 0.28;
	float lengthMask = smoothstep(start, start + 0.10, along) *
		(1.0 - smoothstep(finish - 0.09, finish, along));
	float crossMask = 1.0 - smoothstep(0.16, 0.92, abs(sin(brush.y * 39.0 + seed * 8.2)));
	float chippedEdge = smoothstep(0.24, 0.78, noise(brush * vec2(8.7, 15.3) + seed * 17.0));
	return lengthMask * crossMask * mix(0.58, 1.0, chippedEdge);
}

float paintEdge(float value, float width) {
	return smoothstep(0.0, width, value) * (1.0 - smoothstep(1.0 - width, 1.0, value));
}

float broadUnderpainting(vec2 point, float seed) {
	vec2 warp = vec2(
		noise(point * 0.73 + seed * 4.1),
		noise(point * 0.61 - seed * 3.7)
	) - 0.5;
	return fbm(point * 0.82 + warp * 0.58 + seed * 7.3);
}

float midStrokeMask(vec2 brush, float seed, float phase) {
	vec2 cells = brush * vec2(16.0 + seed * 7.0, 28.0 + seed * 13.0);
	vec2 local = fract(cells + vec2(seed * 5.7 + phase, seed * 2.3));
	float cellSeed = hash21(floor(cells) + seed * 17.0);
	float start = 0.05 + cellSeed * 0.15;
	float finish = 0.58 + cellSeed * 0.32;
	float along = smoothstep(start, start + 0.08, local.x) *
		(1.0 - smoothstep(finish - 0.10, finish, local.x));
	float progress = clamp((local.x - start) / max(finish - start, 0.01), 0.0, 1.0);
	float taper = pow(max(sin(progress * 3.14159265), 0.0), 0.42);
	float curve = sin(progress * 5.4 + cellSeed * 6.2) * 0.075;
	float width = mix(0.16, 0.38, cellSeed) * taper;
	float cross = 1.0 - smoothstep(width * 0.48, width, abs(local.y - 0.5 + curve));
	float chip = smoothstep(0.20, 0.78, noise(cells * vec2(1.7, 2.9) + cellSeed * 11.0));
	return along * cross * mix(0.54, 1.0, chip);
}

float microBristleRidge(vec2 brush, float seed, float strokeBody) {
	float bristle = pow(
		max(0.0, 0.5 + 0.5 * sin(brush.y * (118.0 + seed * 94.0) + seed * 19.0)),
		9.0
	);
	float breakup = smoothstep(0.42, 0.76, noise(brush * vec2(21.0, 47.0) + seed * 8.0));
	return bristle * mix(0.45, 1.0, breakup) * strokeBody * uMicroDetail;
}

vec3 dayUnderpaint(float value) {
	return mix(vec3(0.055, 0.27, 0.29), vec3(0.34, 0.56, 0.49), smoothstep(0.2, 0.88, value));
}

vec3 nightUnderpaint(float value) {
	return mix(vec3(0.006, 0.025, 0.105), vec3(0.025, 0.19, 0.32), smoothstep(0.18, 0.9, value));
}

vec3 dayBrokenPalette(float family, float lightness) {
	vec3 colour = vec3(0.08, 0.43, 0.42);
	if (family > 0.24) colour = vec3(0.43, 0.69, 0.57);
	if (family > 0.50) colour = vec3(0.91, 0.88, 0.69);
	if (family > 0.74) colour = vec3(0.37, 0.24, 0.58);
	return mix(colour * 0.78, colour * 1.08, lightness);
}

vec3 nightBrokenPalette(float family, float lightness) {
	vec3 colour = vec3(0.018, 0.075, 0.28);
	if (family > 0.22) colour = vec3(0.025, 0.23, 0.48);
	if (family > 0.48) colour = vec3(0.025, 0.34, 0.38);
	if (family > 0.73) colour = vec3(0.22, 0.12, 0.42);
	return mix(colour * 0.72, colour * 1.16, lightness);
}

void main() {
	vec2 uv = vUv;
	float aspect = uResolution.x / max(uResolution.y, 1.0);
	vec2 aspectUv = vec2((uv.x - 0.5) * aspect + 0.5, uv.y);
	vec4 tensor = texture(uField, uv);
	float energy = tensor.a;
	float time = uTime * uMotion;
	float flowTime = time * 0.15;
	vec2 readingPoint = vec2((uv.x - 0.5) / 0.39, (uv.y - 0.43) / 0.31);
	float readingCalm = exp(-dot(readingPoint, readingPoint) * 1.72);
	float peripheralEnergy = 1.0 - readingCalm * 0.76;
	float coherence = tensor.b * mix(0.26, 1.0, peripheralEnergy);

	vec2 vortexCenterA = vec2(
		0.22 * aspect + sin(flowTime * 0.73 + 0.4) * 0.026 * aspect,
		0.29 + cos(flowTime * 0.61 + 1.7) * 0.021
	);
	vec2 vortexCenterB = vec2(
		0.73 * aspect + cos(flowTime * 0.47 + 2.1) * 0.031 * aspect,
		0.20 + sin(flowTime * 0.83 + 0.9) * 0.018
	);
	vec2 vortexCenterC = vec2(
		0.61 * aspect + sin(flowTime * 0.39 + 3.4) * 0.022 * aspect,
		0.73 + cos(flowTime * 0.67 + 2.6) * 0.026
	);
	vec2 localWarp =
		vortexWarp(aspectUv, vortexCenterA, 0.24, 0.39) +
		vortexWarp(aspectUv, vortexCenterB, -0.17, 0.31) +
		vortexWarp(aspectUv, vortexCenterC, 0.14, 0.25);
	vec2 regionCoordinate = uv * vec2(3.4, 2.7);
	float regionSeed = noise(regionCoordinate + vec2(7.3, 2.9));
	float phaseSeed = noise(regionCoordinate * 0.71 + vec2(-2.4, 5.8));
	float localPhase = flowTime * mix(0.17, 0.43, phaseSeed) + phaseSeed * 8.0;
	float curl = curlNoise(aspectUv * 1.27 + vec2(3.1, -1.8) + localWarp * 0.9);
	float curlAngle = curl * mix(0.62, 1.02, uDark) + localPhase * 0.035;
	vec2 curlVector = vec2(cos(curlAngle), sin(curlAngle));
	float regionAngle = mix(-1.35, 1.52, regionSeed) + sin(localPhase * 0.57) * 0.18;
	vec2 regionBias = vec2(cos(regionAngle), sin(regionAngle));
	vec2 tensorDirection = normalize(tensor.rg * 2.0 - 1.0 + vec2(0.0001));
	vec2 direction = normalize(
		tensorDirection * (0.13 + coherence * 0.17) +
		localWarp * mix(0.42, 0.69, uDark) * peripheralEnergy +
		curlVector * (0.28 + (1.0 - coherence) * 0.24) +
		regionBias * mix(0.34, 0.47, peripheralEnergy)
	);
	vec2 tangent = vec2(-direction.y, direction.x);
	vec2 drift = direction * sin(localPhase + energy * 5.7) * 0.0052 +
		tangent * cos(localPhase * 0.73 + coherence * 4.9) * 0.0036;
	vec2 scaled = aspectUv + drift + localWarp * 0.038;
	vec2 brushSpace = vec2(dot(scaled, direction), dot(scaled, tangent));
	vec2 secondaryDirection = normalize(direction + regionBias * 0.42 - tangent * 0.18);
	vec2 secondaryTangent = vec2(-secondaryDirection.y, secondaryDirection.x);
	vec2 secondaryBrush = vec2(dot(scaled, secondaryDirection), dot(scaled, secondaryTangent));
	float broad = broadUnderpainting(scaled * 1.46 + localWarp * 0.37, regionSeed);
	float strokeSeed = mix(regionSeed, phaseSeed, 0.43);
	float primaryStroke = midStrokeMask(
		brushSpace + broad * 0.019,
		strokeSeed,
		localPhase * 0.022
	);
	float secondaryStroke = midStrokeMask(
		secondaryBrush * 1.21 + vec2(3.7, -5.2),
		fract(strokeSeed + 0.41),
		-localPhase * 0.017
	) * 0.72;
	float strokeBody = max(primaryStroke, secondaryStroke) * mix(0.64, 1.0, peripheralEnergy);
	float bristleRidge = microBristleRidge(brushSpace, strokeSeed, strokeBody);
	float dryBreak = smoothstep(0.34, 0.76, noise(scaled * 31.0 + strokeSeed * 9.0));
	float edgeMask = paintEdge(clamp(strokeBody, 0.0, 1.0), 0.22) * dryBreak;
	float pigmentGlaze = smoothstep(0.18, 0.88, broad * 0.76 + strokeBody * 0.24);
	float goldDeposit = smoothstep(
		0.90,
		0.985,
		energy * 0.42 + strokeBody * 0.25 + strokeSeed * 0.27
	) * peripheralEnergy;
	float brokenColour = noise(scaled * vec2(7.1, 11.3) + vec2(4.7, -3.2));
	float familyA = fract(strokeSeed + brokenColour * 0.58 + regionSeed * 0.37);
	float familyB = fract(strokeSeed + 0.47 + broad * 0.19 + brokenColour * 0.31);
	float broadColour = mix(0.5, broad, 0.22);
	vec3 underpaint = mix(dayUnderpaint(broadColour), nightUnderpaint(broadColour), uDark);
	vec3 primaryColour = mix(
		dayBrokenPalette(familyA, energy),
		nightBrokenPalette(familyA, energy),
		uDark
	);
	vec3 secondaryColour = mix(
		dayBrokenPalette(familyB, 1.0 - energy * 0.45),
		nightBrokenPalette(familyB, 1.0 - energy * 0.38),
		uDark
	);
	vec3 base = mix(underpaint, primaryColour, primaryStroke * 0.78);
	base = mix(base, secondaryColour, secondaryStroke * 0.62);
	base = mix(underpaint * 0.92, base, 0.62 + pigmentGlaze * 0.31);
	vec3 mineralGold = mix(vec3(0.94, 0.78, 0.35), vec3(1.0, 0.65, 0.12), uDark);
	base = mix(base, mineralGold, goldDeposit * mix(0.55, 0.72, uDark));

	float height =
		(primaryStroke * 0.36 + secondaryStroke * 0.24 + bristleRidge * 0.14 +
		edgeMask * 0.10 + goldDeposit * 0.12 + broad * 0.025) *
		mix(0.50, 1.0, peripheralEnergy);
	vec3 normal = normalize(vec3(-dFdx(height) * 16.0, -dFdy(height) * 16.0, 1.0));
	vec3 lightDirection = normalize(vec3(
		(uPointer.x - 0.5) * 0.28 + 0.16,
		(0.5 - uPointer.y) * 0.22 - 0.10,
		0.96
	));
	float diffuse = max(dot(normal, lightDirection), 0.0);
	float roughness = clamp(
		0.89 - strokeBody * 0.23 - goldDeposit * 0.24 + dryBreak * 0.10,
		0.38,
		0.94
	);
	vec3 halfVector = normalize(lightDirection + vec3(0.0, 0.0, 1.0));
	float specular = pow(max(dot(normal, halfVector), 0.0), mix(7.0, 34.0, 1.0 - roughness));
	vec3 lightColour = mix(vec3(1.0, 0.94, 0.76), vec3(1.0, 0.73, 0.23), uDark);
	base *= 0.72 + diffuse * 0.38;
	base += lightColour * specular *
		(0.035 + strokeBody * 0.10 + bristleRidge * 0.08 + goldDeposit * 0.13);

	float readingProtection = readingCalm;
	vec3 calm = mix(vec3(0.61, 0.73, 0.65), vec3(0.032, 0.105, 0.22), uDark);
	base = mix(base, calm, readingProtection * mix(0.22, 0.17, uDark));

	float canvasWeave =
		sin(gl_FragCoord.x * 1.57 + broad * 1.2) *
		sin(gl_FragCoord.y * 1.43 - broad * 0.9);
	base += canvasWeave * mix(0.004, 0.006, uDark) * (1.0 - readingProtection * 0.52);
	float pigmentGrain = hash21(gl_FragCoord.xy * 0.73) - 0.5;
	base += pigmentGrain * 0.008;
	float vignette = 1.0 - smoothstep(0.24, 1.10, length((uv - 0.5) * vec2(1.0, 0.76)));
	base *= 0.81 + vignette * 0.19;
	outColor = vec4(base, 1.0);
}`;

function decodeField(): Uint8Array {
	const binary = atob(field.data);
	const result = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		result[index] = binary.charCodeAt(index);
	}
	return result;
}

function compileShader(
	gl: WebGL2RenderingContext,
	type: number,
	source: string,
): WebGLShader {
	const shader = gl.createShader(type);
	if (!shader) throw new Error("Unable to create impasto shader");
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const message = gl.getShaderInfoLog(shader) || "Unknown shader error";
		gl.deleteShader(shader);
		throw new Error(message);
	}
	return shader;
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
	const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
	const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
	const program = gl.createProgram();
	if (!program) throw new Error("Unable to create impasto program");
	gl.attachShader(program, vertex);
	gl.attachShader(program, fragment);
	gl.linkProgram(program);
	gl.deleteShader(vertex);
	gl.deleteShader(fragment);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const message = gl.getProgramInfoLog(program) || "Unknown link error";
		gl.deleteProgram(program);
		throw new Error(message);
	}
	return program;
}

function isCoarsePointer(): boolean {
	return window.matchMedia("(pointer: coarse)").matches;
}

function shouldUseStaticMode(): boolean {
	const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const saveData = Boolean((navigator as NavigatorWithConnection).connection?.saveData);
	return reducedMotion || saveData;
}

function qualityDprScale(level: QualityLevel): number {
	if (level === "high") return 1;
	if (level === "medium") return 1;
	return 0.76;
}

function qualityMicroDetail(level: QualityLevel): number {
	if (level === "high") return 1;
	if (level === "medium") return 0.72;
	return 0.38;
}

function updateQualityGovernor(
	state: QualityGovernorState,
	frameCost: number,
	now: number,
): { state: QualityGovernorState; changed: boolean } {
	const averageCost =
		state.samples === 0 ? frameCost : state.averageCost * 0.92 + frameCost * 0.08;
	const samples = Math.min(state.samples + 1, 10_000);
	const slowSamples =
		averageCost > QUALITY_DOWNGRADE_THRESHOLD_MS ? state.slowSamples + 1 : 0;
	const fastSamples =
		averageCost < QUALITY_UPGRADE_THRESHOLD_MS ? state.fastSamples + 1 : 0;
	const next = { ...state, averageCost, samples, slowSamples, fastSamples };

	if (
		samples < QUALITY_MIN_SAMPLES ||
		now - state.lastSwitchAt < QUALITY_SWITCH_COOLDOWN_MS
	) {
		return { state: next, changed: false };
	}

	let level = state.level;
	if (slowSamples >= 12) {
		level = state.level === "high" ? "medium" : "low";
	} else if (fastSamples >= 72) {
		level = state.level === "low" ? "medium" : "high";
	}
	if (level === state.level) return { state: next, changed: false };
	return {
		state: {
			...next,
			level,
			samples: 0,
			slowSamples: 0,
			fastSamples: 0,
			lastSwitchAt: now,
		},
		changed: true,
	};
}

function getAdaptiveDpr(
	cssWidth: number,
	cssHeight: number,
	qualityLevel: QualityLevel,
): number {
	const touch = isCoarsePointer();
	const cssPixels = Math.max(1, cssWidth * cssHeight);
	const maxRenderPixels = touch ? TOUCH_MAX_RENDER_PIXELS : MAX_RENDER_PIXELS;
	const minDpr = touch ? TOUCH_MIN_DPR : MIN_DPR;
	const maxDpr = touch ? TOUCH_MAX_DPR : MAX_DPR;
	const pixelBudgetDpr = Math.sqrt(maxRenderPixels / Math.max(cssPixels, 1));
	const boundedDpr = Math.max(
		minDpr,
		Math.min(window.devicePixelRatio || 1, maxDpr, pixelBudgetDpr),
	);
	return Math.max(minDpr, boundedDpr * qualityDprScale(qualityLevel));
}

export function initImpastoRenderer(): void {
	const impastoWindow = window as ImpastoWindow;
	impastoWindow.__katelyaImpastoCleanup?.();

	const canvas = document.querySelector<HTMLCanvasElement>("[data-impasto-canvas]");
	if (!canvas) return;

	const root = document.documentElement;
	const hadReadyFrame = root.classList.contains("impasto-ready");
	if (!hadReadyFrame) {
		root.classList.remove("impasto-static", "impasto-ready");
		root.classList.add("impasto-booting");
	}

	const setStatic = () => {
		root.classList.remove("impasto-ready", "impasto-booting");
		root.classList.add("impasto-static");
		root.removeAttribute("data-impasto-quality");
	};
	if (shouldUseStaticMode()) {
		setStatic();
		return;
	}

	const gl = canvas.getContext("webgl2", {
		alpha: false,
		antialias: false,
		depth: false,
		stencil: false,
		powerPreference: "low-power",
		preserveDrawingBuffer: false,
	});
	if (!gl) {
		setStatic();
		return;
	}

	let program: WebGLProgram;
	try {
		program = createProgram(gl);
	} catch (error) {
		console.warn("Impasto renderer unavailable", error);
		setStatic();
		return;
	}

	const vao = gl.createVertexArray();
	const texture = gl.createTexture();
	if (!vao || !texture) {
		gl.deleteProgram(program);
		setStatic();
		return;
	}

	gl.bindVertexArray(vao);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA,
		field.width,
		field.height,
		0,
		gl.RGBA,
		gl.UNSIGNED_BYTE,
		decodeField(),
	);
	gl.useProgram(program);
	gl.uniform1i(gl.getUniformLocation(program, "uField"), 0);

	const uniforms = {
		resolution: gl.getUniformLocation(program, "uResolution"),
		pointer: gl.getUniformLocation(program, "uPointer"),
		time: gl.getUniformLocation(program, "uTime"),
		dark: gl.getUniformLocation(program, "uDark"),
		motion: gl.getUniformLocation(program, "uMotion"),
		microDetail: gl.getUniformLocation(program, "uMicroDetail"),
	};

	let pointerX = 0.5;
	let pointerY = 0.34;
	let targetX = pointerX;
	let targetY = pointerY;
	let pointerActiveUntil = performance.now() + 500;
	let themeBurstUntil = 0;
	let isDark = root.classList.contains("dark");
	let visible = document.visibilityState === "visible";
	let frameId = 0;
	let timerId = 0;
	let resizeFrame = 0;
	let firstFrameReady = hadReadyFrame;
	const startedAt = performance.now();
	const touch = isCoarsePointer();
	let qualityState: QualityGovernorState = {
		level: touch ? "medium" : "high",
		averageCost: 0,
		samples: 0,
		slowSamples: 0,
		fastSamples: 0,
		lastSwitchAt: performance.now(),
	};
	root.setAttribute("data-impasto-quality", qualityState.level);
	let lastDrawAt = 0;
	const pointerFps = touch ? TOUCH_POINTER_FPS : POINTER_FPS;
	const themeFps = touch ? TOUCH_THEME_FPS : THEME_FPS;
	const idleFps = touch ? TOUCH_IDLE_FPS : IDLE_FPS;

	const resize = () => {
		resizeFrame = 0;
		const cssWidth = Math.max(1, document.documentElement.clientWidth);
		const cssHeight = Math.max(1, document.documentElement.clientHeight);
		const dpr = getAdaptiveDpr(cssWidth, cssHeight, qualityState.level);
		const width = Math.max(1, Math.round(cssWidth * dpr));
		const height = Math.max(1, Math.round(cssHeight * dpr));
		if (canvas.width === width && canvas.height === height) return;
		canvas.width = width;
		canvas.height = height;
		gl.viewport(0, 0, width, height);
	};

	const queueResize = () => {
		if (!resizeFrame) resizeFrame = requestAnimationFrame(resize);
	};

	const clearSchedule = () => {
		if (frameId) cancelAnimationFrame(frameId);
		if (timerId) window.clearTimeout(timerId);
		frameId = 0;
		timerId = 0;
	};

	const schedule = (delay = 0) => {
		if (!visible || frameId || timerId) return;
		timerId = window.setTimeout(() => {
			timerId = 0;
			frameId = requestAnimationFrame(draw);
		}, delay);
	};

	const draw = (now: number) => {
		frameId = 0;
		if (!visible) return;
		const renderStartedAt = performance.now();

		const pointerActive = now < pointerActiveUntil;
		const themeActive = now < themeBurstUntil;
		const fps = pointerActive ? pointerFps : themeActive ? themeFps : idleFps;
		pointerX += (targetX - pointerX) * (pointerActive ? 0.09 : 0.04);
		pointerY += (targetY - pointerY) * (pointerActive ? 0.09 : 0.04);

		gl.useProgram(program);
		gl.bindVertexArray(vao);
		gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
		gl.uniform2f(uniforms.pointer, pointerX, pointerY);
		gl.uniform1f(uniforms.time, (now - startedAt) / 1000);
		gl.uniform1f(uniforms.dark, isDark ? 1 : 0);
		gl.uniform1f(uniforms.motion, pointerActive ? 1 : themeActive ? 0.58 : 0.22);
		gl.uniform1f(uniforms.microDetail, qualityMicroDetail(qualityState.level));
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		if (!firstFrameReady) markFirstFrameReady();
		const renderCost = performance.now() - renderStartedAt;
		const schedulingCost = lastDrawAt
			? Math.max(0, now - lastDrawAt - 1000 / fps)
			: 0;
		lastDrawAt = now;
		const governor = updateQualityGovernor(
			qualityState,
			Math.max(renderCost, schedulingCost),
			now,
		);
		qualityState = governor.state;
		if (governor.changed) {
			root.setAttribute("data-impasto-quality", qualityState.level);
			queueResize();
		}
		schedule(1000 / fps);
	};

	const markFirstFrameReady = () => {
		firstFrameReady = true;
		root.classList.remove("impasto-static", "impasto-booting");
		root.classList.add("impasto-ready");
		root.dispatchEvent(new CustomEvent("katelya-impasto-first-frame"));
	};

	const onPointerMove = (event: PointerEvent) => {
		targetX = event.clientX / Math.max(window.innerWidth, 1);
		targetY = event.clientY / Math.max(window.innerHeight, 1);
		pointerActiveUntil = performance.now() + POINTER_BURST_MS;
		clearSchedule();
		schedule();
	};

	const onThemeChange = (event: Event) => {
		const customEvent = event as CustomEvent<ThemeChangeDetail>;
		isDark = customEvent.detail?.dark ?? root.classList.contains("dark");
		themeBurstUntil = performance.now() + THEME_BURST_MS;
		clearSchedule();
		schedule();
	};

	const onVisibilityChange = () => {
		visible = document.visibilityState === "visible";
		if (!visible) clearSchedule();
		else schedule();
	};

	const onPageView = () => {
		isDark = root.classList.contains("dark");
		themeBurstUntil = performance.now() + THEME_BURST_MS;
		clearSchedule();
		schedule();
	};

	const onContextLost = (event: Event) => {
		event.preventDefault();
		visible = false;
		clearSchedule();
		setStatic();
	};

	window.addEventListener("pointermove", onPointerMove, { passive: true });
	window.addEventListener("resize", queueResize, { passive: true });
	window.addEventListener("katelya-theme-change", onThemeChange);
	document.addEventListener("visibilitychange", onVisibilityChange);
	document.addEventListener("swup:page:view", onPageView);
	canvas.addEventListener("webglcontextlost", onContextLost);
	resize();
	schedule();

	impastoWindow.__katelyaImpastoCleanup = () => {
		clearSchedule();
		if (resizeFrame) cancelAnimationFrame(resizeFrame);
		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("resize", queueResize);
		window.removeEventListener("katelya-theme-change", onThemeChange);
		document.removeEventListener("visibilitychange", onVisibilityChange);
		document.removeEventListener("swup:page:view", onPageView);
		canvas.removeEventListener("webglcontextlost", onContextLost);
		gl.deleteTexture(texture);
		gl.deleteVertexArray(vao);
		gl.deleteProgram(program);
		root.removeAttribute("data-impasto-quality");
	};
}
