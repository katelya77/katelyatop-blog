import type { Song } from "./types";

export const STORAGE_KEY_VOLUME = "music-player-volume";

export const DEFAULT_VOLUME = 0.7;

const SHARED_PLAYLIST_COVER =
	"assets/music/cover/katelya-starry-playlist.svg";

export const LOCAL_PLAYLIST: Song[] = [
	{
		id: 1,
		title: "我知道",
		artist: "By2",
		cover: SHARED_PLAYLIST_COVER,
		url: "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBmWnkdRKm9F0wcm2xAk_unmpV_2NrAAI0IAACpSIgV8ByeA0mOfmjOwQ.mp3",
		duration: 0,
	},
	{
		id: 2,
		title: "是我不够好",
		artist: "茉莉,DJ小小智",
		cover: SHARED_PLAYLIST_COVER,
		url: "https://pan.katelya.eu.org/file/CQACAgUAAyEFAATamr0MAAIBeGmkQZyoZbX5TtaNF5qt3VGROj1_AAK8HgACecYRVUyGO-zi6ZI8OgQ.flac",
		duration: 0,
	},
	{
		id: 3,
		title: "Duvet",
		artist: "Bôa",
		cover: SHARED_PLAYLIST_COVER,
		url: "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBF2mcQS--9DbxiBr2jyD46jQAAfHFjAACph0AApvD6VSA5XBDrsLK3DoE.mp3",
		duration: 0,
	},
	{
		id: 4,
		title: "孤身 (DJ版)",
		artist: "万能公式",
		cover: SHARED_PLAYLIST_COVER,
		url: "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBFWmcOI605IrhHI00enPd-x_Vx6yWAAJ4HQACm8PpVL5vQ27au3uvOgQ.mp3",
		duration: 0,
	},
	{
		id: 5,
		title: "当你",
		artist: "林俊杰",
		cover: SHARED_PLAYLIST_COVER,
		url: "https://pan.katelya.eu.org/file/hf:hf_1771839099753_mi5vcl.mp3",
		duration: 0,
	},
	{
		id: 6,
		title: "夜的第七章",
		artist: "周杰伦、潘儿",
		cover: SHARED_PLAYLIST_COVER,
		url: "https://pan.katelya.eu.org/file/discord:discord_1771836544534_vzlzem.mp3",
		duration: 0,
	},
	{
		id: 7,
		title: "天后",
		artist: "陈势安",
		cover: SHARED_PLAYLIST_COVER,
		url: "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBDmmImN8jr1VXUM1LuC8HIvW_-ch2AAKIIAACtytAVOEHCdWX4DblOgQ.mp3",
		duration: 0,
	},
	{
		id: 8,
		title: "听妈妈的话",
		artist: "周杰伦",
		cover: SHARED_PLAYLIST_COVER,
		url: "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBDWmImN6EPnahAr1bSnAkOf6_M7qdAAKHIAACtytAVMc7YM45rTVBOgQ.mp3",
		duration: 0,
	},
	{
		id: 9,
		title: "天外来物",
		artist: "薛之谦",
		cover: SHARED_PLAYLIST_COVER,
		url: "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBDGmImN4ODJUOh2BFZXaHqYi57TFUAAKGIAACtytAVJc9Jpzr5Z-IOgQ.mp3",
		duration: 0,
	},
	{
		id: 10,
		title: "情非得已",
		artist: "庾澄庆",
		cover: SHARED_PLAYLIST_COVER,
		url: "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBCmmIlUEaTs_kyR-Nn05V5fH9oGXgAAJzIAACtytAVEMus77Mza1POgQ.mp3",
		duration: 0,
	},
	{
		id: 11,
		title: "青花瓷",
		artist: "周杰伦",
		cover: SHARED_PLAYLIST_COVER,
		url: "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBCWmIlT991q_u6ZIPS7t-xxV9N_lwAAJyIAACtytAVG9gatkK_WWgOgQ.mp3",
		duration: 0,
	},
	{
		id: 12,
		title: "悄悄做个梦给你 (DJ旋律)",
		artist: "像冷冰",
		cover: SHARED_PLAYLIST_COVER,
		url: "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBCGmIlTdxmMQWhBpZMHsoDSg7TUxiAAJxIAACtytAVHuoH7_F-z0dOgQ.mp3",
		duration: 0,
	},
	{
		id: 13,
		title: "体面",
		artist: "于文文",
		cover: SHARED_PLAYLIST_COVER,
		url: "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBB2mIlNrtjORpGqRBMYXkoj4YZnJUAAJvIAACtytAVIMZrmYC1xJWOgQ.mp3",
		duration: 0,
	},
	{
		id: 14,
		title: "天黑黑",
		artist: "孙燕姿",
		cover: SHARED_PLAYLIST_COVER,
		url: "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBBmmIlNnLXGb9sbpZ4tSNhcMEyo4fAAJuIAACtytAVL8_dOvLQijJOgQ.mp3",
		duration: 0,
	},
	{
		id: 15,
		title: "特别的人",
		artist: "方大同",
		cover: SHARED_PLAYLIST_COVER,
		url: "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBBWmIlKIHWS3jF5TaPhdE3iHcre2HAAJtIAACtytAVAPa9H5GUHqJOgQ.mp3",
		duration: 0,
	},
	{
		id: 16,
		title: "说了再见",
		artist: "周杰伦",
		cover: SHARED_PLAYLIST_COVER,
		url: "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBBGmIlJsl_k1bH90ZlIyJzubVfvJ0AAJsIAACtytAVIZ2v7we036IOgQ.mp3",
		duration: 0,
	},
	{
		id: 17,
		title: "算什么男人",
		artist: "周杰伦",
		cover: SHARED_PLAYLIST_COVER,
		url: "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBA2mIlJg7QJLm8_n7wbyyi8Sa7f1NAAJrIAACtytAVG0SCioo-9pmOgQ.mp3",
		duration: 0,
	},
	{
		id: 18,
		title: "淘汰",
		artist: "陈奕迅",
		cover: SHARED_PLAYLIST_COVER,
		url: "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBAmmIlJikJe-ahEmnyt5Tr4eTUUkIAAJqIAACtytAVLY0zB810gFHOgQ.mp3",
		duration: 0,
	},
	{
		id: 19,
		title: "普通朋友",
		artist: "陶喆",
		cover: SHARED_PLAYLIST_COVER,
		url: "https://pan.katelya.eu.org/file/r2:r2_1770303779041_mxxnpp.mp3",
		duration: 0,
	},
	{
		id: 20,
		title: "就是爱你",
		artist: "陶喆",
		cover: SHARED_PLAYLIST_COVER,
		url: "https://pan.katelya.eu.org/file/r2:r2_1770301953290_uvdcly.mp3",
		duration: 0,
	},
	{
		id: 21,
		title: "鼓楼",
		artist: "赵雷",
		cover: SHARED_PLAYLIST_COVER,
		url: "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAP2aYH4t4_fl7ggnTeHKUzTyNkpZwUAAjwgAAJxZRBU1R4Nt8Ng_Vw4BA.mp3",
		duration: 0,
	},
];

export const DEFAULT_SONG: Song = {
	title: "我知道",
	artist: "By2",
	cover: "/assets/music/cover/katelya-starry-playlist.svg",
	url: "",
	duration: 0,
	id: 0,
};

export const DEFAULT_METING_API =
	"https://www.bilibili.uno/api?server=:server&type=:type&id=:id&auth=:auth&r=:r";
export const DEFAULT_METING_ID = "14164869977";
export const DEFAULT_METING_SERVER = "netease";
export const DEFAULT_METING_TYPE = "playlist";

export const ERROR_DISPLAY_DURATION = 3000;
export const SKIP_ERROR_DELAY = 1000;
