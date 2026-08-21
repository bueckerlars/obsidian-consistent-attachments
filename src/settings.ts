import { App, normalizePath, PluginSettingTab, Setting, type SettingDefinitionItem } from "obsidian";
import { hasWildcard, prepareFolderPattern } from "./exclusion-match";
import type ConsistentAttachmentsPlugin from "./main";
import type { ConsistentAttachmentsSettings } from "./types";

export const DEFAULT_SETTINGS: ConsistentAttachmentsSettings = {
	autoMoveEnabled: true,
	excludedFolders: [],
	excludedFilePatterns: [],
	sharedAttachmentStrategy: "skip",
	targetPathMode: "obsidian-default",
	noteSubfolderName: "assets",
	fixedFolderPath: "attachments",
	deleteEmptyAttachmentFolders: true,
	showNotices: true,
	logLimit: 150,
};

function sanitizeFolderExclusion(value: string): string {
	const prepared = prepareFolderPattern(value);
	if (!prepared) {
		return "";
	}
	if (hasWildcard(prepared)) {
		return prepared;
	}
	return normalizePath(prepared);
}

export function sanitizeSettings(settings: ConsistentAttachmentsSettings): ConsistentAttachmentsSettings {
	const cleanExcluded = settings.excludedFolders.map(sanitizeFolderExclusion).filter((value) => value.length > 0);

	// Patterns are kept verbatim (trimmed only); normalizePath would mangle wildcard entries.
	const cleanFilePatterns = settings.excludedFilePatterns
		.map((value) => value.trim())
		.filter((value) => value.length > 0);

	return {
		...settings,
		excludedFolders: cleanExcluded,
		excludedFilePatterns: cleanFilePatterns,
		noteSubfolderName: settings.noteSubfolderName.trim() || "assets",
		fixedFolderPath: normalizePath(settings.fixedFolderPath.trim() || "attachments"),
		logLimit: Math.max(20, settings.logLimit),
	};
}

function parseCommaSeparated(value: string): string[] {
	return value
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

export class ConsistentAttachmentsSettingTab extends PluginSettingTab {
	private pendingExcludedFolders: string | null = null;
	private pendingExcludedFilePatterns: string | null = null;

	constructor(app: App, private readonly plugin: ConsistentAttachmentsPlugin) {
		super(app, plugin);
	}

	hide(): void {
		void this.flushExclusionFields();
		super.hide();
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		await this.flushExclusionFields();
		Object.assign(this.plugin.settings, { [key]: value });
		await this.plugin.saveSettings();
	}

	private async flushExclusionFields(): Promise<void> {
		let changed = false;
		if (this.pendingExcludedFolders !== null) {
			this.plugin.settings.excludedFolders = parseCommaSeparated(this.pendingExcludedFolders);
			this.pendingExcludedFolders = null;
			changed = true;
		}
		if (this.pendingExcludedFilePatterns !== null) {
			this.plugin.settings.excludedFilePatterns = parseCommaSeparated(this.pendingExcludedFilePatterns);
			this.pendingExcludedFilePatterns = null;
			changed = true;
		}
		if (changed) {
			await this.plugin.saveSettings();
		}
	}

	private bindExclusionTextArea(
		setting: Setting,
		currentValue: string[],
		onDraft: (value: string) => void
	): () => void {
		let inputEl: HTMLTextAreaElement | null = null;
		const persist = (): void => {
			void this.flushExclusionFields();
		};
		setting.addTextArea((area) => {
			inputEl = area.inputEl;
			area.setValue(currentValue.join(", "));
			area.inputEl.addEventListener("blur", persist);
			area.onChange(onDraft);
		});
		return () => {
			inputEl?.removeEventListener("blur", persist);
		};
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: "Enable auto-move",
				desc: "Automatically move or copy attachments when a note is moved. When enabled or when target path settings change, existing attachments are aligned to the current layout.",
				control: { type: "toggle", key: "autoMoveEnabled" },
			},
			{
				name: "Shared attachment strategy",
				desc: "Choose how shared attachments are handled when another note also references the file.",
				control: {
					type: "dropdown",
					key: "sharedAttachmentStrategy",
					options: {
						skip: "Skip shared attachments",
						copy: "Copy shared attachments",
						ask: "Ask every time",
					},
				},
			},
			{
				name: "Target path mode",
				desc: "Define where attachments should be placed. Follow Obsidian default uses your vault attachment folder settings. Run the command apply attachment layout to vault to update existing files, or enable auto-move to reapply automatically when these settings change.",
				control: {
					type: "dropdown",
					key: "targetPathMode",
					options: {
						"obsidian-default": "Follow Obsidian default",
						"note-subfolder": "Subfolder of note",
						"same-folder": "Same folder as note",
						"fixed-folder": "Fixed vault folder",
					},
				},
			},
			{
				name: "Subfolder name",
				desc: "Name of the attachment subfolder relative to the note's folder.",
				visible: () => this.plugin.settings.targetPathMode === "note-subfolder",
				control: { type: "text", key: "noteSubfolderName" },
			},
			{
				name: "Fixed folder path",
				desc: "Vault-relative folder used as destination for moved attachments.",
				visible: () => this.plugin.settings.targetPathMode === "fixed-folder",
				control: { type: "text", key: "fixedFolderPath" },
			},
			{
				name: "Delete empty attachment folders",
				desc: "Send note-local attachment subfolders to trash when they are left empty after a move. Applies for subfolder, same-folder, and Obsidian-default modes when attachments live in or below the note folder.",
				control: { type: "toggle", key: "deleteEmptyAttachmentFolders" },
			},
			{
				name: "Excluded folders",
				desc: "Comma-separated vault paths or wildcard patterns skipped by attachment moves and scans (e.g. */__WIP). A lone * matches every folder. Changes are saved when you leave the field.",
				render: (setting: Setting) => {
					return this.bindExclusionTextArea(setting, this.plugin.settings.excludedFolders, (value) => {
						this.pendingExcludedFolders = value;
					});
				},
			},
			{
				name: "Excluded file patterns",
				desc: "Comma-separated wildcard patterns for attachment files to ignore, e.g. *.py, *-generated.svg. Patterns without a slash match the file name, patterns with a slash match the full vault path. Changes are saved when you leave the field.",
				render: (setting: Setting) => {
					return this.bindExclusionTextArea(
						setting,
						this.plugin.settings.excludedFilePatterns,
						(value) => {
							this.pendingExcludedFilePatterns = value;
						}
					);
				},
			},
			{
				name: "Show notices",
				desc: "Display short notifications after commands and move operations.",
				control: { type: "toggle", key: "showNotices" },
			},
			{
				name: "Operation log size",
				desc: "Maximum number of in-memory operation entries to keep.",
				control: { type: "slider", key: "logLimit", min: 20, max: 500, step: 10 },
			},
		];
	}
}
