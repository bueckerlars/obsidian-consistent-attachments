import { App, normalizePath, PluginSettingTab, Setting } from "obsidian";
import type ConsistentAttachmentsPlugin from "./main";
import type { ConsistentAttachmentsSettings, SharedAttachmentStrategy, TargetPathMode } from "./types";

export const DEFAULT_SETTINGS: ConsistentAttachmentsSettings = {
	autoMoveEnabled: true,
	excludedFolders: [],
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

	return {
		...settings,
		excludedFolders: cleanExcluded,
		noteSubfolderName: settings.noteSubfolderName.trim() || "assets",
		fixedFolderPath: normalizePath(settings.fixedFolderPath.trim() || "attachments"),
		logLimit: Math.max(20, settings.logLimit),
	};
}

export class ConsistentAttachmentsSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: ConsistentAttachmentsPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Enable auto-move")
			.setDesc(
				"Automatically move or copy attachments when a note is moved. When enabled or when target path settings change, existing attachments are aligned to the current layout."
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoMoveEnabled).onChange(async (value) => {
					this.plugin.settings.autoMoveEnabled = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Shared attachment strategy")
			.setDesc("Choose how shared attachments are handled when another note also references the file.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("skip", "Skip shared attachments")
					.addOption("copy", "Copy shared attachments")
					.addOption("ask", "Ask every time")
					.setValue(this.plugin.settings.sharedAttachmentStrategy)
					.onChange(async (value: SharedAttachmentStrategy) => {
						this.plugin.settings.sharedAttachmentStrategy = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Target path mode")
			.setDesc(
				"Define where attachments should be placed. Follow Obsidian default uses your vault attachment folder settings. Run the command apply attachment layout to vault to update existing files, or enable auto-move to reapply automatically when these settings change."
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("obsidian-default", "Follow Obsidian default")
					.addOption("note-subfolder", "Subfolder of note")
					.addOption("same-folder", "Same folder as note")
					.addOption("fixed-folder", "Fixed vault folder")
					.setValue(this.plugin.settings.targetPathMode)
					.onChange(async (value: TargetPathMode) => {
						this.plugin.settings.targetPathMode = value;
						await this.plugin.saveSettings();
						this.display();
					})
			);

		if (this.plugin.settings.targetPathMode === "note-subfolder") {
			new Setting(containerEl)
				.setName("Subfolder name")
				.setDesc("Name of the attachment subfolder relative to the note's folder.")
				.addText((text) =>
					text.setValue(this.plugin.settings.noteSubfolderName).onChange(async (value) => {
						this.plugin.settings.noteSubfolderName = value.trim() || "assets";
						await this.plugin.saveSettings();
					})
				);
		}

		if (this.plugin.settings.targetPathMode === "fixed-folder") {
			new Setting(containerEl)
				.setName("Fixed folder path")
				.setDesc("Vault-relative folder used as destination for moved attachments.")
				.addText((text) =>
					text.setValue(this.plugin.settings.fixedFolderPath).onChange(async (value) => {
						this.plugin.settings.fixedFolderPath = normalizePath(value.trim() || "attachments");
						await this.plugin.saveSettings();
					})
				);
		}

		new Setting(containerEl)
			.setName("Delete empty attachment folders")
			.setDesc(
				"Remove note-local attachment subfolders left empty after a move. Applies for subfolder, same-folder, and Obsidian-default modes when attachments live in or below the note folder."
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.deleteEmptyAttachmentFolders).onChange(async (value) => {
					this.plugin.settings.deleteEmptyAttachmentFolders = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Excluded folders")
			.setDesc("Comma-separated vault paths where note move events are ignored.")
			.addTextArea((area) =>
				area
					.setValue(this.plugin.settings.excludedFolders.join(", "))
					.onChange(async (value) => {
						this.plugin.settings.excludedFolders = value
							.split(",")
							.map((entry) => entry.trim())
							.filter((entry) => entry.length > 0);
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Show notices")
			.setDesc("Display short notifications after commands and move operations.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.showNotices).onChange(async (value) => {
					this.plugin.settings.showNotices = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Operation log size")
			.setDesc("Maximum number of in-memory operation entries to keep.")
			.addSlider((slider) =>
				slider
					.setLimits(20, 500, 10)
					.setValue(this.plugin.settings.logLimit)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.logLimit = value;
						await this.plugin.saveSettings();
					})
			);
	}
}

