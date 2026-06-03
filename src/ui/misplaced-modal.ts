import { App, Modal, Notice, Setting, TFile } from "obsidian";
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

		contentEl.createEl("h3", { text: "Misplaced attachments" });

		if (this.items.length === 0) {
			contentEl.createEl("p", { text: "No misplaced attachments found." });
			return;
		}

		const visible = this.getVisibleItems();
		const summary = contentEl.createEl("p", {
			cls: "consistent-attachments-misplaced-summary",
		});
		summary.setText(
			`${this.items.length} linked file(s) not at the expected path, ${formatFileSize(totalSize(this.items))} total. Showing ${visible.length}.`
		);

		contentEl.createEl("p", {
			cls: "consistent-attachments-misplaced-hint",
			text: "These files are still referenced by notes. Use relocate actions to move them; do not delete them from the orphan scanner.",
		});

		new Setting(contentEl)
			.setName("Filter")
			.addText((text) => {
				text.setPlaceholder("Search by name, path, or note…");
				text.setValue(this.filterText);
				text.onChange((value) => {
					this.filterText = value;
					this.render();
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
						this.render();
					});
			});

		const list = contentEl.createDiv({ cls: "consistent-attachments-misplaced-list" });

		if (visible.length === 0) {
			list.createEl("p", { text: "No files match your filter." });
		} else {
			for (const item of visible) {
				this.renderRow(list, item);
			}
		}

		const footer = contentEl.createDiv({ cls: "consistent-attachments-misplaced-actions" });
		new Setting(footer)
			.addButton((button) =>
				button
					.setButtonText("Relocate shown")
					.setCta()
					.setDisabled(this.relocating || visible.length === 0)
					.onClick(() => {
						void this.relocateShown(visible);
					})
			)
			.addButton((button) =>
				button.setButtonText("Close").onClick(() => {
					this.close();
				})
			);
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

	private removeResolvedItem(item: MisplacedAttachment, pathBefore: string): void {
		if (!this.app.vault.getAbstractFileByPath(pathBefore)) {
			this.items = this.items.filter((candidate) => candidate.file.path !== pathBefore);
		}
	}

	private async relocateOne(item: MisplacedAttachment): Promise<void> {
		if (this.relocating) {
			return;
		}

		this.relocating = true;
		const pathBefore = item.file.path;
		try {
			await this.actions.relocate(item);
			this.removeResolvedItem(item, pathBefore);
			new Notice(`Relocated "${item.file.name}".`);
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
						this.removeResolvedItem(item, pathBefore);
						relocated += 1;
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
