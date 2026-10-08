export interface LinkTarget {
	target: string;
}

export interface FileRef {
	path: string;
	extension: string;
}

export interface ResolveAttachmentRefsResult<T extends FileRef> {
	files: T[];
	unresolvedTargets: string[];
}

function uniqueSourcePaths(sourcePaths: string[]): string[] {
	const seen = new Set<string>();
	const unique: string[] = [];
	for (const path of sourcePaths) {
		if (!path || seen.has(path)) {
			continue;
		}
		seen.add(path);
		unique.push(path);
	}
	return unique;
}

/**
 * Resolve attachment links against one or more source note paths.
 * Sources are tried in order per link (e.g. previous path first after a note move).
 */
export function resolveAttachmentRefs<T extends FileRef>(
	links: LinkTarget[],
	sourcePaths: string | string[],
	resolve: (target: string, sourcePath: string) => T | "markdown" | null
): ResolveAttachmentRefsResult<T> {
	const sources = uniqueSourcePaths(Array.isArray(sourcePaths) ? sourcePaths : [sourcePaths]);
	const resolved = new Map<string, T>();
	const unresolvedTargets: string[] = [];

	for (const link of links) {
		let matched: T | null = null;
		let sawMarkdown = false;
		for (const sourcePath of sources) {
			const classified = resolve(link.target, sourcePath);
			if (classified === "markdown") {
				sawMarkdown = true;
				continue;
			}
			if (!classified) {
				continue;
			}
			matched = classified;
			break;
		}

		if (matched) {
			resolved.set(matched.path, matched);
			continue;
		}
		// Note links are ignored; only report targets that resolve to nothing.
		if (!sawMarkdown) {
			unresolvedTargets.push(link.target);
		}
	}

	return {
		files: [...resolved.values()],
		unresolvedTargets,
	};
}
