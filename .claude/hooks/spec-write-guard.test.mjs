import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const script = new URL('./spec-write-guard.mjs', import.meta.url).pathname;
function check(root, tool_name, tool_input = {}) {
  const result = spawnSync(process.execPath, [script], { encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name, tool_input }) });
  assert.equal(result.status, 0);
  return JSON.parse(result.stdout);
}
test('permits exact spec writes and read-only MCP, denies traversal and other tools', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-guard-'));
  try {
    assert.deepEqual(check(root, 'Write', { file_path: 'specs/l05/spec.md' }), {});
    assert.deepEqual(check(root, 'Edit', { file_path: path.join(root, 'specs/l05/spec.md') }), {});
    assert.deepEqual(check(root, 'mcp__devdigest__get_blast_radius'), {});
    for (const [tool, input] of [['Write', { file_path: 'specs/l05/../../outside.md' }],
      ['Edit', { file_path: 'server/src/app.ts' }],
      ['Write', { file_path: 'specs/l05/link/../spec.md' }], ['Write', {}],
      ['Bash', { command: 'touch specs/l05/spec.md' }], ['Agent', {}],
      ['mcp__devdigest__run_agent_on_pr', {}], ['mcp__devdigest__unknown', {}]]) {
      assert.equal(check(root, tool, input).hookSpecificOutput.permissionDecision, 'deny');
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('rejects symlink directory and dangling target links', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-guard-'));
  try {
    fs.mkdirSync(path.join(root, 'other'));
    fs.symlinkSync(path.join(root, 'other'), path.join(root, 'specs'));
    assert.equal(check(root, 'Write', { file_path: 'specs/l05/spec.md' }).hookSpecificOutput.permissionDecision, 'deny');
    fs.unlinkSync(path.join(root, 'specs'));
    fs.mkdirSync(path.join(root, 'specs/l05'), { recursive: true });
    fs.symlinkSync(path.join(root, 'missing'), path.join(root, 'specs/l05/spec.md'));
    assert.equal(check(root, 'Edit', { file_path: 'specs/l05/spec.md' }).hookSpecificOutput.permissionDecision, 'deny');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('malformed input fails closed', () => {
  for (const input of ['not json', '{}', 'null']) {
    const result = spawnSync(process.execPath, [script], { input, encoding: 'utf8' });
    assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, 'deny');
  }
});
