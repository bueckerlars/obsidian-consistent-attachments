import { TFile } from "obsidian";
import { resolveAttachmentRefs } from "./attachment-resolve";
import type { ParsedAttachmentLink, ResolveContext } from "./types";

export interface ResolveAttachmentResult {
	files: TFile[];
	unresolvedTargets: string[];
}

/**
 * Resolve attachment links against one or more source note paths.
 * Sources are tried in order per link (e.g. previous path first after a note move).
 */
export function resolveAttachmentFilesDetailed(
	links: ParsedAttachmentLink[],
	sourcePaths: string | string[],
	context: ResolveContext
): ResolveAttachmentResult {
	return resolveAttachmentRefs(links, sourcePaths, (target, sourcePath) => {
		const file = context.resolveFirstLinkpathDest(target, sourcePath);
		if (!(file instanceof TFile)) {
			return null;
		}
		if (file.extension === "md") {
			return "markdown";
		}
		return file;
	});
}

export function resolveAttachmentFiles(
	links: ParsedAttachmentLink[],
	sourcePath: string,
	context: ResolveContext
): TFile[] {
	return resolveAttachmentFilesDetailed(links, sourcePath, context).files;
}
