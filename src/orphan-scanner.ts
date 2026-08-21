import { normalizePath, type App, type TFile } from "obsidian";
import { buildAttachmentReferencers, getVaultAttachmentCandidates } from "./vault-scan";

export async function findOrphanAttachments(
	app: App,
	excludedFolders: string[] = [],
	excludedFilePatterns: string[] = []
): Promise<TFile[]> {
	const referencers = await buildAttachmentReferencers(app, excludedFolders);
	const orphans: TFile[] = [];

	for (const file of getVaultAttachmentCandidates(app, excludedFolders, excludedFilePatterns)) {
		const sources = referencers.get(normalizePath(file.path));
		if (!sources?.size) {
			orphans.push(file);
		}
	}

	return orphans.sort((a, b) => a.path.localeCompare(b.path));
}
