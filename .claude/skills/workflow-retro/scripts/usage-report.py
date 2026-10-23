#!/usr/bin/env python3
"""Summarize explicitly selected Claude JSONL logs without retaining prompt text."""
import argparse
import json
from pathlib import Path


def summarize(paths):
    messages = {}
    malformed = 0
    for log in paths:
        for line in log.read_text().splitlines():
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                malformed += 1
                continue
            message = event.get('message', {})
            if not isinstance(message, dict) or message.get('role') != 'assistant':
                continue
            identity = message.get('id')
            # Missing IDs cannot safely be deduplicated across streaming records.
            if not identity:
                malformed += 1
                continue
            key = identity
            record = messages.setdefault(key, {'usage': {}, 'tools': set()})
            for field, value in (message.get('usage') or {}).items():
                if isinstance(value, (int, float)) and not isinstance(value, bool):
                    record['usage'][field] = max(record['usage'].get(field, 0), value)
            for block in message.get('content', []):
                if isinstance(block, dict) and block.get('type') == 'tool_use':
                    record['tools'].add(block.get('id') or json.dumps(block, sort_keys=True))
    totals = {}
    present = {}
    for record in messages.values():
        for field, value in record['usage'].items():
            totals[field] = totals.get(field, 0) + value
            present[field] = present.get(field, 0) + 1
    return {'logs': [str(p) for p in paths], 'assistant_messages': len(messages),
            'recorded_usage': totals, 'messages_with_field': present,
            'tool_calls': sum(len(r['tools']) for r in messages.values()),
            'skipped_malformed_or_unidentified': malformed,
            'duration': None, 'peak_concurrency': None, 'cost_usd': None,
            'limitations': 'Usage is recorded fields only; absent fields, cost, duration and concurrency require manual verification. Child completeness must be checked.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('log', type=Path)
    parser.add_argument('--deep', action='store_true')
    parser.add_argument('--child-log', action='append', type=Path, default=[])
    args = parser.parse_args()
    paths = [args.log, *args.child_log]
    if args.deep:
        paths.extend(sorted((args.log.with_suffix('') / 'subagents').glob('**/*.jsonl')))
    print(json.dumps(summarize(list(dict.fromkeys(paths))), indent=2))


if __name__ == '__main__':
    main()
