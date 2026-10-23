#!/usr/bin/env python3
"""Summarize explicitly selected Claude JSONL logs without retaining prompt text."""
import argparse
import json
from datetime import datetime
from pathlib import Path


def timestamp(value):
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return parsed.timestamp() if parsed.tzinfo else None
    except ValueError:
        return None


def summarize(paths):
    messages = {}
    malformed = 0
    times = []
    lifecycles = {}
    reported_costs = {}
    missing_logs = []
    for log in dict.fromkeys(Path(p).resolve() for p in paths):
        if not log.is_file():
            missing_logs.append(str(log))
            continue
        for line in log.read_text().splitlines():
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                malformed += 1
                continue
            if not isinstance(event, dict):
                malformed += 1
                continue
            when = timestamp(event.get('timestamp'))
            if when is not None:
                times.append(when)
            agent_id = event.get('agent_id') or event.get('agentId')
            hook = event.get('hook_event_name')
            if isinstance(agent_id, str) and hook in ('SubagentStart', 'SubagentStop'):
                lifecycle = lifecycles.setdefault(agent_id, {})
                if when is not None:
                    lifecycle[hook] = when
            # Result totals may already include child costs. Preserve separately;
            # never add them to each other or to per-message usage.
            cost = event.get('total_cost_usd')
            if event.get('type') == 'result' and isinstance(cost, (int, float)) and not isinstance(cost, bool):
                reported_costs[str(log)] = cost
            message = event.get('message', {})
            if not isinstance(message, dict) or message.get('role') != 'assistant':
                continue
            identity = message.get('id')
            # Missing IDs cannot safely be deduplicated across streaming records.
            if not isinstance(identity, str) or not identity:
                malformed += 1
                continue
            key = identity
            record = messages.setdefault(key, {'usage': {}, 'tools': {}, 'model': None})
            if isinstance(message.get('model'), str):
                record['model'] = message['model']
            usage = message.get('usage')
            if not isinstance(usage, dict):
                usage = {}
            for field, value in usage.items():
                if isinstance(value, (int, float)) and not isinstance(value, bool):
                    record['usage'][field] = max(record['usage'].get(field, 0), value)
            content = message.get('content')
            for block in content if isinstance(content, list) else []:
                if isinstance(block, dict) and block.get('type') == 'tool_use':
                    tool_id = block.get('id')
                    if not isinstance(tool_id, str):
                        malformed += 1
                        continue
                    # Store identifiers and role/model only, not tool arguments,
                    # prompt text, command text, or tool responses.
                    args = block.get('input')
                    args = args if isinstance(args, dict) else {}
                    previous = record['tools'].get(tool_id, {})
                    previous_time = previous.get('timestamp')
                    launch_time = min(t for t in (previous_time, when) if t is not None) \
                        if previous_time is not None or when is not None else None
                    record['tools'][tool_id] = {
                        'tool_id': tool_id, 'tool': block.get('name'),
                        'role': args.get('subagent_type') if isinstance(args.get('subagent_type'), str) else None,
                        'model': args.get('model') if isinstance(args.get('model'), str) else None,
                        'timestamp': launch_time,
                    }
    totals = {}
    present = {}
    tools = {}
    for record in messages.values():
        for field, value in record['usage'].items():
            totals[field] = totals.get(field, 0) + value
            present[field] = present.get(field, 0) + 1
        tools.update(record['tools'])
    launches = sorted((t for t in tools.values() if t['tool'] in ('Agent', 'Task')),
                      key=lambda t: (t['timestamp'] is None, t['timestamp'] or 0, t['tool_id']))
    complete = [(v['SubagentStart'], v['SubagentStop']) for v in lifecycles.values()
                if 'SubagentStart' in v and 'SubagentStop' in v
                and v['SubagentStop'] >= v['SubagentStart']]
    peak = None
    lifecycle_coverage_complete = bool(lifecycles) and len(complete) == len(lifecycles) \
        and len(lifecycles) >= len(launches) and not missing_logs
    if lifecycle_coverage_complete:
        active = peak = 0
        # Count child-agent lifetimes, excluding the parent. A stop at the
        # same timestamp as a start does not imply overlap.
        boundaries = [(start, 1) for start, stop in complete if start < stop]
        boundaries += [(stop, -1) for start, stop in complete if start < stop]
        for _, delta in sorted(boundaries):
            active += delta
            peak = max(peak, active)
    return {'logs': [str(p) for p in paths], 'assistant_messages': len(messages),
            'recorded_usage': totals, 'messages_with_field': present,
            'tool_calls': len(tools),
            'models': sorted({r['model'] for r in messages.values() if r['model']}),
            'agent_launch_calls': len(launches), 'agent_order': launches,
            'agents_with_lifecycle_events': len(lifecycles),
            'observed_lifecycle_coverage_complete': lifecycle_coverage_complete,
            'skipped_malformed_or_unidentified': malformed,
            'missing_logs': missing_logs,
            'duration': max(times) - min(times) if len(times) > 1 else None,
            'duration_unit': 'seconds',
            'peak_concurrency': peak, 'cost_usd': None,
            'concurrency_scope': 'Observed child-agent lifetimes; launch-to-lifecycle identity coverage must be checked manually.',
            'reported_cost_totals': reported_costs,
            'limitations': 'Duration is the observed log span. Concurrency counts only children with complete lifecycle events; verify run/child coverage. Launch calls do not prove successful agents. Result costs may include children and are not summed. Missing fields stay unknown.'}


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
