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
let panelPositionFrame = 0;

const fakeResult: SearchResult[] = [
	{
		url: url("/"),
		meta: { title: "开发环境搜索示例" },
		excerpt: "生产构建后将使用 <mark>Pagefind</mark> 返回真实文章。",
	},
];

const panel = () => document.getElementById("search-panel");
const input = () => document.getElementById("search-input") as HTMLInputElement | null;
const visibleTrigger = (): HTMLElement | null => {
	const triggers = Array.from(
		document.querySelectorAll<HTMLElement>("[data-search-trigger]"),
	);
	return triggers.find((trigger) => trigger.getClientRects().length > 0) ?? triggers[0] ?? null;
};

const positionSearchPanel = (): void => {
	const target = panel();
	const trigger = visibleTrigger();
	if (!target || !trigger) return;

	const triggerRect = trigger.getBoundingClientRect();
	const viewportWidth = document.documentElement.clientWidth;
	const viewportHeight = window.innerHeight;
	const viewportMargin = viewportWidth < 768 ? 12 : 16;
	const panelGap = viewportWidth < 768 ? 10 : 12;
	const preferredWidth = 448;
	const minimumWidth = Math.min(288, viewportWidth - viewportMargin * 2);
	const panelWidth = Math.max(
		minimumWidth,
		Math.min(preferredWidth, viewportWidth - viewportMargin * 2),
	);
	const unclampedLeft = triggerRect.right - panelWidth;
	const panelLeft = Math.min(
		Math.max(unclampedLeft, viewportMargin),
		viewportWidth - panelWidth - viewportMargin,
	);
	const panelTop = Math.max(viewportMargin, triggerRect.bottom + panelGap);
	const panelMaxHeight = Math.max(220, viewportHeight - panelTop - viewportMargin);

	target.style.setProperty("--katelya-search-panel-top", `${Math.round(panelTop)}px`);
	target.style.setProperty("--katelya-search-panel-left", `${Math.round(panelLeft)}px`);
	target.style.setProperty("--katelya-search-panel-width", `${Math.round(panelWidth)}px`);
	target.style.setProperty(
		"--katelya-search-panel-max-height",
		`${Math.round(panelMaxHeight)}px`,
	);
};

const scheduleSearchPanelPosition = (): void => {
	if (!isOpen || panelPositionFrame) return;
	panelPositionFrame = requestAnimationFrame(() => {
		panelPositionFrame = 0;
		positionSearchPanel();
	});
};

const syncPanel = (): void => {
	const target = panel();
	if (!target) return;
	if (isOpen) positionSearchPanel();
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
	requestAnimationFrame(() => {
		positionSearchPanel();
		input()?.focus({ preventScroll: true });
	});
};

const closeSearch = (clear = false, restoreFocus = false): void => {
	isOpen = false;
	if (clear) {
		keyword = "";
		result = [];
	}
	syncPanel();
	if (restoreFocus) requestAnimationFrame(() => visibleTrigger()?.focus());
};

const toggleSearch = (): void => {
	if (isOpen) closeSearch(false, true);
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
			closeSearch(false, true);
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
	window.addEventListener("resize", scheduleSearchPanelPosition, { passive: true });
	window.addEventListener("scroll", scheduleSearchPanelPosition, { passive: true });
	syncPanel();

	return () => {
		document.removeEventListener("pagefindready", onReady);
		document.removeEventListener("pagefindloaderror", onError);
		document.removeEventListener("pointerdown", onOutsidePointer);
		document.removeEventListener("keydown", onDocumentKeydown);
		document.removeEventListener("swup:page:view", onPageView);
		window.removeEventListener("resize", scheduleSearchPanelPosition);
		window.removeEventListener("scroll", scheduleSearchPanelPosition);
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
	if (panelPositionFrame) cancelAnimationFrame(panelPositionFrame);
	panel()?.classList.add("float-panel-closed");
});
</script>

<div class="hidden lg:block katelya-search-desktop">
	<button
		id="search-bar"
		type="button"
		class="katelya-search-trigger"
		data-search-trigger
		aria-label="打开站内搜索"
		aria-controls="search-panel"
		aria-haspopup="dialog"
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
	aria-label="打开站内搜索"
	aria-controls="search-panel"
	aria-haspopup="dialog"
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
	<div class="katelya-search-panel-header">
		<div class="katelya-search-panel-heading">
			<span class="katelya-search-panel-mark" aria-hidden="true">
				<Icon icon="material-symbols:travel-explore-rounded" />
			</span>
			<span>
				<strong>站内搜索</strong>
				<small>探索文章、标签与项目记录</small>
			</span>
		</div>
		<div class="katelya-search-panel-actions">
			<kbd>Esc</kbd>
			<button
				type="button"
				class="katelya-search-panel-close"
				data-search-close
				aria-label="关闭搜索"
				onclick={() => closeSearch(false, true)}
			>
				<Icon icon="material-symbols:close-rounded" />
			</button>
		</div>
	</div>

	<div class="katelya-search-input-row">
		<Icon icon="material-symbols:search" class="katelya-search-field-icon" />
		<input
			id="search-input"
			placeholder={i18n(I18nKey.search)}
			bind:value={keyword}
			autocomplete="off"
			spellcheck="false"
			class="min-w-0 flex-1 bg-transparent outline-0 text-sm"
		/>
		{#if keyword}
			<button
				type="button"
				class="katelya-search-clear"
				aria-label="清空搜索"
				onclick={() => {
					keyword = "";
					result = [];
					input()?.focus();
				}}
			>
				<Icon icon="material-symbols:backspace-outline-rounded" />
			</button>
		{/if}
	</div>

	<div class="katelya-search-results" aria-live="polite">
		{#if !keyword}
			<div class="katelya-search-empty katelya-search-empty--idle">
				<Icon icon="material-symbols:ink-pen-outline-rounded" />
				<strong>从一段关键词开始</strong>
				<span>可搜索标题、正文内容与标签</span>
			</div>
		{:else if result.length === 0}
			<div class="katelya-search-empty">
				<Icon icon="material-symbols:search-off-rounded" />
				<strong>暂未找到匹配内容</strong>
				<span>换一个更简短的关键词再试试</span>
			</div>
		{/if}
		{#each result as item}
			<a
				href={item.url}
				onclick={(event) => handleResultClick(event, item.url)}
				class="katelya-search-result"
			>
				<span class="katelya-search-result-icon" aria-hidden="true">
					<Icon icon="material-symbols:article-outline-rounded" />
				</span>
				<span class="katelya-search-result-copy">
					<strong>{item.meta.title}</strong>
					<span>{@html item.excerpt}</span>
				</span>
				<Icon icon="material-symbols:arrow-forward-rounded" class="katelya-search-result-arrow" />
			</a>
		{/each}
	</div>
</div>
