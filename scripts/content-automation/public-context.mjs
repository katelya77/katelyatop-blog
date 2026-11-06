import { existsSync, readFileSync } from "node:fs";

import { scanPublicContent } from "./privacy.mjs";

const DEFAULT_CONTEXT_PATH = "editorial/public-context.json";
const ALLOWED_ITEM_KEYS = new Set([
	"id",
	"kind",
	"status",
	"visibility",
	"title",
	"summary",
	"tags",
]);
const ALLOWED_KINDS = new Set(["topic-inspiration", "experience-retrospective"]);

export function loadApprovedEditorialContext(filePath = DEFAULT_CONTEXT_PATH) {
	if (!existsSync(filePath)) return [];

	let payload;
	try {
		payload = JSON.parse(readFileSync(filePath, "utf8"));
	} catch (error) {
		throw new Error(`Unable to parse public editorial context: ${error?.message || error}`);
	}

	if (!payload || !Array.isArray(payload.items)) {
		throw new Error("Public editorial context must contain an items array");
	}

	return payload.items
		.filter(
			(item) =>
				item?.status === "approved" &&
				item?.visibility === "public" &&
				item?.kind === "topic-inspiration",
		)
		.map((item) => {
			const unexpectedKeys = Object.keys(item).filter((key) => !ALLOWED_ITEM_KEYS.has(key));
			if (unexpectedKeys.length > 0) {
				throw new Error(
					`Editorial context item ${String(item.id || "unknown")} contains unsupported fields; raw chat text and source dumps are not allowed`,
				);
			}

			const entry = {
				id: String(item.id || "").trim(),
				title: String(item.title || "").trim(),
				summary: String(item.summary || "").trim(),
				tags: Array.isArray(item.tags)
					? item.tags.map(String).map((tag) => tag.trim()).filter(Boolean).slice(0, 8)
					: [],
			};

			if (!entry.id || !entry.title || !entry.summary) {
				throw new Error("Approved editorial context requires id, title, and summary");
			}
			if (entry.summary.length > 800) {
				throw new Error(`Editorial context summary is too long: ${entry.id}`);
			}

			const privacy = scanPublicContent(
				[entry.id, entry.title, entry.summary, ...entry.tags].join("\n"),
			);
			if (!privacy.ok) {
				const codes = [...privacy.blocking, ...privacy.review].map((finding) => finding.code);
				throw new Error(
					`Editorial context item ${entry.id} failed the privacy gate: ${codes.join(", ")}`,
				);
			}

			return entry;
		});
}

export function formatApprovedEditorialContext(entries = []) {
	if (!Array.isArray(entries) || entries.length === 0) return "（暂无经过批准的公开主题摘要）";
	return entries
		.map((entry) => {
			const tags = entry.tags?.length ? `；标签：${entry.tags.join("、")}` : "";
			return `- [${entry.id}] ${entry.title}：${entry.summary}${tags}`;
		})
		.join("\n");
}
