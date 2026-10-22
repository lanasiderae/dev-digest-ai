import { z } from 'zod';
import { ReviewRecord } from '@devdigest/shared';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { DevDigestApi } from '../api/client.js';
import type { Logger } from '../log.js';
import { resolvePull, resolveRepo, ResolveError } from '../api/resolve.js';
import { RepoArg, PrNumberArg, RunIdArg } from './schemas.js';
import { conciseFinding, truncate, MAX_FINDINGS_PER_REVIEW } from './shape.js';

/**
 * `get_findings` — persisted review findings for a PR. Read-only.
 *
 * Returns EVERY persisted review for the PR, newest first — deliberately
 * does NOT reimplement "latest review per agent" dedup (that rule is already
 * duplicated 4x in this codebase's own UI; a 5th copy here would just be
 * another place for it to drift). The description tells the caller the
 * newest review per agent is the current one.
 */
export function registerGetFindingsTool(server: McpServer, deps: { api: DevDigestApi; log: Logger }) {
  server.registerTool(
    'get_findings',
    {
      title: 'Get review findings for a PR',
      description:
        'Get every persisted review (and its findings) for a PR already imported into DevDigest, newest first. ' +
        'A re-run supersedes that same agent\'s earlier review — the newest review per agent is the current one. ' +
        'Optionally filter to one run via `run_id`.',
      inputSchema: z
        .object({ repo: RepoArg, pr_number: PrNumberArg, run_id: RunIdArg.optional() })
        .strict(),
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      try {
        const repo = await resolveRepo(deps.api, args.repo);
        const pull = await resolvePull(deps.api, repo.id, args.pr_number);
        const reviews = await deps.api.get(`/pulls/${pull.id}/reviews`, z.array(ReviewRecord));
        const scoped = args.run_id ? reviews.filter((r) => r.run_id === args.run_id) : reviews;

        const bySeverity = { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 };
        let totalFindings = 0;
        const reviewsOut = scoped.map((r) => {
          const { items, truncated } = truncate(r.findings.map(conciseFinding), MAX_FINDINGS_PER_REVIEW);
          for (const f of items) {
            bySeverity[f.severity] += 1;
            totalFindings += 1;
          }
          return {
            review_id: r.id,
            run_id: r.run_id,
            agent_name: r.agent_name ?? null,
            kind: r.kind,
            verdict: r.verdict,
            score: r.score,
            created_at: r.created_at,
            findings: items,
            findings_truncated: truncated,
          };
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                repo: repo.fullName,
                pr_number: pull.number,
                reviews: reviewsOut,
                totals: { reviews: reviewsOut.length, findings: totalFindings, by_severity: bySeverity },
              }),
            },
          ],
        };
      } catch (err) {
        if (err instanceof ResolveError) {
          return { isError: true, content: [{ type: 'text' as const, text: err.message }] };
        }
        throw err;
      }
    },
  );
}
