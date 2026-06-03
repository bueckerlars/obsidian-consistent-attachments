import { normalizePath, type App, type TFile } from "obsidian";
import {
	buildAttachmentReferencers,
	getMarkdownReferencers,
	getVaultAttachmentCandidates,
} from "./vault-scan";

export async function findOrphanAttachments(
	app: App,
	excludedFolders: string[] = []
): Promise<TFile[]> {
	const referencers = await buildAttachmentReferencers(app, excludedFolders);
	const orphans: TFile[] = [];

	for (const file of getVaultAttachmentCandidates(app, excludedFolders)) {
		const noteReferencers = getMarkdownReferencers(app, referencers.get(normalizePath(file.path)));
		if (noteReferencers.size === 0) {
			orphans.push(file);
		}
	}

	return orphans.sort((a, b) => a.path.localeCompare(b.path));
}
