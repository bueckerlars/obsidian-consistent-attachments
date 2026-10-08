import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	filterMisplacedAttachmentsForDisplay,
	isUnmovableMisplacedAttachment,
} from "./misplaced-filter.ts";
import type { MisplacedAttachment } from "./types.ts";

function item(path: string, notePaths: string[]): MisplacedAttachment {
	return {
		file: { path, name: path.split("/").pop() ?? path } as MisplacedAttachment["file"],
		notePaths,
		expectedPath: `Dest/${path.split("/").pop() ?? path}`,
	};
}

describe("isUnmovableMisplacedAttachment", () => {
	it("is true for shared files when strategy is skip", () => {
		const misplaced = item("shared.png", ["a.md", "b.md"]);
		assert.equal(
			isUnmovableMisplacedAttachment(misplaced, { sharedAttachmentStrategy: "skip" }, () => true),
			true
		);
	});

	it("is false when strategy is copy or ask", () => {
		const misplaced = item("shared.png", ["a.md", "b.md"]);
		assert.equal(
			isUnmovableMisplacedAttachment(misplaced, { sharedAttachmentStrategy: "copy" }, () => true),
			false
		);
		assert.equal(
			isUnmovableMisplacedAttachment(misplaced, { sharedAttachmentStrategy: "ask" }, () => true),
			false
		);
	});

	it("is false when the file is not shared", () => {
		const misplaced = item("solo.png", ["a.md"]);
		assert.equal(
			isUnmovableMisplacedAttachment(misplaced, { sharedAttachmentStrategy: "skip" }, () => false),
			false
		);
	});
});

describe("filterMisplacedAttachmentsForDisplay", () => {
	const solo = item("solo.png", ["a.md"]);
	const shared = item("shared.png", ["a.md", "b.md"]);

	it("hides unmovable items when the setting is enabled", () => {
		const result = filterMisplacedAttachmentsForDisplay(
			[solo, shared],
			{ sharedAttachmentStrategy: "skip", hideUnmovableMisplacedResults: true },
			(file) => file.path === "shared.png"
		);
		assert.deepEqual(
			result.map((entry) => entry.file.path),
			["solo.png"]
		);
	});

	it("keeps all items when the setting is disabled", () => {
		const result = filterMisplacedAttachmentsForDisplay(
			[solo, shared],
			{ sharedAttachmentStrategy: "skip", hideUnmovableMisplacedResults: false },
			(file) => file.path === "shared.png"
		);
		assert.equal(result.length, 2);
	});

	it("keeps shared items when strategy is copy", () => {
		const result = filterMisplacedAttachmentsForDisplay(
			[solo, shared],
			{ sharedAttachmentStrategy: "copy", hideUnmovableMisplacedResults: true },
			() => true
		);
		assert.equal(result.length, 2);
	});
});
