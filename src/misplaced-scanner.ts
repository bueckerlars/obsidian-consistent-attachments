import { normalizePath, TFile, type App } from "obsidian";
import { computeTargetPath } from "./attachment-path";
import type { ConsistentAttachmentsSettings, MisplacedAttachment } from "./types";
import {
	buildAttachmentReferencers,
	getMarkdownReferencers,
	getVaultAttachmentCandidates,
} from "./vault-scan";

function pickPrimaryNotePath(notePaths: Iterable<string>): string {
	return [...notePaths].sort((a, b) => a.localeCompare(b))[0] ?? "";
}

export async function findMisplacedAttachments(
	app: App,
	settings: ConsistentAttachmentsSettings,
	excludedFolders: string[] = []
): Promise<MisplacedAttachment[]> {
	const referencers = await buildAttachmentReferencers(app, excludedFolders);
	const misplaced: MisplacedAttachment[] = [];

	for (const file of getVaultAttachmentCandidates(app, excludedFolders)) {
		const noteReferencers = getMarkdownReferencers(app, referencers.get(normalizePath(file.path)));
		if (noteReferencers.size === 0) {
			continue;
		}

		let correctlyPlaced = false;
		for (const notePath of noteReferencers) {
			const note = app.vault.getAbstractFileByPath(notePath);
			if (!(note instanceof TFile)) {
				continue;
			}

			const expectedPath = await computeTargetPath(app, settings, note, file);
			if (normalizePath(expectedPath) === normalizePath(file.path)) {
				correctlyPlaced = true;
				break;
			}
		}

		if (correctlyPlaced) {
			continue;
		}

		const primaryNotePath = pickPrimaryNotePath(noteReferencers);
		const primaryNote = app.vault.getAbstractFileByPath(primaryNotePath);
		const expectedPath =
			primaryNote instanceof TFile
				? await computeTargetPath(app, settings, primaryNote, file)
				: file.path;

		misplaced.push({
			file,
			notePaths: [...noteReferencers].sort((a, b) => a.localeCompare(b)),
			expectedPath,
		});
	}

	return misplaced.sort((a, b) => a.file.path.localeCompare(b.file.path));
}
