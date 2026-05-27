import { App, Modal } from "obsidian";
import type { OperationLogEntry } from "../types";

function formatTime(timestamp: number): string {
	return new Date(timestamp).toLocaleString();
}

export class LogModal extends Modal {
	constructor(app: App, private readonly entries: OperationLogEntry[]) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h3", { text: "Recent attachment operations" });

		if (this.entries.length === 0) {
			contentEl.createEl("p", { text: "No operations recorded yet." });
			return;
		}

		for (const entry of this.entries) {
			const row = contentEl.createDiv({ cls: "consistent-attachments-log-row" });
			row.createEl("strong", { text: `${formatTime(entry.timestamp)} - ${entry.status.toUpperCase()}` });
			row.createEl("div", { text: `Note: ${entry.notePath}` });
			if (entry.sourcePath) {
				row.createEl("div", { text: `From: ${entry.sourcePath}` });
			}
			if (entry.targetPath) {
				row.createEl("div", { text: `To: ${entry.targetPath}` });
			}
			row.createEl("div", { text: `Reason: ${entry.reason}` });
			row.createEl("hr");
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
