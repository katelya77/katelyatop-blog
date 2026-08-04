<script lang="ts">
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import Icon from "@iconify/svelte";
import { navigateToPage } from "@utils/navigation-utils";
import { url } from "@utils/url-utils";
import { onDestroy, onMount } from "svelte";

import type { SearchResult } from "@/global";

let keywordDesktop = $state("");
let keywordMobile = $state("");
let result: SearchResult[] = $state([]);
let pagefindLoaded = false;
let initialized = $state(false);
let isDesktopSearchExpanded = $state(false);
let debounceTimer: ReturnType<typeof setTimeout>;
let blurTimer: ReturnType<typeof setTimeout>;

const fakeResult: SearchResult[] = [
	{
		url: url("/"),
		meta: { title: "开发环境搜索示例" },
		excerpt: "生产构建后将使用 <mark>Pagefind</mark> 返回真实文章。",
	},
];

const panel = () => document.getElementById("search-panel");

const setPanelVisibility = (show: boolean): void => {
	const target = panel();
	if (!target) return;
	target.classList.toggle("float-panel-closed", !show);
};

const togglePanel = () => {
	const target = panel();
	if (!target) return;
	target.classList.toggle("float-panel-closed");
	if (
		!target.classList.contains("float-panel-closed") &&
		typeof window.loadPagefind === "function"
	) {
		window.loadPagefind();
	}
};

const toggleDesktopSearch = (event?: MouseEvent) => {
	if (event?.target instanceof HTMLInputElement) return;
	isDesktopSearchExpanded = !isDesktopSearchExpanded;
	if (isDesktopSearchExpanded) {
		if (typeof window.loadPagefind === "function") window.loadPagefind();
		setTimeout(() => {
			document.getElementById("search-input-desktop")?.focus();
		}, 0);
	} else if (!keywordDesktop) {
		setPanelVisibility(false);
	}
};

const closeDesktopSearch = () => {
	isDesktopSearchExpanded = false;
	if (!keywordDesktop) setPanelVisibility(false);
};

const handleBlur = () => {
	blurTimer = setTimeout(() => {
		closeDesktopSearch();
	}, 180);
};

const closeSearchPanel = (): void => {
	setPanelVisibility(false);
	isDesktopSearchExpanded = false;
	keywordDesktop = "";
	keywordMobile = "";
	result = [];
};

const handleResultClick = (event: Event, destination: string): void => {
	event.preventDefault();
	closeSearchPanel();
	navigateToPage(destination);
};

const search = async (keyword: string): Promise<void> => {
	if (!keyword) {
		result = [];
		setPanelVisibility(false);
		return;
	}
	if (!initialized) return;

	try {
		let searchResults: SearchResult[] = [];
		if (import.meta.env.PROD && pagefindLoaded && window.pagefind) {
			const response = await window.pagefind.search(keyword);
			searchResults = await Promise.all(
				response.results.map((item) => item.data()),
			);
		} else if (import.meta.env.DEV) {
			searchResults = fakeResult;
		}
		result = searchResults;
		setPanelVisibility(result.length > 0);
	} catch (error) {
		console.error("Search error:", error);
		result = [];
		setPanelVisibility(false);
	}
};

onMount(() => {
	const initializeSearch = () => {
		initialized = true;
		pagefindLoaded = Boolean(
			window.pagefind && typeof window.pagefind.search === "function",
		);
	};
	const onReady = () => initializeSearch();
	const onError = () => initializeSearch();
	const onOutsidePointer = (event: PointerEvent) => {
		const target = event.target;
		const container = document.getElementById("search-container");
		const searchPanel = panel();
		if (!(target instanceof Node)) return;
		if (
			isDesktopSearchExpanded &&
			!container?.contains(target) &&
			!searchPanel?.contains(target)
		) {
			closeDesktopSearch();
		}
	};

	if (import.meta.env.DEV) initializeSearch();
	else {
		document.addEventListener("pagefindready", onReady);
		document.addEventListener("pagefindloaderror", onError);
		setTimeout(() => {
			if (!initialized) initializeSearch();
		}, 2000);
	}
	document.addEventListener("pointerdown", onOutsidePointer);

	return () => {
		document.removeEventListener("pagefindready", onReady);
		document.removeEventListener("pagefindloaderror", onError);
		document.removeEventListener("pointerdown", onOutsidePointer);
	};
});

$effect(() => {
	if (!initialized) return;
	const keyword = keywordDesktop || keywordMobile;
	clearTimeout(debounceTimer);
	if (keyword) {
		debounceTimer = setTimeout(() => search(keyword), 280);
	} else {
		result = [];
		setPanelVisibility(false);
	}
});

$effect(() => {
	const navbar = document.getElementById("navbar");
	navbar?.classList.toggle("is-searching", isDesktopSearchExpanded);
});

onDestroy(() => {
	document.getElementById("navbar")?.classList.remove("is-searching");
	clearTimeout(debounceTimer);
	clearTimeout(blurTimer);
});
</script>

<div class="hidden lg:block relative w-10 h-10 shrink-0 katelya-search-desktop">
	<button
		id="search-bar"
		type="button"
		class:is-expanded={isDesktopSearchExpanded}
		class="katelya-search-trigger"
		aria-label="搜索"
		aria-expanded={isDesktopSearchExpanded}
		onclick={toggleDesktopSearch}
	>
		<Icon icon="material-symbols:search" class="katelya-search-icon" />
		<input
			id="search-input-desktop"
			placeholder={i18n(I18nKey.search)}
			bind:value={keywordDesktop}
			onfocus={() => {
				clearTimeout(blurTimer);
				isDesktopSearchExpanded = true;
				search(keywordDesktop);
			}}
			onblur={handleBlur}
			class="katelya-search-input"
		/>
	</button>
</div>

<button
	onclick={togglePanel}
	aria-label="打开搜索"
	id="search-switch"
	class="btn-plain scale-animation lg:hidden! rounded-lg w-10 h-10 active:scale-90"
>
	<Icon icon="material-symbols:search" class="text-[1.2rem]" />
</button>

<div
	id="search-panel"
	class="float-panel float-panel-closed katelya-search-panel search-panel"
>
	<div id="search-bar-inside" class="katelya-search-mobile-row lg:hidden">
		<Icon icon="material-symbols:search" class="text-[1.2rem] opacity-50" />
		<input
			placeholder={i18n(I18nKey.search)}
			bind:value={keywordMobile}
			class="min-w-0 flex-1 bg-transparent outline-0 text-sm"
		/>
	</div>

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
