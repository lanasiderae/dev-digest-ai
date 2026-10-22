// Flat ESLint config (ESLint 9+). Requires `eslint` + `typescript-eslint` as
// devDependencies — not committed here (e2e/package.json is git
// skip-worktree; see e2e/AGENTS.md), so install them locally first:
// `pnpm add -D eslint typescript-eslint`.
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["node_modules/**", "test-results/**"],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
);
