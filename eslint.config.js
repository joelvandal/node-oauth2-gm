import globals from "globals";
import pluginJs from "@eslint/js";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    languageOptions: {
      globals: {
        ...globals.browser, // Includes browser globals
        ...globals.node,    // Adds Node.js globals like `process`
      },
    },
  },
  pluginJs.configs.recommended,
];
