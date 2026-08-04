import type { SiteConfig } from "../types/config";

const SITE_LANG = "zh_CN";

export const siteConfig: SiteConfig = {
	title: "Katelya · 思囿随笔",
	subtitle: "个人数字花园、项目实验室与成长档案",
	siteURL: "https://blog.katelya.top/",
	siteStartDate: "2026-05-23",

	lang: SITE_LANG,

	themeColor: {
		hue: 188,
		fixed: false,
	},

	featurePages: {
		anime: false,
		diary: false,
		friends: false,
		projects: true,
		skills: false,
		timeline: true,
		albums: false,
		devices: false,
		aiTools: false,
	},

	navbarTitle: {
		mode: "text-icon",
		text: "Katelya · 思囿随笔",
		icon: "assets/brand/katelya-k.svg",
		logo: "assets/brand/katelya-k.svg",
	},

	pageScaling: {
		enable: true,
		targetWidth: 2000,
	},

	bangumi: {
		userId: "your-bangumi-id",
		fetchOnDev: false,
	},

	bilibili: {
		vmid: "your-bilibili-vmid",
		fetchOnDev: false,
		coverMirror: "",
		useWebp: true,
	},

	anime: {
		mode: "local",
	},

	diaryApiUrl: "",

	postListLayout: {
		defaultMode: "list",
		enable: true,
		allowSwitch: true,
		categoryBar: {
			enable: true,
		},
	},

	tagStyle: {
		useNewStyle: true,
	},

	wallpaperMode: {
		defaultMode: "banner",
		showModeSwitchOnMobile: "desktop",
	},

	banner: {
		src: {
			desktop: ["/assets/art/katelya-impression.svg"],
			mobile: ["/assets/art/katelya-impression.svg"],
		},

		position: "center",

		carousel: {
			enable: false,
			interval: 8,
			switchable: false,
		},

		waves: {
			enable: true,
			performanceMode: true,
			mobileDisable: false,
			switchable: true,
		},

		imageApi: {
			enable: false,
			url: "",
		},

		homeText: {
			enable: true,
			title: "Katelya · 思囿随笔",
			switchable: true,

			subtitle: [
				"在代码、生活与热爱之间，记录自己的成长轨迹。",
				"把折腾写成经验，把经历留作答案。",
				"关于技术、大学生活、开源项目与仍在生长的自己。",
			],
			typewriter: {
				enable: true,
				speed: 82,
				deleteSpeed: 42,
				pauseTime: 2600,
			},
		},

		credit: {
			enable: true,
			text: "原创程序化画境 · Katelya",
			url: "/about/",
		},

		navbar: {
			transparentMode: "semifull",
		},
	},

	toc: {
		enable: true,
		mobileTop: true,
		desktopSidebar: true,
		floating: true,
		depth: 3,
		useJapaneseBadge: false,
	},
	showCoverInContent: true,
	generateOgImages: false,
	favicon: [
		{
			src: "/assets/brand/katelya-k.svg",
			sizes: "any",
		},
	],

	showLastModified: true,
	pageProgressBar: {
		enable: true,
		height: 3,
		duration: 6000,
	},

	thirdPartyAnalytics: {
		enable: false,
		clarityId: "",
	},
	card: {
		border: true,
		followTheme: false,
	},
	imageOptimization: {
		formats: "webp",
		quality: 85,
		noReferrerDomains: ["*.hdslb.com"],
	},
};

export { SITE_LANG };
