import type { ProfileConfig } from "../types/config";

export const profileConfig: ProfileConfig = {
	avatar:
		"https://gravatar.com/avatar/f87ae790fde7864d396abc7e06fdbf563ae3b993821c9b2164395741770e6e05?size=256&d=initials",
	name: "Katelya",
	bio: "你好，我是 Katelya。这里记录技术折腾、大学生活、项目实践，以及仍在生长的日常片段。",
	typewriter: {
		enable: true,
		speed: 76,
	},
	links: [
		{
			name: "GitHub",
			icon: "fa7-brands:github",
			url: "https://github.com/katelya77",
		},
		{
			name: "Telegram",
			icon: "fa7-brands:telegram",
			url: "https://t.me/katelya77",
		},
		{
			name: "X / Twitter",
			icon: "fa7-brands:x-twitter",
			url: "https://x.com/katelya77",
		},
		{
			name: "Email",
			icon: "mdi:email",
			url: "mailto:katelya77@gmail.com",
		},
	],
};
