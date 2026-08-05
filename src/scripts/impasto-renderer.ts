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

const THEME_BURST_MS = 220;
const POINTER_BURST_MS = 650;
const MAX_DPR = 1.4;
const MIN_DPR = 0.85;
const MAX_RENDER_PIXELS = 3_200_000;
const POINTER_FPS = 40;
const THEME_FPS = 30;
const IDLE_FPS = 8;

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
	for (int octave = 0; octave < 3; octave++) {
		value += noise(point) * amplitude;
		point = rotation * point * 2.03 + 13.7;
		amplitude *= 0.48;
	}
	return value;
}

vec3 dayPalette(float value, float accent) {
	vec3 deep = vec3(0.055, 0.255, 0.29);
	vec3 teal = vec3(0.16, 0.55, 0.51);
	vec3 mint = vec3(0.55, 0.79, 0.69);
	vec3 cream = vec3(0.96, 0.93, 0.77);
	vec3 colour = mix(deep, teal, smoothstep(0.08, 0.46, value));
	colour = mix(colour, mint, smoothstep(0.40, 0.75, value));
	colour = mix(colour, cream, smoothstep(0.73, 1.0, value));
	return mix(colour, vec3(0.44, 0.30, 0.67), accent * 0.28);
}

vec3 nightPalette(float value, float accent) {
	vec3 navy = vec3(0.014, 0.055, 0.18);
	vec3 cobalt = vec3(0.035, 0.19, 0.42);
	vec3 cyan = vec3(0.075, 0.43, 0.54);
	vec3 colour = mix(navy, cobalt, smoothstep(0.06, 0.56, value));
	colour = mix(colour, cyan, smoothstep(0.50, 0.93, value));
	return mix(colour, vec3(0.96, 0.70, 0.20), accent * 0.32);
}

void main() {
	vec2 uv = vUv;
	float aspect = uResolution.x / max(uResolution.y, 1.0);
	vec4 tensor = texture(uField, uv);
	vec2 direction = normalize(tensor.rg * 2.0 - 1.0 + vec2(0.0001));
	float coherence = tensor.b;
	float energy = tensor.a;
	vec2 tangent = vec2(-direction.y, direction.x);
	float time = uTime * uMotion;
	vec2 drift = direction * sin(time * 0.14 + energy * 5.2) * 0.0018;
	vec2 scaled = vec2((uv.x + drift.x) * aspect, uv.y + drift.y);
	vec2 brushSpace = vec2(dot(scaled, direction), dot(scaled, tangent));

	float broad = fbm(scaled * 2.65 + direction * 1.85);
	float ridges = fbm(scaled * 9.6 + tangent * broad * 2.15);
	float strokeWave = sin(brushSpace.y * 43.0 + broad * 7.6 + time * 0.16);
	float strokeBand = 1.0 - smoothstep(0.18, 0.92, abs(strokeWave));
	float strokeSegment = smoothstep(
		0.30,
		0.76,
		noise(vec2(brushSpace.x * 5.2 + time * 0.012, floor(brushSpace.y * 2.4) + energy * 2.0))
	);
	float bristleRidge = pow(
		1.0 - abs(sin(brushSpace.y * 118.0 + ridges * 5.4)),
		4.5
	) * coherence;
	float shortStroke = strokeBand * strokeSegment * coherence;
	float pigmentGlaze = smoothstep(0.26, 0.88, broad * 0.62 + ridges * 0.38);
	float pigment = clamp(
		0.14 + broad * 0.48 + energy * 0.30 + shortStroke * 0.16 + bristleRidge * 0.07,
		0.0,
		1.0
	);
	float accent = smoothstep(
		0.73,
		0.98,
		energy * 0.66 + ridges * 0.28 + bristleRidge * 0.20
	) * coherence;

	vec3 base = mix(dayPalette(pigment, accent), nightPalette(pigment, accent), uDark);
	vec3 underpaint = mix(
		vec3(0.075, 0.31, 0.30),
		vec3(0.012, 0.065, 0.20),
		uDark
	);
	base = mix(underpaint, base, 0.72 + pigmentGlaze * 0.22);
	vec3 mineralGold = mix(vec3(0.95, 0.79, 0.39), vec3(1.0, 0.69, 0.16), uDark);
	base = mix(base, mineralGold, accent * mix(0.075, 0.14, uDark));

	float height =
		broad * 0.38 +
		ridges * 0.23 +
		shortStroke * 0.25 +
		bristleRidge * 0.14;
	vec3 normal = normalize(vec3(-dFdx(height) * 25.0, -dFdy(height) * 25.0, 1.0));
	vec3 lightDirection = normalize(vec3((uPointer.x - 0.5) * 1.05, (0.5 - uPointer.y) * 0.86, 0.92));
	float diffuse = max(dot(normal, lightDirection), 0.0);
	float roughness = mix(0.82, 0.34, coherence * energy);
	vec3 halfVector = normalize(lightDirection + vec3(0.0, 0.0, 1.0));
	float specular = pow(max(dot(normal, halfVector), 0.0), mix(9.0, 32.0, 1.0 - roughness));
	vec3 lightColour = mix(vec3(1.0, 0.94, 0.76), vec3(1.0, 0.75, 0.26), uDark);
	base *= 0.75 + diffuse * 0.36;
	base += lightColour * specular * (0.075 + energy * 0.13 + bristleRidge * 0.035);

	vec2 center = vec2((uv.x - 0.5) / 0.37, (uv.y - 0.43) / 0.29);
	float readingProtection = exp(-dot(center, center) * 1.72);
	vec3 calm = mix(vec3(0.84, 0.91, 0.85), vec3(0.045, 0.13, 0.24), uDark);
	base = mix(base, calm, readingProtection * mix(0.25, 0.18, uDark));

	float canvasWeave =
		sin(gl_FragCoord.x * 1.57 + broad * 2.0) *
		sin(gl_FragCoord.y * 1.43 - broad * 1.4);
	base += canvasWeave * mix(0.008, 0.011, uDark) * (1.0 - readingProtection * 0.35);
	float pigmentGrain = hash21(gl_FragCoord.xy * 0.73) - 0.5;
	base += pigmentGrain * 0.009;
	float vignette = smoothstep(1.08, 0.25, length((uv - 0.5) * vec2(1.0, 0.78)));
	base *= 0.83 + vignette * 0.17;
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
	const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
	const saveData = Boolean((navigator as NavigatorWithConnection).connection?.saveData);
	return reducedMotion || saveData || (coarsePointer && window.innerWidth < 900);
}

function getAdaptiveDpr(cssWidth: number, cssHeight: number): number {
	const cssPixels = Math.max(1, cssWidth * cssHeight);
	const pixelBudgetDpr = Math.sqrt(MAX_RENDER_PIXELS / Math.max(cssPixels, 1));
	return Math.max(
		MIN_DPR,
		Math.min(window.devicePixelRatio || 1, MAX_DPR, pixelBudgetDpr),
	);
}

export function initImpastoRenderer(): void {
	const impastoWindow = window as ImpastoWindow;
	impastoWindow.__katelyaImpastoCleanup?.();

	const canvas = document.querySelector<HTMLCanvasElement>("[data-impasto-canvas]");
	if (!canvas) return;

	const root = document.documentElement;
	const setStatic = () => {
		root.classList.remove("impasto-ready");
		root.classList.add("impasto-static");
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
	const startedAt = performance.now();

	const resize = () => {
		resizeFrame = 0;
		const cssWidth = Math.max(1, document.documentElement.clientWidth);
		const cssHeight = Math.max(1, document.documentElement.clientHeight);
		const dpr = getAdaptiveDpr(cssWidth, cssHeight);
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
		const fps = pointerActive ? POINTER_FPS : themeActive ? THEME_FPS : IDLE_FPS;
		pointerX += (targetX - pointerX) * (pointerActive ? 0.09 : 0.04);
		pointerY += (targetY - pointerY) * (pointerActive ? 0.09 : 0.04);

		gl.useProgram(program);
		gl.bindVertexArray(vao);
		gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
		gl.uniform2f(uniforms.pointer, pointerX, pointerY);
		gl.uniform1f(uniforms.time, (now - startedAt) / 1000);
		gl.uniform1f(uniforms.dark, isDark ? 1 : 0);
		gl.uniform1f(uniforms.motion, pointerActive ? 1 : themeActive ? 0.46 : 0.12);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		schedule(1000 / fps);
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
	root.classList.remove("impasto-static");
	root.classList.add("impasto-ready");
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
