---
name: workflow-retro
description: Manually analyze a completed agent pipeline's local usage logs, including child logs in deep mode, and append an evidence-based retrospective to docs/retros/ledger.md.
disable-model-invocation: true
---

Run only on explicit manual invocation, after a pipeline completes. Obtain its
session log and run boundary from the caller; do not scan unrelated sessions.
Use the stdlib parser:

```
python3 .claude/skills/workflow-retro/scripts/usage-report.py SESSION.jsonl
python3 .claude/skills/workflow-retro/scripts/usage-report.py SESSION.jsonl --deep
```

Deep mode also reads `SESSION/subagents/**/*.jsonl`, Claude's nested subagent
layout alongside SESSION.jsonl. Pass additional `--child-log FILE` arguments
for child logs elsewhere; verify all nested agents from the run are represented.
The parser deduplicates streamed messages by message ID, counts tool-use blocks,
and totals recorded token fields. Logs vary by client: report missing fields,
uncertain linkage and incomplete concurrency honestly. Never interpret unknown
costs as zero; do not use token totals alone to claim dollar cost.

Inspect timestamps and worker intervals to establish duration and concurrency;
when logs cannot establish them, record unavailable. Use recorded costs, or a
cited model price and explicit calculation with cache input categories separated.
Compare against the pre-run budget and prior ledger entries where available.

Append a short entry to `docs/retros/ledger.md` only now: date/run ID, models,
log coverage including children, tokens/cache reads/tool calls/duration/peak
concurrency/cost (unknown fields marked unavailable), validation performed,
and 2–3 concrete improvements supported by the run. Examples: stop repeatedly
loading the same package docs; split a role with an oversized prompt; reduce
concurrency when duplicated exploration outweighed latency savings. Do not
create a fictitious completed run to populate the ledger.
