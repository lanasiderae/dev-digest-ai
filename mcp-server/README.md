# `@devdigest/mcp-server`

A local, stdio [MCP](https://modelcontextprotocol.io) server for DevDigest —
a thin HTTP client of the `server/` Fastify API (`:3001`). It exposes exactly
5 tools so an MCP-capable agent (e.g. Claude Code) can read and act on data
already imported into DevDigest, without ever touching the database or
duplicating `server/`'s business logic:

| Tool | Read-only? | What it does |
|------|------------|--------------|
| `list_agents` | yes | List the configured review agents. |
| `get_findings` | yes | Get every persisted review + findings for a PR, newest first. |
| `get_conventions` | yes | Get extracted coding-convention candidates for a repo. |
| `get_blast_radius` | yes | Get downstream callers of a PR's changed symbols. |
| `run_agent_on_pr` | **no** | Trigger one agent to review a PR and wait for the result. Spends LLM credits. |

`list_repos`/`list_prs` are intentionally not provided — use `gh` or
GitHub's own MCP server for repo/PR discovery; every tool here resolves a
human-legible `{repo: "owner/name", pr_number}` to DevDigest's internal ids
itself.

## Install

```sh
cd mcp-server
npm install
```

The DevDigest API must be running (`cd server && pnpm dev`, `:3001` by
default) for any tool except `tools/list` to do anything useful.

## Registering with an MCP client

The root [`.mcp.json`](../.mcp.json) already registers this server for
project-scoped MCP clients (e.g. Claude Code):

```json
{
  "mcpServers": {
    "devdigest": {
      "command": "./mcp-server/node_modules/.bin/tsx",
      "args": ["./mcp-server/src/index.ts"],
      "env": { "DEVDIGEST_API_BASE": "http://127.0.0.1:3001" }
    }
  }
}
```

It launches the locally-installed `tsx` binary directly — not `npx tsx`
(which could reach the network to resolve `tsx` if it isn't cached) and not
`npm run dev` (whose startup banner would land on stdout and corrupt the
JSON-RPC stream). Run `npm install` in `mcp-server/` first so that binary
exists.

## Environment variables

| Var | Default | Notes |
|-----|---------|-------|
| `DEVDIGEST_API_BASE` | `http://127.0.0.1:3001` | The DevDigest API base URL. Loopback-only unless `https:` or the remote opt-in below. |
| `DEVDIGEST_MCP_ALLOW_REMOTE_API` | unset (off) | Explicit opt-in required for a non-loopback, non-`https:` base. |
| `DEVDIGEST_MCP_RUN_TIMEOUT_MS` | `300000` | Bounds how long `run_agent_on_pr` polls before returning `still_running`. |
| `DEVDIGEST_MCP_REQUEST_TIMEOUT_MS` | `30000` | Per-HTTP-request timeout to the DevDigest API. |
| `DEVDIGEST_MCP_LOG_LEVEL` | `info` | `silent｜error｜warn｜info｜debug` — stderr only, never stdout. |

No secrets — the DevDigest API has no auth layer (single default workspace),
so this server sends no auth header either.

## Commands

See `AGENTS.md` for the full Conventions/Gotchas list. In short:

```sh
npm test          # vitest, hermetic
npm run typecheck
npm run lint
```
