import { normalizePath, TFile, type App } from "obsidian";
import { ConflictModal, type ConflictDecision } from "./ui/conflict-modal";
import type { AttachmentMoveDecision, ConsistentAttachmentsSettings, OperationLogEntry } from "./types";

interface MoveContext {
	app: App;
	settings: ConsistentAttachmentsSettings;
	isShared: (file: TFile, ownerNotePath: string) => boolean;
	pushLog: (entry: OperationLogEntry) => void;
}

async function ensureFolderExists(app: App, targetPath: string): Promise<void> {
	const folder = targetPath.includes("/") ? targetPath.substring(0, targetPath.lastIndexOf("/")) : "";
	if (!folder) {
		return;
	}

	const segments = folder.split("/");
	let current = "";
	for (const segment of segments) {
		current = current ? `${current}/${segment}` : segment;
		if (!app.vault.getAbstractFileByPath(current)) {
			await app.vault.createFolder(current);
		}
	}
}

async function askDecision(app: App, attachmentPath: string): Promise<ConflictDecision> {
	return await new Promise((resolve) => {
		new ConflictModal(app, attachmentPath, resolve).open();
	});
}

async function chooseDecision(context: MoveContext, attachment: TFile, notePath: string): Promise<AttachmentMoveDecision> {
	const shared = context.isShared(attachment, notePath);
	if (!shared) {
		return { shouldMove: true, shouldCopy: false };
	}

	if (context.settings.sharedAttachmentStrategy === "skip") {
		return { shouldMove: false, shouldCopy: false, reason: "shared-skip" };
	}
	if (context.settings.sharedAttachmentStrategy === "copy") {
		return { shouldMove: false, shouldCopy: true, reason: "shared-copy" };
	}

	const decision = await askDecision(context.app, attachment.path);
	if (decision === "copy") {
		return { shouldMove: false, shouldCopy: true, reason: "shared-ask-copy" };
	}
	return { shouldMove: false, shouldCopy: false, reason: "shared-ask-skip" };
}

export function computeTargetFolder(settings: ConsistentAttachmentsSettings, note: TFile): string {
	const noteFolder = note.parent?.path ?? "";
	switch (settings.targetPathMode) {
		case "same-folder":
		case "obsidian-default":
			return noteFolder;
		case "note-subfolder":
			return normalizePath(noteFolder ? `${noteFolder}/${settings.noteSubfolderName}` : settings.noteSubfolderName);
		case "fixed-folder":
			return normalizePath(settings.fixedFolderPath);
		default:
			return noteFolder;
	}
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

export async function moveOrCopyAttachmentsForNote(
	context: MoveContext,
	note: TFile,
	attachments: TFile[]
): Promise<void> {
	const targetFolder = computeTargetFolder(context.settings, note);
	for (const attachment of attachments) {
		try {
			if (attachment.path === note.path) {
				continue;
			}
			const decision = await chooseDecision(context, attachment, note.path);
			if (!decision.shouldMove && !decision.shouldCopy) {
				context.pushLog({
					timestamp: Date.now(),
					notePath: note.path,
					sourcePath: attachment.path,
					status: "skipped",
					reason: decision.reason ?? "policy-skip",
				});
				continue;
			}

			const targetPath = nextAvailablePath(
				context.app,
				normalizePath(targetFolder ? `${targetFolder}/${attachment.name}` : attachment.name)
			);
			await ensureFolderExists(context.app, targetPath);

			if (decision.shouldCopy) {
				await context.app.vault.copy(attachment, targetPath);
				context.pushLog({
					timestamp: Date.now(),
					notePath: note.path,
					sourcePath: attachment.path,
					targetPath,
					status: "copied",
					reason: decision.reason ?? "shared-copy",
				});
				continue;
			}

			await context.app.fileManager.renameFile(attachment, targetPath);
			context.pushLog({
				timestamp: Date.now(),
				notePath: note.path,
				sourcePath: attachment.path,
				targetPath,
				status: "moved",
				reason: "moved-with-note",
			});
		} catch (error) {
			context.pushLog({
				timestamp: Date.now(),
				notePath: note.path,
				sourcePath: attachment.path,
				status: "error",
				reason: error instanceof Error ? error.message : "unknown-error",
			});
		}
	}
}
