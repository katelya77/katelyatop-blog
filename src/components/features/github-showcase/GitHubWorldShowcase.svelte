<script lang="ts">
	import { onMount } from "svelte";

	type WorldId = "minimal" | "craft" | "retro" | "toy";

	type Profile = {
		username: string;
		displayName: string;
		avatar: string;
		url: string;
		bio: string;
		tagline: string;
	};

	type Stat = { label: string; value: string | number; detail: string };

	type FeaturedRepository = {
		name: string;
		title: string;
		description: string;
		category: string;
		techStack: string[];
		fullName: string;
		url: string;
		stars: number | null;
		forks: number | null;
		language: string | null;
		updatedAt: string;
		homepage: string;
	};

	type AdditionalRepository = {
		name: string;
		url: string;
		description: string;
		language: string | null;
		stars: number;
		updatedAt: string;
	};

	type ActivityDay = { date: string; count: number | null; level: string };
	type ActivityEvent = { label: string; repository: string; url: string; date: string };
	type FilterTab = { value: string; label: string; count: number };

	type Props = {
		profile: Profile;
		stats: Stat[];
		featuredRepositories: FeaturedRepository[];
		additionalRepositories: AdditionalRepository[];
		recentActivity: ActivityEvent[];
		activityWeeks: ActivityDay[][];
		filterTabs: FilterTab[];
	};

	let {
		profile,
		stats,
		featuredRepositories,
		additionalRepositories,
		recentActivity,
		activityWeeks,
		filterTabs,
	}: Props = $props();

	const worlds: { id: WorldId; label: string; english: string; description: string }[] = [
		{ id: "minimal", label: "极简", english: "MINIMAL", description: "干净留白 · 轻盈过渡" },
		{ id: "craft", label: "手作", english: "CRAFT", description: "纸张质感 · 柔和回弹" },
		{ id: "retro", label: "复古", english: "RETRO", description: "终端荧光 · 像素节奏" },
		{ id: "toy", label: "玩具", english: "TOY", description: "立体塑料 · 弹性反馈" },
	];

	let hydrated = $state(false);
	let world = $state<WorldId>("minimal");
	let category = $state("all");
	let activeDay = $state<ActivityDay | null>(null);
	let selectedDay = $state<ActivityDay | null>(null);
	let focusedDayIndex = $state(0);
	let displayedDay = $derived(activeDay ?? selectedDay);

	// Public Events is a recent, capped sample; unknown days must stay distinct from zero.
	const visibleDays = activityWeeks.flat();
	const observedDays = visibleDays.filter((day) => day.count !== null);
	const observedEvents = observedDays.reduce((sum, day) => sum + (day.count ?? 0), 0);
	const activeDays = observedDays.filter((day) => (day.count ?? 0) > 0).length;
	const monthMarkers = activityWeeks
		.map((week, index) => ({
			index,
			month: week[0]?.date.slice(0, 7) ?? "",
			label: week[0]?.date.slice(5, 7) ?? "",
		}))
		.filter((item, index, all) => index === 0 || item.month !== all[index - 1]?.month);
	const rankedRepositories = [...featuredRepositories, ...additionalRepositories]
		.filter((repository) => typeof repository.stars === "number")
		.sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0))
		.slice(0, 5)
		.map((repository) => ({
			name: "title" in repository ? repository.title : repository.name,
			url: repository.url,
			stars: repository.stars ?? 0,
		}));
	const highestStars = Math.max(1, ...rankedRepositories.map((repository) => repository.stars));
	const technologies = [...new Set(featuredRepositories.flatMap((repository) => repository.techStack))].slice(0, 14);

	let worldIndex = $derived(Math.max(0, worlds.findIndex((item) => item.id === world)));
	let currentWorld = $derived(worlds[worldIndex]);
	onMount(() => {
		hydrated = true;
	});

	let filteredRepositories = $derived(
		category === "all"
			? featuredRepositories
			: featuredRepositories.filter((repository) => repository.category === category),
	);

	function compactNumber(value: number | null | undefined): string {
		if (value === null || value === undefined) return "—";
		return new Intl.NumberFormat("en", {
			notation: "compact",
			maximumFractionDigits: 1,
		}).format(value);
	}

	function handleWorldKeydown(event: KeyboardEvent, index: number) {
		let next = index;
		if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % worlds.length;
		else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index + worlds.length - 1) % worlds.length;
		else if (event.key === "Home") next = 0;
		else if (event.key === "End") next = worlds.length - 1;
		else return;

		event.preventDefault();
		world = worlds[next].id;
		document
			.querySelector<HTMLButtonElement>('[data-world-tab="' + worlds[next].id + '"]')
			?.focus();
	}

	function handleActivityKeydown(event: KeyboardEvent, index: number) {
		const total = activityWeeks.reduce((sum, week) => sum + week.length, 0);
		let next = index;
		if (event.key === "ArrowRight") next += 1;
		else if (event.key === "ArrowLeft") next -= 1;
		else if (event.key === "ArrowDown") next += 7;
		else if (event.key === "ArrowUp") next -= 7;
		else if (event.key === "Home") next = 0;
		else if (event.key === "End") next = total - 1;
		else return;

		event.preventDefault();
		if (next < 0 || next >= total) return;
		focusedDayIndex = next;
		document
			.querySelector<HTMLButtonElement>('[data-activity-index="' + next + '"]')
			?.focus();
	}

	function daySummary(day: ActivityDay | null): string {
		if (!day) return "将鼠标移至方格，查看当天公开事件样本";
		if (day.count === null) return day.date + " · 当前 API 样本未覆盖";
		return day.date + " · " + day.count + " 条公开事件";
	}
</script>

<div class="github-showcase-shell" data-world={world} data-hydrated={hydrated ? "true" : "false"}>
	<section class="gh-hero">
		<div class="gh-hero-copy">
			<div class="gh-eyebrow"><span class="gh-live-dot"></span> OPEN SOURCE · BUILD IN PUBLIC</div>
			<p class="gh-overline">A PERSONAL DEVELOPER SPACE</p>
			<h1>代码、产品，<br />以及持续发生的创造。</h1>
			<p class="gh-intro">{profile.bio}</p>
			<p class="gh-tagline">{profile.tagline}</p>
			<div class="gh-hero-actions">
				<a class="gh-primary-link" href={profile.url} target="_blank" rel="noopener noreferrer">
					<span aria-hidden="true">⌘</span> 访问 GitHub 主页 <span aria-hidden="true">↗</span>
				</a>
				<a class="gh-secondary-link" href="/projects/">浏览项目总览</a>
			</div>
			<nav class="gh-quick-nav" aria-label="GitHub 页面章节导航">
				<a href="#github-activity">01 / 活动图谱 ↗</a>
				<a href="#github-projects">02 / 精选作品 ↗</a>
				<a href="#github-impact">03 / 开源速览 ↗</a>
			</nav>
		</div>

		<article class="gh-developer-card" aria-label="Developer identity card">
			<div class="gh-id-topline">
				<span>DEVELOPER / PROFILE</span>
				<span class="gh-id-status"><i></i> PUBLIC</span>
			</div>
			<div class="gh-id-main">
				<img
					class="gh-avatar"
					src={profile.avatar}
					alt={profile.displayName + " 的 GitHub 头像"}
					width="76"
					height="76"
					loading="eager"
					decoding="async"
				/>
				<div class="gh-id-name">
					<h2>{profile.displayName}</h2>
					<span>@{profile.username}</span>
				</div>
			</div>
			<div class="gh-id-rule"></div>
			<p>在想法与实现之间搭建桥梁，把有用的东西做出来。</p>
			<div class="gh-id-stack">
				<span>Astro</span><span>Svelte</span><span>TypeScript</span><span>AI</span><span>Cloudflare</span>
			</div>
			<div class="gh-id-bottom">
				<span>OPEN SOURCE CONTRIBUTOR</span>
				<a href={profile.url} target="_blank" rel="noopener noreferrer">VIEW PROFILE ↗</a>
			</div>
			<span class="gh-id-watermark" aria-hidden="true">GH</span>
		</article>
	</section>

	<section class="gh-world-panel" aria-label="Ovio-inspired visual styles">
		<div class="gh-world-copy">
			<div>
				<span class="gh-kicker">ONE DATASET · FOUR WORLDS</span>
				<h2>切换你的视觉世界</h2>
				<p>同一份 GitHub 公开数据，四种完全不同的表达方式。</p>
			</div>
			<span class="gh-world-current">{currentWorld.english} / 04</span>
		</div>
		<div
			class="gh-world-tabs"
			role="tablist"
			aria-label="选择 GitHub 展示风格"
			style={"--world-shift: " + worldIndex * 100 + "%"}
		>
			<div class="gh-world-indicator" aria-hidden="true"></div>
			{#each worlds as item, index (item.id)}
				<button
					type="button"
					role="tab"
					data-world-tab={item.id}
					aria-selected={world === item.id}
					aria-controls="github-world-content"
					tabindex={world === item.id ? 0 : -1}
					class:active={world === item.id}
					onclick={() => (world = item.id)}
					onkeydown={(event) => handleWorldKeydown(event, index)}
				>
					<span>{item.label}</span>
					<small>{item.english}</small>
				</button>
			{/each}
		</div>
		<div class="gh-world-description" aria-live="polite">
			<span class="gh-world-dot"></span>
			{currentWorld.description}
			<span class="gh-world-hint">点击切换 · 体验不同动效</span>
		</div>
	</section>

	<div id="github-world-content" class="gh-world-content" role="tabpanel" aria-label={currentWorld.label + " 风格展示"}>
		<section class="gh-stats-grid" aria-label="GitHub 公开统计">
			{#each stats as stat (stat.label)}
				<div class="gh-stat-card">
					<span class="gh-stat-label">{stat.label}</span>
					<strong>{stat.value}</strong>
					<small>{stat.detail}</small>
					<span class="gh-stat-decoration" aria-hidden="true"></span>
				</div>
			{/each}
		</section>

		<section id="github-activity" class="gh-panel gh-activity-panel">
			<div class="gh-section-heading">
				<div>
					<span class="gh-kicker">ACTIVITY / PUBLIC SIGNALS</span>
					<h2>近期公开活动</h2>
					<p>让公开事件在时间轴上留下痕迹，轻触方格查看每天的数据。</p>
				</div>
				<span class="gh-data-pill">90 DAYS · PUBLIC EVENTS SAMPLE</span>
			</div>

			<div class="gh-activity-kpis" aria-label="公开事件样本概览">
				<div><strong>{observedEvents}</strong><span>样本事件</span></div>
				<div><strong>{activeDays}</strong><span>有事件的日期</span></div>
				<div><strong>{observedDays.length} / {visibleDays.length}</strong><span>可观察日期</span></div>
			</div>
			<div class="gh-activity-layout">
				<div class="gh-activity-labels" aria-hidden="true">
					<span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
				</div>
				<div class="gh-activity-scroll">
					<div class="gh-activity-months" style={"--activity-week-count: " + activityWeeks.length} aria-hidden="true">
						{#each monthMarkers as marker (marker.month)}
							<span style={"grid-column: " + (marker.index + 1) + " / span 2"}>{marker.label}月</span>
						{/each}
					</div>
					<div class="gh-activity-grid" style={"--activity-week-count: " + activityWeeks.length} role="grid" aria-label="最近公开事件的日期分布">
						{#each activityWeeks as week, weekIndex (weekIndex)}
							<div class="gh-activity-week" role="row">
								{#each week as day, dayIndex (day.date)}
									{@const index = weekIndex * 7 + dayIndex}
									<button
										type="button"
										class="gh-activity-cell"
										data-level={day.level}
										data-activity-index={index}
										title={daySummary(day)}
										aria-label={daySummary(day)}
										aria-pressed={selectedDay?.date === day.date}
										tabindex={focusedDayIndex === index ? 0 : -1}
										style={"--cell-tilt: " + (((index * 17) % 9) - 4) + "deg"}
										onpointerenter={() => (activeDay = day)}
										onpointerleave={() => (activeDay = null)}
										onfocus={() => {
											focusedDayIndex = index;
											activeDay = day;
										}}
										onblur={() => (activeDay = null)}
										onclick={() => (selectedDay = selectedDay?.date === day.date ? null : day)}
										onkeydown={(event) => handleActivityKeydown(event, index)}
									></button>
								{/each}
							</div>
						{/each}
					</div>
				</div>
			</div>
			<div class="gh-activity-bottom">
				<p class="gh-activity-readout" aria-live="polite">
					<span class="gh-readout-mark"></span>
					{daySummary(displayedDay)}
				</p>
				<div class="gh-activity-legend" aria-label="活动强度图例">
					<span>少</span><i data-level="0"></i><i data-level="1"></i><i data-level="2"></i><i data-level="3"></i><span>多</span><i data-level="unknown"></i><span>未覆盖</span>
				</div>
			</div>
			<p class="gh-footnote">
				数据口径：GitHub Public Events API 的最近 100 条公开事件样本，不是官方 Contributions 贡献日历；公开事件通常仅保留最近 30 天。虚线格代表样本未覆盖，不能理解为当天零贡献。点选方格可固定日期。
			</p>
		</section>

		<section id="github-projects" class="gh-repositories">
			<div class="gh-section-heading gh-repo-heading">
				<div>
					<span class="gh-kicker">SELECTED WORKS / PUBLIC REPOSITORIES</span>
					<h2>精选开源项目</h2>
					<p>从代码仓库到实际产品，看看这些项目如何生长。</p>
				</div>
				<a class="gh-inline-link" href={profile.url + "?tab=repositories"} target="_blank" rel="noopener noreferrer">全部公开仓库 ↗</a>
			</div>

			<div class="gh-filter-tabs" aria-label="筛选项目分类">
				{#each filterTabs as tab (tab.value)}
					<button
						type="button"
						data-filter-value={tab.value}
						class:active={category === tab.value}
						aria-pressed={category === tab.value}
						onclick={() => (category = tab.value)}
					>
						{tab.label}<span>{tab.count}</span>
					</button>
				{/each}
			</div>

			<div class="gh-repo-grid">
				{#each filteredRepositories as repository (repository.name)}
					<article class="gh-repo-card" data-category={repository.category}>
						<div class="gh-repo-topline">
							<span class="gh-repo-mark" aria-hidden="true">⌘</span>
							<span class="gh-repo-category">{repository.category}</span>
							<span class="gh-repo-owner">katelya77 /</span>
						</div>
						<h3>{repository.title}</h3>
						<p class="gh-repo-description">{repository.description}</p>
						<div class="gh-tech-stack">
							{#each repository.techStack as tech (tech)}
								<span>{tech}</span>
							{/each}
						</div>
						<div class="gh-repo-metrics">
							{#if repository.language}<span class="gh-language"><i></i>{repository.language}</span>{/if}
							<span>★ {compactNumber(repository.stars)}</span>
							<span>⑂ {compactNumber(repository.forks)}</span>
							{#if repository.updatedAt}<span>更新于 {repository.updatedAt}</span>{/if}
						</div>
						<div class="gh-repo-actions">
							<a href={repository.url} target="_blank" rel="noopener noreferrer">查看源码 ↗</a>
							{#if repository.homepage}
								<a href={repository.homepage} target="_blank" rel="noopener noreferrer">在线体验 ↗</a>
							{/if}
							<a href={"https://star-history.com/#" + repository.fullName + "&Date"} target="_blank" rel="noopener noreferrer">Star History</a>
						</div>
					</article>
				{/each}
				{#if filteredRepositories.length === 0}
					<div class="gh-empty-state">该分类暂时没有可展示的精选仓库。</div>
				{/if}
			</div>
		</section>

		{#if additionalRepositories.length > 0}
			<section class="gh-panel gh-more-panel">
				<div class="gh-section-heading">
					<div>
						<span class="gh-kicker">MORE REPOSITORIES</span>
						<h2>更多公开仓库</h2>
						<p>自动同步公开、非 Fork 且未归档的仓库。</p>
					</div>
					<a class="gh-inline-link" href={profile.url + "?tab=repositories"} target="_blank" rel="noopener noreferrer">查看全部 ↗</a>
				</div>
				<div class="gh-more-repos">
					{#each additionalRepositories as repository (repository.name)}
						<a class="gh-more-repo" href={repository.url} target="_blank" rel="noopener noreferrer">
							<span class="gh-more-icon" aria-hidden="true">↗</span>
							<span class="gh-more-main">
								<strong>{repository.name}</strong>
								<small>{repository.description}</small>
							</span>
							<span class="gh-more-meta">
								{#if repository.language}<i>{repository.language}</i>{/if}
								<span>★ {compactNumber(repository.stars)}</span>
								<small>{repository.updatedAt}</small>
							</span>
						</a>
					{/each}
				</div>
			</section>
		{/if}

		<section id="github-impact" class="gh-insights-grid" aria-label="公开项目与技术速览">
			<div class="gh-panel gh-insight-panel">
				<div class="gh-section-heading">
					<div><span class="gh-kicker">OPEN SOURCE / PROJECT SIGNALS</span><h2>仓库热度速览</h2><p>仅统计可获取 Stars 数据的公开非 Fork 仓库。</p></div>
				</div>
				{#if rankedRepositories.length > 0}
					<div class="gh-rank-list">
						{#each rankedRepositories as repository, index (repository.url)}
							<a class="gh-rank-item" href={repository.url} target="_blank" rel="noopener noreferrer">
								<div class="gh-rank-top"><span>{String(index + 1).padStart(2, "0")} <strong>{repository.name}</strong></span><b>★ {compactNumber(repository.stars)}</b></div>
								<div class="gh-rank-track"><span style={"width: " + Math.max(3, repository.stars / highestStars * 100) + "%"}></span></div>
							</a>
						{/each}
					</div>
				{:else}
					<p class="gh-empty-state">公开仓库数据尚不可用。</p>
				{/if}
			</div>
			<div class="gh-panel gh-insight-panel">
				<div class="gh-section-heading">
					<div><span class="gh-kicker">STACK / BUILDING BLOCKS</span><h2>技术拼图</h2><p>来自本站精选项目的技术标签，而非编造的语言占比。</p></div>
				</div>
				<div class="gh-stack-cloud">
					{#each technologies as technology, index (technology)}
						<span class:gh-stack-primary={index < 5}>{technology}</span>
					{/each}
				</div>
				<a class="gh-insight-link" href="#github-projects">探索技术对应的实际项目 ↗</a>
			</div>
		</section>

		<section class="gh-panel gh-events-panel">
			<div class="gh-section-heading">
				<div>
					<span class="gh-kicker">RECENT EVENTS</span>
					<h2>开发动态</h2>
					<p>只展示 GitHub 返回的公开事件，不读取或展示私有仓库活动。</p>
				</div>
			</div>
			{#if recentActivity.length > 0}
				<div class="gh-event-list">
					{#each recentActivity as event, index (event.repository + event.date + index)}
						<a class="gh-event" href={event.url} target="_blank" rel="noopener noreferrer">
							<span class="gh-event-index">{String(index + 1).padStart(2, "0")}</span>
							<span class="gh-event-mark" aria-hidden="true">↳</span>
							<span class="gh-event-copy"><strong>{event.label}</strong><small>{event.repository}</small></span>
							<time>{event.date}</time>
						</a>
					{/each}
				</div>
			{:else}
				<p class="gh-empty-state">暂时没有可展示的近期公开事件，稍后可重新同步。</p>
			{/if}
		</section>
	</div>

	<footer class="gh-credit">
		<span>DESIGNED FOR KATELYA · INSPIRED BY OVIO</span>
		<a href="https://github.com/JanaSundar/ovio" target="_blank" rel="noopener noreferrer">Ovio UI · MIT License ↗</a>
		<span>DATA SOURCE: GITHUB PUBLIC API</span>
	</footer>
</div>

<style>
	.github-showcase-shell {
		--gh-surface: var(--card-bg, #fff);
		--gh-stage: var(--page-bg, #f5f5f5);
		--gh-ink: var(--deep-text, #242424);
		--gh-ink-2: var(--content-meta, #666);
		--gh-muted: var(--content-meta, #777);
		--gh-line: var(--line-divider, rgba(0, 0, 0, 0.1));
		--gh-accent: var(--primary, #777);
		--gh-accent-deep: color-mix(in srgb, var(--gh-accent) 75%, #111);
		--gh-track: color-mix(in srgb, var(--gh-ink) 5%, transparent);
		--gh-shadow: 0 14px 32px -24px rgba(0, 0, 0, 0.24);
		display: grid;
		gap: 1.25rem;
		min-width: 0;
		color: var(--gh-ink);
	}

	.github-showcase-shell[data-world="craft"] {
		--gh-surface: #fffaf0;
		--gh-stage: #f1e8d7;
		--gh-ink: #3c3328;
		--gh-ink-2: #675744;
		--gh-muted: #8d7b63;
		--gh-line: rgba(95, 69, 37, 0.2);
		--gh-accent: #d56d36;
		--gh-accent-deep: #a94822;
		--gh-track: #e7ddca;
		--gh-shadow: 0 16px 34px -20px rgba(76, 49, 22, 0.42);
	}

	.github-showcase-shell[data-world="retro"] {
		--gh-surface: #07130b;
		--gh-stage: #020803;
		--gh-ink: #b7ffc2;
		--gh-ink-2: #8bdc99;
		--gh-muted: #65a874;
		--gh-line: rgba(91, 255, 126, 0.28);
		--gh-accent: #4fe276;
		--gh-accent-deep: #1c8c43;
		--gh-track: #07190d;
		--gh-shadow: 0 0 22px rgba(60, 255, 100, 0.1);
	}

	.github-showcase-shell[data-world="toy"] {
		--gh-surface: #fff8e8;
		--gh-stage: #e8e1d4;
		--gh-ink: #4a4034;
		--gh-ink-2: #6f6251;
		--gh-muted: #8a7e6d;
		--gh-line: rgba(92, 70, 43, 0.12);
		--gh-accent: #ed5a3a;
		--gh-accent-deep: #b73520;
		--gh-track: #e4ddcf;
		--gh-shadow: inset 0 1px 0 #fff, 0 7px 0 #d0c8b8, 0 22px 28px -18px rgba(44, 31, 15, 0.5);
	}

	.gh-hero {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1.15fr) minmax(260px, 0.85fr);
		align-items: center;
		gap: clamp(1.25rem, 4vw, 3rem);
		padding: clamp(1.25rem, 4vw, 2.5rem);
		overflow: hidden;
		border: 1px solid var(--gh-line);
		border-radius: 1.25rem;
		background:
			radial-gradient(circle at 90% 12%, color-mix(in srgb, var(--gh-accent) 16%, transparent), transparent 35%),
			var(--gh-surface);
		box-shadow: var(--gh-shadow);
		transition: background-color 220ms ease, border-color 220ms ease;
	}

	.gh-hero-copy {
		position: relative;
		z-index: 1;
		min-width: 0;
	}

	.gh-eyebrow,
	.gh-kicker {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--gh-accent);
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.13em;
	}

	.gh-live-dot,
	.gh-world-dot {
		width: 0.48rem;
		height: 0.48rem;
		border-radius: 50%;
		background: var(--gh-accent);
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--gh-accent) 14%, transparent);
	}

	.gh-overline {
		margin: 1.3rem 0 0.55rem;
		color: var(--gh-muted);
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.12em;
	}

	.gh-hero h1 {
		margin: 0;
		color: var(--gh-ink);
		font-size: clamp(1.8rem, 4.2vw, 3.15rem);
		font-weight: 850;
		letter-spacing: -0.055em;
		line-height: 1.2;
	}

	.gh-intro {
		max-width: 36rem;
		margin: 1rem 0 0;
		color: var(--gh-ink-2);
		font-size: 0.9rem;
		line-height: 1.8;
	}

	.gh-tagline {
		margin: 0.65rem 0 1.3rem;
		color: var(--gh-muted);
		font-size: 0.72rem;
		letter-spacing: 0.04em;
	}

	.gh-hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
	}

	.gh-primary-link,
	.gh-secondary-link {
		display: inline-flex;
		min-height: 42px;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.65rem 0.95rem;
		border-radius: 0.75rem;
		font-size: 0.78rem;
		font-weight: 750;
		text-decoration: none;
		transition: transform 180ms ease, background-color 180ms ease;
	}

	.gh-primary-link {
		background: var(--gh-accent);
		color: #fff;
		box-shadow: 0 6px 16px color-mix(in srgb, var(--gh-accent) 22%, transparent);
	}

	.gh-secondary-link {
		border: 1px solid var(--gh-line);
		color: var(--gh-ink);
		background: color-mix(in srgb, var(--gh-surface) 84%, transparent);
	}

	.gh-primary-link:hover,
	.gh-secondary-link:hover {
		transform: translateY(-2px);
	}

	.gh-developer-card {
		position: relative;
		min-width: 0;
		padding: 1.25rem;
		overflow: hidden;
		border: 1px solid var(--gh-line);
		border-radius: 1rem;
		background: var(--gh-surface);
		box-shadow: var(--gh-shadow);
		transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 240ms ease;
	}

	.gh-developer-card:hover {
		transform: translateY(-3px) rotate(-0.35deg);
	}

	.gh-id-topline,
	.gh-id-bottom {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		color: var(--gh-muted);
		font-family: var(--font-jetbrains-mono), monospace;
		font-size: 0.58rem;
		letter-spacing: 0.08em;
	}

	.gh-id-status {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	.gh-id-status i {
		width: 0.42rem;
		height: 0.42rem;
		border-radius: 50%;
		background: #2fbd70;
		box-shadow: 0 0 0 3px rgba(47, 189, 112, 0.13);
	}

	.gh-id-main {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin: 1.2rem 0;
	}

	.gh-avatar {
		width: 70px;
		height: 70px;
		flex: 0 0 70px;
		border: 3px solid color-mix(in srgb, var(--gh-accent) 24%, var(--gh-surface));
		border-radius: 50%;
		object-fit: cover;
		box-shadow: 0 7px 20px rgba(0, 0, 0, 0.13);
	}

	.gh-id-name {
		min-width: 0;
	}

	.gh-id-name h2 {
		margin: 0;
		color: var(--gh-ink);
		font-size: clamp(1.45rem, 3vw, 2rem);
		font-weight: 850;
		letter-spacing: -0.045em;
		overflow-wrap: anywhere;
	}

	.gh-id-name span {
		color: var(--gh-muted);
		font-size: 0.8rem;
	}

	.gh-id-rule {
		height: 1px;
		background: var(--gh-line);
	}

	.gh-developer-card > p {
		position: relative;
		z-index: 1;
		margin: 0.9rem 0;
		color: var(--gh-ink-2);
		font-size: 0.78rem;
		line-height: 1.65;
	}

	.gh-id-stack {
		position: relative;
		z-index: 1;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.gh-id-stack span {
		padding: 0.28rem 0.5rem;
		border: 1px solid var(--gh-line);
		border-radius: 999px;
		color: var(--gh-ink-2);
		font-size: 0.63rem;
	}

	.gh-id-bottom {
		position: relative;
		z-index: 1;
		margin-top: 1.1rem;
		padding-top: 0.8rem;
		border-top: 1px dashed var(--gh-line);
	}

	.gh-id-bottom a {
		color: var(--gh-accent);
		font-weight: 800;
		text-decoration: none;
	}

	.gh-id-watermark {
		position: absolute;
		right: -0.2rem;
		bottom: -2.3rem;
		color: color-mix(in srgb, var(--gh-accent) 7%, transparent);
		font-size: 8rem;
		font-weight: 950;
		letter-spacing: -0.12em;
		pointer-events: none;
	}

	.gh-world-panel,
	.gh-panel {
		min-width: 0;
		padding: clamp(1rem, 3vw, 1.55rem);
		border: 1px solid var(--gh-line);
		border-radius: 1rem;
		background: var(--gh-surface);
		box-shadow: var(--gh-shadow);
		transition: background-color 220ms ease, border-color 220ms ease;
	}

	.gh-world-copy,
	.gh-section-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.gh-world-copy h2,
	.gh-section-heading h2 {
		margin: 0.35rem 0 0.25rem;
		color: var(--gh-ink);
		font-size: 1.25rem;
		font-weight: 850;
		letter-spacing: -0.035em;
	}

	.gh-world-copy p,
	.gh-section-heading p {
		margin: 0;
		color: var(--gh-muted);
		font-size: 0.78rem;
		line-height: 1.65;
	}

	.gh-world-current {
		flex: 0 0 auto;
		padding: 0.38rem 0.58rem;
		border: 1px solid var(--gh-line);
		border-radius: 999px;
		color: var(--gh-muted);
		font-family: var(--font-jetbrains-mono), monospace;
		font-size: 0.6rem;
		letter-spacing: 0.06em;
	}

	.gh-world-tabs {
		position: relative;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0;
		margin-top: 1.15rem;
		padding: 4px;
		overflow: hidden;
		border: 1px solid var(--gh-line);
		border-radius: 0.9rem;
		background: var(--gh-track);
		isolation: isolate;
	}

	.gh-world-indicator {
		position: absolute;
		z-index: -1;
		top: 4px;
		bottom: 4px;
		left: 4px;
		width: calc((100% - 8px) / 4);
		transform: translateX(var(--world-shift, 0%));
		border-radius: 0.65rem;
		background: var(--gh-accent);
		box-shadow: 0 4px 12px color-mix(in srgb, var(--gh-accent) 24%, transparent);
		transition: transform 420ms cubic-bezier(0.22, 1, 0.36, 1), border-radius 220ms ease;
	}

	.gh-world-tabs button {
		position: relative;
		z-index: 1;
		display: flex;
		min-width: 0;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.1rem;
		padding: 0.62rem 0.2rem;
		border: 0;
		border-radius: 0.65rem;
		background: transparent;
		color: var(--gh-muted);
		cursor: pointer;
		transition: color 180ms ease, transform 180ms ease;
	}

	.gh-world-tabs button span {
		font-size: 0.82rem;
		font-weight: 800;
	}

	.gh-world-tabs button small {
		font-family: var(--font-jetbrains-mono), monospace;
		font-size: 0.52rem;
		letter-spacing: 0.08em;
	}

	.gh-world-tabs button.active {
		color: #fff;
	}

	.gh-world-tabs button:active {
		transform: scale(0.96);
	}

	.gh-world-description {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		margin-top: 0.8rem;
		color: var(--gh-ink-2);
		font-size: 0.7rem;
	}

	.gh-world-dot {
		width: 0.38rem;
		height: 0.38rem;
		flex: 0 0 0.38rem;
	}

	.gh-world-hint {
		margin-left: auto;
		color: var(--gh-muted);
		font-size: 0.65rem;
	}

	.gh-world-content {
		display: grid;
		gap: 1.25rem;
		min-width: 0;
	}

	.gh-stats-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.gh-stat-card {
		position: relative;
		display: flex;
		min-width: 0;
		min-height: 112px;
		flex-direction: column;
		justify-content: center;
		gap: 0.25rem;
		padding: 1rem 1.1rem;
		overflow: hidden;
		border: 1px solid var(--gh-line);
		border-radius: 0.85rem;
		background: var(--gh-surface);
		box-shadow: var(--gh-shadow);
		transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms ease, background-color 220ms ease;
	}

	.gh-stat-card:hover {
		transform: translateY(-3px);
	}

	.gh-stat-label {
		color: var(--gh-muted);
		font-size: 0.73rem;
	}

	.gh-stat-card strong {
		position: relative;
		z-index: 1;
		color: var(--gh-ink);
		font-size: clamp(1.45rem, 3vw, 2rem);
		font-weight: 850;
		letter-spacing: -0.05em;
		font-variant-numeric: tabular-nums;
	}

	.gh-stat-card small {
		position: relative;
		z-index: 1;
		color: var(--gh-muted);
		font-size: 0.6rem;
		line-height: 1.45;
	}

	.gh-stat-decoration {
		position: absolute;
		right: -0.5rem;
		bottom: -1.2rem;
		width: 3.6rem;
		height: 3.6rem;
		border: 1px solid color-mix(in srgb, var(--gh-accent) 18%, transparent);
		border-radius: 50%;
		box-shadow: 0 0 0 0.6rem color-mix(in srgb, var(--gh-accent) 4%, transparent), 0 0 0 1.2rem color-mix(in srgb, var(--gh-accent) 3%, transparent);
	}

	.gh-section-heading {
		margin-bottom: 1.1rem;
	}

	.gh-data-pill {
		flex: 0 0 auto;
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--gh-line);
		border-radius: 999px;
		color: var(--gh-muted);
		font-family: var(--font-jetbrains-mono), monospace;
		font-size: 0.57rem;
		white-space: nowrap;
	}

	.gh-activity-layout {
		display: flex;
		gap: 0.5rem;
		align-items: stretch;
		min-width: 0;
	}

	.gh-activity-labels {
		display: grid;
		grid-template-rows: repeat(7, 10px);
		gap: 4px;
		padding-top: 1px;
		color: var(--gh-muted);
		font-family: var(--font-jetbrains-mono), monospace;
		font-size: 0.52rem;
		line-height: 10px;
	}

	.gh-activity-scroll {
		min-width: 0;
		max-width: 100%;
		overflow-x: auto;
		padding: 0.2rem 0 0.5rem;
		scrollbar-width: thin;
	}

	.gh-activity-grid {
		display: flex;
		width: max-content;
		gap: 4px;
	}

	.gh-activity-week {
		display: grid;
		grid-template-rows: repeat(7, 10px);
		gap: 4px;
	}

	.gh-activity-cell {
		position: relative;
		width: 10px;
		height: 10px;
		padding: 0;
		border: 1px solid transparent;
		border-radius: 3px;
		background: color-mix(in srgb, var(--gh-muted) 15%, transparent);
		cursor: pointer;
		transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1), background-color 180ms ease, box-shadow 180ms ease;
		animation: gh-cell-in 380ms both;
		animation-delay: var(--cell-delay, 0ms);
	}

	.gh-activity-cell[data-level="1"] { background: color-mix(in srgb, var(--gh-accent) 35%, transparent); }
	.gh-activity-cell[data-level="2"] { background: color-mix(in srgb, var(--gh-accent) 62%, transparent); }
	.gh-activity-cell[data-level="3"] { background: var(--gh-accent); }
	.gh-activity-cell[data-level="unknown"] { border: 1px dashed color-mix(in srgb, var(--gh-muted) 45%, transparent); background: transparent; }

	.gh-activity-cell:hover,
	.gh-activity-cell:focus-visible,
	.gh-activity-cell[aria-pressed="true"] {
		z-index: 2;
		transform: scale(1.5);
		outline: none;
		box-shadow: 0 0 0 2px var(--gh-surface), 0 0 0 3px var(--gh-accent);
	}

	.gh-activity-bottom {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem 1rem;
		margin-top: 0.5rem;
		padding-top: 0.8rem;
		border-top: 1px solid var(--gh-line);
	}

	.gh-activity-readout {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		color: var(--gh-ink-2);
		font-size: 0.7rem;
	}

	.gh-readout-mark {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 50%;
		background: var(--gh-accent);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--gh-accent) 15%, transparent);
	}

	.gh-activity-legend {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		color: var(--gh-muted);
		font-size: 0.6rem;
	}

	.gh-activity-legend i {
		display: block;
		width: 9px;
		height: 9px;
		border-radius: 2px;
		background: color-mix(in srgb, var(--gh-muted) 15%, transparent);
	}

	.gh-activity-legend i[data-level="1"] { background: color-mix(in srgb, var(--gh-accent) 35%, transparent); }
	.gh-activity-legend i[data-level="2"] { background: color-mix(in srgb, var(--gh-accent) 62%, transparent); }
	.gh-activity-legend i[data-level="3"] { background: var(--gh-accent); }
	.gh-activity-legend i[data-level="unknown"] { border: 1px dashed var(--gh-muted); background: transparent; }

	.gh-footnote {
		margin: 0.8rem 0 0;
		color: var(--gh-muted);
		font-size: 0.65rem;
		line-height: 1.7;
	}

	.gh-repositories {
		min-width: 0;
	}

	.gh-repo-heading {
		align-items: flex-end;
		margin-bottom: 0.9rem;
	}

	.gh-inline-link {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		flex: 0 0 auto;
		color: var(--gh-accent);
		font-size: 0.72rem;
		font-weight: 800;
		text-decoration: none;
	}

	.gh-inline-link:hover { text-decoration: underline; text-underline-offset: 3px; }

	.gh-filter-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin-bottom: 0.9rem;
	}

	.gh-filter-tabs button {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.48rem 0.68rem;
		border: 1px solid var(--gh-line);
		border-radius: 999px;
		background: var(--gh-surface);
		color: var(--gh-muted);
		font-size: 0.68rem;
		cursor: pointer;
		transition: transform 180ms ease, background-color 180ms ease, color 180ms ease;
	}

	.gh-filter-tabs button span {
		display: inline-grid;
		min-width: 1.2rem;
		height: 1.2rem;
		place-items: center;
		border-radius: 999px;
		background: var(--gh-track);
		font-size: 0.58rem;
	}

	.gh-filter-tabs button.active {
		border-color: var(--gh-accent);
		background: var(--gh-accent);
		color: #fff;
	}

	.gh-filter-tabs button:active { transform: scale(0.96); }

	.gh-repo-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.9rem;
	}

	.gh-repo-card {
		position: relative;
		display: flex;
		min-width: 0;
		flex-direction: column;
		padding: 1.1rem;
		overflow: hidden;
		border: 1px solid var(--gh-line);
		border-radius: 0.95rem;
		background: var(--gh-surface);
		box-shadow: var(--gh-shadow);
		transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms ease, border-color 180ms ease;
	}

	.gh-repo-card:hover {
		transform: translateY(-4px);
		border-color: color-mix(in srgb, var(--gh-accent) 48%, var(--gh-line));
	}

	.gh-repo-topline {
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}

	.gh-repo-mark {
		display: grid;
		width: 31px;
		height: 31px;
		flex: 0 0 31px;
		place-items: center;
		border-radius: 0.6rem;
		background: color-mix(in srgb, var(--gh-accent) 12%, transparent);
		color: var(--gh-accent);
		font-size: 1.05rem;
	}

	.gh-repo-category {
		padding: 0.25rem 0.45rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--gh-accent) 10%, transparent);
		color: var(--gh-accent);
		font-size: 0.57rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.gh-repo-owner {
		margin-left: auto;
		color: var(--gh-muted);
		font-family: var(--font-jetbrains-mono), monospace;
		font-size: 0.58rem;
	}

	.gh-repo-card h3 {
		margin: 0.9rem 0 0.4rem;
		color: var(--gh-ink);
		font-size: 1.08rem;
		font-weight: 850;
		letter-spacing: -0.025em;
		overflow-wrap: anywhere;
	}

	.gh-repo-description {
		min-height: 3.25rem;
		margin: 0;
		color: var(--gh-ink-2);
		font-size: 0.75rem;
		line-height: 1.7;
	}

	.gh-tech-stack {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin: 0.9rem 0;
	}

	.gh-tech-stack span {
		padding: 0.23rem 0.42rem;
		border: 1px solid var(--gh-line);
		border-radius: 0.4rem;
		color: var(--gh-muted);
		font-size: 0.59rem;
	}

	.gh-repo-metrics {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.55rem;
		margin-top: auto;
		color: var(--gh-muted);
		font-size: 0.63rem;
	}

	.gh-language {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}

	.gh-language i {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 50%;
		background: var(--gh-accent);
	}

	.gh-repo-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem;
		margin-top: 0.9rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--gh-line);
	}

	.gh-repo-actions a {
		color: var(--gh-accent);
		font-size: 0.65rem;
		font-weight: 800;
		text-decoration: none;
	}

	.gh-repo-actions a:hover { text-decoration: underline; text-underline-offset: 3px; }

	.gh-more-repos {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.6rem;
	}

	.gh-more-repo {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 0.7rem;
		padding: 0.75rem;
		border: 1px solid var(--gh-line);
		border-radius: 0.75rem;
		color: inherit;
		text-decoration: none;
		transition: border-color 180ms ease, transform 180ms ease;
	}

	.gh-more-repo:hover {
		transform: translateY(-2px);
		border-color: var(--gh-accent);
	}

	.gh-more-icon {
		display: grid;
		width: 27px;
		height: 27px;
		flex: 0 0 27px;
		place-items: center;
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--gh-accent) 10%, transparent);
		color: var(--gh-accent);
	}

	.gh-more-main {
		display: grid;
		min-width: 0;
		flex: 1;
		gap: 0.15rem;
	}

	.gh-more-main strong {
		overflow: hidden;
		color: var(--gh-ink);
		font-size: 0.72rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.gh-more-main small {
		overflow: hidden;
		color: var(--gh-muted);
		font-size: 0.6rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.gh-more-meta {
		display: flex;
		flex: 0 0 auto;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.15rem;
		color: var(--gh-muted);
		font-size: 0.59rem;
	}

	.gh-more-meta i {
		font-style: normal;
	}

	.gh-event-list {
		display: grid;
		gap: 0.1rem;
	}

	.gh-event {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 0.7rem;
		padding: 0.65rem 0;
		border-bottom: 1px solid var(--gh-line);
		color: inherit;
		text-decoration: none;
	}

	.gh-event:last-child { border-bottom: 0; }

	.gh-event-index {
		color: var(--gh-muted);
		font-family: var(--font-jetbrains-mono), monospace;
		font-size: 0.6rem;
	}

	.gh-event-mark {
		display: grid;
		width: 27px;
		height: 27px;
		flex: 0 0 27px;
		place-items: center;
		border-radius: 50%;
		background: color-mix(in srgb, var(--gh-accent) 11%, transparent);
		color: var(--gh-accent);
	}

	.gh-event-copy {
		display: grid;
		min-width: 0;
		flex: 1;
		gap: 0.12rem;
	}

	.gh-event-copy strong {
		color: var(--gh-ink);
		font-size: 0.72rem;
	}

	.gh-event-copy small {
		overflow: hidden;
		color: var(--gh-muted);
		font-size: 0.62rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.gh-event time {
		flex: 0 0 auto;
		color: var(--gh-muted);
		font-size: 0.62rem;
	}

	.gh-empty-state {
		grid-column: 1 / -1;
		padding: 1.4rem;
		border: 1px dashed var(--gh-line);
		border-radius: 0.8rem;
		color: var(--gh-muted);
		font-size: 0.75rem;
		text-align: center;
	}

	.gh-credit {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1rem;
		padding: 0.75rem 0.15rem 0;
		color: var(--gh-muted);
		font-family: var(--font-jetbrains-mono), monospace;
		font-size: 0.56rem;
		letter-spacing: 0.04em;
	}

	.gh-credit a {
		color: var(--gh-accent);
		text-decoration: none;
	}


	/* A proportional, accessible heatmap instead of 10px cells stranded in a large panel. */
	.gh-quick-nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem 0.9rem;
		margin-top: 1.25rem;
	}
	.gh-quick-nav a {
		color: var(--gh-accent-deep);
		font-size: 0.68rem;
		font-weight: 750;
		text-decoration: none;
	}
	.gh-quick-nav a:hover { text-decoration: underline; text-underline-offset: 3px; }
	.gh-activity-kpis {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.6rem;
		margin: 0.1rem 0 1.1rem;
	}
	.gh-activity-kpis > div {
		display: flex;
		flex-direction: column;
		gap: 0.12rem;
		padding: 0.75rem 0.8rem;
		border: 1px solid var(--gh-line);
		border-radius: 0.7rem;
		background: color-mix(in srgb, var(--gh-stage) 24%, var(--gh-surface));
	}
	.gh-activity-kpis strong {
		color: var(--gh-ink);
		font-size: clamp(1rem, 2.3vw, 1.45rem);
		font-variant-numeric: tabular-nums;
	}
	.gh-activity-kpis span { color: var(--gh-muted); font-size: 0.64rem; }
	.gh-activity-layout { gap: 0.6rem; }
	.gh-activity-labels {
		flex: 0 0 1.15rem;
		grid-template-rows: repeat(7, minmax(0, 1fr));
		gap: clamp(3px, 0.6vw, 7px);
		padding-top: 1.45rem;
		padding-bottom: 0.5rem;
		font-size: 0.58rem;
		line-height: normal;
	}
	.gh-activity-labels span { display: grid; place-items: center; }
	.gh-activity-scroll {
		flex: 1 1 0;
		min-width: 0;
		padding: 0;
	}
	.gh-activity-months,
	.gh-activity-grid {
		display: grid;
		grid-template-columns: repeat(var(--activity-week-count), minmax(0, 1fr));
		gap: clamp(3px, 0.6vw, 7px);
		width: 100%;
	}
	.gh-activity-months {
		min-height: 1.15rem;
		margin-bottom: 0.3rem;
		color: var(--gh-muted);
		font-size: 0.61rem;
		font-weight: 700;
	}
	.gh-activity-months span { white-space: nowrap; }
	.gh-activity-week {
		min-width: 0;
		grid-template-rows: repeat(7, minmax(0, 1fr));
		gap: clamp(3px, 0.6vw, 7px);
	}
	.gh-activity-cell {
		width: 100%;
		height: auto;
		aspect-ratio: 1;
		min-width: 0;
		border-radius: clamp(2px, 0.45vw, 5px);
		animation: none;
	}
	.gh-activity-cell[data-level="unknown"] {
		background: color-mix(in srgb, var(--gh-muted) 4%, transparent);
		border: 1px dashed color-mix(in srgb, var(--gh-muted) 35%, transparent);
	}
	.gh-activity-cell:hover,
	.gh-activity-cell:focus-visible,
	.gh-activity-cell[aria-pressed="true"] { transform: scale(1.12); }
	.gh-activity-readout { min-height: 1.2rem; }
	.gh-activity-legend { flex-wrap: wrap; }
	.gh-insights-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
		min-width: 0;
	}
	.gh-insight-panel { min-width: 0; }
	.gh-rank-list { display: grid; gap: 0.85rem; }
	.gh-rank-item { display: grid; gap: 0.35rem; color: var(--gh-ink); text-decoration: none; }
	.gh-rank-top { display: flex; align-items: center; justify-content: space-between; gap: 0.45rem; font-size: 0.68rem; }
	.gh-rank-top span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--gh-muted); }
	.gh-rank-top strong { color: var(--gh-ink); margin-left: 0.3rem; font-weight: 800; }
	.gh-rank-top b { flex: 0 0 auto; color: var(--gh-accent); font-variant-numeric: tabular-nums; }
	.gh-rank-track { height: 0.48rem; overflow: hidden; border-radius: 999px; background: color-mix(in srgb, var(--gh-muted) 13%, transparent); }
	.gh-rank-track span { display: block; height: 100%; border-radius: inherit; background: var(--gh-accent); }
	.gh-rank-item:hover .gh-rank-track span { opacity: 0.82; }
	.gh-stack-cloud { display: flex; flex-wrap: wrap; align-content: flex-start; gap: 0.5rem; min-height: 9rem; }
	.gh-stack-cloud span { padding: 0.4rem 0.6rem; border: 1px solid var(--gh-line); border-radius: 0.55rem; color: var(--gh-ink-2); font-size: 0.7rem; background: var(--gh-surface); }
	.gh-stack-cloud span.gh-stack-primary { background: color-mix(in srgb, var(--gh-accent) 12%, var(--gh-surface)); color: var(--gh-accent-deep); }
	.gh-insight-link { display: inline-block; margin-top: 1rem; font-size: 0.72rem; font-weight: 800; color: var(--gh-accent); text-decoration: none; }
	.gh-insight-link:hover { text-decoration: underline; }
	/* Skip expensive offscreen panel layout until readers scroll there. */
	.gh-more-panel, .gh-events-panel, .gh-insight-panel { content-visibility: auto; contain-intrinsic-size: auto 460px; }
	@media (max-width: 760px) {
		.gh-insights-grid { grid-template-columns: minmax(0, 1fr); }
	}
	@media (max-width: 460px) {
		.gh-activity-kpis > div { padding: 0.55rem 0.45rem; }
		.gh-activity-kpis span { font-size: 0.57rem; }
		.gh-activity-layout { gap: 0.35rem; }
		.gh-activity-labels { flex-basis: 0.9rem; }
		.gh-activity-months, .gh-activity-grid, .gh-activity-week { gap: 3px; }
	}

	/* Ovio-inspired visual worlds: same semantic data, different material language. */
	.github-showcase-shell[data-world="craft"] .gh-world-panel,
	.github-showcase-shell[data-world="craft"] .gh-panel {
		border: 0;
		border-radius: 0.3rem;
		box-shadow: 0 2px 4px rgba(70, 45, 20, 0.12), 0 16px 30px -18px rgba(70, 45, 20, 0.35);
		background-image: linear-gradient(rgba(49, 120, 198, 0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(49, 120, 198, 0.055) 1px, transparent 1px);
		background-size: 18px 18px;
	}

	.github-showcase-shell[data-world="craft"] .gh-developer-card,
	.github-showcase-shell[data-world="craft"] .gh-repo-card {
		border: 0;
		border-radius: 0.35rem;
		box-shadow: 0 2px 4px rgba(70, 45, 20, 0.12), 0 14px 24px -12px rgba(70, 45, 20, 0.38);
	}

	.github-showcase-shell[data-world="craft"] .gh-developer-card::before,
	.github-showcase-shell[data-world="craft"] .gh-repo-card::before {
		position: absolute;
		top: -1px;
		left: 28%;
		width: 72px;
		height: 17px;
		background: rgba(231, 194, 115, 0.7);
		content: "";
		transform: rotate(-3deg);
	}

	.github-showcase-shell[data-world="craft"] .gh-repo-card {
		transform: rotate(-0.35deg);
	}

	.github-showcase-shell[data-world="craft"] .gh-repo-card:nth-child(even) {
		transform: rotate(0.45deg);
	}

	.github-showcase-shell[data-world="craft"] .gh-repo-card:hover {
		transform: translateY(-5px) rotate(0deg);
	}

	.github-showcase-shell[data-world="craft"] .gh-activity-cell[data-level="1"],
	.github-showcase-shell[data-world="craft"] .gh-activity-cell[data-level="2"],
	.github-showcase-shell[data-world="craft"] .gh-activity-cell[data-level="3"] {
		border-radius: 2px;
		transform: rotate(var(--cell-tilt, 0deg));
		box-shadow: 0 2px 4px rgba(90, 50, 20, 0.22);
	}
	.github-showcase-shell[data-world="craft"] .gh-activity-cell:hover,
	.github-showcase-shell[data-world="craft"] .gh-activity-cell:focus-visible,
	.github-showcase-shell[data-world="craft"] .gh-activity-cell[aria-pressed="true"] {
		transform: scale(1.5) rotate(0deg);
	}

	.github-showcase-shell[data-world="craft"] .gh-tech-stack span {
		border: 0;
		border-radius: 2px;
		background: #f3e4c8;
		color: #70593e;
		box-shadow: 0 1px 2px rgba(70, 45, 20, 0.14);
	}

	.github-showcase-shell[data-world="retro"] .gh-hero,
	.github-showcase-shell[data-world="retro"] .gh-world-panel,
	.github-showcase-shell[data-world="retro"] .gh-panel,
	.github-showcase-shell[data-world="retro"] .gh-stat-card,
	.github-showcase-shell[data-world="retro"] .gh-developer-card,
	.github-showcase-shell[data-world="retro"] .gh-repo-card {
		border: 2px solid var(--gh-accent);
		border-radius: 0;
		box-shadow: inset 0 0 18px rgba(54, 255, 104, 0.035), 0 0 18px rgba(54, 255, 104, 0.06);
		font-family: var(--font-jetbrains-mono), monospace;
	}

	.github-showcase-shell[data-world="retro"] .gh-hero {
		background: radial-gradient(ellipse at 50% 40%, #0d2814 0%, #061108 70%, #030803 100%);
	}

	.github-showcase-shell[data-world="retro"] .gh-hero h1,
	.github-showcase-shell[data-world="retro"] .gh-section-heading h2,
	.github-showcase-shell[data-world="retro"] .gh-world-copy h2 {
		color: #c9ffd2;
		text-shadow: 0 0 9px rgba(90, 255, 120, 0.3);
	}

	.github-showcase-shell[data-world="retro"] .gh-activity-cell {
		border-radius: 0;
		box-shadow: 0 0 5px color-mix(in srgb, var(--gh-accent) 20%, transparent);
	}

	.github-showcase-shell[data-world="retro"] .gh-activity-cell[data-level="1"] { background: #1d5a2b; }
	.github-showcase-shell[data-world="retro"] .gh-activity-cell[data-level="2"] { background: #2f9a45; }
	.github-showcase-shell[data-world="retro"] .gh-activity-cell[data-level="3"] { background: #4fdc68; box-shadow: 0 0 8px rgba(80, 255, 120, 0.65); }
	.github-showcase-shell[data-world="retro"] .gh-repo-topline::before {
		content: "REPO.EXE";
		margin-right: auto;
		color: var(--gh-accent);
		font-size: 0.58rem;
		letter-spacing: 0.1em;
	}
	.github-showcase-shell[data-world="retro"] .gh-repo-mark,
	.github-showcase-shell[data-world="retro"] .gh-repo-owner {
		display: none;
	}
	.github-showcase-shell[data-world="retro"] .gh-repo-card h3 {
		color: #c9ffd2;
		font-weight: 500;
		text-transform: uppercase;
	}
	.github-showcase-shell[data-world="retro"] .gh-repo-card h3::before { content: "> "; color: var(--gh-accent); }
	.github-showcase-shell[data-world="retro"] .gh-repo-actions a { color: #b7ffc2; }
	.github-showcase-shell[data-world="retro"] .gh-world-tabs {
		border: 2px double var(--gh-accent);
		border-radius: 0;
		background: #061108;
	}
	.github-showcase-shell[data-world="retro"] .gh-world-indicator {
		border-radius: 0;
		box-shadow: 0 0 12px rgba(80, 255, 120, 0.3);
	}
	.github-showcase-shell[data-world="retro"] .gh-world-tabs button {
		font-family: var(--font-jetbrains-mono), monospace;
		text-transform: uppercase;
	}
	.github-showcase-shell[data-world="retro"] .gh-world-tabs button small { font-size: 0.48rem; }
	.github-showcase-shell[data-world="retro"] .gh-world-tabs button.active { color: #061108; }
	.github-showcase-shell[data-world="retro"] .gh-id-status { color: #b7ffc2; }

	.github-showcase-shell[data-world="toy"] .gh-hero,
	.github-showcase-shell[data-world="toy"] .gh-world-panel,
	.github-showcase-shell[data-world="toy"] .gh-panel,
	.github-showcase-shell[data-world="toy"] .gh-stat-card,
	.github-showcase-shell[data-world="toy"] .gh-developer-card,
	.github-showcase-shell[data-world="toy"] .gh-repo-card {
		border: 0;
		border-radius: 1.15rem;
		box-shadow: var(--gh-shadow);
	}

	.github-showcase-shell[data-world="toy"] .gh-world-tabs {
		border: 0;
		border-radius: 1.1rem;
		box-shadow: inset 0 3px 7px rgba(40, 28, 10, 0.25), 0 1px 0 #fff;
	}

	.github-showcase-shell[data-world="toy"] .gh-world-indicator {
		top: 5px;
		bottom: 5px;
		border-radius: 0.85rem;
		box-shadow: 0 5px 0 var(--gh-accent-deep), 0 10px 14px -6px rgba(40, 28, 10, 0.45), inset 0 2px 0 rgba(255, 255, 255, 0.28);
	}

	.github-showcase-shell[data-world="toy"] .gh-world-tabs button.active {
		transform: translateY(-1px);
	}

	.github-showcase-shell[data-world="toy"] .gh-developer-card,
	.github-showcase-shell[data-world="toy"] .gh-repo-card,
	.github-showcase-shell[data-world="toy"] .gh-stat-card {
		box-shadow: inset 0 1px 0 #fff, 0 7px 0 #d0c8b8, 0 20px 26px -16px rgba(44, 31, 15, 0.42);
	}

	.github-showcase-shell[data-world="toy"] .gh-id-main {
		padding: 0.75rem;
		border-radius: 0.85rem;
		background: var(--gh-accent);
		color: #fff;
		box-shadow: inset 0 -4px 0 rgba(0, 0, 0, 0.16), inset 0 2px 0 rgba(255, 255, 255, 0.2);
	}

	.github-showcase-shell[data-world="toy"] .gh-id-name h2,
	.github-showcase-shell[data-world="toy"] .gh-id-name span {
		color: #fff;
	}

	.github-showcase-shell[data-world="toy"] .gh-avatar {
		border: 0;
		box-shadow: 0 5px 0 #b8a77e, 0 10px 12px -5px rgba(0, 0, 0, 0.3);
	}

	.github-showcase-shell[data-world="toy"] .gh-tech-stack span {
		border: 0;
		border-radius: 0.55rem;
		background: #f2d36b;
		color: #514225;
		box-shadow: 0 4px 0 #c49d35;
		font-weight: 800;
	}

	.github-showcase-shell[data-world="toy"] .gh-activity-cell {
		border-radius: 50%;
		box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.12);
	}

	.github-showcase-shell[data-world="toy"] .gh-activity-cell[data-level="1"] { background: #f4b52a; box-shadow: 0 2px 0 #b47e17; }
	.github-showcase-shell[data-world="toy"] .gh-activity-cell[data-level="2"] { background: #ef7a2b; box-shadow: 0 3px 0 #ae5016; }
	.github-showcase-shell[data-world="toy"] .gh-activity-cell[data-level="3"] { background: #ef4f2b; box-shadow: 0 3px 0 #ad2f17; }
	.github-showcase-shell[data-world="toy"] .gh-repo-card h3 {
		display: inline-block;
		align-self: flex-start;
		padding: 0.5rem 0.65rem;
		border-radius: 0.6rem;
		background: var(--gh-accent);
		color: #fff;
		box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.18);
	}

	.github-showcase-shell[data-world="toy"] .gh-repo-mark {
		border-radius: 0.55rem;
		background: #f2d36b;
		color: #514225;
		box-shadow: 0 3px 0 #c49d35;
	}

	.github-showcase-shell[data-world="toy"] .gh-repo-actions a {
		display: inline-flex;
		align-items: center;
		padding: 0.38rem 0.52rem;
		border-radius: 0.5rem;
		background: #f2d36b;
		color: #514225;
		box-shadow: 0 3px 0 #c49d35;
	}

	.github-showcase-shell[data-world="toy"] .gh-repo-actions a:active {
		transform: translateY(2px);
		box-shadow: 0 1px 0 #c49d35;
	}

	@keyframes gh-cell-in {
		from { opacity: 0; transform: translateY(4px) scale(0.86); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	@media (max-width: 760px) {
		.gh-hero { grid-template-columns: minmax(0, 1fr); }
		.gh-stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
		.gh-repo-grid,
		.gh-more-repos { grid-template-columns: minmax(0, 1fr); }
		.gh-repo-description { min-height: 0; }
		.gh-hero { gap: 1.2rem; }
	}

	@media (max-width: 460px) {
		.gh-world-copy { align-items: flex-start; flex-direction: column; gap: 0.55rem; }
		.gh-world-tabs button { padding: 0.55rem 0.08rem; }
		.gh-world-tabs button span { font-size: 0.74rem; }
		.gh-world-tabs button small { font-size: 0.44rem; }
		.gh-world-description { flex-wrap: wrap; }
		.gh-world-hint { margin-left: 0; }
		.gh-section-heading { flex-direction: column; }
		.gh-data-pill { align-self: flex-start; }
		.gh-repo-heading { align-items: flex-start; }
		.gh-more-repo { flex-wrap: wrap; }
		.gh-more-meta { flex-direction: row; align-items: center; margin-left: auto; }
		.gh-credit { flex-direction: column; align-items: flex-start; }
	}

	@media (prefers-reduced-motion: reduce) {
		.github-showcase-shell *,
		.github-showcase-shell *::before,
		.github-showcase-shell *::after {
			animation-duration: 0.01ms !important;
			animation-iteration-count: 1 !important;
			animation-delay: 0ms !important;
			scroll-behavior: auto !important;
			transition-duration: 0.01ms !important;
		}
	}
</style>
