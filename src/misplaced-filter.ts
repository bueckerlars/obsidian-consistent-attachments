import type { TFile } from "obsidian";
import type { ConsistentAttachmentsSettings, MisplacedAttachment } from "./types";

/**
 * Whether relocating this misplaced item would be skipped under current settings
 * (shared attachment + skip strategy). Copy/ask strategies remain actionable.
 */
export function isUnmovableMisplacedAttachment(
	item: MisplacedAttachment,
	settings: Pick<ConsistentAttachmentsSettings, "sharedAttachmentStrategy">,
	isShared: (file: TFile, ownerNotePath: string) => boolean
): boolean {
	if (settings.sharedAttachmentStrategy !== "skip") {
		return false;
	}
	const ownerNotePath = item.notePaths[0];
	if (!ownerNotePath) {
		return false;
	}
	return isShared(item.file, ownerNotePath);
}

/** Drop misplaced items that relocate would skip, when the hide setting is enabled. */
export function filterMisplacedAttachmentsForDisplay(
	items: MisplacedAttachment[],
	settings: Pick<
		ConsistentAttachmentsSettings,
		"sharedAttachmentStrategy" | "hideUnmovableMisplacedResults"
	>,
	isShared: (file: TFile, ownerNotePath: string) => boolean
): MisplacedAttachment[] {
	if (!settings.hideUnmovableMisplacedResults) {
		return items;
	}
	return items.filter((item) => !isUnmovableMisplacedAttachment(item, settings, isShared));
}
