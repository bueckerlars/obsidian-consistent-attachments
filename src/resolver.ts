import { TFile } from "obsidian";
import type { ParsedAttachmentLink, ResolveContext } from "./types";

export function resolveAttachmentFiles(
	links: ParsedAttachmentLink[],
	sourcePath: string,
	context: ResolveContext
): TFile[] {
	const resolved = new Map<string, TFile>();

	for (const link of links) {
		const file = context.resolveFirstLinkpathDest(link.target, sourcePath);
		if (!(file instanceof TFile)) {
			continue;
		}
		if (file.extension === "md") {
			continue;
		}
		resolved.set(file.path, file);
	}

	return [...resolved.values()];
}
