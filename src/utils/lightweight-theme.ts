import { DARK_MODE, LIGHT_MODE } from "@constants/constants";

import type { LIGHT_DARK_MODE } from "@/types/config";

const THEME_TRANSITION_MS = 180;
let cleanupTimer = 0;

export function setKatelyaTheme(theme: LIGHT_DARK_MODE): void {
	const root = document.documentElement;
	const dark = theme === DARK_MODE;
	const nextTheme = dark ? "github-dark" : "github-light";

	localStorage.setItem("theme", theme);
	window.clearTimeout(cleanupTimer);
	root.classList.add("is-theme-transitioning");

	requestAnimationFrame(() => {
		root.classList.toggle("dark", dark);
		root.setAttribute("data-theme", nextTheme);
		window.dispatchEvent(
			new CustomEvent("katelya-theme-change", {
				detail: { theme, dark, duration: THEME_TRANSITION_MS },
			}),
		);

		cleanupTimer = window.setTimeout(() => {
			root.classList.remove("is-theme-transitioning");
		}, THEME_TRANSITION_MS);
	});
}

export function normalizeKatelyaTheme(theme: LIGHT_DARK_MODE): LIGHT_DARK_MODE {
	return theme === DARK_MODE ? DARK_MODE : LIGHT_MODE;
}
