import { normalizePath, TFile, type App } from "obsidian";
import { extractAttachmentLinks } from "./parser";
import { resolveAttachmentFiles } from "./resolver";
import { isFileExcluded, isPathExcluded } from "./safety";

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

function getCanvasFiles(app: App, excludedFolders: string[] = []): TFile[] {
	return app.vault
		.getFiles()
		.filter((file) => file.extension === "canvas" && !isPathExcluded(file.path, excludedFolders));
}

interface CanvasFileNode {
	type?: string;
	file?: string;
	text?: string;
}

interface CanvasDocument {
	nodes?: CanvasFileNode[];
}

/**
 * All non-markdown attachment candidates in the vault.
 * Uses {@link Vault.getFiles} and filters by extension.
 */
export function getVaultAttachmentCandidates(
	app: App,
	excludedFolders: string[] = [],
	excludedFilePatterns: string[] = []
): TFile[] {
	return app.vault.getFiles().filter(
		(file) =>
			isAttachmentCandidate(file) &&
			!isPathExcluded(file.path, excludedFolders) &&
			!isFileExcluded(file.path, excludedFilePatterns)
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

function addReferencer(
	referencers: Map<string, Set<string>>,
	targetPath: string,
	sourcePath: string
): void {
	const normalizedTarget = normalizePath(targetPath);
	const normalizedSource = normalizePath(sourcePath);
	let sources = referencers.get(normalizedTarget);
	if (!sources) {
		sources = new Set();
		referencers.set(normalizedTarget, sources);
	}
	sources.add(normalizedSource);
}

/**
 * Map of attachment path -> vault paths that link to it (from the link index and markdown parsing).
 */
export function collectReferencersFromCache(app: App): Map<string, Set<string>> {
	const referencers = new Map<string, Set<string>>();

	for (const [sourcePath, targets] of Object.entries(app.metadataCache.resolvedLinks)) {
		for (const [targetPath, count] of Object.entries(targets)) {
			if (count > 0) {
				addReferencer(referencers, targetPath, sourcePath);
			}
		}
	}

	return referencers;
}

/**
 * Attachment referencers by reading markdown notes via the vault API.
 * Supplements the metadata cache for link targets Obsidian may not have indexed yet.
 */
export async function collectReferencersFromNotes(
	app: App,
	notes: TFile[]
): Promise<Map<string, Set<string>>> {
	const referencers = new Map<string, Set<string>>();

	for (const note of notes) {
		const content = await app.vault.cachedRead(note);
		const links = extractAttachmentLinks(content);
		const resolved = resolveAttachmentFiles(links, note.path, {
			resolveFirstLinkpathDest: (linktext, sourcePath) =>
				app.metadataCache.getFirstLinkpathDest(linktext, sourcePath),
		});

		for (const file of resolved) {
			addReferencer(referencers, file.path, note.path);
		}
	}

	return referencers;
}

/**
 * Attachment referencers by reading canvas files via the vault API.
 * Supplements metadataCache because Obsidian indexes markdown links in resolvedLinks,
 * not native canvas embeds (see JSON Canvas file/text nodes).
 */
export async function collectReferencersFromCanvasFiles(
	app: App,
	canvasFiles: TFile[]
): Promise<Map<string, Set<string>>> {
	const referencers = new Map<string, Set<string>>();
	const resolveContext = {
		resolveFirstLinkpathDest: (linktext: string, sourcePath: string) =>
			app.metadataCache.getFirstLinkpathDest(linktext, sourcePath),
	};

	for (const canvas of canvasFiles) {
		let document: CanvasDocument;
		try {
			document = JSON.parse(await app.vault.cachedRead(canvas)) as CanvasDocument;
		} catch {
			continue;
		}

		for (const node of document.nodes ?? []) {
			if (node.type === "file" && node.file) {
				const target = node.file.split("#")[0]?.trim() ?? "";
				if (!target) {
					continue;
				}
				const file = resolveContext.resolveFirstLinkpathDest(target, canvas.path);
				if (file instanceof TFile && isAttachmentCandidate(file)) {
					addReferencer(referencers, file.path, canvas.path);
				}
				continue;
			}

			if (node.type === "text" && node.text) {
				const links = extractAttachmentLinks(node.text);
				for (const file of resolveAttachmentFiles(links, canvas.path, resolveContext)) {
					addReferencer(referencers, file.path, canvas.path);
				}
			}
		}
	}

	return referencers;
}

function mergeReferencerMaps(...maps: Map<string, Set<string>>[]): Map<string, Set<string>> {
	const merged = new Map<string, Set<string>>();

	for (const map of maps) {
		for (const [targetPath, sources] of map) {
			let existing = merged.get(targetPath);
			if (!existing) {
				existing = new Set();
				merged.set(targetPath, existing);
			}
			for (const source of sources) {
				existing.add(source);
			}
		}
	}

	return merged;
}

/**
 * Map of attachment path -> vault paths that reference it.
 */
export async function buildAttachmentReferencers(
	app: App,
	excludedFolders: string[] = []
): Promise<Map<string, Set<string>>> {
	const notes = getMarkdownNotes(app, excludedFolders);
	const canvasFiles = getCanvasFiles(app, excludedFolders);
	return mergeReferencerMaps(
		collectReferencersFromCache(app),
		await collectReferencersFromNotes(app, notes),
		await collectReferencersFromCanvasFiles(app, canvasFiles)
	);
}

export function getMarkdownReferencers(app: App, sources: Set<string> | undefined): Set<string> {
	const referencers = new Set<string>();
	if (!sources) {
		return referencers;
	}

	for (const sourcePath of sources) {
		const source = app.vault.getAbstractFileByPath(sourcePath);
		if (source instanceof TFile && source.extension === "md") {
			referencers.add(sourcePath);
		}
	}

	return referencers;
}
