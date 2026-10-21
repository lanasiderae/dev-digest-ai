// Flat ESLint config (ESLint 9+). Requires `eslint` + `typescript-eslint` as
// devDependencies — not committed here (reviewer-core/package.json is git
// skip-worktree; see reviewer-core/CLAUDE.md), so install them locally
// first: `pnpm add -D eslint typescript-eslint`.
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
);
