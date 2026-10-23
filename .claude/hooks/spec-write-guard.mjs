import fs from 'node:fs';
import path from 'node:path';

const readTools = new Set(['Read', 'Grep', 'Glob', 'AskUserQuestion',
  'mcp__devdigest__list_agents', 'mcp__devdigest__get_findings',
  'mcp__devdigest__get_conventions', 'mcp__devdigest__get_blast_radius']);

// Reject symlinks at every existing component, including dangling links.
function noSymlinks(target) {
  let current = path.parse(target).root;
  for (const part of target.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try { if (fs.lstatSync(current).isSymbolicLink()) return false; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return true;
}

try {
  const event = JSON.parse(fs.readFileSync(0, 'utf8'));
  if (event.hook_event_name !== 'PreToolUse' || typeof event.tool_name !== 'string'
      || !event.tool_input || typeof event.tool_input !== 'object'
      || Array.isArray(event.tool_input)) throw new Error('Malformed hook input');
  let allowed = readTools.has(event.tool_name);
  if (['Write', 'Edit'].includes(event.tool_name)) {
    const projectPath = path.resolve(process.env.CLAUDE_PROJECT_DIR);
    const root = fs.realpathSync(projectPath);
    const supplied = event.tool_input.file_path;
    if (typeof supplied !== 'string' || !supplied || supplied.includes('\0')
        || supplied.split(/[\\/]/).includes('..')) {
      throw new Error('Missing file_path');
    }
    const relative = path.isAbsolute(supplied) ? path.relative(projectPath, supplied) : supplied;
    const target = path.resolve(root, relative);
    allowed = target === path.join(root, 'specs/l05/spec.md') && noSymlinks(target);
  }
  if (!allowed) throw new Error('spec-creator may write only specs/l05/spec.md and use its listed read-only tools');
  process.stdout.write('{}\n');
} catch (error) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: {
    hookEventName: 'PreToolUse', permissionDecision: 'deny',
    permissionDecisionReason: `Specification guard: ${error.message}`,
  } }) + '\n');
}
