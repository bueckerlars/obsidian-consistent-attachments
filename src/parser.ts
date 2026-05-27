import type { ParsedAttachmentLink } from "./types";

const WIKI_LINK_REGEX = /(!)?\[\[([^[\]]+?)]]/g;
const MARKDOWN_LINK_REGEX = /(!)?\[[^\]]*]\(([^)]+)\)/g;

function cleanTarget(rawTarget: string): string {
	const withoutAlias = rawTarget.split("|")[0]?.trim() ?? "";
	return withoutAlias.split("#")[0]?.trim() ?? "";
}

function normalizeMarkdownTarget(target: string): string {
	const unwrapped = target.trim().replace(/^<(.+)>$/, "$1");
	const decoded = unwrapped.replace(/\\\)/g, ")");
	return decoded;
}

export function extractAttachmentLinks(markdown: string): ParsedAttachmentLink[] {
	const found = new Map<string, ParsedAttachmentLink>();

	for (const match of markdown.matchAll(WIKI_LINK_REGEX)) {
		const rawTarget = cleanTarget(match[2] ?? "");
		if (!rawTarget) {
			continue;
		}
		const key = `wiki:${rawTarget}`;
		found.set(key, {
			raw: match[0] ?? rawTarget,
			target: rawTarget,
			embedded: Boolean(match[1]),
		});
	}

	for (const match of markdown.matchAll(MARKDOWN_LINK_REGEX)) {
		const raw = normalizeMarkdownTarget(match[2] ?? "");
		const target = cleanTarget(raw);
		if (!target || target.startsWith("http://") || target.startsWith("https://")) {
			continue;
		}
		const key = `md:${target}`;
		found.set(key, {
			raw: match[0] ?? target,
			target,
			embedded: Boolean(match[1]),
		});
	}

	return [...found.values()];
}
