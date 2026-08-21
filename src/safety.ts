import { TFile, normalizePath } from "obsidian";
import { isFileExcluded as matchFileExcluded, isPathExcluded as matchPathExcluded } from "./exclusion-match";

export function isPathExcluded(path: string, excludedFolders: string[]): boolean {
	return matchPathExcluded(normalizePath(path), excludedFolders);
}

export function isFileExcluded(path: string, patterns: string[]): boolean {
	return matchFileExcluded(normalizePath(path), patterns);
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
