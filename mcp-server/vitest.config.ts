import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // Mirrors tsconfig.json's `paths` — Vite's resolver doesn't read
      // tsconfig paths on its own (see reviewer-core/vitest.config.ts, which
      // hits the same thing for the same reason: @devdigest/shared is the
      // server's vendored contracts tree, not an installed package).
      "@devdigest/shared": path.resolve(__dirname, "../server/src/vendor/shared"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
