const AGGREGATE_PATHS = ["/", "/archive/", "/atom.xml", "/rss.xml"];
const PAGEFIND_PATH = "/pagefind/";
const POST_PREFIX = "src/content/posts/";

function normalizeSiteUrl(siteUrl) {
	return String(siteUrl).replace(/\/+$/, "");
}

function toAbsolute(siteUrl, pathname) {
	const base = normalizeSiteUrl(siteUrl);
	const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
	return `${base}${path}`;
}

function normalizePermalink(value) {
	const trimmed = String(value ?? "")
		.trim()
		.replace(/^["']|["']$/g, "");
	if (!trimmed) return null;
	return `/${trimmed.replace(/^\/+|\/+$/g, "")}/`;
}

function readFrontmatterScalar(content, key) {
	const match = String(content ?? "").match(
		/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/,
	);
	if (!match) return null;
	const body = match[1];
	const keyMatch = body.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, "m"));
	return keyMatch ? keyMatch[1] : null;
}

export function postPathFromSource({ filePath, content }) {
	if (!filePath?.startsWith(POST_PREFIX)) return null;
	const permalink = normalizePermalink(
		readFrontmatterScalar(content, "permalink"),
	);
	if (permalink) return permalink;

	const alias = normalizePermalink(readFrontmatterScalar(content, "alias"));
	if (alias) return alias.startsWith("/posts/") ? alias : `/posts${alias}`;

	const id = filePath.slice(POST_PREFIX.length).replace(/\.(md|mdx)$/i, "");
	if (!id) return null;
	return `/posts/${id.replace(/^\/+|\/+$/g, "")}/`;
}

function isPost(path) {
	return path?.startsWith(POST_PREFIX) && /\.(md|mdx)$/i.test(path);
}

function isPublicFile(path) {
	return path?.startsWith("public/") && !path.startsWith("public/_astro/");
}

function affectsPublicSite(path) {
	return Boolean(
		path &&
			(path.startsWith("src/content/posts/") ||
				path.startsWith("src/pages/") ||
				path.startsWith("src/layouts/") ||
				path.startsWith("src/components/") ||
				path.startsWith("src/config/") ||
				path.startsWith("src/styles/") ||
				path === "src/content.config.ts" ||
				path === "astro.config.mjs"),
	);
}

function addAggregateTargets(urlPaths, dirPaths, reasons, reason) {
	for (const path of AGGREGATE_PATHS) urlPaths.add(path);
	dirPaths.add(PAGEFIND_PATH);
	reasons.add(reason);
}

export async function buildRefreshPlan({ changes, siteUrl, readFileAtRef }) {
	const urlPaths = new Set();
	const dirPaths = new Set();
	const reasons = new Set();

	for (const change of changes ?? []) {
		const candidates = [];
		if (change.oldPath && change.oldPath !== change.path) {
			candidates.push({ path: change.oldPath, ref: "base" });
		}
		candidates.push({
			path: change.path,
			ref: change.status === "D" ? "base" : "head",
		});

		let changeAffectsSite = false;
		for (const candidate of candidates) {
			if (!candidate.path) continue;

			if (isPost(candidate.path)) {
				const content = await readFileAtRef(candidate.path, candidate.ref);
				const postPath = postPathFromSource({
					filePath: candidate.path,
					content,
				});
				if (postPath && !postPath.startsWith("/_astro/")) {
					urlPaths.add(postPath);
				}
				changeAffectsSite = true;
				continue;
			}

			if (isPublicFile(candidate.path)) {
				const publicPath = `/${candidate.path.slice("public/".length)}`;
				if (!publicPath.startsWith("/_astro/")) urlPaths.add(publicPath);
				reasons.add(`public:${candidate.path}`);
				continue;
			}

			if (affectsPublicSite(candidate.path)) changeAffectsSite = true;
		}

		if (changeAffectsSite) {
			addAggregateTargets(
				urlPaths,
				dirPaths,
				reasons,
				`site:${change.path ?? change.oldPath}`,
			);
		}
	}

	const urls = [...urlPaths]
		.filter((path) => !path.startsWith("/_astro/"))
		.map((path) => toAbsolute(siteUrl, path))
		.sort();
	const paths = [...dirPaths]
		.filter((path) => !path.startsWith("/_astro/"))
		.map((path) => toAbsolute(siteUrl, path))
		.sort();

	return { urls, paths, reasons: [...reasons].sort() };
}
