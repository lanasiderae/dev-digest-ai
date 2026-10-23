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


if __name__ == '__main__':
    unittest.main()
