import { App, Modal, Notice, Setting, TFile } from "obsidian";
import { revealFileInExplorer } from "../file-explorer";
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

function totalSize(files: TFile[]): number {
	return files.reduce((sum, file) => sum + file.stat.size, 0);
}

export class OrphanModal extends Modal {
	private filterText = "";
	private sortKey: SortKey = "path";

	constructor(
		app: App,
		private orphans: TFile[]
	) {
		super(app);
		this.modalEl.addClass("consistent-attachments-orphan-modal");
	}

	onOpen(): void {
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private getVisibleOrphans(): TFile[] {
		const query = this.filterText.trim().toLowerCase();
		let files = query
			? this.orphans.filter(
					(file) =>
						file.path.toLowerCase().includes(query) ||
						file.name.toLowerCase().includes(query)
				)
			: [...this.orphans];

		switch (this.sortKey) {
			case "size":
				files.sort((a, b) => b.stat.size - a.stat.size);
				break;
			case "mtime":
				files.sort((a, b) => b.stat.mtime - a.stat.mtime);
				break;
			default:
				files.sort((a, b) => a.path.localeCompare(b.path));
		}

		return files;
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h3", { text: "Orphaned attachments" });

		if (this.orphans.length === 0) {
			contentEl.createEl("p", { text: "No orphaned attachments found." });
			return;
		}

		const visible = this.getVisibleOrphans();
		const summary = contentEl.createEl("p", {
			cls: "consistent-attachments-orphan-summary",
		});
		summary.setText(
			`${this.orphans.length} unreferenced file(s), ${formatFileSize(totalSize(this.orphans))} total. Showing ${visible.length}.`
		);

		new Setting(contentEl)
			.setName("Filter")
			.addText((text) => {
				text.setPlaceholder("Search by name or path…");
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

		const list = contentEl.createDiv({ cls: "consistent-attachments-orphan-list" });

		if (visible.length === 0) {
			list.createEl("p", { text: "No files match your filter." });
		} else {
			for (const file of visible) {
				this.renderRow(list, file);
			}
		}

		const actions = contentEl.createDiv({ cls: "consistent-attachments-orphan-actions" });
		new Setting(actions)
			.addButton((button) =>
				button.setButtonText("Delete shown").setWarning().onClick(() => {
					void this.deleteShown(visible);
				})
			)
			.addButton((button) =>
				button.setButtonText("Close").onClick(() => {
					this.close();
				})
			);
	}

	private renderRow(container: HTMLElement, file: TFile): void {
		const folder = file.parent?.path ?? "";
		const desc = [folder, formatFileSize(file.stat.size), new Date(file.stat.mtime).toLocaleString()]
			.filter(Boolean)
			.join(" · ");

		new Setting(container)
			.setName(file.name)
			.setDesc(desc)
			.addButton((button) =>
				button.setIcon("file").setTooltip("Open").onClick(() => {
					void this.openFile(file);
				})
			)
			.addButton((button) =>
				button.setIcon("folder-open").setTooltip("Reveal in explorer").onClick(() => {
					void this.revealInExplorer(file);
				})
			)
			.addButton((button) =>
				button.setIcon("trash").setTooltip("Move to trash").setWarning().onClick(() => {
					void this.deleteFile(file);
				})
			);
	}

	private async openFile(file: TFile): Promise<void> {
		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(file);
	}

	private async revealInExplorer(file: TFile): Promise<void> {
		await revealFileInExplorer(this.app, file);
	}

	private async deleteFile(file: TFile): Promise<void> {
		await this.app.fileManager.promptForDeletion(file);
		if (this.app.vault.getAbstractFileByPath(file.path)) {
			return;
		}

		this.orphans = this.orphans.filter((candidate) => candidate.path !== file.path);
		new Notice(`Moved "${file.name}" to trash.`);
		this.render();
	}

	private deleteShown(files: TFile[]): void {
		if (files.length === 0) {
			return;
		}

		const message =
			files.length === 1
				? `Move "${files[0]?.name}" to trash?`
				: `Move ${files.length} files to trash?`;

		new ConfirmModal(this.app, message, "Move to trash", async () => {
			for (const file of files) {
				await this.app.fileManager.trashFile(file);
			}

			const deletedPaths = new Set(files.map((file) => file.path));
			this.orphans = this.orphans.filter((file) => !deletedPaths.has(file.path));
			new Notice(`Moved ${files.length} file(s) to trash.`);
			this.render();
		}).open();
	}
}
