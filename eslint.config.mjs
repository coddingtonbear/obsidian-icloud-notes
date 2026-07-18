import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  {
    ignores: ["node_modules/", "main.js"],
  },

  ...obsidianmd.configs.recommended,

  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { project: "./tsconfig.json" },
    },
    rules: {
      // The plugin deliberately shells out to the icloud-md CLI via
      // node:child_process rather than bundling the sync engine.
      "obsidianmd/no-nodejs-modules": "off",

      "obsidianmd/ui/sentence-case": [
        "error",
        {
          acronyms: ["PATH", "GUI", "CLI"],
          brands: ["Obsidian", "icloud-md", "Node"],
          allowAutoFix: true,
        },
      ],
    },
  },
]);
