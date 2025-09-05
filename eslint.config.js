<<<<<<< HEAD
import { defineConfig } from "eslint/config";
import globals from "globals";
import js from "@eslint/js";

export default defineConfig([
  { files: ["**/*.js"], languageOptions: { globals: globals.browser } },
  { files: ["**/*.js"], plugins: { js }, extends: ["js/recommended"] },
  {
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "warn",
    },
  },
]);
=======
import eslintPluginAstro from "eslint-plugin-astro";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  ...tseslint.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  { rules: { "no-console": "error" } },
  { ignores: ["dist/**", ".astro", "public/pagefind/**"] },
];
>>>>>>> 3c45e98 (Initial commit from Astro)
