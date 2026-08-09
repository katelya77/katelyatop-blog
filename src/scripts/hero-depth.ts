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
	let pageLeft = 0;
	let pageTop = 0;
	let heroWidth = 1;
	let heroHeight = 1;

	const measureHero = () => {
		const rect = hero.getBoundingClientRect();
		pageLeft = rect.left + window.scrollX;
		pageTop = rect.top + window.scrollY;
		heroWidth = Math.max(rect.width, 1);
		heroHeight = Math.max(rect.height, 1);
	};

	const writeVariables = (x: number, y: number) => {
		hero.style.setProperty("--hero-pointer-x", x.toFixed(3));
		hero.style.setProperty("--hero-pointer-y", y.toFixed(3));
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

		const left = pageLeft - window.scrollX;
		const top = pageTop - window.scrollY;
		const right = left + heroWidth;
		const bottom = top + heroHeight;

		const insideHero =
			event.clientX >= left &&
			event.clientX <= right &&
			event.clientY >= top &&
			event.clientY <= bottom;
		if (!insideHero) {
			reset();
			return;
		}

		targetX = clamp(
			((event.clientX - left) / heroWidth - 0.5) * 2,
			-MAX_X,
			MAX_X,
		);
		targetY = clamp(
			((event.clientY - top) / heroHeight - 0.5) * 2,
			-MAX_Y,
			MAX_Y,
		);
		queueRender();
	};

	measureHero();
	writeVariables(0, 0);
	if (!reducedMotion && !coarsePointer) {
		window.addEventListener("pointermove", onPointerMove, { passive: true });
		window.addEventListener("blur", reset);
		window.addEventListener("resize", measureHero, { passive: true });
	}

	depthWindow.__katelyaHeroDepthCleanup = () => {
		if (frameId) cancelAnimationFrame(frameId);
		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("blur", reset);
		window.removeEventListener("resize", measureHero);
		if (depthWindow.__katelyaHeroDepthElement === hero) {
			depthWindow.__katelyaHeroDepthElement = undefined;
		}
	};
}
