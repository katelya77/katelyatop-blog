import type { TimelineItem } from "../components/features/timeline/types";

export const timelineData: TimelineItem[] = [
	{
		id: "impressionist-digital-garden",
		title: "思囿随笔完成印象画境二创",
		description:
			"将个人博客升级为蓝绿色印象画境，以原创程序化 SVG、矿物金微光和轻量 CSS 3D 环绕重新塑造首页体验。",
		type: "project",
		startDate: "2026-08-04",
		skills: ["Astro", "TypeScript", "CSS 3D", "SVG", "Cloudflare Pages"],
		achievements: [
			"完成原创视觉系统与 Katelya 品牌标识",
			"保留静态部署、暗色主题与移动端降级能力",
			"建立设计文档、回归测试与 PR 验证流程",
		],
		links: [
			{
				name: "访问博客",
				url: "https://blog.katelya.top/",
				type: "website",
			},
		],
		icon: "material-symbols:palette-outline-rounded",
		color: "#6D5AA7",
		featured: true,
	},
	{
		id: "katelya-space-online",
		title: "Katelya Space 正式上线",
		description:
			"建立长期个人记录空间，用于沉淀技术折腾、项目实践、大学生活与日常思考。",
		type: "achievement",
		startDate: "2026-05-23",
		skills: ["Astro", "Markdown", "Cloudflare Pages", "SEO"],
		achievements: [
			"完成个人域名与静态站点部署",
			"确定「思囿随笔」的长期内容方向",
		],
		links: [
			{
				name: "建站记录",
				url: "/posts/katelya-space-online/",
				type: "other",
			},
		],
		icon: "material-symbols:edit-square-outline-rounded",
		color: "#2F706D",
		featured: true,
	},
	{
		id: "k-vault-project",
		title: "K-Vault 持续演进",
		description:
			"把最初的图床方向扩展为基于 Cloudflare 的 Serverless 聚合云盘，探索多存储后端和零成本个人数据管理。",
		type: "project",
		startDate: "2026-02-01",
		skills: ["Cloudflare Workers", "R2", "Telegram", "S3"],
		achievements: [
			"支持 Telegram、R2 与 S3 兼容存储",
			"沉淀自定义域名、部署和安全配置经验",
		],
		links: [
			{
				name: "GitHub 仓库",
				url: "https://github.com/katelya77/K-Vault",
				type: "project",
			},
		],
		icon: "material-symbols:cloud-outline-rounded",
		color: "#537E8D",
		featured: true,
	},
	{
		id: "katelyatv-project",
		title: "开始构建 KatelyaTV",
		description:
			"围绕个人影音体验开展前端二创，持续练习界面设计、聚合检索、跨端适配与部署优化。",
		type: "project",
		startDate: "2025-01-01",
		skills: ["Next.js", "TypeScript", "Tailwind CSS", "Docker"],
		achievements: [
			"完成可部署的个人影音站实践",
			"积累从开源项目二创到持续维护的经验",
		],
		links: [
			{
				name: "GitHub 仓库",
				url: "https://github.com/katelya77/KatelyaTV",
				type: "project",
			},
		],
		icon: "material-symbols:movie-outline-rounded",
		color: "#C8A765",
	},
	{
		id: "university-growth",
		title: "进入大学，开始新的成长阶段",
		description:
			"在专业学习之外继续探索技术、开源项目、运动与校园实践，并尝试用长期记录把零散经历连接起来。",
		type: "education",
		startDate: "2025-09-01",
		skills: ["自主学习", "项目实践", "团队协作", "长期记录"],
		achievements: [
			"持续参与项目开发与校园实践",
			"建立个人知识与作品沉淀方式",
		],
		icon: "material-symbols:school-outline-rounded",
		color: "#4F817C",
	},
];
