import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('usage_report', Path(__file__).with_name('usage-report.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class UsageReportTest(unittest.TestCase):
    def test_streaming_and_forwarded_child_records_count_once(self):
        with tempfile.TemporaryDirectory() as directory:
            paths = [Path(directory) / 'parent.jsonl', Path(directory) / 'child.jsonl']
            def record(tokens):
                return {'message': {'id': 'same-id', 'role': 'assistant',
                        'usage': {'input_tokens': tokens},
                        'content': [{'type': 'tool_use', 'id': 'tool-1'}]}}
            paths[0].write_text('\n'.join(json.dumps(record(n)) for n in [5, 5, 8]))
            paths[1].write_text(json.dumps(record(3)))
            result = module.summarize(paths)
            self.assertEqual(result['recorded_usage']['input_tokens'], 8)
            self.assertEqual(result['tool_calls'], 1)
            self.assertIsNone(result['cost_usd'])

    def test_agent_order_usage_and_complete_lifecycle_overlap(self):
        events = [
            {'timestamp': '2026-10-22T12:00:00Z', 'hook_event_name': 'SubagentStart', 'agent_id': 'a'},
            {'timestamp': '2026-10-22T12:00:01Z', 'hook_event_name': 'SubagentStart', 'agent_id': 'b'},
            {'timestamp': '2026-10-22T12:00:03Z', 'hook_event_name': 'SubagentStop', 'agent_id': 'a'},
            {'timestamp': '2026-10-22T12:00:04Z', 'hook_event_name': 'SubagentStop', 'agent_id': 'b'},
            {'timestamp': '2026-10-22T12:00:00Z', 'message': {
                'id': 'parent', 'role': 'assistant', 'model': 'recorded-model',
                'usage': {'input_tokens': 10, 'cache_read_input_tokens': 20},
                'content': [{'type': 'tool_use', 'id': 'launch-1', 'name': 'Agent',
                             'input': {'subagent_type': 'implementer', 'prompt': 'PRIVATE PROMPT'}}]}},
        ]
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / 'run.jsonl'
            log.write_text('\n'.join(map(json.dumps, events)))
            result = module.summarize([log])
        self.assertEqual(result['agent_launch_calls'], 1)
        self.assertEqual(result['agent_order'][0]['role'], 'implementer')
        self.assertEqual(result['peak_concurrency'], 2)
        self.assertEqual(result['duration'], 4)
        self.assertEqual(result['recorded_usage']['cache_read_input_tokens'], 20)
        self.assertEqual(result['models'], ['recorded-model'])
        self.assertNotIn('PRIVATE PROMPT', json.dumps(result))

    def test_incomplete_lifecycle_unknown_costs_and_bad_records(self):
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / 'run.jsonl'
            log.write_text('\n'.join([
                'not json', 'null',
                json.dumps({'hook_event_name': 'SubagentStart', 'agent_id': 'a',
                            'timestamp': '2026-10-22T12:00:00Z'}),
                json.dumps({'type': 'result', 'total_cost_usd': 1.25}),
            ]))
            result = module.summarize([log, Path(directory) / 'missing.jsonl'])
        self.assertIsNone(result['peak_concurrency'])
        self.assertIsNone(result['cost_usd'])
        self.assertEqual(list(result['reported_cost_totals'].values()), [1.25])
        self.assertEqual(result['skipped_malformed_or_unidentified'], 2)
        self.assertEqual(len(result['missing_logs']), 1)

    def test_adjacent_agent_lifetimes_do_not_overlap(self):
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / 'run.jsonl'
            events = [
                {'hook_event_name': hook, 'agent_id': agent, 'timestamp': instant}
                for agent, hook, instant in [
                    ('a', 'SubagentStart', '2026-10-22T12:00:00Z'),
                    ('a', 'SubagentStop', '2026-10-22T12:00:01Z'),
                    ('b', 'SubagentStart', '2026-10-22T12:00:01Z'),
                    ('b', 'SubagentStop', '2026-10-22T12:00:02Z'),
                ]]
            log.write_text('\n'.join(map(json.dumps, events)))
            result = module.summarize([log])
        self.assertEqual(result['peak_concurrency'], 1)

    def test_missing_lifecycle_for_a_launched_agent_prevents_concurrency_claim(self):
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / 'run.jsonl'
            events = [
                {'hook_event_name': 'SubagentStart', 'agent_id': 'a', 'timestamp': '2026-10-22T12:00:00Z'},
                {'hook_event_name': 'SubagentStop', 'agent_id': 'a', 'timestamp': '2026-10-22T12:00:01Z'},
                {'message': {'role': 'assistant', 'id': 'parent', 'content': [
                    {'type': 'tool_use', 'id': 'one', 'name': 'Agent'},
                    {'type': 'tool_use', 'id': 'two', 'name': 'Agent'},
                ]}},
            ]
            log.write_text('\n'.join(map(json.dumps, events)))
            result = module.summarize([log])
        self.assertFalse(result['observed_lifecycle_coverage_complete'])
        self.assertIsNone(result['peak_concurrency'])

    def test_streaming_updates_preserve_agent_launch_order(self):
        def event(message_id, tool_id, second):
            return {'timestamp': f'2026-10-22T12:00:0{second}Z', 'message': {
                'id': message_id, 'role': 'assistant', 'content': [
                    {'type': 'tool_use', 'id': tool_id, 'name': 'Agent'}]}}
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / 'run.jsonl'
            log.write_text('\n'.join(map(json.dumps, [
                event('first-message', 'first-agent', 1),
                event('second-message', 'second-agent', 2),
                event('first-message', 'first-agent', 3),
            ])))
            result = module.summarize([log])
        self.assertEqual([t['tool_id'] for t in result['agent_order']],
                         ['first-agent', 'second-agent'])


if __name__ == '__main__':
    unittest.main()
