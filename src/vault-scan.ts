import { normalizePath, TFile, type App } from "obsidian";
import { extractAttachmentLinks } from "./parser";
import { resolveAttachmentFiles } from "./resolver";
import { isPathExcluded } from "./safety";

/** Obsidian-native vault files that are not note attachments. */
const NON_ATTACHMENT_EXTENSIONS = new Set(["base", "canvas"]);

export function isAttachmentCandidate(file: TFile): boolean {
	return file.extension !== "md" && !NON_ATTACHMENT_EXTENSIONS.has(file.extension);
}

/**
 * All markdown notes in the vault, optionally skipping excluded folder paths.
 * Uses {@link Vault.getMarkdownFiles}.
 */
export function getMarkdownNotes(app: App, excludedFolders: string[] = []): TFile[] {
	return app.vault.getMarkdownFiles().filter((file) => !isPathExcluded(file.path, excludedFolders));
}

/**
 * All non-markdown attachment candidates in the vault.
 * Uses {@link Vault.getFiles} and filters by extension.
 */
export function getVaultAttachmentCandidates(app: App, excludedFolders: string[] = []): TFile[] {
	return app.vault.getFiles().filter(
		(file) => isAttachmentCandidate(file) && !isPathExcluded(file.path, excludedFolders)
	);
}

/**
 * Referenced vault paths from Obsidian's link index (markdown, canvas, frontmatter, etc.).
 */
export function collectReferencedPathsFromCache(app: App): Set<string> {
	const referenced = new Set<string>();

	for (const targets of Object.values(app.metadataCache.resolvedLinks)) {
		for (const [targetPath, count] of Object.entries(targets)) {
			if (count > 0) {
				referenced.add(normalizePath(targetPath));
			}
		}
	}

	return referenced;
}

/**
 * Referenced attachment paths by reading markdown notes via the vault API.
 * Supplements the metadata cache for link targets Obsidian may not have indexed yet.
 */
export async function collectReferencedPathsFromNotes(
	app: App,
	notes: TFile[]
): Promise<Set<string>> {
	const referenced = new Set<string>();

	for (const note of notes) {
		const content = await app.vault.cachedRead(note);
		const links = extractAttachmentLinks(content);
		const resolved = resolveAttachmentFiles(links, note.path, {
			resolveFirstLinkpathDest: (linktext, sourcePath) =>
				app.metadataCache.getFirstLinkpathDest(linktext, sourcePath),
		});

		for (const file of resolved) {
			referenced.add(normalizePath(file.path));
		}
	}

	return referenced;
}

/**
 * Paths of files referenced from notes or indexed links in the vault.
 */
export async function collectReferencedAttachmentPaths(
	app: App,
	excludedFolders: string[] = []
): Promise<Set<string>> {
	const notes = getMarkdownNotes(app, excludedFolders);
	const referenced = collectReferencedPathsFromCache(app);

	for (const path of await collectReferencedPathsFromNotes(app, notes)) {
		referenced.add(path);
	}

	return referenced;
}
