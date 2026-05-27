import { TFile, type App } from "obsidian";
import { extractAttachmentLinks } from "./parser";
import { resolveAttachmentFiles } from "./resolver";

/** Obsidian-native vault files that are not note attachments. */
const NON_ATTACHMENT_EXTENSIONS = new Set(["base", "canvas"]);

export async function findOrphanAttachments(app: App): Promise<TFile[]> {
	const files = app.vault.getFiles();
	const notes = files.filter((file) => file.extension === "md");
	const attachments = files.filter(
		(file) => file.extension !== "md" && !NON_ATTACHMENT_EXTENSIONS.has(file.extension)
	);
	const referenced = new Set<string>();

	for (const note of notes) {
		const content = await app.vault.cachedRead(note);
		const links = extractAttachmentLinks(content);
		const resolved = resolveAttachmentFiles(links, note.path, {
			resolveFirstLinkpathDest: (linktext, sourcePath) =>
				app.metadataCache.getFirstLinkpathDest(linktext, sourcePath),
		});
		for (const file of resolved) {
			referenced.add(file.path);
		}
	}

	return attachments.filter((file) => !referenced.has(file.path));
}
