import { App, Modal } from "obsidian";
import type { TFile } from "obsidian";

export class OrphanModal extends Modal {
	constructor(app: App, private readonly orphans: TFile[]) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h3", { text: "Orphaned attachments" });
		contentEl.createEl("p", {
			text: `${this.orphans.length} unreferenced attachment(s) found. This scan is read-only.`,
		});

		const list = contentEl.createEl("ul");
		for (const file of this.orphans) {
			list.createEl("li", { text: file.path });
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
