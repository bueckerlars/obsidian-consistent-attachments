import { normalizePath, type App, type TFile } from "obsidian";
import type { ConsistentAttachmentsSettings } from "./types";

export interface ComputeTargetPathOptions {
	/** When false, avoids Obsidian APIs that create attachment folders (e.g. scans). Default: true. */
	allowSideEffects?: boolean;
}

function readObsidianAttachmentFolderConfig(app: App): string {
	const getConfig = (app.vault as { getConfig?: (key: string) => unknown }).getConfig;
	if (!getConfig) {
		return "";
	}
	const value = getConfig.call(app.vault, "attachmentFolderPath");
	return typeof value === "string" ? value : "";
}

/** Resolve Obsidian's configured attachment folder for a note without creating directories. */
export function resolveObsidianAttachmentFolder(app: App, note: TFile): string {
	const config = readObsidianAttachmentFolderConfig(app).trim();
	const noteFolder = note.parent?.path ?? "";

	if (!config || config === "/") {
		return "";
	}

	if (config === "./") {
		return noteFolder;
	}

	if (config.startsWith("./")) {
		const subfolder = config.slice(2);
		return normalizePath(noteFolder ? `${noteFolder}/${subfolder}` : subfolder);
	}

	return normalizePath(config);
}

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

function computeObsidianDefaultPathReadOnly(app: App, note: TFile, attachment: TFile): string {
	const folder = resolveObsidianAttachmentFolder(app, note);
	const preferred = normalizePath(folder ? `${folder}/${attachment.name}` : attachment.name);
	const existing = app.vault.getAbstractFileByPath(preferred);

	if (!existing || existing === attachment) {
		return preferred;
	}

	return nextAvailablePath(app, preferred);
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
	attachment: TFile,
	options: ComputeTargetPathOptions = {}
): Promise<string> {
	const allowSideEffects = options.allowSideEffects !== false;

	switch (settings.targetPathMode) {
		case "obsidian-default":
			return allowSideEffects
				? computeObsidianDefaultPath(app, note, attachment)
				: computeObsidianDefaultPathReadOnly(app, note, attachment);
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
