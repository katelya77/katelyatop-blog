type DepthWindow = Window & {
	__katelyaHeroDepthCleanup?: () => void;
	__katelyaHeroDepthElement?: HTMLElement;
};

const MAX_X = 1;
const MAX_Y = 1;

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
	let frameId = 0;

	const writeVariables = (x: number, y: number) => {
		hero.style.setProperty("--hero-shallow-x", `${(x * 5).toFixed(2)}px`);
		hero.style.setProperty("--hero-shallow-y", `${(y * 4).toFixed(2)}px`);
		hero.style.setProperty("--hero-mid-x", `${(x * 11).toFixed(2)}px`);
		hero.style.setProperty("--hero-mid-y", `${(y * 8).toFixed(2)}px`);
		hero.style.setProperty("--hero-deep-x", `${(x * 19).toFixed(2)}px`);
		hero.style.setProperty("--hero-deep-y", `${(y * 13).toFixed(2)}px`);
		hero.style.setProperty("--hero-light-x", `${(50 + x * 23).toFixed(2)}%`);
		hero.style.setProperty("--hero-light-y", `${(42 + y * 18).toFixed(2)}%`);
	};

	const applyTarget = () => {
		frameId = 0;
		writeVariables(targetX, targetY);
	};

	const queueRender = () => {
		if (!frameId) frameId = requestAnimationFrame(applyTarget);
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

	writeVariables(0, 0);
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
