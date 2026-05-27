import { normalizePath, type App, type TFile } from "obsidian";
import type { ConsistentAttachmentsSettings } from "./types";

export function nextAvailablePath(app: App, desiredPath: string): string {
	if (!app.vault.getAbstractFileByPath(desiredPath)) {
		return desiredPath;
	}
	const extIndex = desiredPath.lastIndexOf(".");
	const base = extIndex >= 0 ? desiredPath.slice(0, extIndex) : desiredPath;
	const ext = extIndex >= 0 ? desiredPath.slice(extIndex) : "";
	let index = 1;
	while (true) {
		const candidate = `${base}-${index}${ext}`;
		if (!app.vault.getAbstractFileByPath(candidate)) {
			return candidate;
		}
		index += 1;
	}
}

function pathDirname(filePath: string): string {
	return filePath.includes("/") ? filePath.substring(0, filePath.lastIndexOf("/")) : "";
}

export function computeTargetFolder(settings: ConsistentAttachmentsSettings, note: TFile): string {
	const noteFolder = note.parent?.path ?? "";
	switch (settings.targetPathMode) {
		case "same-folder":
			return noteFolder;
		case "note-subfolder":
			return normalizePath(
				noteFolder ? `${noteFolder}/${settings.noteSubfolderName}` : settings.noteSubfolderName
			);
		case "fixed-folder":
			return normalizePath(settings.fixedFolderPath);
		default:
			return noteFolder;
	}
}

async function computeObsidianDefaultPath(app: App, note: TFile, attachment: TFile): Promise<string> {
	const available = await app.fileManager.getAvailablePathForAttachment(attachment.name, note.path);
	const folder = pathDirname(available);
	const preferred = normalizePath(folder ? `${folder}/${attachment.name}` : attachment.name);
	const existing = app.vault.getAbstractFileByPath(preferred);

	if (!existing || existing === attachment) {
		return preferred;
	}

	return nextAvailablePath(app, preferred);
}

export async function computeTargetPath(
	app: App,
	settings: ConsistentAttachmentsSettings,
	note: TFile,
	attachment: TFile
): Promise<string> {
	switch (settings.targetPathMode) {
		case "obsidian-default":
			return computeObsidianDefaultPath(app, note, attachment);
		case "same-folder": {
			const folder = note.parent?.path ?? "";
			return normalizePath(folder ? `${folder}/${attachment.name}` : attachment.name);
		}
		case "note-subfolder":
		case "fixed-folder": {
			const folder = computeTargetFolder(settings, note);
			return normalizePath(folder ? `${folder}/${attachment.name}` : attachment.name);
		}
		default:
			return attachment.path;
	}
}

export function hasAttachmentLayoutChanged(
	previous: ConsistentAttachmentsSettings,
	next: ConsistentAttachmentsSettings
): boolean {
	return (
		previous.targetPathMode !== next.targetPathMode ||
		previous.noteSubfolderName !== next.noteSubfolderName ||
		previous.fixedFolderPath !== next.fixedFolderPath
	);
}
