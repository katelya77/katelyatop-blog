import type { FullscreenWallpaperConfig } from "../types/config";

const DAY_ART = "/assets/art/katelya-van-gogh-day.svg";
const NIGHT_ART = "/assets/art/katelya-van-gogh-night.svg";

export const fullscreenWallpaperConfig: FullscreenWallpaperConfig = {
	enable: true,
	src: {
		desktop: [DAY_ART, NIGHT_ART],
		mobile: [DAY_ART, NIGHT_ART],
	},
	position: "center",
	carousel: {
		enable: false,
		interval: 8,
	},
	zIndex: -1,
	opacity: 0.88,
	blur: 0,
	switchable: true,
	overlay: {
		opacity: 0.88,
		blur: 0.5,
		cardOpacity: 0.84,
		switchable: {
			opacity: true,
			blur: true,
			cardOpacity: true,
		},
	},
	fullscreen: {
		switchable: {
			opacity: true,
			blur: true,
		},
	},
};
