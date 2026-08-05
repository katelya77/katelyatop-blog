type DepthWindow = Window & {
	__katelyaHeroDepthCleanup?: () => void;
	__katelyaHeroDepthElement?: HTMLElement;
};

const MAX_X = 1;
const MAX_Y = 1;
const EASING = 0.14;
const STOP_EPSILON = 0.002;

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}

export function initKatelyaHeroDepth(): void {
	const depthWindow = window as DepthWindow;
	const hero = document.querySelector<HTMLElement>("[data-katelya-orbit]");
	if (!hero) return;
	if (
		depthWindow.__katelyaHeroDepthElement === hero &&
		depthWindow.__katelyaHeroDepthCleanup
	) {
		return;
	}

	depthWindow.__katelyaHeroDepthCleanup?.();
	depthWindow.__katelyaHeroDepthElement = hero;

	const reducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)",
	).matches;
	const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
	let targetX = 0;
	let targetY = 0;
	let currentX = 0;
	let currentY = 0;
	let frameId = 0;

	const writeVariables = () => {
		hero.style.setProperty("--hero-shallow-x", `${(currentX * 5).toFixed(2)}px`);
		hero.style.setProperty("--hero-shallow-y", `${(currentY * 4).toFixed(2)}px`);
		hero.style.setProperty("--hero-mid-x", `${(currentX * 11).toFixed(2)}px`);
		hero.style.setProperty("--hero-mid-y", `${(currentY * 8).toFixed(2)}px`);
		hero.style.setProperty("--hero-deep-x", `${(currentX * 19).toFixed(2)}px`);
		hero.style.setProperty("--hero-deep-y", `${(currentY * 13).toFixed(2)}px`);
		hero.style.setProperty("--hero-light-x", `${(50 + currentX * 23).toFixed(2)}%`);
		hero.style.setProperty("--hero-light-y", `${(42 + currentY * 18).toFixed(2)}%`);
	};

	const render = () => {
		frameId = 0;
		currentX += (targetX - currentX) * EASING;
		currentY += (targetY - currentY) * EASING;
		writeVariables();

		if (
			Math.abs(targetX - currentX) > STOP_EPSILON ||
			Math.abs(targetY - currentY) > STOP_EPSILON
		) {
			frameId = requestAnimationFrame(render);
		}
	};

	const queueRender = () => {
		if (!frameId) frameId = requestAnimationFrame(render);
	};

	const reset = () => {
		targetX = 0;
		targetY = 0;
		queueRender();
	};

	const onPointerMove = (event: PointerEvent) => {
		if (!hero.classList.contains("is-home-active")) {
			reset();
			return;
		}

		const rect = hero.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) {
			reset();
			return;
		}

		const insideHero =
			event.clientX >= rect.left &&
			event.clientX <= rect.right &&
			event.clientY >= rect.top &&
			event.clientY <= rect.bottom;
		if (!insideHero) {
			reset();
			return;
		}

		targetX = clamp(
			((event.clientX - rect.left) / rect.width - 0.5) * 2,
			-MAX_X,
			MAX_X,
		);
		targetY = clamp(
			((event.clientY - rect.top) / rect.height - 0.5) * 2,
			-MAX_Y,
			MAX_Y,
		);
		queueRender();
	};

	writeVariables();
	if (!reducedMotion && !coarsePointer) {
		window.addEventListener("pointermove", onPointerMove, { passive: true });
		window.addEventListener("blur", reset);
	}

	depthWindow.__katelyaHeroDepthCleanup = () => {
		if (frameId) cancelAnimationFrame(frameId);
		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("blur", reset);
		if (depthWindow.__katelyaHeroDepthElement === hero) {
			depthWindow.__katelyaHeroDepthElement = undefined;
		}
	};
}
