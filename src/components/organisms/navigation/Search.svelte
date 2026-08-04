<script lang="ts">
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import Icon from "@iconify/svelte";
import { navigateToPage } from "@utils/navigation-utils";
import { url } from "@utils/url-utils";
import { onDestroy, onMount } from "svelte";

import type { SearchResult } from "@/global";
import "@/styles/katelya-light-performance.css";

let keyword = $state("");
let result: SearchResult[] = $state([]);
let pagefindLoaded = false;
let initialized = $state(false);
let isOpen = $state(false);
let debounceTimer: ReturnType<typeof setTimeout>;

const fakeResult: SearchResult[] = [
	{
		url: url("/"),
		meta: { title: "开发环境搜索示例" },
		excerpt: "生产构建后将使用 <mark>Pagefind</mark> 返回真实文章。",
	},
];

const panel = () => document.getElementById("search-panel");
const input = () => document.getElementById("search-input") as HTMLInputElement | null;

const syncPanel = (): void => {
	const target = panel();
	if (!target) return;
	target.classList.toggle("float-panel-closed", !isOpen);
	target.classList.toggle("is-open", isOpen);
	target.setAttribute("aria-hidden", isOpen ? "false" : "true");
};

const ensurePagefind = (): void => {
	if (typeof window.loadPagefind === "function") window.loadPagefind();
};

const openSearch = (): void => {
	isOpen = true;
	syncPanel();
	ensurePagefind();
	requestAnimationFrame(() => input()?.focus({ preventScroll: true }));
};

const closeSearch = (clear = false): void => {
	isOpen = false;
	if (clear) {
		keyword = "";
		result = [];
	}
	syncPanel();
};

const toggleSearch = (): void => {
	if (isOpen) closeSearch();
	else openSearch();
};

const handleDesktopKeydown = (event: KeyboardEvent): void => {
	if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
		event.preventDefault();
		openSearch();
	}
};

const handleResultClick = (event: Event, destination: string): void => {
	event.preventDefault();
	closeSearch(true);
	navigateToPage(destination);
};

const search = async (value: string): Promise<void> => {
	if (!value || !initialized) {
		result = [];
		return;
	}

	try {
		if (import.meta.env.PROD && pagefindLoaded && window.pagefind) {
			const response = await window.pagefind.search(value);
			result = await Promise.all(response.results.map((item) => item.data()));
		} else if (import.meta.env.DEV) {
			result = fakeResult;
		}
	} catch (error) {
		console.error("Search error:", error);
		result = [];
	}
};

onMount(() => {
	const initializeSearch = () => {
		initialized = true;
		pagefindLoaded = Boolean(window.pagefind && typeof window.pagefind.search === "function");
	};
	const onReady = () => initializeSearch();
	const onError = () => initializeSearch();
	const onOutsidePointer = (event: PointerEvent) => {
		const target = event.target;
		const searchPanel = panel();
		const triggers = document.querySelectorAll("[data-search-trigger]");
		if (!(target instanceof Node) || !isOpen) return;
		const insideTrigger = Array.from(triggers).some((trigger) => trigger.contains(target));
		if (!insideTrigger && !searchPanel?.contains(target)) closeSearch();
	};
	const onDocumentKeydown = (event: KeyboardEvent) => {
		if (event.key === "Escape" && isOpen) {
			event.preventDefault();
			closeSearch();
		}
	};
	const onPageView = () => closeSearch(true);

	if (import.meta.env.DEV) initializeSearch();
	else {
		document.addEventListener("pagefindready", onReady);
		document.addEventListener("pagefindloaderror", onError);
		window.setTimeout(() => {
			if (!initialized) initializeSearch();
		}, 2000);
	}

	document.addEventListener("pointerdown", onOutsidePointer);
	document.addEventListener("keydown", onDocumentKeydown);
	document.addEventListener("swup:page:view", onPageView);
	syncPanel();

	return () => {
		document.removeEventListener("pagefindready", onReady);
		document.removeEventListener("pagefindloaderror", onError);
		document.removeEventListener("pointerdown", onOutsidePointer);
		document.removeEventListener("keydown", onDocumentKeydown);
		document.removeEventListener("swup:page:view", onPageView);
	};
});

$effect(() => {
	if (!initialized) return;
	clearTimeout(debounceTimer);
	if (keyword) debounceTimer = setTimeout(() => search(keyword), 240);
	else result = [];
});

$effect(() => {
	syncPanel();
});

onDestroy(() => {
	clearTimeout(debounceTimer);
	panel()?.classList.add("float-panel-closed");
});
</script>

<div class="hidden lg:block katelya-search-desktop">
	<button
		id="search-bar"
		type="button"
		class="katelya-search-trigger"
		data-search-trigger
		aria-label="打开搜索"
		aria-expanded={isOpen}
		onclick={toggleSearch}
		onkeydown={handleDesktopKeydown}
	>
		<Icon icon="material-symbols:search" class="katelya-search-icon" />
	</button>
</div>

<button
	onclick={toggleSearch}
	onkeydown={handleDesktopKeydown}
	aria-label="打开搜索"
	aria-expanded={isOpen}
	id="search-switch"
	data-search-trigger
	class="btn-plain scale-animation lg:hidden! rounded-lg w-10 h-10 active:scale-90"
>
	<Icon icon="material-symbols:search" class="text-[1.2rem]" />
</button>

<div
	id="search-panel"
	data-search-dialog
	role="dialog"
	aria-label="站内搜索"
	aria-hidden="true"
	class="float-panel float-panel-closed katelya-search-panel katelya-search-desktop-panel search-panel"
>
	<div class="katelya-search-input-row">
		<Icon icon="material-symbols:search" class="text-[1.2rem] opacity-55" />
		<input
			id="search-input"
			placeholder={i18n(I18nKey.search)}
			bind:value={keyword}
			class="min-w-0 flex-1 bg-transparent outline-0 text-sm"
		/>
		{#if keyword}
			<button type="button" class="katelya-search-clear" aria-label="清空搜索" onclick={() => {
				keyword = "";
				result = [];
				input()?.focus();
			}}>
				<Icon icon="material-symbols:close-rounded" />
			</button>
		{/if}
	</div>

	<div class="katelya-search-results" aria-live="polite">
		{#if keyword && result.length === 0}
			<p class="katelya-search-empty">没有找到匹配内容</p>
		{/if}
		{#each result as item}
			<a
				href={item.url}
				onclick={(event) => handleResultClick(event, item.url)}
				class="katelya-search-result"
			>
				<div class="font-bold text-90 flex items-center gap-1">
					{item.meta.title}
					<Icon icon="fa7-solid:chevron-right" class="text-xs text-(--primary)" />
				</div>
				<div class="text-sm text-50">{@html item.excerpt}</div>
			</a>
		{/each}
	</div>
</div>
