import type { CollectionEntry } from "astro:content";
import { getPostUrl, url } from "./url-utils";

export interface SeriesNavigationItem {
	title: string;
	url: string;
	order: number;
}

export interface SeriesNavigationData {
	series: string;
	homeUrl: string;
	currentOrder: number;
	items: SeriesNavigationItem[];
}

export function buildSeriesNavigation(
	entry: CollectionEntry<"posts">,
	allPosts: CollectionEntry<"posts">[],
): SeriesNavigationData | null {
	const { series, seriesOrder, seriesHome } = entry.data;
	if (!series || seriesOrder === undefined || !seriesHome) {
		return null;
	}

	const items = allPosts
		.filter(
			(post) =>
				post.data.series === series &&
				typeof post.data.seriesOrder === "number",
		)
		.map((post) => ({
			title: post.data.title,
			url: getPostUrl(post),
			order: post.data.seriesOrder as number,
		}))
		.sort((a, b) => a.order - b.order);

	if (items.length === 0) {
		return null;
	}

	const homeItem = allPosts.find(
		(post) =>
			post.data.series === series &&
			post.data.permalink?.replace(/^\/+|\/+$/g, "") ===
				seriesHome.replace(/^\/+|\/+$/g, ""),
	);
	const homeUrl = homeItem
		? getPostUrl(homeItem)
		: url(`/${seriesHome.replace(/^\/+|\/+$/g, "")}/`);

	return {
		series,
		homeUrl,
		currentOrder: seriesOrder,
		items,
	};
}
