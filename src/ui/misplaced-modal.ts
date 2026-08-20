import { App, Modal, normalizePath, Notice, Setting, TFile, type ButtonComponent } from "obsidian";
import { revealFileInExplorer } from "../file-explorer";
import type { MisplacedAttachment } from "../types";
import { ConfirmModal } from "./confirm-modal";

type SortKey = "path" | "size" | "mtime";

function formatFileSize(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes} B`;
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function totalSize(items: MisplacedAttachment[]): number {
	return items.reduce((sum, item) => sum + item.file.stat.size, 0);
}

export interface MisplacedModalActions {
	relocate: (item: MisplacedAttachment) => Promise<void>;
}

export class MisplacedModal extends Modal {
	private filterText = "";
	private sortKey: SortKey = "path";
	private relocating = false;
	private summaryEl: HTMLElement | null = null;
	private listEl: HTMLElement | null = null;
	private relocateShownButton: ButtonComponent | null = null;

	constructor(
		app: App,
		private items: MisplacedAttachment[],
		private actions: MisplacedModalActions
	) {
		super(app);
		this.modalEl.addClass("consistent-attachments-misplaced-modal");
	}

	onOpen(): void {
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private getVisibleItems(): MisplacedAttachment[] {
		const query = this.filterText.trim().toLowerCase();
		let items = query
			? this.items.filter(
					(item) =>
						item.file.path.toLowerCase().includes(query) ||
						item.file.name.toLowerCase().includes(query) ||
						item.expectedPath.toLowerCase().includes(query) ||
						item.notePaths.some((path) => path.toLowerCase().includes(query))
				)
			: [...this.items];

		switch (this.sortKey) {
			case "size":
				items.sort((a, b) => b.file.stat.size - a.file.stat.size);
				break;
			case "mtime":
				items.sort((a, b) => b.file.stat.mtime - a.file.stat.mtime);
				break;
			default:
				items.sort((a, b) => a.file.path.localeCompare(b.file.path));
		}

		return items;
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.summaryEl = null;
		this.listEl = null;
		this.relocateShownButton = null;

		contentEl.createEl("h3", { text: "Misplaced attachments" });

		if (this.items.length === 0) {
			contentEl.createEl("p", { text: "No misplaced attachments found." });
			return;
		}

		this.summaryEl = contentEl.createEl("p", {
			cls: "consistent-attachments-misplaced-summary",
		});

		contentEl.createEl("p", {
			cls: "consistent-attachments-misplaced-hint",
			text: "These files are still referenced by notes. Use relocate actions to move them; do not delete them from the orphan scanner.",
		});

		new Setting(contentEl)
			.setName("Filter")
			.addText((text) => {
				text.setPlaceholder("Search by name, path, or note…");
				text.setValue(this.filterText);
				// Only re-render the list so the input element survives and keeps focus.
				text.onChange((value) => {
					this.filterText = value;
					this.renderList();
				});
			});

		new Setting(contentEl)
			.setName("Sort by")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("path", "Path")
					.addOption("size", "Size")
					.addOption("mtime", "Modified")
					.setValue(this.sortKey)
					.onChange((value) => {
						this.sortKey = value as SortKey;
						this.renderList();
					});
			});

		this.listEl = contentEl.createDiv({ cls: "consistent-attachments-misplaced-list" });

		const footer = contentEl.createDiv({ cls: "consistent-attachments-misplaced-actions" });
		new Setting(footer)
			.addButton((button) => {
				this.relocateShownButton = button;
				button
					.setButtonText("Relocate shown")
					.setCta()
					.onClick(() => {
						void this.relocateShown(this.getVisibleItems());
					});
			})
			.addButton((button) =>
				button.setButtonText("Close").onClick(() => {
					this.close();
				})
			);

		this.renderList();
	}

	private renderList(): void {
		if (!this.summaryEl || !this.listEl) {
			return;
		}

		const visible = this.getVisibleItems();
		this.summaryEl.setText(
			`${this.items.length} linked file(s) not at the expected path, ${formatFileSize(totalSize(this.items))} total. Showing ${visible.length}.`
		);

		this.relocateShownButton?.setDisabled(this.relocating || visible.length === 0);

		this.listEl.empty();
		if (visible.length === 0) {
			this.listEl.createEl("p", { text: "No files match your filter." });
		} else {
			for (const item of visible) {
				this.renderRow(this.listEl, item);
			}
		}
	}

	private renderRow(container: HTMLElement, item: MisplacedAttachment): void {
		const primaryNote = item.notePaths[0] ?? "";
		const referencerLabel =
			item.notePaths.length === 1
				? primaryNote
				: `${primaryNote} (+${item.notePaths.length - 1} more)`;
		const desc = [
			item.file.parent?.path ?? "",
			`→ ${item.expectedPath}`,
			`from ${referencerLabel}`,
			formatFileSize(item.file.stat.size),
		]
			.filter(Boolean)
			.join(" · ");

		new Setting(container)
			.setName(item.file.name)
			.setDesc(desc)
			.addButton((button) =>
				button.setIcon("file").setTooltip("Open attachment").onClick(() => {
					void this.openFile(item.file);
				})
			)
			.addButton((button) =>
				button.setIcon("file-text").setTooltip("Open referencing note").onClick(() => {
					void this.openNote(primaryNote);
				})
			)
			.addButton((button) =>
				button.setIcon("folder-open").setTooltip("Reveal in explorer").onClick(() => {
					void revealFileInExplorer(this.app, item.file);
				})
			)
			.addButton((button) =>
				button
					.setIcon("arrow-right")
					.setTooltip("Relocate to expected path")
					.setDisabled(this.relocating)
					.onClick(() => {
						void this.relocateOne(item);
					})
			);
	}

	private async openFile(file: TFile): Promise<void> {
		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(file);
	}

	private async openNote(notePath: string): Promise<void> {
		const note = this.app.vault.getAbstractFileByPath(notePath);
		if (!(note instanceof TFile)) {
			return;
		}
		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(note);
	}

	private shouldRemoveAfterRelocate(item: MisplacedAttachment, pathBefore: string): boolean {
		if (!this.app.vault.getAbstractFileByPath(pathBefore)) {
			return true;
		}
		return normalizePath(item.file.path) !== normalizePath(pathBefore);
	}

	private removeResolvedItem(item: MisplacedAttachment, pathBefore: string): void {
		if (!this.shouldRemoveAfterRelocate(item, pathBefore)) {
			return;
		}

		this.items = this.items.filter(
			(candidate) =>
				candidate.file !== item.file && normalizePath(candidate.file.path) !== normalizePath(pathBefore)
		);
	}

	private async relocateOne(item: MisplacedAttachment): Promise<void> {
		if (this.relocating) {
			return;
		}

		this.relocating = true;
		const pathBefore = item.file.path;
		try {
			await this.actions.relocate(item);
			if (this.shouldRemoveAfterRelocate(item, pathBefore)) {
				this.removeResolvedItem(item, pathBefore);
				new Notice(`Relocated "${item.file.name}".`);
			} else {
				new Notice(`"${item.file.name}" was not relocated (skipped or already in place).`);
			}
			this.render();
		} catch (error) {
			new Notice(
				`Failed to relocate "${item.file.name}": ${error instanceof Error ? error.message : "unknown error"}`
			);
		} finally {
			this.relocating = false;
		}
	}

	private relocateShown(items: MisplacedAttachment[]): void {
		if (items.length === 0) {
			return;
		}

		const message =
			items.length === 1
				? `Relocate "${items[0]?.file.name}" to the expected path?`
				: `Relocate ${items.length} files to their expected paths?`;

		new ConfirmModal(this.app, message, "Relocate", async () => {
			this.relocating = true;
			let relocated = 0;
			try {
				for (const item of items) {
					const pathBefore = item.file.path;
					try {
						await this.actions.relocate(item);
						if (this.shouldRemoveAfterRelocate(item, pathBefore)) {
							this.removeResolvedItem(item, pathBefore);
							relocated += 1;
						}
					} catch {
						// Keep remaining items in the list for manual retry.
					}
				}
				new Notice(`Relocated ${relocated} of ${items.length} file(s).`);
				this.render();
			} finally {
				this.relocating = false;
			}
		}).open();
	}
}
