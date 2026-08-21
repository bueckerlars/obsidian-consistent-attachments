export function hasWildcard(pattern: string): boolean {
	return /[*?]/.test(pattern);
}

/** Converts a wildcard pattern (`*` = any characters, `?` = one character except `/`) to a RegExp. */
export function wildcardToRegExp(pattern: string): RegExp {
	const escaped = pattern
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replace(/\*/g, ".*")
		.replace(/\?/g, "[^/]");
	return new RegExp(`^${escaped}$`);
}

function unifySlashes(value: string): string {
	return value.replace(/\\+/g, "/").replace(/\/{2,}/g, "/");
}

/** Trim, unify slashes; strip trailing slashes only for literal folder paths. */
export function prepareFolderPattern(pattern: string): string {
	const trimmed = unifySlashes(pattern.trim());
	if (!trimmed) {
		return "";
	}
	if (hasWildcard(trimmed)) {
		return trimmed;
	}
	return trimmed.replace(/\/+$/, "");
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

function isUnderFolder(path: string, folder: string): boolean {
	return path === folder || path.startsWith(`${folder}/`);
}

function matchesWildcardFolder(path: string, pattern: string): boolean {
	const ancestors = getAncestorFolders(path);

	if (pattern.endsWith("/*")) {
		const base = pattern.slice(0, -2);
		if (!base) {
			return false;
		}
		if (hasWildcard(base)) {
			const regex = wildcardToRegExp(base);
			return ancestors.some((ancestor) => regex.test(ancestor));
		}
		return isUnderFolder(path, base);
	}

	const regex = wildcardToRegExp(pattern);
	return ancestors.some((ancestor) => regex.test(ancestor));
}

export function isPathExcluded(path: string, excludedFolders: string[]): boolean {
	const normalizedPath = unifySlashes(path).replace(/\/+$/, "");
	return excludedFolders
		.map(prepareFolderPattern)
		.filter((folder) => folder.length > 0)
		.some((folder) => {
			if (hasWildcard(folder)) {
				return matchesWildcardFolder(normalizedPath, folder);
			}
			return isUnderFolder(normalizedPath, folder);
		});
}

/**
 * Whether a file matches any exclusion pattern. Patterns without a slash are
 * matched against the file name, patterns containing a slash against the full vault path.
 */
export function isFileExcluded(path: string, patterns: string[]): boolean {
	const normalizedPath = unifySlashes(path).replace(/\/+$/, "");
	const fileName = normalizedPath.split("/").pop() ?? normalizedPath;
	return patterns
		.map((pattern) => pattern.trim())
		.filter((pattern) => pattern.length > 0)
		.some((pattern) =>
			wildcardToRegExp(pattern).test(pattern.includes("/") ? normalizedPath : fileName)
		);
}
