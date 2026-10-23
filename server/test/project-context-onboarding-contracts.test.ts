import { describe, it, expect } from 'vitest';
import {
  ProjectContextSelection,
  ProjectContextSelectionList,
  ProjectContextDiscoveryResponse,
  ProjectContextPreview,
  ProjectContextOmission,
  ProjectContextSnapshot,
  MAX_PROJECT_CONTEXT_ATTACHMENTS,
  DEFAULT_PROJECT_CONTEXT_ROOTS,
  OnboardingTour,
  OnboardingTourSections,
  PrBrief,
  RunTrace,
  Settings,
} from '@devdigest/shared';

/**
 * TASK-02 contract freeze — focused parse/shape tests for the new/extended
 * L05 contracts (Project Context Folder, PR Brief extension, trace
 * extension, onboarding tour, workspace settings roots). Hermetic, no DB —
 * mirrors `server/test/contracts.test.ts`'s existing fixture-parse style.
 */
describe('ProjectContextSelection / ProjectContextSelectionList (CTX-AC-01/04)', () => {
  it('parses an ordered {repo_id, paths} list and preserves order', () => {
    const list = ProjectContextSelectionList.parse([
      { repo_id: 'r1', paths: ['specs/a.md', 'docs/b.md'] },
      { repo_id: 'r1', paths: ['insights/c.md'] },
    ]);
    expect(list).toHaveLength(2);
    expect(list[0]!.paths).toEqual(['specs/a.md', 'docs/b.md']);
  });

  it('defaults to an empty array — healthy-empty, not "unavailable"', () => {
    expect(ProjectContextSelectionList.parse(undefined)).toEqual([]);
  });

  it(`rejects more than ${MAX_PROJECT_CONTEXT_ATTACHMENTS} total attached paths across entries`, () => {
    const paths = Array.from({ length: MAX_PROJECT_CONTEXT_ATTACHMENTS + 1 }, (_, i) => `docs/${i}.md`);
    expect(() => ProjectContextSelectionList.parse([{ repo_id: 'r1', paths }])).toThrow();
  });

  it(`accepts exactly ${MAX_PROJECT_CONTEXT_ATTACHMENTS} total attached paths across entries`, () => {
    const paths = Array.from({ length: MAX_PROJECT_CONTEXT_ATTACHMENTS }, (_, i) => `docs/${i}.md`);
    expect(() => ProjectContextSelectionList.parse([{ repo_id: 'r1', paths }])).not.toThrow();
  });

  it('a single selection round-trips', () => {
    expect(() => ProjectContextSelection.parse({ repo_id: 'r1', paths: [] })).not.toThrow();
  });
});

describe('Project Context discovery/preview/omission shapes (CTX-AC-06/07/08)', () => {
  it('ProjectContextDiscoveryResponse round-trips with the pinned revision distinct from PR head', () => {
    const res = ProjectContextDiscoveryResponse.parse({
      repo_id: 'r1',
      revision: 'abc123',
      documents: [
        {
          repo_id: 'r1',
          path: 'specs/a.md',
          type: 'specs',
          size_bytes: 1024,
          tokens_estimate: 256,
          updated_at: '2026-10-22T00:00:00Z',
          oversized: false,
        },
      ],
      truncated: false,
    });
    expect(res.documents[0]!.type).toBe('specs');
  });

  it('ProjectContextPreview is view-only text + provenance, no edit surface', () => {
    expect(() =>
      ProjectContextPreview.parse({
        repo_id: 'r1',
        path: 'docs/b.md',
        type: 'docs',
        revision: 'abc123',
        content: '# hello',
        tokens_estimate: 3,
      }),
    ).not.toThrow();
  });

  it('ProjectContextOmission requires a typed reason', () => {
    expect(() =>
      ProjectContextOmission.parse({ repo_id: 'r1', path: 'docs/missing.md', reason: 'missing', detail: null }),
    ).not.toThrow();
    expect(() =>
      ProjectContextOmission.parse({ repo_id: 'r1', path: 'docs/x.md', reason: 'not_a_real_reason', detail: null }),
    ).toThrow();
  });
});

describe('ProjectContextSnapshot — trace, distinct from path-only selection metadata', () => {
  it('round-trips documents/omissions/attached_specs with the literal label text documented inline', () => {
    const snapshot = ProjectContextSnapshot.parse({
      documents: [{ repo_id: 'r1', path: 'specs/a.md', type: 'specs', revision: 'abc123', tokens: 120 }],
      total_tokens: 120,
      omissions: [{ repo_id: 'r1', path: 'docs/missing.md', reason: 'missing', detail: null }],
      attached_specs: '## Project context\n<spec-0>...</spec-0>',
    });
    expect(snapshot.total_tokens).toBe(120);
  });

  it('is nullable so a no-selection run is distinguishable from "not resolved yet"', () => {
    expect(ProjectContextSnapshot.nullable().parse(null)).toBeNull();
  });
});

describe('RunTrace carries specs_read + project_context (CTX-AC-06)', () => {
  const base = {
    config: { agent: 'Security Reviewer', model: 'gpt-4.1', source: 'local' as const },
    stats: { duration_ms: 1, tokens_in: 1, tokens_out: 1, cost_usd: 0, findings: 0, grounding: 'ok' },
    prompt_assembly: { system: 's', user: 'u' },
    tool_calls: [],
    raw_output: '{}',
    memory_pulled: [],
    specs_read: ['specs/a.md'],
    log: [],
  };

  it('parses without project_context (pre-L05 persisted trace) via .nullish()', () => {
    expect(() => RunTrace.parse(base)).not.toThrow();
  });

  it('parses with a populated project_context snapshot', () => {
    const trace = RunTrace.parse({
      ...base,
      project_context: {
        documents: [{ repo_id: 'r1', path: 'specs/a.md', type: 'specs', revision: 'abc123', tokens: 10 }],
        total_tokens: 10,
        omissions: [],
        attached_specs: '## Project context\n...',
      },
    });
    expect(trace.project_context?.documents).toHaveLength(1);
  });
});

describe('OnboardingTour — exactly five keyed sections (ONBOARD-AC-01)', () => {
  const skeletonSection = { narrative: null, evidence: [], status: 'skeleton' as const, reason: 'no index' };

  it('OnboardingTourSections requires exactly the five fixed keys', () => {
    const sections = OnboardingTourSections.parse({
      architecture_overview: skeletonSection,
      critical_paths: skeletonSection,
      local_setup: skeletonSection,
      reading_order: skeletonSection,
      first_tasks: skeletonSection,
    });
    expect(Object.keys(sections).sort()).toEqual(
      ['architecture_overview', 'critical_paths', 'first_tasks', 'local_setup', 'reading_order'].sort(),
    );
  });

  it('round-trips a zero-call skeleton tour with attempt: null', () => {
    const tour = OnboardingTour.parse({
      repo_id: 'r1',
      sections: {
        architecture_overview: skeletonSection,
        critical_paths: skeletonSection,
        local_setup: skeletonSection,
        reading_order: skeletonSection,
        first_tasks: skeletonSection,
      },
      status: 'skeleton',
      reason: 'repository index unavailable',
      index_revision: null,
      attempt: null,
      omissions: [{ path: null, reason: 'index_unavailable', detail: null }],
      generated_at: '2026-10-22T00:00:00Z',
    });
    expect(tour.attempt).toBeNull();
  });

  it('a generated section narrative is distinguishable from a skeleton one (status, not just narrative presence)', () => {
    expect(() =>
      OnboardingTourSections.parse({
        architecture_overview: { narrative: 'This repo is...', evidence: [], status: 'generated', reason: null },
        critical_paths: skeletonSection,
        local_setup: skeletonSection,
        reading_order: skeletonSection,
        first_tasks: skeletonSection,
      }),
    ).not.toThrow();
  });
});

describe('PrBrief extension — summary/review_focus, nullable Intent/Blast, sources, provenance', () => {
  const minimalProvenance = {
    reviewer_agent_id: null,
    skill_ids: [],
    documents: [],
    pr_linked_spec_path: null,
    head_sha: 'abc123',
    context_fingerprint: 'fp1',
    generated_at: '2026-10-22T00:00:00Z',
  };
  const availableSource = { status: 'available' as const, reason: null };
  const unselectedReviewer = { status: 'unavailable' as const, reason: 'Reviewer context not selected.' };

  it('round-trips a complete brief with available Intent/Blast', () => {
    const brief = PrBrief.parse({
      summary: 'Adds rate limiting to the public webhook endpoint.',
      intent: { intent: 'x', in_scope: ['a'], out_of_scope: [] },
      blast: { changed_symbols: [], downstream: [], summary: 's' },
      risks: { risks: [] },
      history: { history: [] },
      review_focus: [{ file: 'src/a.ts', line: 10, reason: 'new auth check' }],
      sources: {
        intent: availableSource,
        blast: availableSource,
        issue: availableSource,
        reviewer_context: unselectedReviewer,
        documents: availableSource,
      },
      provenance: minimalProvenance,
    });
    expect(brief.review_focus[0]!.line).toBe(10);
  });

  it('distinguishes unavailable Intent/Blast (null) from healthy-empty (populated object with empty arrays)', () => {
    const brief = PrBrief.parse({
      summary: 's',
      intent: null,
      blast: { changed_symbols: [], downstream: [], summary: 'no changed symbols' },
      risks: { risks: [] },
      history: { history: [] },
      review_focus: [],
      sources: {
        intent: { status: 'unavailable', reason: 'intent never derived' },
        blast: availableSource,
        issue: availableSource,
        reviewer_context: unselectedReviewer,
        documents: availableSource,
      },
      provenance: minimalProvenance,
    });
    expect(brief.intent).toBeNull();
    expect(brief.blast).not.toBeNull();
    expect(brief.blast?.changed_symbols).toEqual([]);
  });

  it('rejects a non-positive review_focus line', () => {
    expect(() =>
      PrBrief.parse({
        summary: 's',
        intent: null,
        blast: null,
        risks: { risks: [] },
        history: { history: [] },
        review_focus: [{ file: 'a.ts', line: 0, reason: 'r' }],
        sources: {
          intent: unselectedReviewer,
          blast: unselectedReviewer,
          issue: unselectedReviewer,
          reviewer_context: unselectedReviewer,
          documents: unselectedReviewer,
        },
        provenance: minimalProvenance,
      }),
    ).toThrow();
  });
});

describe('Settings — workspace project_context.roots (C4)', () => {
  it('defaults to the configured-roots glob', () => {
    const s = Settings.parse({});
    expect(s.project_context.roots).toEqual(DEFAULT_PROJECT_CONTEXT_ROOTS);
  });

  it('accepts a custom roots override', () => {
    const s = Settings.parse({ project_context: { roots: ['custom/**/*.md'] } });
    expect(s.project_context.roots).toEqual(['custom/**/*.md']);
  });
});
