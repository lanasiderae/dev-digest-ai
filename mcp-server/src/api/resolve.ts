import { Agent, PrMeta, Repo } from '@devdigest/shared';
import { z } from 'zod';
import type { DevDigestApi } from './client.js';

/**
 * Resolves human-legible identifiers (`owner/repo`, a PR number, an agent
 * name or uuid) to this app's internal uuids. Nothing outside DevDigest knows
 * those uuids, and `list_repos`/`list_prs` are deliberately not exposed as
 * tools (`gh`/GitHub's own MCP server already cover repo/PR discovery) — so
 * every tool resolves through here instead.
 *
 * Lookup is ALWAYS via the existing read endpoints (`GET /repos`,
 * `GET /repos/:id/pulls`, `GET /agents`) — no new server endpoint, no DB, no
 * caching (two extra loopback GETs per tool call is cheaper than a
 * stale-repo-list bug; see `mcp-server/AGENTS.md`).
 *
 * Note that `GET /repos/:id/pulls` is a GET but not effect-free server-side
 * — it syncs from GitHub and upserts PR rows, same as loading the PR list in
 * the UI. That's a pre-existing property of that endpoint, not something
 * this resolver adds; see `mcp-server/AGENTS.md`'s "Do not touch" section
 * for why `readOnlyHint: true` on the tools that call it is still correct.
 *
 * `repo` (and every other model-supplied string) is NEVER interpolated into
 * a URL path — only uuids returned BY OUR OWN API ever reach a path segment,
 * closing the path-injection/SSRF surface at the resolver boundary.
 */
export class ResolveError extends Error {
  constructor(
    readonly kind: 'repo' | 'pr' | 'agent',
    message: string,
  ) {
    super(message);
    this.name = 'ResolveError';
  }
}

export interface RepoRef {
  id: string;
  fullName: string;
}

export interface PullRef {
  id: string;
  number: number;
  headSha: string;
}

export interface AgentRef {
  id: string;
  name: string;
}

const MAX_LIST_HINT = 20;

/** Render a capped, comma-joined hint list: "a, b, c (…and N more)". */
function hintList(items: string[]): string {
  if (items.length <= MAX_LIST_HINT) return items.join(', ');
  return `${items.slice(0, MAX_LIST_HINT).join(', ')} (…and ${items.length - MAX_LIST_HINT} more)`;
}

export async function resolveRepo(api: DevDigestApi, fullName: string): Promise<RepoRef> {
  const repos = await api.get('/repos', z.array(Repo));
  const needle = fullName.toLowerCase();
  const match = repos.find((r) => r.full_name.toLowerCase() === needle);
  if (!match) {
    const known = repos.map((r) => r.full_name);
    const hint =
      known.length > 0
        ? `DevDigest currently has: ${hintList(known)}. Add a repo in the DevDigest UI first, or use one of these.`
        : 'DevDigest has no repos yet. Add one in the DevDigest UI first.';
    throw new ResolveError('repo', `Unknown repo "${fullName}". ${hint}`);
  }
  return { id: match.id, fullName: match.full_name };
}

export async function resolvePull(api: DevDigestApi, repoId: string, prNumber: number): Promise<PullRef> {
  const pulls = await api.get(`/repos/${repoId}/pulls`, z.array(PrMeta));
  const match = pulls.find((p) => p.number === prNumber);
  if (!match || match.id == null) {
    const known = pulls.map((p) => p.number).sort((a, b) => b - a);
    const hint =
      known.length > 0
        ? `PRs DevDigest has imported: ${hintList(known.map(String))}. Import PRs for this repo in the DevDigest UI first.`
        : 'No PRs have been imported for this repo yet. Import PRs in the DevDigest UI first.';
    throw new ResolveError('pr', `PR #${prNumber} not found. ${hint}`);
  }
  return { id: match.id, number: match.number, headSha: match.head_sha };
}

export async function resolveAgent(api: DevDigestApi, nameOrId: string): Promise<AgentRef> {
  const agents = await api.get('/agents', z.array(Agent));

  const byId = agents.find((a) => a.id === nameOrId);
  if (byId) return { id: byId.id, name: byId.name };

  const needle = nameOrId.toLowerCase();
  const byName = agents.filter((a) => a.name.toLowerCase() === needle);
  if (byName.length === 1) {
    const only = byName[0]!;
    return { id: only.id, name: only.name };
  }
  if (byName.length > 1) {
    throw new ResolveError(
      'agent',
      `Agent name "${nameOrId}" is ambiguous — matches ids: ${byName.map((a) => a.id).join(', ')}. ` +
        'Pass the specific id instead.',
    );
  }

  const known = agents.map((a) => a.name);
  const hint =
    known.length > 0
      ? `Configured agents: ${hintList(known)}. Pass a name or id from list_agents.`
      : 'No agents are configured yet. Create one in the DevDigest UI first.';
  throw new ResolveError('agent', `Unknown agent "${nameOrId}". ${hint}`);
}
