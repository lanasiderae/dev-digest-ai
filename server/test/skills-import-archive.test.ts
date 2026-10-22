import { describe, it, expect } from 'vitest';
import { ZipFile } from 'yazl';
import { extractSkillArchive } from '../src/modules/skills/import/archive.js';
import { ValidationError } from '../src/platform/errors.js';
import { MAX_ARCHIVE_ENTRIES, MAX_UNCOMPRESSED_ENTRY_BYTES } from '../src/modules/skills/constants.js';

/** Build an in-memory .zip buffer from a list of entries (yazl — yauzl's sibling writer). */
async function buildZip(
  entries: { path: string; content?: string; mode?: number; isDir?: boolean }[],
): Promise<Buffer> {
  const zip = new ZipFile();
  for (const e of entries) {
    if (e.isDir) {
      zip.addEmptyDirectory(e.path);
    } else {
      zip.addBuffer(
        Buffer.from(e.content ?? '', 'utf8'),
        e.path,
        e.mode !== undefined ? { mode: e.mode } : undefined,
      );
    }
  }
  zip.end();
  const chunks: Buffer[] = [];
  for await (const chunk of zip.outputStream as AsyncIterable<Buffer>) chunks.push(chunk);
  return Buffer.concat(chunks);
}

/**
 * yazl refuses to write an unsafe (zip-slip / absolute) path directly — it's
 * a well-behaved writer. To exercise extractSkillArchive's own zip-slip
 * guard, write a same-length placeholder path and patch its raw bytes in the
 * finished buffer (local header + central directory both contain it).
 */
async function buildZipWithUnsafePath(unsafePath: string, content: string): Promise<Buffer> {
  const placeholder = 'p'.repeat(unsafePath.length);
  const buf = await buildZip([{ path: placeholder, content }]);
  const needle = Buffer.from(placeholder, 'utf8');
  const replacement = Buffer.from(unsafePath, 'utf8');
  const out = Buffer.from(buf);
  let idx = out.indexOf(needle);
  while (idx !== -1) {
    replacement.copy(out, idx);
    idx = out.indexOf(needle, idx + needle.length);
  }
  return out;
}

const UNIX_EXECUTABLE_MODE = 0o100755;

describe('extractSkillArchive', () => {
  it('auto-resolves a root SKILL.md', async () => {
    const buf = await buildZip([
      { path: 'SKILL.md', content: '# My Skill\nBody text.' },
      { path: 'README.md', content: '# Not the skill' },
    ]);
    const result = await extractSkillArchive(buf);
    expect(result.resolvedIndex).toBeDefined();
    expect(result.candidates[result.resolvedIndex!]!.path).toBe('SKILL.md');
    expect(result.name).toBe('My Skill');
    expect(result.body).toContain('Body text.');
  });

  it('auto-resolves a single stray .md file with no root SKILL.md', async () => {
    const buf = await buildZip([{ path: 'docs/rule.md', content: '# Rule\nDescribe it.' }]);
    const result = await extractSkillArchive(buf);
    expect(result.resolvedIndex).toBe(0);
    expect(result.body).toContain('Describe it.');
  });

  it('returns all candidates unresolved when multiple .md files exist and none is root SKILL.md', async () => {
    const buf = await buildZip([
      { path: 'a.md', content: '# A' },
      { path: 'b.md', content: '# B' },
    ]);
    const result = await extractSkillArchive(buf);
    expect(result.resolvedIndex).toBeUndefined();
    expect(result.candidates).toHaveLength(2);
    expect(result.body).toBe('');
  });

  it('rejects the whole archive when it contains an executable entry (by extension)', async () => {
    const buf = await buildZip([
      { path: 'SKILL.md', content: '# Fine' },
      { path: 'install.sh', content: '#!/bin/sh\necho hi' },
    ]);
    await expect(extractSkillArchive(buf)).rejects.toThrow(ValidationError);
    await expect(extractSkillArchive(buf)).rejects.toThrow(/install\.sh/);
  });

  it('rejects the whole archive when a file carries the Unix executable bit', async () => {
    const buf = await buildZip([
      { path: 'SKILL.md', content: '# Fine' },
      { path: 'payload.bin', content: 'not really a script', mode: UNIX_EXECUTABLE_MODE },
    ]);
    await expect(extractSkillArchive(buf)).rejects.toThrow(ValidationError);
  });

  it('rejects a zip-slip path', async () => {
    // yauzl itself validates fileName during iteration and rejects this
    // before our own isPathSafe check ever runs — both layers get wrapped
    // uniformly into a ValidationError (422), not a raw/uncaught Error.
    const buf = await buildZipWithUnsafePath('../../etc/passwd', 'pwned');
    await expect(extractSkillArchive(buf)).rejects.toThrow(ValidationError);
    await expect(extractSkillArchive(buf)).rejects.toThrow(/rejected/i);
  });

  it('rejects an entry whose declared uncompressed size exceeds the per-entry cap', async () => {
    const huge = 'x'.repeat(MAX_UNCOMPRESSED_ENTRY_BYTES + 1024);
    const buf = await buildZip([{ path: 'SKILL.md', content: huge }]);
    await expect(extractSkillArchive(buf)).rejects.toThrow(/too large/);
  });

  it('rejects an archive with too many entries', async () => {
    const entries = Array.from({ length: MAX_ARCHIVE_ENTRIES + 1 }, (_, i) => ({
      path: `f${i}.txt`,
      content: 'x',
    }));
    const buf = await buildZip(entries);
    await expect(extractSkillArchive(buf)).rejects.toThrow(/too many entries/);
  });

  it('ignores non-markdown entries and directory entries', async () => {
    const buf = await buildZip([
      { path: 'assets', isDir: true },
      { path: 'notes.txt', content: 'not markdown' },
      { path: 'SKILL.md', content: '# Only this counts' },
    ]);
    const result = await extractSkillArchive(buf);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.path).toBe('SKILL.md');
  });
});
