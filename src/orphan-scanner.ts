import { TFile, type App } from "obsidian";

/** Obsidian-native vault files that are not note attachments. */
const NON_ATTACHMENT_EXTENSIONS = new Set(["base", "canvas"]);

function isAttachmentCandidate(file: TFile): boolean {
	return file.extension !== "md" && !NON_ATTACHMENT_EXTENSIONS.has(file.extension);
}

function collectReferencedPaths(app: App): Set<string> {
	const referenced = new Set<string>();

	for (const targets of Object.values(app.metadataCache.resolvedLinks)) {
		for (const [targetPath, count] of Object.entries(targets)) {
			if (count > 0) {
				referenced.add(targetPath);
			}
		}
	}

	return referenced;
}

export async function findOrphanAttachments(app: App): Promise<TFile[]> {
	const referenced = collectReferencedPaths(app);
	const orphans: TFile[] = [];

	for (const file of app.vault.getFiles()) {
		if (!isAttachmentCandidate(file)) {
			continue;
		}
		if (!referenced.has(file.path)) {
			orphans.push(file);
		}
	}

	return orphans.sort((a, b) => a.path.localeCompare(b.path));
}
