import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

// Feature Isolation — no feature may import from another feature, and src/shared may not
// import a feature either (BOARD Decision 2026-09-14). Shared code lives in src/shared/.
const FEATURES = ["dashboard", "map", "simulation", "flood", "air-quality", "alerts"];
const featureIsolation = FEATURES.map((feat) => ({
  files: [`src/features/${feat}/**/*.{ts,tsx}`],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: FEATURES.filter((f) => f !== feat).map((other) => ({
          group: [`@/features/${other}/*`, `@/features/${other}`],
          message: `features/${feat} must not import from features/${other} — move shared code to src/shared/.`,
        })),
      },
    ],
  },
}));

export default defineConfig([
  globalIgnores(["dist", "src/components/ui/**"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  ...featureIsolation,
  {
    files: ["src/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: FEATURES.map((f) => ({
            group: [`@/features/${f}/*`, `@/features/${f}`],
            message: "src/shared must not import a feature — shared cannot depend on the code that depends on it.",
          })),
        },
      ],
    },
  },
  {
    // The route table declares one `const SomePage = lazyPage(() => import(...))` binding
    // per route so each page ships as its own chunk. react-refresh reads those as component
    // declarations sitting beside a non-component export (the routes array) and flags every
    // one. This module exports a route table, never a component, so Fast Refresh has nothing
    // to preserve here.
    files: ["src/router/routes.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
]);
