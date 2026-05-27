import { MarkdownView, Notice, Plugin, TFile } from "obsidian";
import { hasAttachmentLayoutChanged } from "./attachment-path";
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
	private reconcileTimer: number | null = null;
	private reconcileRunning = false;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new ConsistentAttachmentsSettingTab(this.app, this));
		this.registerRenameHandler();
		this.registerCommands();
		this.registerFileContextMenu();
	}

	onunload(): void {
		if (this.reconcileTimer !== null) {
			window.clearTimeout(this.reconcileTimer);
			this.reconcileTimer = null;
		}
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

				await this.moveAttachmentsForNote(file, { previousNotePath: oldPath });
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

	private async moveAttachmentsForNote(
		note: TFile,
		options?: { silent?: boolean; previousNotePath?: string }
	): Promise<void> {
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
				folderCleanup: {
					note,
					previousNotePaths: options?.previousNotePath ? [options.previousNotePath] : undefined,
				},
			},
			note,
			attachments
		);

		if (!options?.silent) {
			this.maybeNotice(`Processed ${attachments.length} attachment(s) for "${note.basename}".`);
		}
	}

	private shouldReconcileAttachments(
		previous: ConsistentAttachmentsSettings,
		next: ConsistentAttachmentsSettings
	): boolean {
		if (!next.autoMoveEnabled) {
			return false;
		}
		if (!previous.autoMoveEnabled && next.autoMoveEnabled) {
			return true;
		}
		return hasAttachmentLayoutChanged(previous, next);
	}

	private scheduleAttachmentReconcile(): void {
		if (this.reconcileTimer !== null) {
			window.clearTimeout(this.reconcileTimer);
		}
		this.reconcileTimer = window.setTimeout(() => {
			this.reconcileTimer = null;
			void this.reconcileVaultAttachments();
		}, 800);
	}

	private async reconcileVaultAttachments(): Promise<void> {
		if (this.reconcileRunning || !this.settings.autoMoveEnabled) {
			return;
		}

		this.reconcileRunning = true;
		try {
			const notes = this.app.vault
				.getMarkdownFiles()
				.filter((note) => !isPathExcluded(note.path, this.settings.excludedFolders));

			for (const note of notes) {
				await this.moveAttachmentsForNote(note, { silent: true });
			}

			this.maybeNotice(`Applied attachment layout to ${notes.length} note(s).`);
		} finally {
			this.reconcileRunning = false;
		}
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
		const previous = { ...this.settings };
		this.settings = sanitizeSettings(this.settings);
		await this.saveData(this.settings);

		if (!this.shouldReconcileAttachments(previous, this.settings)) {
			return;
		}

		const textOnlyLayoutChange =
			previous.targetPathMode === this.settings.targetPathMode &&
			hasAttachmentLayoutChanged(previous, this.settings);

		if (textOnlyLayoutChange) {
			this.scheduleAttachmentReconcile();
			return;
		}

		void this.reconcileVaultAttachments();
	}
}
