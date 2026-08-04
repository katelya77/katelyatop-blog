import type { SiteConfig } from "../types/config";

const SITE_LANG = "zh_CN";
const DAY_ART = "/assets/art/katelya-van-gogh-day.svg";
// Dark theme counterpart is selected by the gallery CSS layer.
const NIGHT_ART = "/assets/art/katelya-van-gogh-night.svg";
const BRAND_SEAL = "assets/brand/katelya-starry-cypress-seal.svg";

export const siteConfig: SiteConfig = {
	title: "Katelya · 思囿随笔",
	subtitle: "个人数字花园、项目实验室与成长档案",
	siteURL: "https://blog.katelya.top/",
	siteStartDate: "2026-05-23",

	lang: SITE_LANG,

	themeColor: {
		hue: 188,
		fixed: true,
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
		icon: BRAND_SEAL,
		logo: BRAND_SEAL,
	},

	pageScaling: {
		enable: false,
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
			desktop: [DAY_ART],
			mobile: [DAY_ART],
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
			text: "原创昼夜画境 · Katelya",
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
			src: `/${BRAND_SEAL}`,
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

void NIGHT_ART;
export { SITE_LANG };
