import globals from "globals";
import pluginJs from "@eslint/js";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      "**/cdk.out/**",
      "dist/**",
      "coverage/**",
      "node_modules/**",
    ],
  },
  {
    languageOptions: { globals: globals.node },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  pluginJs.configs.recommended,
];

