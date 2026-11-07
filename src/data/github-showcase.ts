export type GitHubProjectCategory = "web" | "tools" | "desktop";

export interface FeaturedGitHubRepository {
	name: string;
	owner?: string;
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
			"图片与文件托管解决方案，支持 Cloudflare Pages 与 Docker 双模部署，并整合 R2、S3、WebDAV、GitHub 等存储后端。",
		category: "tools",
		techStack: ["Cloudflare Pages", "Docker", "R2", "S3"],
		homepage: "https://pan.katelya.eu.org/",
	},
	{
		name: "KatelyaTV",
		title: "KatelyaTV",
		description:
			"基于 Next.js 14 的自托管影视聚合播放器，支持多源搜索、高清播放、播放记录、收藏同步、PWA 与多种数据存储后端。",
		category: "web",
		techStack: ["Next.js 14", "React", "TypeScript", "Framer Motion"],
		homepage: "https://tv.katelya.top/",
	},
	{
		name: "DecoTV",
		owner: "Decohererk",
		title: "DecoTV",
		description:
			"Decohererk 组织维护的开源影视聚合平台，基于 LibreTV 二次开发，持续改进跨端播放、界面和部署体验。",
		category: "web",
		techStack: ["Node.js", "Express", "Docker", "LibreTV"],
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
