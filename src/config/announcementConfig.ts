import type { AnnouncementConfig } from "../types/config";

export const announcementConfig: AnnouncementConfig = {
	title: "",
	content:
		"欢迎来到 Katelya · 思囿随笔。这里收藏技术折腾、项目实践与生活里值得留下的微光。",
	closable: true,
	link: {
		enable: true,
		text: "关于本站",
		url: "/about/",
		external: false,
	},
};
