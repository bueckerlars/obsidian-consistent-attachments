import type { TAbstractFile, TFile } from "obsidian";

export type SharedAttachmentStrategy = "skip" | "copy" | "ask";
export type TargetPathMode = "obsidian-default" | "note-subfolder" | "same-folder" | "fixed-folder";

export interface ConsistentAttachmentsSettings {
	autoMoveEnabled: boolean;
	excludedFolders: string[];
	sharedAttachmentStrategy: SharedAttachmentStrategy;
	targetPathMode: TargetPathMode;
	noteSubfolderName: string;
	fixedFolderPath: string;
	showNotices: boolean;
	logLimit: number;
}

export interface ParsedAttachmentLink {
	raw: string;
	target: string;
	embedded: boolean;
}

export interface AttachmentMoveCandidate {
	sourceFile: TFile;
	targetPath: string;
	isShared: boolean;
}

export interface AttachmentMoveDecision {
	shouldMove: boolean;
	shouldCopy: boolean;
	reason?: string;
}

export type OperationStatus = "moved" | "copied" | "skipped" | "error";

export interface OperationLogEntry {
	timestamp: number;
	notePath: string;
	sourcePath?: string;
	targetPath?: string;
	status: OperationStatus;
	reason: string;
}

export interface OrphanAttachment {
	file: TFile;
}

export interface ResolveContext {
	resolveFirstLinkpathDest: (linktext: string, sourcePath: string) => TAbstractFile | null;
}
