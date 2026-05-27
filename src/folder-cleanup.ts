import { normalizePath, TFolder, type App, type TFile } from "obsidian";
import type { ConsistentAttachmentsSettings } from "./types";

export interface FolderCleanupContext {
	note: TFile;
	/** Note paths before a cross-folder move (e.g. vault rename oldPath). */
	previousNotePaths?: string[];
}

function pathDirname(filePath: string): string {
	return filePath.includes("/") ? filePath.substring(0, filePath.lastIndexOf("/")) : "";
}

export function noteFolderFromNotePath(notePath: string): string {
	return pathDirname(notePath);
}

export function collectNoteFolderRoots(note: TFile, previousNotePaths: string[] = []): string[] {
	const roots = new Set<string>();
	roots.add(normalizePath(note.parent?.path ?? ""));

	for (const notePath of previousNotePaths) {
		roots.add(normalizePath(noteFolderFromNotePath(notePath)));
	}

	return [...roots];
}

function isUnderNoteFolderRoot(noteFolderRoots: string[], folderPath: string): boolean {
	for (const root of noteFolderRoots) {
		if (folderPath === root) {
			continue;
		}
		if (!root) {
			if (!folderPath.includes("/")) {
				return true;
			}
			continue;
		}
		if (folderPath.startsWith(`${root}/`)) {
			return true;
		}
	}
	return false;
}

/**
 * Whether an emptied source folder from a move may be removed.
 * Uses the folder that was left behind, not only the note's current location.
 */
export function canDeleteEmptyAttachmentFolder(
	settings: ConsistentAttachmentsSettings,
	noteFolderRoots: string[],
	folderPath: string
): boolean {
	if (!settings.deleteEmptyAttachmentFolders) {
		return false;
	}

	const folder = normalizePath(folderPath);
	if (!folder) {
		return false;
	}

	const fixedFolder = normalizePath(settings.fixedFolderPath);
	if (folder === fixedFolder) {
		return false;
	}

	for (const root of noteFolderRoots) {
		if (folder === root) {
			return false;
		}
	}

	if (isUnderNoteFolderRoot(noteFolderRoots, folder)) {
		return true;
	}

	const baseName = folder.includes("/") ? folder.slice(folder.lastIndexOf("/") + 1) : folder;
	if (settings.targetPathMode === "note-subfolder" && baseName === settings.noteSubfolderName) {
		return true;
	}

	return false;
}

function isFolderEmpty(app: App, folderPath: string): boolean {
	const folder = app.vault.getAbstractFileByPath(normalizePath(folderPath));
	return folder instanceof TFolder && folder.children.length === 0;
}

async function removeEmptyFolder(app: App, folderPath: string): Promise<boolean> {
	if (!isFolderEmpty(app, folderPath)) {
		return false;
	}

	const folder = app.vault.getAbstractFileByPath(normalizePath(folderPath));
	if (!(folder instanceof TFolder)) {
		return false;
	}

	// Empty attachment folders should be removed from the vault tree, not sent to trash.
	// eslint-disable-next-line obsidianmd/prefer-file-manager-trash-file -- intentional removal of empty dirs
	await app.vault.delete(folder);
	return true;
}

export async function cleanupEmptySourceFolders(
	app: App,
	settings: ConsistentAttachmentsSettings,
	context: FolderCleanupContext,
	sourceFolderPaths: string[]
): Promise<void> {
	if (!settings.deleteEmptyAttachmentFolders || sourceFolderPaths.length === 0) {
		return;
	}

	const noteFolderRoots = collectNoteFolderRoots(context.note, context.previousNotePaths ?? []);
	const candidates = [...new Set(sourceFolderPaths.map((path) => normalizePath(path)))].sort(
		(a, b) => b.split("/").length - a.split("/").length
	);

	for (const folderPath of candidates) {
		let current = folderPath;
		while (current && canDeleteEmptyAttachmentFolder(settings, noteFolderRoots, current)) {
			const removed = await removeEmptyFolder(app, current);
			if (!removed) {
				break;
			}
			const parent = pathDirname(current);
			current = parent !== current ? parent : "";
		}
	}
}
