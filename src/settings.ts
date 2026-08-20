import { App, normalizePath, PluginSettingTab, Setting, type SettingDefinitionItem } from "obsidian";
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

export function sanitizeSettings(settings: ConsistentAttachmentsSettings): ConsistentAttachmentsSettings {
	const cleanExcluded = settings.excludedFolders
		.map((value) => normalizePath(value.trim()))
		.filter((value) => value.length > 0);

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
	constructor(app: App, private readonly plugin: ConsistentAttachmentsPlugin) {
		super(app, plugin);
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		Object.assign(this.plugin.settings, { [key]: value });
		await this.plugin.saveSettings();
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
				desc: "Comma-separated vault paths or wildcard patterns (e.g. */__WIP) that are skipped by attachment moves and scans.",
				render: (setting: Setting) => {
					setting.addTextArea((area) =>
						area.setValue(this.plugin.settings.excludedFolders.join(", ")).onChange(async (value) => {
							this.plugin.settings.excludedFolders = parseCommaSeparated(value);
							await this.plugin.saveSettings();
						})
					);
				},
			},
			{
				name: "Excluded file patterns",
				desc: "Comma-separated wildcard patterns for attachment files to ignore, e.g. *.py, *-generated.svg. Patterns without a slash match the file name, patterns with a slash match the full vault path.",
				render: (setting: Setting) => {
					setting.addTextArea((area) =>
						area
							.setValue(this.plugin.settings.excludedFilePatterns.join(", "))
							.onChange(async (value) => {
								this.plugin.settings.excludedFilePatterns = parseCommaSeparated(value);
								await this.plugin.saveSettings();
							})
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
