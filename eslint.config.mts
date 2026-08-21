import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
	{
		linterOptions: {
			reportUnusedDisableDirectives: "error",
		},
		languageOptions: {
			parserOptions: {
				projectService: {
					allowDefaultProject: ["eslint.config.mts", "manifest.json"],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: [".json"],
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		files: ["**/*.ts"],
		rules: {
			"@typescript-eslint/no-unsafe-argument": "error",
			"@typescript-eslint/no-unsafe-assignment": "error",
			"@typescript-eslint/no-unsafe-call": "error",
			"@typescript-eslint/no-unsafe-member-access": "error",
			"obsidianmd/no-unsupported-api": "error",
			"obsidianmd/prefer-create-el": "error",
			"obsidianmd/prefer-file-manager-trash-file": "error",
			"obsidianmd/settings-tab/prefer-setting-definitions": "error",
		},
	},
	{
		files: ["**/*.test.ts"],
		rules: {
			"obsidianmd/no-nodejs-modules": "off",
			"obsidianmd/no-unsupported-api": "off",
			"obsidianmd/prefer-create-el": "off",
			"obsidianmd/prefer-file-manager-trash-file": "off",
			"obsidianmd/settings-tab/prefer-setting-definitions": "off",
		},
	},
	globalIgnores([
		"node_modules",
		"dist",
		"esbuild.config.mjs",
		"eslint.config.js",
		"eslint.config.mts",
		"version-bump.mjs",
		"versions.json",
		"main.js",
	])
);
