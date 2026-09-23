import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Separate from vite.config.ts on purpose: the build config adds the React Compiler
// Babel preset, which doubles source parsing for zero test-observable benefit (it only
// changes runtime memoization, not behavior).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Committed default so `pnpm -F web test` needs no local .env file (those are
    // gitignored — see repo .gitignore's `.env.*` rule) or exported shell var. Only
    // `build` needs VITE_MAPBOX_TOKEN supplied externally — src/config/env.test.ts
    // stubs this away to test the missing-token case.
    env: {
      VITE_API_BASE_URL: "",
      VITE_MAPBOX_TOKEN: "pk.test-placeholder",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/shared/lib/**", "src/shared/utils/**", "src/shared/types/**"],
    },
  },
});
