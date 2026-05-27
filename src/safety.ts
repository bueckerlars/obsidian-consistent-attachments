import { TFile, normalizePath } from "obsidian";

export function isPathExcluded(path: string, excludedFolders: string[]): boolean {
	const normalizedPath = normalizePath(path);
	return excludedFolders
		.map((folder) => normalizePath(folder).replace(/\/+$/, ""))
		.filter((folder) => folder.length > 0)
		.some((folder) => normalizedPath === folder || normalizedPath.startsWith(`${folder}/`));
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
