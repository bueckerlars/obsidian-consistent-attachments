import { normalizePath, TFile, type App } from "obsidian";
import { computeTargetPath, nextAvailablePath } from "./attachment-path";
import { cleanupEmptySourceFolders, type FolderCleanupContext } from "./folder-cleanup";
import { ConflictModal, type ConflictDecision } from "./ui/conflict-modal";
import type { AttachmentMoveDecision, ConsistentAttachmentsSettings, OperationLogEntry } from "./types";

interface MoveContext {
	app: App;
	settings: ConsistentAttachmentsSettings;
	isShared: (file: TFile, ownerNotePath: string) => boolean;
	pushLog: (entry: OperationLogEntry) => void;
	folderCleanup?: FolderCleanupContext;
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

export async function moveOrCopyAttachmentsForNote(
	context: MoveContext,
	note: TFile,
	attachments: TFile[]
): Promise<void> {
	const emptiedSourceFolders = new Set<string>();

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

			const preferredPath = await computeTargetPath(context.app, context.settings, note, attachment);
			if (normalizePath(attachment.path) === normalizePath(preferredPath)) {
				context.pushLog({
					timestamp: Date.now(),
					notePath: note.path,
					sourcePath: attachment.path,
					status: "skipped",
					reason: "already-in-target-location",
				});
				continue;
			}

			const targetPath = nextAvailablePath(context.app, preferredPath);
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

			const sourceFolder = attachment.parent?.path ?? "";
			await context.app.fileManager.renameFile(attachment, targetPath);
			if (sourceFolder) {
				emptiedSourceFolders.add(sourceFolder);
			}
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

	await cleanupEmptySourceFolders(
		context.app,
		context.settings,
		context.folderCleanup ?? { note },
		[...emptiedSourceFolders]
	);
}
