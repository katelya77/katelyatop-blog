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

type RenderProfile = {
	maxDpr: number;
	minDpr: number;
	maxPixels: number;
	pointerFps: number;
	themeFps: number;
	idleFps: number;
};

const THEME_BURST_MS = 220;
const POINTER_BURST_MS = 650;
const DESKTOP_RENDER_PROFILE: RenderProfile = {
	maxDpr: 1.4,
	minDpr: 0.85,
	maxPixels: 3_200_000,
	pointerFps: 48,
	themeFps: 36,
	idleFps: 14,
};
const TOUCH_RENDER_PROFILE: RenderProfile = {
	maxDpr: 1.15,
	minDpr: 0.8,
	maxPixels: 1_450_000,
	pointerFps: 24,
	themeFps: 20,
	idleFps: 8,
};

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

vec3 dayPalette(float value, float accent, float violet) {
	vec3 deep = vec3(0.035, 0.215, 0.25);
	vec3 teal = vec3(0.10, 0.48, 0.46);
	vec3 celadon = vec3(0.46, 0.73, 0.63);
	vec3 cream = vec3(0.94, 0.91, 0.74);
	vec3 colour = mix(deep, teal, smoothstep(0.05, 0.43, value));
	colour = mix(colour, celadon, smoothstep(0.36, 0.72, value));
	colour = mix(colour, cream, smoothstep(0.70, 1.0, value));
	colour = mix(colour, vec3(0.40, 0.27, 0.63), violet * 0.32);
	return mix(colour, vec3(0.95, 0.78, 0.34), accent * 0.16);
}

vec3 nightPalette(float value, float accent, float violet) {
	vec3 navy = vec3(0.008, 0.035, 0.12);
	vec3 ultramarine = vec3(0.025, 0.12, 0.36);
	vec3 cobalt = vec3(0.035, 0.27, 0.49);
	vec3 petrol = vec3(0.035, 0.38, 0.43);
	vec3 colour = mix(navy, ultramarine, smoothstep(0.04, 0.38, value));
	colour = mix(colour, cobalt, smoothstep(0.33, 0.68, value));
	colour = mix(colour, petrol, smoothstep(0.67, 0.96, value));
	colour = mix(colour, vec3(0.26, 0.17, 0.49), violet * 0.42);
	return mix(colour, vec3(0.98, 0.67, 0.15), accent * 0.20);
}

void main() {
	vec2 uv = vUv;
	float aspect = uResolution.x / max(uResolution.y, 1.0);
	vec2 aspectUv = vec2((uv.x - 0.5) * aspect + 0.5, uv.y);
	vec4 tensor = texture(uField, uv);
	float coherence = tensor.b;
	float energy = tensor.a;
	float time = uTime * uMotion;
	float flowTime = time * 0.18;

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
	float curl = curlNoise(
		aspectUv * 1.31 + vec2(3.1, -1.8) + vec2(flowTime * 0.017, -flowTime * 0.011)
	);
	float curlAngle = curl * mix(0.48, 0.84, uDark);
	vec2 curlVector = vec2(cos(curlAngle), sin(curlAngle));
	vec2 tensorDirection = normalize(tensor.rg * 2.0 - 1.0 + vec2(0.0001));
	vec2 direction = normalize(
		tensorDirection * (0.56 + coherence * 0.24) +
		localWarp * mix(0.54, 0.88, uDark) +
		curlVector * (0.14 + (1.0 - coherence) * 0.22)
	);
	vec2 tangent = vec2(-direction.y, direction.x);
	vec2 drift =
		direction * sin(flowTime * 0.71 + energy * 5.7) * 0.0021 +
		tangent * cos(flowTime * 0.43 + coherence * 4.9) * 0.0013;
	vec2 scaled = aspectUv + drift + localWarp * 0.042;
	vec2 brushSpace = vec2(dot(scaled, direction), dot(scaled, tangent));

	vec2 broadFlow = vec2(flowTime * 0.026, -flowTime * 0.014);
	vec2 secondaryFlow = vec2(-flowTime * 0.041, flowTime * 0.023);
	vec2 ridgeFlow = vec2(flowTime * 0.061, flowTime * 0.037);
	float broad = fbm(scaled * 2.18 + direction * 1.43 + broadFlow);
	float secondary = fbm(
		scaled * 5.15 - tangent * 1.92 + vec2(8.2, -4.7) + secondaryFlow
	);
	float ridges = fbm(
		scaled * 10.7 + tangent * broad * 2.15 + direction * secondary + ridgeFlow
	);
	float cellSeed = hash21(floor(brushSpace * vec2(6.1, 13.7)) + vec2(2.7, 11.3));
	float brokenMask = brokenStroke(
		brushSpace + vec2(flowTime * 0.021, broad * 0.08),
		cellSeed
	) * mix(0.58, 1.0, coherence);
	float strokeSegment = smoothstep(0.18, 0.86, brokenMask + ridges * 0.15);
	float bristleRidge = pow(
		1.0 - abs(sin(brushSpace.y * (82.0 + cellSeed * 71.0) + ridges * 6.1)),
		5.2
	) * mix(0.48, 1.0, coherence);
	float chippedPigment = smoothstep(0.34, 0.76, noise(scaled * 29.0 + cellSeed * 9.0));
	float edgeMask = paintEdge(fract(brushSpace.x * (2.8 + cellSeed * 3.5)), 0.17);
	float shortStroke = strokeSegment * mix(0.64, 1.0, chippedPigment);
	float pigmentGlaze = smoothstep(
		0.22,
		0.90,
		broad * 0.50 + secondary * 0.32 + ridges * 0.18
	);
	float pigment = clamp(
		0.10 + broad * 0.38 + secondary * 0.21 + energy * 0.20 +
		shortStroke * 0.22 + bristleRidge * 0.075 + edgeMask * 0.04,
		0.0,
		1.0
	);
	float goldDeposit = smoothstep(
		0.79,
		0.985,
		energy * 0.47 + ridges * 0.16 + shortStroke * 0.20 + cellSeed * 0.19
	) * mix(0.45, 1.0, coherence);
	float violetDeposit = smoothstep(
		0.64,
		0.94,
		secondary * 0.60 + curl * 0.15 + cellSeed * 0.25
	);

	vec3 base = mix(
		dayPalette(pigment, goldDeposit, violetDeposit),
		nightPalette(pigment, goldDeposit, violetDeposit),
		uDark
	);
	vec3 underpaint = mix(
		vec3(0.045, 0.25, 0.27),
		vec3(0.006, 0.035, 0.13),
		uDark
	);
	base = mix(underpaint, base, 0.66 + pigmentGlaze * 0.28);
	vec3 mineralGold = mix(vec3(0.94, 0.78, 0.35), vec3(1.0, 0.65, 0.12), uDark);
	base = mix(base, mineralGold, goldDeposit * mix(0.08, 0.17, uDark));

	float height =
		broad * 0.18 +
		secondary * 0.13 +
		ridges * 0.08 +
		shortStroke * 0.32 +
		bristleRidge * 0.16 +
		edgeMask * 0.05;
	vec3 normal = normalize(vec3(-dFdx(height) * 22.0, -dFdy(height) * 22.0, 1.0));
	vec3 lightDirection = normalize(vec3(
		(uPointer.x - 0.5) * 1.18 + 0.18,
		(0.5 - uPointer.y) * 0.94 - 0.12,
		0.90
	));
	float diffuse = max(dot(normal, lightDirection), 0.0);
	float roughness = clamp(
		0.86 - coherence * 0.25 - shortStroke * 0.24 + ridges * 0.06,
		0.31,
		0.91
	);
	vec3 halfVector = normalize(lightDirection + vec3(0.0, 0.0, 1.0));
	float specular = pow(max(dot(normal, halfVector), 0.0), mix(7.0, 34.0, 1.0 - roughness));
	vec3 lightColour = mix(vec3(1.0, 0.94, 0.76), vec3(1.0, 0.73, 0.23), uDark);
	base *= 0.72 + diffuse * 0.38;
	base += lightColour * specular *
		(0.05 + energy * 0.11 + bristleRidge * 0.07 + edgeMask * 0.035);

	vec2 center = vec2((uv.x - 0.5) / 0.37, (uv.y - 0.43) / 0.28);
	float readingProtection = exp(-dot(center, center) * 1.78);
	vec3 calm = mix(vec3(0.82, 0.90, 0.84), vec3(0.032, 0.105, 0.22), uDark);
	base = mix(base, calm, readingProtection * mix(0.29, 0.21, uDark));

	float canvasWeave =
		sin(gl_FragCoord.x * 1.57 + broad * 2.0) *
		sin(gl_FragCoord.y * 1.43 - broad * 1.4);
	base += canvasWeave * mix(0.007, 0.010, uDark) * (1.0 - readingProtection * 0.42);
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

function shouldUseStaticMode(): boolean {
	const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const saveData = Boolean((navigator as NavigatorWithConnection).connection?.saveData);
	return reducedMotion || saveData;
}

function getRenderProfile(): RenderProfile {
	return window.matchMedia("(pointer: coarse)").matches
		? TOUCH_RENDER_PROFILE
		: DESKTOP_RENDER_PROFILE;
}

function getAdaptiveDpr(
	cssWidth: number,
	cssHeight: number,
	profile: RenderProfile,
): number {
	const cssPixels = Math.max(1, cssWidth * cssHeight);
	const pixelBudgetDpr = Math.sqrt(profile.maxPixels / Math.max(cssPixels, 1));
	return Math.max(
		profile.minDpr,
		Math.min(window.devicePixelRatio || 1, profile.maxDpr, pixelBudgetDpr),
	);
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
	};
	if (shouldUseStaticMode()) {
		setStatic();
		return;
	}

	const renderProfile = getRenderProfile();
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

	const resize = () => {
		resizeFrame = 0;
		const cssWidth = Math.max(1, document.documentElement.clientWidth);
		const cssHeight = Math.max(1, document.documentElement.clientHeight);
		const dpr = getAdaptiveDpr(cssWidth, cssHeight, renderProfile);
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

		const pointerActive = now < pointerActiveUntil;
		const themeActive = now < themeBurstUntil;
		const fps = pointerActive
			? renderProfile.pointerFps
			: themeActive
				? renderProfile.themeFps
				: renderProfile.idleFps;
		pointerX += (targetX - pointerX) * (pointerActive ? 0.09 : 0.04);
		pointerY += (targetY - pointerY) * (pointerActive ? 0.09 : 0.04);

		gl.useProgram(program);
		gl.bindVertexArray(vao);
		gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
		gl.uniform2f(uniforms.pointer, pointerX, pointerY);
		gl.uniform1f(uniforms.time, (now - startedAt) / 1000);
		gl.uniform1f(uniforms.dark, isDark ? 1 : 0);
		gl.uniform1f(uniforms.motion, pointerActive ? 1 : themeActive ? 0.58 : 0.22);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		if (!firstFrameReady) markFirstFrameReady();
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
	};
}
