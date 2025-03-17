import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import simpleImportSortPlugin from "eslint-plugin-simple-import-sort";
import prettierPlugin from "eslint-plugin-prettier/recommended";

export default tseslint.config(
  { ignores: ["dist"] },
  prettierPlugin,
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "simple-import-sort": simpleImportSortPlugin,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/interface-name-prefix": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      camelcase: [
        "error",
        {
          properties: "never",
        },
      ],
      eqeqeq: "error",
      "max-depth": "error",
      "no-alert": "error",
      "no-array-constructor": "error",
      "no-console": [
        "error",
        {
          allow: ["warn", "error"],
        },
      ],
      "no-eval": "error",
      "no-implicit-coercion": "error",
      "no-lonely-if": "error",
      "no-nested-ternary": "error",
      "no-negated-condition": "error",
      "no-unneeded-ternary": "error",
      "no-undef-init": "error",
      "no-underscore-dangle": "error",
      "no-useless-concat": "error",
      "no-void": "error",
      "no-var": "error",
      "prefer-const": "error",
      "prefer-promise-reject-errors": "error",
      "prefer-template": "error",
      yoda: "error",
      "no-unused-vars": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-extra-semi": "off",
    },
  },
  {
    ignores: [
      "apps/frontend/src/api/**",
      "apps/frontend/dist/**",
      "apps/frontend/build/**",
      "apps/backend/dist/**",
      "apps/backend/build/**",
      "node_modules/**",
    ],
  },
);
