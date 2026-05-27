import { MarkdownView, Notice, Plugin, TFile } from "obsidian";
import { OperationLogger } from "./logger";
import { moveOrCopyAttachmentsForNote } from "./mover";
import { findOrphanAttachments } from "./orphan-scanner";
import { extractAttachmentLinks } from "./parser";
import { resolveAttachmentFiles } from "./resolver";
import { DEFAULT_SETTINGS, ConsistentAttachmentsSettingTab, sanitizeSettings } from "./settings";
import { isPathExcluded, isRenameOnly } from "./safety";
import type { ConsistentAttachmentsSettings } from "./types";
import { LogModal } from "./ui/log-modal";
import { OrphanModal } from "./ui/orphan-modal";

export default class ConsistentAttachmentsPlugin extends Plugin {
	settings: ConsistentAttachmentsSettings = DEFAULT_SETTINGS;
	private logger = new OperationLogger(() => this.settings.logLimit);

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new ConsistentAttachmentsSettingTab(this.app, this));
		this.registerRenameHandler();
		this.registerCommands();
		this.registerFileContextMenu();
	}

	private registerRenameHandler(): void {
		this.registerEvent(
			this.app.vault.on("rename", async (file, oldPath) => {
				if (!(file instanceof TFile) || file.extension !== "md") {
					return;
				}
				if (!this.settings.autoMoveEnabled) {
					return;
				}
				if (isRenameOnly(file.path, oldPath)) {
					return;
				}
				if (
					isPathExcluded(file.path, this.settings.excludedFolders) ||
					isPathExcluded(oldPath, this.settings.excludedFolders)
				) {
					return;
				}

				await this.moveAttachmentsForNote(file);
			})
		);
	}

	private registerCommands(): void {
		this.addCommand({
			id: "move-attachments-for-current-note",
			name: "Move attachments for current note",
			checkCallback: (checking) => {
				const note = this.getActiveNote();
				if (!note) {
					return false;
				}
				if (!checking) {
					void this.moveAttachmentsForNote(note);
				}
				return true;
			},
		});

		this.addCommand({
			id: "find-orphaned-attachments",
			name: "Find orphaned attachments",
			callback: async () => {
				const orphans = await findOrphanAttachments(this.app);
				new OrphanModal(this.app, orphans).open();
			},
		});

		this.addCommand({
			id: "show-recent-operation-log",
			name: "Show recent operation log",
			callback: () => {
				new LogModal(this.app, this.logger.list()).open();
			},
		});

		this.addCommand({
			id: "toggle-auto-move",
			name: "Toggle auto-move on/off",
			callback: async () => {
				this.settings.autoMoveEnabled = !this.settings.autoMoveEnabled;
				await this.saveSettings();
				this.maybeNotice(`Auto-move ${this.settings.autoMoveEnabled ? "enabled" : "disabled"}.`);
			},
		});
	}

	private registerFileContextMenu(): void {
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (!(file instanceof TFile) || file.extension !== "md") {
					return;
				}
				menu.addItem((item) =>
					item.setTitle("Move attachments for this note").onClick(() => {
						void this.moveAttachmentsForNote(file);
					})
				);
			})
		);
	}

	private async moveAttachmentsForNote(note: TFile): Promise<void> {
		const markdown = await this.app.vault.cachedRead(note);
		const links = extractAttachmentLinks(markdown);
		const attachments = resolveAttachmentFiles(links, note.path, {
			resolveFirstLinkpathDest: (linktext, sourcePath) =>
				this.app.metadataCache.getFirstLinkpathDest(linktext, sourcePath),
		});

		await moveOrCopyAttachmentsForNote(
			{
				app: this.app,
				settings: this.settings,
				isShared: (file, ownerNotePath) => this.isSharedAttachment(file, ownerNotePath),
				pushLog: (entry) => this.logger.add(entry),
			},
			note,
			attachments
		);

		this.maybeNotice(`Processed ${attachments.length} attachment(s) for "${note.basename}".`);
	}

	private isSharedAttachment(file: TFile, ownerNotePath: string): boolean {
		const resolvedLinks = this.app.metadataCache.resolvedLinks;
		const targetPath = file.path;
		for (const [sourcePath, targets] of Object.entries(resolvedLinks)) {
			if (sourcePath === ownerNotePath) {
				continue;
			}
			if ((targets[targetPath] ?? 0) > 0) {
				return true;
			}
		}
		return false;
	}

	private getActiveNote(): TFile | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		return view?.file ?? null;
	}

	private maybeNotice(message: string): void {
		if (this.settings.showNotices) {
			new Notice(message);
		}
	}

	async loadSettings(): Promise<void> {
		const loaded = (await this.loadData()) as Partial<ConsistentAttachmentsSettings> | null;
		this.settings = sanitizeSettings({ ...DEFAULT_SETTINGS, ...(loaded ?? {}) });
	}

	async saveSettings(): Promise<void> {
		this.settings = sanitizeSettings(this.settings);
		await this.saveData(this.settings);
	}
}
