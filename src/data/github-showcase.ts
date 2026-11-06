export type GitHubProjectCategory = "web" | "tools" | "desktop";

export interface FeaturedGitHubRepository {
	name: string;
	title: string;
	description: string;
	category: GitHubProjectCategory;
	techStack: string[];
	homepage?: string;
}

export const githubProfile = {
	username: "katelya77",
	displayName: "Katelya",
	avatar: "https://avatars.githubusercontent.com/u/123220557?v=4",
	url: "https://github.com/katelya77",
	bio: "在代码、产品与日常之间持续探索。这里收录公开项目、工程实践与开源作品。",
	tagline: "Build in public · Keep learning · Make things useful",
};

export const featuredGitHubRepositories: FeaturedGitHubRepository[] = [
	{
		name: "katelyatop-blog",
		title: "Katelya · 思囿随笔",
		description:
			"个人数字花园与技术档案。基于 Astro 持续演进，记录项目实践、技术研究与值得长期保存的经验。",
		category: "web",
		techStack: ["Astro", "TypeScript", "Svelte", "Cloudflare Pages"],
		homepage: "https://blog.katelya.top/",
	},
	{
		name: "K-Vault",
		title: "K-Vault",
		description:
			"面向个人文件管理的 Serverless 云存储项目，探索多存储后端整合、资源管理与轻量化部署。",
		category: "tools",
		techStack: ["Cloudflare Pages", "Docker", "R2", "S3"],
		homepage: "https://pan.katelya.eu.org/",
	},
	{
		name: "KatelyaTV",
		title: "KatelyaTV",
		description:
			"面向个人影音体验的前端项目，持续探索内容检索、界面设计、跨端适配与播放体验。",
		category: "web",
		techStack: ["Next.js", "TypeScript", "Tailwind CSS"],
		homepage: "https://tv.katelya.top/",
	},
	{
		name: "DecoTV",
		title: "DecoTV",
		description:
			"跨平台影视聚合播放器，关注多资源检索、播放体验、收藏同步与自托管部署。",
		category: "web",
		techStack: ["Node.js", "Express", "Docker"],
	},
	{
		name: "NebulaTree_Desktop",
		title: "NebulaTree Desktop",
		description:
			"Windows 桌面端交互实验，将 Three.js 3D 粒子视觉与 MediaPipe 手势识别结合。",
		category: "desktop",
		techStack: ["Electron", "Three.js", "WebGL", "MediaPipe"],
	},
];

export const githubProjectCategories = [
	{ value: "all", label: "全部项目", icon: "material-symbols:grid-view-rounded" },
	{ value: "web", label: "Web", icon: "material-symbols:language-rounded" },
	{ value: "tools", label: "工具与服务", icon: "material-symbols:deployed-code-rounded" },
	{ value: "desktop", label: "桌面应用", icon: "material-symbols:desktop-windows-rounded" },
] as const;
