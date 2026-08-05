import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
	new URL("../src/components/widgets/music-player/constants.ts", import.meta.url),
	"utf8",
);

const tracks = [
	["我知道", "By2", "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBmWnkdRKm9F0wcm2xAk_unmpV_2NrAAI0IAACpSIgV8ByeA0mOfmjOwQ.mp3"],
	["是我不够好", "茉莉,DJ小小智", "https://pan.katelya.eu.org/file/CQACAgUAAyEFAATamr0MAAIBeGmkQZyoZbX5TtaNF5qt3VGROj1_AAK8HgACecYRVUyGO-zi6ZI8OgQ.flac"],
	["Duvet", "Bôa", "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBF2mcQS--9DbxiBr2jyD46jQAAfHFjAACph0AApvD6VSA5XBDrsLK3DoE.mp3"],
	["孤身 (DJ版)", "万能公式", "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBFWmcOI605IrhHI00enPd-x_Vx6yWAAJ4HQACm8PpVL5vQ27au3uvOgQ.mp3"],
	["当你", "林俊杰", "https://pan.katelya.eu.org/file/hf:hf_1771839099753_mi5vcl.mp3"],
	["夜的第七章", "周杰伦、潘儿", "https://pan.katelya.eu.org/file/discord:discord_1771836544534_vzlzem.mp3"],
	["天后", "陈势安", "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBDmmImN8jr1VXUM1LuC8HIvW_-ch2AAKIIAACtytAVOEHCdWX4DblOgQ.mp3"],
	["听妈妈的话", "周杰伦", "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBDWmImN6EPnahAr1bSnAkOf6_M7qdAAKHIAACtytAVMc7YM45rTVBOgQ.mp3"],
	["天外来物", "薛之谦", "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBDGmImN4ODJUOh2BFZXaHqYi57TFUAAKGIAACtytAVJc9Jpzr5Z-IOgQ.mp3"],
	["情非得已", "庾澄庆", "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBCmmIlUEaTs_kyR-Nn05V5fH9oGXgAAJzIAACtytAVEMus77Mza1POgQ.mp3"],
	["青花瓷", "周杰伦", "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBCWmIlT991q_u6ZIPS7t-xxV9N_lwAAJyIAACtytAVG9gatkK_WWgOgQ.mp3"],
	["悄悄做个梦给你 (DJ旋律)", "像冷冰", "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBCGmIlTdxmMQWhBpZMHsoDSg7TUxiAAJxIAACtytAVHuoH7_F-z0dOgQ.mp3"],
	["体面", "于文文", "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBB2mIlNrtjORpGqRBMYXkoj4YZnJUAAJvIAACtytAVIMZrmYC1xJWOgQ.mp3"],
	["天黑黑", "孙燕姿", "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBBmmIlNnLXGb9sbpZ4tSNhcMEyo4fAAJuIAACtytAVL8_dOvLQijJOgQ.mp3"],
	["特别的人", "方大同", "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBBWmIlKIHWS3jF5TaPhdE3iHcre2HAAJtIAACtytAVAPa9H5GUHqJOgQ.mp3"],
	["说了再见", "周杰伦", "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBBGmIlJsl_k1bH90ZlIyJzubVfvJ0AAJsIAACtytAVIZ2v7we036IOgQ.mp3"],
	["算什么男人", "周杰伦", "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBA2mIlJg7QJLm8_n7wbyyi8Sa7f1NAAJrIAACtytAVG0SCioo-9pmOgQ.mp3"],
	["淘汰", "陈奕迅", "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAIBAmmIlJikJe-ahEmnyt5Tr4eTUUkIAAJqIAACtytAVLY0zB810gFHOgQ.mp3"],
	["普通朋友", "陶喆", "https://pan.katelya.eu.org/file/r2:r2_1770303779041_mxxnpp.mp3"],
	["就是爱你", "陶喆", "https://pan.katelya.eu.org/file/r2:r2_1770301953290_uvdcly.mp3"],
	["鼓楼", "赵雷", "https://pan.katelya.eu.org/file/CQACAgUAAyEGAATamr0MAAP2aYH4t4_fl7ggnTeHKUzTyNkpZwUAAjwgAAJxZRBU1R4Nt8Ng_Vw4BA.mp3"],
];

test("local playlist contains the exact supplied 21 tracks in order", () => {
	assert.equal(tracks.length, 21);
	let previousIndex = -1;
	for (const [title, artist, url] of tracks) {
		const titleIndex = source.indexOf(`title: ${JSON.stringify(title)}`);
		assert.ok(titleIndex > previousIndex, `${title} must appear in supplied order`);
		assert.match(source, new RegExp(`artist:\\s*${JSON.stringify(artist).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
		assert.ok(source.includes(`url: ${JSON.stringify(url)}`), `${title} URL must match exactly`);
		previousIndex = titleIndex;
	}
	assert.equal((source.match(/\bid:\s*\d+,/g) || []).length, 21);
	assert.equal((source.match(/duration:\s*0,/g) || []).length, 22);
	assert.equal(
		(source.match(/cover:\s*"assets\/music\/cover\/katelya-starry-playlist\.svg"/g) || []).length,
		21,
	);
});
