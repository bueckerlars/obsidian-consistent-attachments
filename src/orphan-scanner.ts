import type { App, TFile } from "obsidian";
import {
	collectReferencedAttachmentPaths,
	getVaultAttachmentCandidates,
} from "./vault-scan";

export async function findOrphanAttachments(
	app: App,
	excludedFolders: string[] = []
): Promise<TFile[]> {
	const referenced = await collectReferencedAttachmentPaths(app, excludedFolders);
	const orphans: TFile[] = [];

	for (const file of getVaultAttachmentCandidates(app, excludedFolders)) {
		if (!referenced.has(file.path)) {
			orphans.push(file);
		}
	}

	return orphans.sort((a, b) => a.path.localeCompare(b.path));
}
