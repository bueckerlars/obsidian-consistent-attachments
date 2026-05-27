import type { App, TAbstractFile } from "obsidian";

interface FileExplorerView {
	revealInFolder(file: TAbstractFile): void;
}

export async function revealFileInExplorer(app: App, file: TAbstractFile): Promise<void> {
	let leaves = app.workspace.getLeavesOfType("file-explorer");

	if (leaves.length === 0) {
		const leaf = app.workspace.getLeaf(false);
		await leaf.setViewState({ type: "file-explorer" });
		leaves = app.workspace.getLeavesOfType("file-explorer");
	}

	const leaf = leaves[0];
	if (!leaf) {
		return;
	}

	await app.workspace.revealLeaf(leaf);
	(leaf.view as unknown as FileExplorerView).revealInFolder(file);
}
