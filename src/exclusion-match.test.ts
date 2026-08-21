import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	isFileExcluded,
	isPathExcluded,
	prepareFolderPattern,
	wildcardToRegExp,
} from "./exclusion-match.ts";

describe("prepareFolderPattern", () => {
	it("does not collapse */ into *", () => {
		assert.equal(prepareFolderPattern("*/"), "*/");
	});

	it("keeps wildcard folder patterns verbatim after trim", () => {
		assert.equal(prepareFolderPattern("  */__WIP  "), "*/__WIP");
	});

	it("strips trailing slashes from literal folders only", () => {
		assert.equal(prepareFolderPattern("Templates/"), "Templates");
	});
});

describe("isPathExcluded", () => {
	it("matches */__WIP against nested __WIP folders, not files named __WIP", () => {
		assert.equal(isPathExcluded("foo/__WIP/a.png", ["*/__WIP"]), true);
		assert.equal(isPathExcluded("a/b/__WIP/c.png", ["*/__WIP"]), true);
		assert.equal(isPathExcluded("foo/__WIP.png", ["*/__WIP"]), false);
	});

	it("does not match *tmp* against a file whose name contains tmp", () => {
		assert.equal(isPathExcluded("my-tmp-file.png", ["*tmp*"]), false);
		assert.equal(isPathExcluded("notes/tmp/file.png", ["*tmp*"]), true);
	});

	it("treats Projects/secret/* as a folder prefix", () => {
		assert.equal(isPathExcluded("Projects/secret/img.png", ["Projects/secret/*"]), true);
		assert.equal(isPathExcluded("Projects/other/img.png", ["Projects/secret/*"]), false);
	});

	it("keeps literal folder matches case-sensitive", () => {
		assert.equal(isPathExcluded("Templates/note.md", ["Templates"]), true);
		assert.equal(isPathExcluded("templates/note.md", ["Templates"]), false);
	});

	it("keeps wildcard folder matches case-sensitive", () => {
		assert.equal(isPathExcluded("TemplateStuff/note.md", ["Template*"]), true);
		assert.equal(isPathExcluded("templates/note.md", ["Template*"]), false);
	});

	it("treats * as matching every nested folder, not vault-root files", () => {
		assert.equal(isPathExcluded("notes/image.png", ["*"]), true);
		assert.equal(isPathExcluded("image.png", ["*"]), false);
	});

	it("does not let ? match a slash", () => {
		assert.equal(isPathExcluded("a/c/file.png", ["a?c"]), false);
		assert.equal(isPathExcluded("axc/file.png", ["a?c"]), true);
	});
});

describe("isFileExcluded", () => {
	it("matches filename globs without a slash", () => {
		assert.equal(isFileExcluded("notes/script.py", ["*.py"]), true);
		assert.equal(isFileExcluded("notes/chart-generated.svg", ["*-generated.svg"]), true);
		assert.equal(isFileExcluded("notes/chart.svg", ["*-generated.svg"]), false);
	});

	it("matches vault-path globs when the pattern contains a slash", () => {
		assert.equal(isFileExcluded("notes/chart.svg", ["notes/*.svg"]), true);
		assert.equal(isFileExcluded("other/chart.svg", ["notes/*.svg"]), false);
	});

	it("is case-sensitive", () => {
		assert.equal(isFileExcluded("notes/Script.PY", ["*.py"]), false);
	});

	it("does not let ? match a slash", () => {
		assert.equal(wildcardToRegExp("a?b").test("a/b"), false);
		assert.equal(wildcardToRegExp("a?b").test("axb"), true);
	});
});
