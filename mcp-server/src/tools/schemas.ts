import { z } from 'zod';

/** Shared strict argument fragments — every tool's input object is built from
 *  these and wrapped `.strict()` so an unexpected field is a validation
 *  error, not a silently-ignored one. */

export const RepoArg = z
  .string()
  .regex(/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/, 'Use "owner/name", e.g. "acme/widgets".')
  .describe('The repo as "owner/name", e.g. "acme/widgets" — must already be imported into DevDigest.');

export const PrNumberArg = z
  .number()
  .int()
  .positive()
  .describe('The pull request number on GitHub (not DevDigest\'s internal id), e.g. 412.');

export const AgentArg = z
  .string()
  .min(1)
  .describe('An agent\'s name or DevDigest id — see list_agents for valid values.');

export const RunIdArg = z.string().uuid().describe('A run id returned by run_agent_on_pr or GET /pulls/:id/runs.');
