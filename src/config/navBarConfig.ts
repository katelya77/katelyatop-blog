import type { NavBarConfig } from "../types/config";
import { LinkPreset } from "../types/config";

export const navBarConfig: NavBarConfig = {
	links: [
		LinkPreset.Home,
		LinkPreset.Archive,
		{
			name: "项目",
			url: "/projects/",
			icon: "material-symbols:deployed-code-outline",
		},
		{
			name: "时间线",
			url: "/timeline/",
			icon: "material-symbols:timeline-rounded",
		},
		{
			name: "关于",
			url: "/about/",
			icon: "material-symbols:person-outline-rounded",
		},
		{
			name: "更多",
			url: "#",
			icon: "material-symbols:more-horiz",
			children: [
				{
					name: "新生指南",
					url: "/fosu/2026-freshman-guide/",
					icon: "material-symbols:school-outline-rounded",
				},
				{
					name: "RSS 订阅",
					url: "/rss.xml",
					external: true,
					icon: "material-symbols:rss-feed-rounded",
				},
				{
					name: "站点地图",
					url: "/sitemap-index.xml",
					external: true,
					icon: "material-symbols:map-outline-rounded",
				},
				{
					name: "GitHub",
					url: "https://github.com/katelya77",
					external: true,
					icon: "fa7-brands:github",
				},
			],
		},
	],
};
