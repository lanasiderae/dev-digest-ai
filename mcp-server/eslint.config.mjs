// Flat ESLint config (ESLint 9+). Requires `eslint` + `typescript-eslint` as
// devDependencies (installed via `npm install` in this package).
//
// `no-console: error` is the cheap mechanical guard for stdout discipline:
// stdout is owned by the JSON-RPC transport end to end, so a stray
// console.log would corrupt the protocol stream. All logging goes through
// log.ts's stderr-only logger instead.
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["node_modules/**"],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "error",
    },
  },
);
