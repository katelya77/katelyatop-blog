<script lang="ts">
import { DARK_MODE, DEFAULT_THEME, LIGHT_MODE } from "@constants/constants";
import Icon from "@iconify/svelte";
import { getStoredTheme } from "@utils/setting-utils";
import { normalizeKatelyaTheme, setKatelyaTheme } from "@utils/lightweight-theme";
import { onMount } from "svelte";

import type { LIGHT_DARK_MODE } from "@/types/config.ts";

const seq: LIGHT_DARK_MODE[] = [LIGHT_MODE, DARK_MODE];
let mode: LIGHT_DARK_MODE = $state(DEFAULT_THEME);
let isChanging = $state(false);
let releaseTimer = 0;

onMount(() => {
	mode = normalizeKatelyaTheme(getStoredTheme());

	const handleContentReplace = () => {
		requestAnimationFrame(() => {
			mode = normalizeKatelyaTheme(getStoredTheme());
		});
	};
	const handleThemeChange = (event: Event) => {
		const customEvent = event as CustomEvent<{ theme?: LIGHT_DARK_MODE }>;
		if (customEvent.detail?.theme) {
			mode = normalizeKatelyaTheme(customEvent.detail.theme);
		}
	};

	let swupHooked = false;
	const setupSwupHook = () => {
		if (!swupHooked && window.swup?.hooks) {
			window.swup.hooks.on("content:replace", handleContentReplace);
			swupHooked = true;
		}
	};

	if (window.swup?.hooks) setupSwupHook();
	else document.addEventListener("swup:enable", setupSwupHook, { once: true });
	window.addEventListener("katelya-theme-change", handleThemeChange);

	return () => {
		if (window.swup?.hooks && swupHooked) {
			window.swup.hooks.off("content:replace", handleContentReplace);
		}
		document.removeEventListener("swup:enable", setupSwupHook);
		window.removeEventListener("katelya-theme-change", handleThemeChange);
		window.clearTimeout(releaseTimer);
	};
});

function switchScheme(newMode: LIGHT_DARK_MODE) {
	if (isChanging) return;
	isChanging = true;
	mode = newMode;
	setKatelyaTheme(newMode);
	window.clearTimeout(releaseTimer);
	releaseTimer = window.setTimeout(() => {
		isChanging = false;
	}, 200);
}

function toggleScheme() {
	if (isChanging) return;
	const currentIndex = Math.max(0, seq.indexOf(mode));
	switchScheme(seq[(currentIndex + 1) % seq.length]);
}
</script>

<button
	aria-label="Light/Dark Mode"
	class="relative btn-plain scale-animation rounded-lg h-11 w-11 active:scale-90 theme-switch-btn z-50"
	id="scheme-switch"
	onclick={toggleScheme}
	data-mode={mode}
	disabled={isChanging}
>
	<div
		class="absolute transition-all duration-150 ease-out"
		class:opacity-0={mode !== LIGHT_MODE}
		class:rotate-180={mode !== LIGHT_MODE}
	>
		<Icon icon="material-symbols:wb-sunny-outline-rounded" class="text-[1.25rem]"></Icon>
	</div>
	<div
		class="absolute transition-all duration-150 ease-out"
		class:opacity-0={mode !== DARK_MODE}
		class:rotate-180={mode !== DARK_MODE}
	>
		<Icon icon="material-symbols:dark-mode-outline-rounded" class="text-[1.25rem]"></Icon>
	</div>
</button>

<style>
	.theme-switch-btn::before {
		transition:
			transform 75ms ease-out,
			background-color 0ms !important;
	}

	.theme-switch-btn:disabled {
		cursor: wait;
	}
</style>
