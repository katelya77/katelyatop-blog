export interface Project {
	id: string;
	title: string;
	description: string;
	image: string;
	category: "web" | "mobile" | "desktop" | "other";
	techStack: string[];
	status: "completed" | "in-progress" | "planned";
	liveDemo?: string;
	sourceCode?: string;
	visitUrl?: string;
	startDate: string;
	endDate?: string;
	featured?: boolean;
	tags?: string[];
	showImage?: boolean;
}

export const projectsData: Project[] = [
	{
		id: "katelya-digital-garden",
		title: "Katelya · 思囿随笔",
		description:
			"我的个人数字花园与成长档案。基于 Astro 和 Mizuki 持续二创，用来记录技术折腾、大学生活、项目实践与日常思考。",
		image: "",
		category: "web",
		techStack: ["Astro", "TypeScript", "Tailwind CSS", "Cloudflare Pages"],
		status: "in-progress",
		visitUrl: "https://blog.katelya.top/",
		startDate: "2026-05-23",
		featured: true,
		tags: ["Digital Garden", "Blog", "Astro"],
		showImage: false,
	},
	{
		id: "decotv",
		title: "DecoTV",
		description:
			"开箱即用的跨平台影视聚合播放器，支持多资源搜索、在线播放、收藏同步、播放记录与自托管部署。",
		image: "",
		category: "web",
		techStack: ["Next.js", "TypeScript", "Tailwind CSS", "Docker"],
		status: "in-progress",
		sourceCode: "https://github.com/Decohererk/DecoTV",
		visitUrl: "https://decotv.katelya.eu.org/",
		startDate: "2025-01-01",
		featured: true,
		tags: ["Self-hosted", "Streaming", "Docker"],
		showImage: false,
	},
	{
		id: "katelyatv",
		title: "KatelyaTV",
		description:
			"面向个人影音体验的前端二创项目，用于探索聚合检索、界面设计、跨端适配与部署优化。",
		image: "",
		category: "web",
		techStack: ["Next.js", "TypeScript", "Tailwind CSS", "Cloudflare"],
		status: "completed",
		sourceCode: "https://github.com/katelya77/KatelyaTV",
		visitUrl: "https://tv.katelya.eu.org/",
		startDate: "2025-01-01",
		featured: true,
		tags: ["Frontend", "Streaming", "Archive"],
		showImage: false,
	},
	{
		id: "k-vault",
		title: "K-Vault",
		description:
			"基于 Cloudflare 的零成本 Serverless 聚合云盘，支持 Telegram、R2、S3 兼容存储等多种后端与自定义域名。",
		image: "",
		category: "web",
		techStack: ["Cloudflare Pages", "Workers", "Telegram", "R2"],
		status: "in-progress",
		sourceCode: "https://github.com/katelya77/K-Vault",
		visitUrl: "https://pan.katelya.eu.org/",
		startDate: "2026-02-01",
		featured: true,
		tags: ["Cloud Storage", "Serverless", "Open Source"],
		showImage: false,
	},
];

export const getProjectStats = () => {
	const total = projectsData.length;
	const completed = projectsData.filter((p) => p.status === "completed").length;
	const inProgress = projectsData.filter(
		(p) => p.status === "in-progress",
	).length;
	const planned = projectsData.filter((p) => p.status === "planned").length;

	return {
		total,
		byStatus: {
			completed,
			inProgress,
			planned,
		},
	};
};

export const getProjectsByCategory = (category?: string) => {
	if (!category || category === "all") {
		return projectsData;
	}
	return projectsData.filter((p) => p.category === category);
};

export const getFeaturedProjects = () => {
	return projectsData.filter((p) => p.featured);
};

export const getAllTechStack = () => {
	const techSet = new Set<string>();
	projectsData.forEach((project) => {
		project.techStack.forEach((tech) => {
			techSet.add(tech);
		});
	});
	return Array.from(techSet).sort();
};
