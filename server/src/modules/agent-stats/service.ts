import type { Container } from '../../platform/container.js';
import type { AgentStats, AgentPerf } from '@devdigest/shared';
import { NotFoundError } from '../../platform/errors.js';
import { resolveRange, toAgentStats, toAgentPerf, type RangeInput } from './helpers.js';

/**
 * Agent Performance Dashboard (L08, Part 5) orchestration.
 *
 * Reads via the reviews module's own repository (`container.reviewRepo`)
 * rather than querying `agent_runs`/`findings` directly from this module,
 * per onion-architecture's cross-module rule — same pattern `history/
 * service.ts` and `blast/service.ts` already use. No GitHub call, no model
 * call: this is a read-only aggregation over already-persisted rows.
 */
export class AgentStatsService {
  constructor(private container: Container) {}

  /** `GET /agents/:id/stats`. 404s if the agent doesn't exist in the
   *  workspace; a zero-run agent still gets a valid `AgentStats` (AC-02). */
  async getAgentStats(workspaceId: string, agentId: string, rangeInput: RangeInput): Promise<AgentStats> {
    const agent = await this.container.agentsRepo.getById(workspaceId, agentId);
    if (!agent) throw new NotFoundError('Agent not found');

    const { from, to } = resolveRange(rangeInput);
    const raw = await this.container.reviewRepo.getAgentStatsRaw(workspaceId, { agentId, from, to });
    const group = raw[0];

    const estimate = (model: string, tokensIn: number, tokensOut: number) =>
      this.container.priceBook.estimate(model, tokensIn, tokensOut);

    return toAgentStats(agent.id, agent.name, group?.runs ?? [], group?.findings ?? [], estimate);
  }

  /** `GET /agents/performance`. Workspace-wide; empty case (AC-05) falls out
   *  of `toAgentPerf` naturally when no agent has a run in range. */
  async getAgentPerformance(workspaceId: string, rangeInput: RangeInput): Promise<AgentPerf> {
    const { from, to } = resolveRange(rangeInput);
    const raw = await this.container.reviewRepo.getAgentStatsRaw(workspaceId, { from, to });

    const estimate = (model: string, tokensIn: number, tokensOut: number) =>
      this.container.priceBook.estimate(model, tokensIn, tokensOut);

    return toAgentPerf(raw, estimate);
  }
}
