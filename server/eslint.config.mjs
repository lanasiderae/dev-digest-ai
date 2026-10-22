// Flat ESLint config (ESLint 9+). Requires `eslint` + `typescript-eslint` as
// devDependencies — not committed here (server/package.json is git
// skip-worktree; see server/AGENTS.md), so install them locally first:
// `pnpm add -D eslint typescript-eslint`.
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "clones/**", "src/vendor/**"],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
);
