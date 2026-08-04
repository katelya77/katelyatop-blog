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
	float amplitude = 0.55;
	mat2 rotation = mat2(0.80, -0.60, 0.60, 0.80);
	for (int octave = 0; octave < 4; octave++) {
		value += noise(point) * amplitude;
		point = rotation * point * 2.02 + 13.7;
		amplitude *= 0.48;
	}
	return value;
}

vec3 dayPalette(float value, float accent) {
	vec3 deep = vec3(0.075, 0.29, 0.31);
	vec3 teal = vec3(0.22, 0.58, 0.55);
	vec3 mint = vec3(0.58, 0.80, 0.72);
	vec3 cream = vec3(0.94, 0.92, 0.78);
	vec3 colour = mix(deep, teal, smoothstep(0.10, 0.48, value));
	colour = mix(colour, mint, smoothstep(0.42, 0.75, value));
	colour = mix(colour, cream, smoothstep(0.73, 1.0, value));
	return mix(colour, vec3(0.43, 0.31, 0.67), accent * 0.26);
}

vec3 nightPalette(float value, float accent) {
	vec3 navy = vec3(0.018, 0.075, 0.21);
	vec3 cobalt = vec3(0.045, 0.22, 0.43);
	vec3 cyan = vec3(0.10, 0.48, 0.56);
	vec3 colour = mix(navy, cobalt, smoothstep(0.08, 0.58, value));
	colour = mix(colour, cyan, smoothstep(0.52, 0.92, value));
	return mix(colour, vec3(0.94, 0.72, 0.22), accent * 0.30);
}

void main() {
	vec2 uv = vUv;
	float aspect = uResolution.x / max(uResolution.y, 1.0);
	vec2 fieldUv = vec2(uv.x, uv.y);
	vec4 tensor = texture(uField, fieldUv);
	vec2 direction = normalize(tensor.rg * 2.0 - 1.0 + vec2(0.0001));
	float coherence = tensor.b;
	float energy = tensor.a;
	vec2 tangent = vec2(-direction.y, direction.x);
	float time = uTime * uMotion;
	vec2 drift = direction * sin(time * 0.18 + energy * 5.0) * 0.0024;
	vec2 paintedUv = uv + drift;
	vec2 scaled = vec2(paintedUv.x * aspect, paintedUv.y);
	float broad = fbm(scaled * 2.7 + direction * 1.9);
	float strokeWave = sin(dot(scaled * vec2(32.0, 24.0), tangent) + broad * 8.0 + time * 0.20);
	float shortStroke = smoothstep(-0.55, 0.92, strokeWave) * coherence;
	float ridges = fbm(scaled * 11.0 + tangent * broad * 2.0);
	float pigment = clamp(0.18 + broad * 0.52 + energy * 0.32 + shortStroke * 0.12, 0.0, 1.0);
	float accent = smoothstep(0.76, 0.98, energy * 0.72 + ridges * 0.38) * coherence;
	vec3 base = mix(dayPalette(pigment, accent), nightPalette(pigment, accent), uDark);

	float height = broad * 0.45 + ridges * 0.28 + shortStroke * 0.27;
	vec3 normal = normalize(vec3(-dFdx(height) * 26.0, -dFdy(height) * 26.0, 1.0));
	vec3 lightDirection = normalize(vec3((uPointer.x - 0.5) * 1.15, (0.5 - uPointer.y) * 0.95, 0.88));
	float diffuse = max(dot(normal, lightDirection), 0.0);
	float roughness = mix(0.78, 0.34, coherence * energy);
	vec3 halfVector = normalize(lightDirection + vec3(0.0, 0.0, 1.0));
	float specular = pow(max(dot(normal, halfVector), 0.0), mix(10.0, 38.0, 1.0 - roughness));
	vec3 lightColour = mix(vec3(1.0, 0.94, 0.78), vec3(1.0, 0.78, 0.30), uDark);
	base *= 0.76 + diffuse * 0.34;
	base += lightColour * specular * (0.10 + energy * 0.15);

	vec2 center = vec2((uv.x - 0.5) / 0.36, (uv.y - 0.43) / 0.28);
	float protection = exp(-dot(center, center) * 1.65);
	vec3 calm = mix(vec3(0.84, 0.91, 0.87), vec3(0.055, 0.14, 0.25), uDark);
	base = mix(base, calm, protection * mix(0.30, 0.22, uDark));
	float grain = hash21(gl_FragCoord.xy + floor(uTime * 8.0)) - 0.5;
	base += grain * 0.018;
	float vignette = smoothstep(1.05, 0.24, length((uv - 0.5) * vec2(1.0, 0.78)));
	base *= 0.84 + vignette * 0.16;
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
	const reducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)",
	).matches;
	const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
	const saveData = Boolean(
		(navigator as NavigatorWithConnection).connection?.saveData,
	);
	return reducedMotion || saveData || (coarsePointer && window.innerWidth < 900);
}

export function initImpastoRenderer(): void {
	const impastoWindow = window as ImpastoWindow;
	impastoWindow.__katelyaImpastoCleanup?.();

	const canvas = document.querySelector<HTMLCanvasElement>(
		"[data-impasto-canvas]",
	);
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
	let frame = 0;
	let lastFrame = 0;
	let activeUntil = performance.now() + 1200;
	let visible = document.visibilityState === "visible";
	const startedAt = performance.now();

	const resize = () => {
		const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
		const width = Math.max(1, Math.round(window.innerWidth * dpr));
		const height = Math.max(1, Math.round(window.innerHeight * dpr));
		if (canvas.width !== width || canvas.height !== height) {
			canvas.width = width;
			canvas.height = height;
			gl.viewport(0, 0, width, height);
		}
	};

	const draw = (now: number) => {
		frame = 0;
		if (!visible) return;
		const active = now < activeUntil;
		const interval = active ? 1000 / 45 : 1000 / 18;
		if (now - lastFrame >= interval) {
			lastFrame = now;
			pointerX += (targetX - pointerX) * 0.075;
			pointerY += (targetY - pointerY) * 0.075;
			resize();
			gl.useProgram(program);
			gl.bindVertexArray(vao);
			gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
			gl.uniform2f(uniforms.pointer, pointerX, pointerY);
			gl.uniform1f(uniforms.time, (now - startedAt) / 1000);
			gl.uniform1f(
				uniforms.dark,
				root.classList.contains("dark") ? 1 : 0,
			);
			gl.uniform1f(uniforms.motion, active ? 1 : 0.28);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
		}
		frame = requestAnimationFrame(draw);
	};

	const wake = () => {
		activeUntil = performance.now() + 1500;
		if (!frame && visible) frame = requestAnimationFrame(draw);
	};
	const onPointerMove = (event: PointerEvent) => {
		targetX = event.clientX / Math.max(window.innerWidth, 1);
		targetY = event.clientY / Math.max(window.innerHeight, 1);
		wake();
	};
	const onVisibilityChange = () => {
		visible = document.visibilityState === "visible";
		if (!visible && frame) {
			cancelAnimationFrame(frame);
			frame = 0;
		} else if (visible) {
			wake();
		}
	};
	const onThemeMutation = () => wake();
	const themeObserver = new MutationObserver(onThemeMutation);
	themeObserver.observe(root, { attributes: true, attributeFilter: ["class"] });

	window.addEventListener("pointermove", onPointerMove, { passive: true });
	window.addEventListener("resize", wake, { passive: true });
	document.addEventListener("visibilitychange", onVisibilityChange);
	document.addEventListener("swup:page:view", wake);
	root.classList.remove("impasto-static");
	root.classList.add("impasto-ready");
	wake();

	impastoWindow.__katelyaImpastoCleanup = () => {
		if (frame) cancelAnimationFrame(frame);
		themeObserver.disconnect();
		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("resize", wake);
		document.removeEventListener("visibilitychange", onVisibilityChange);
		document.removeEventListener("swup:page:view", wake);
		gl.deleteTexture(texture);
		gl.deleteVertexArray(vao);
		gl.deleteProgram(program);
	};
}
