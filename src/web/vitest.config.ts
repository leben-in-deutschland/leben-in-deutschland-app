import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    pool: "forks",
    // The jsdom page tests (settings, mock exam, onboarding, support, prepare)
    // render whole pages; the first test of each file also pays the dynamic page
    // import. On a loaded machine (landing verify, parallel jobs) that exceeds
    // the 5000 ms default, and the rest of the file then fails with "element not
    // found". A fast run still takes ~15 s in total, so this only lifts the ceiling.
    testTimeout: 15000,
    include: ["__tests__/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
  },
});
