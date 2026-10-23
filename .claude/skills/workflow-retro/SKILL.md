---
name: workflow-retro
description: Manually review a completed workflow using current context, optionally inspect nested logs in deep mode, and summarize evidence plus improvements in chat and docs/retro/ledger.md.
disable-model-invocation: true
---

Run only on explicit manual invocation. Default to the completed run's current
conversation context; do not read disk logs automatically. Establish the run
boundary and report available evidence. `--deep` explicitly opts into local
session/child logs. Obtain the session path when needed and never scan unrelated
sessions. In deep mode the stdlib parser can summarize recorded metrics:

```
python3 .claude/skills/workflow-retro/scripts/usage-report.py SESSION.jsonl --deep
```

Deep mode reads `SESSION/subagents/**/*.jsonl` alongside SESSION.jsonl; pass
`--child-log FILE` for children elsewhere. Verify nested-agent coverage. The
parser deduplicates streamed/forwarded message IDs and tool calls. Its fields
are not a complete cost or concurrency report: verify these from recorded
worker intervals and provider costs where available. Missing metrics stay
unavailable; never infer zero cost or invent child usage.

Report agent execution order/count/models; tokens/cache reads/tool calls;
duration/concurrency/cost; easy and hard stages; duplicated work/context and
missed requirements; validation performed; actionable improvements. Distinguish
observed facts from recommendations. When calculating cost, cite current prices
and separate cache categories; otherwise leave it unavailable.

Return a concise chat summary and append a short actual-run entry to
`docs/retro/ledger.md`: date/run ID, evidence coverage, metrics (unknowns marked),
what worked, what was hard, duplication/misses and 2–3 concrete improvements.
Compare prior entries where available. Do not create a fictitious run or invoke
this skill automatically after run-plan.
