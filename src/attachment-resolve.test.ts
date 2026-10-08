import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAttachmentRefs } from "./attachment-resolve.ts";

function file(path: string, extension: string): { path: string; extension: string } {
	return { path, extension };
}

describe("resolveAttachmentRefs", () => {
	it("resolves relative links via the previous note path after a move", () => {
		const attachment = file("Source/_attachments/image.png", "png");
		const result = resolveAttachmentRefs(
			[{ target: "_attachments/image.png" }],
			["Source/note.md", "Destination/note.md"],
			(target, sourcePath) => {
				if (target === "_attachments/image.png" && sourcePath === "Source/note.md") {
					return attachment;
				}
				return null;
			}
		);

		assert.deepEqual(
			result.files.map((entry) => entry.path),
			["Source/_attachments/image.png"]
		);
		assert.deepEqual(result.unresolvedTargets, []);
	});

	it("falls back to the current note path when only that resolves", () => {
		const attachment = file("Source/_attachments/image.png", "png");
		const result = resolveAttachmentRefs(
			[{ target: "Source/_attachments/image.png" }],
			["Source/note.md", "Destination/note.md"],
			(target, sourcePath) => {
				if (target === "Source/_attachments/image.png" && sourcePath === "Destination/note.md") {
					return attachment;
				}
				return null;
			}
		);

		assert.deepEqual(
			result.files.map((entry) => entry.path),
			["Source/_attachments/image.png"]
		);
		assert.deepEqual(result.unresolvedTargets, []);
	});

	it("reports unresolved non-markdown targets", () => {
		const result = resolveAttachmentRefs(
			[{ target: "_attachments/missing.png" }],
			["Destination/note.md"],
			() => null
		);

		assert.deepEqual(result.files, []);
		assert.deepEqual(result.unresolvedTargets, ["_attachments/missing.png"]);
	});

	it("ignores markdown note targets without reporting them unresolved", () => {
		const result = resolveAttachmentRefs(
			[{ target: "Other/note" }],
			["Destination/note.md"],
			() => "markdown"
		);

		assert.deepEqual(result.files, []);
		assert.deepEqual(result.unresolvedTargets, []);
	});

	it("deduplicates source paths and resolved files", () => {
		const attachment = file("Source/_attachments/image.png", "png");
		const result = resolveAttachmentRefs(
			[{ target: "_attachments/image.png" }, { target: "_attachments/image.png" }],
			["Source/note.md", "Source/note.md", "Destination/note.md"],
			() => attachment
		);

		assert.equal(result.files.length, 1);
		assert.equal(result.files[0]?.path, "Source/_attachments/image.png");
	});
});
