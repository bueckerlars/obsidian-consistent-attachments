import { TFile, normalizePath } from "obsidian";

export function hasWildcard(pattern: string): boolean {
	return /[*?]/.test(pattern);
}

/** Converts a wildcard pattern (`*` = any characters, `?` = single character) to a RegExp. */
export function wildcardToRegExp(pattern: string): RegExp {
	const escaped = pattern
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replace(/\*/g, ".*")
		.replace(/\?/g, ".");
	return new RegExp(`^${escaped}$`, "i");
}

/** All ancestor folder paths of a vault path, e.g. "a/b/c.md" -> ["a", "a/b"]. */
function getAncestorFolders(path: string): string[] {
	const parts = path.split("/");
	const ancestors: string[] = [];
	for (let i = 1; i < parts.length; i++) {
		ancestors.push(parts.slice(0, i).join("/"));
	}
	return ancestors;
}

export function isPathExcluded(path: string, excludedFolders: string[]): boolean {
	const normalizedPath = normalizePath(path);
	const ancestors = getAncestorFolders(normalizedPath);
	return excludedFolders
		.map((folder) => normalizePath(folder).replace(/\/+$/, ""))
		.filter((folder) => folder.length > 0)
		.some((folder) => {
			if (hasWildcard(folder)) {
				const regex = wildcardToRegExp(folder);
				return regex.test(normalizedPath) || ancestors.some((ancestor) => regex.test(ancestor));
			}
			return normalizedPath === folder || normalizedPath.startsWith(`${folder}/`);
		});
}

/**
 * Whether a file matches any exclusion pattern. Patterns without a slash are
 * matched against the file name, patterns containing a slash against the full vault path.
 */
export function isFileExcluded(path: string, patterns: string[]): boolean {
	const normalizedPath = normalizePath(path);
	const fileName = normalizedPath.split("/").pop() ?? normalizedPath;
	return patterns
		.map((pattern) => pattern.trim())
		.filter((pattern) => pattern.length > 0)
		.some((pattern) =>
			wildcardToRegExp(pattern).test(pattern.includes("/") ? normalizedPath : fileName)
		);
}

export function isRenameOnly(newPath: string, oldPath: string): boolean {
	const oldFolder = oldPath.includes("/") ? oldPath.substring(0, oldPath.lastIndexOf("/")) : "";
	const newFolder = newPath.includes("/") ? newPath.substring(0, newPath.lastIndexOf("/")) : "";
	return oldFolder === newFolder;
}

export function isAttachmentShared(
	file: TFile,
	ownerNotePath: string,
	getBacklinksForFile: (target: TFile) => Set<string>
): boolean {
	const backlinks = getBacklinksForFile(file);
	const owners = new Set([...backlinks].filter((path) => path !== ownerNotePath));
	return owners.size > 0;
}
