import { App, Modal, Setting } from "obsidian";

export type ConflictDecision = "skip" | "copy";

export class ConflictModal extends Modal {
	private decision: ConflictDecision = "skip";

	constructor(
		app: App,
		private readonly attachmentPath: string,
		private readonly onDone: (decision: ConflictDecision) => void
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h3", { text: "Shared attachment detected" });
		contentEl.createEl("p", {
			text: `How do you want to handle "${this.attachmentPath}" for this move operation?`,
		});

		new Setting(contentEl)
			.addButton((button) =>
				button.setButtonText("Skip").setCta().onClick(() => {
					this.decision = "skip";
					this.close();
				})
			)
			.addButton((button) =>
				button.setButtonText("Copy").onClick(() => {
					this.decision = "copy";
					this.close();
				})
			);
	}

	onClose(): void {
		this.contentEl.empty();
		this.onDone(this.decision);
	}
}
