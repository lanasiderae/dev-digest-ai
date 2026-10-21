// Flat ESLint config (ESLint 9+). Requires `eslint` + `typescript-eslint` +
// `eslint-plugin-react-hooks` as devDependencies — not committed here
// (client/package.json is git skip-worktree; see client/CLAUDE.md), so
// install them locally first: `pnpm add -D eslint typescript-eslint
// eslint-plugin-react-hooks`.
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: [".next/**", "node_modules/**", "src/vendor/**", "next-env.d.ts"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      // Downgraded rather than fixing ~10 pre-existing call sites across the
      // codebase (out of scope for introducing lint tooling) — both flag a
      // real, common React pattern used deliberately throughout this app
      // (sync setState in an effect) and a handful of existing `any`s.
      "react-hooks/set-state-in-effect": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
);
