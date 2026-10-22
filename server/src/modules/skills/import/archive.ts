import yauzl from 'yauzl';
import { ValidationError } from '../../../platform/errors.js';
import {
  EXECUTABLE_ENTRY_EXTENSIONS,
  MAX_ARCHIVE_ENTRIES,
  MAX_UNCOMPRESSED_ENTRY_BYTES,
  MAX_UNCOMPRESSED_TOTAL_BYTES,
} from '../constants.js';
import { deriveNameFromMarkdown } from '../helpers.js';

/**
 * Archive (.zip) skill import. STRICT extraction: any entry-count / size /
 * path / executable-content violation REJECTS THE WHOLE ARCHIVE (never
 * silently skips the offending entry), checked from zip central-directory
 * metadata BEFORE any bytes are inflated — yauzl exposes per-entry size and
 * Unix mode bits ahead of `openReadStream`, which is what makes this
 * zero-inflation rejection possible. Only `.md`/`.markdown` entries that pass
 * every check are ever read into memory; nothing extracted is ever executed.
 */

export interface ArchiveCandidate {
  path: string;
  body: string;
}

export interface ArchiveImportResult {
  /** Derived heading-based name, only set when exactly one candidate resolved. */
  name?: string;
  /** The resolved candidate's content, or '' when ambiguous/empty. */
  body: string;
  /** Every `.md`/`.markdown` entry found (bounded by the size caps above). */
  candidates: ArchiveCandidate[];
  /** Index into `candidates` that was auto-resolved, if any. */
  resolvedIndex?: number;
}

/** Unix "version made by" host id (upper byte of Entry.versionMadeBy). */
const VERSION_MADE_BY_UNIX = 3;

function isPathSafe(fileName: string): boolean {
  if (fileName.startsWith('/') || fileName.startsWith('\\') || /^[a-zA-Z]:/.test(fileName)) {
    return false;
  }
  return !fileName.split(/[/\\]/).includes('..');
}

function isExecutableEntry(entry: yauzl.Entry): boolean {
  const lower = entry.fileName.toLowerCase();
  if (EXECUTABLE_ENTRY_EXTENSIONS.some((ext) => lower.endsWith(ext))) return true;
  // Unix permission bits only live in the upper 16 bits of
  // externalFileAttributes when the archive's host OS is POSIX — other hosts
  // (e.g. Windows/FAT) don't populate them meaningfully, so only trust this
  // check when versionMadeBy says so.
  if (entry.versionMadeBy >>> 8 !== VERSION_MADE_BY_UNIX) return false;
  const unixMode = entry.externalFileAttributes >>> 16;
  return (unixMode & 0o111) !== 0;
}

async function readEntryText(zipfile: yauzl.ZipFile, entry: yauzl.Entry): Promise<string> {
  const stream = await zipfile.openReadStreamPromise(entry);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

export async function extractSkillArchive(buffer: Buffer): Promise<ArchiveImportResult> {
  let zipfile: yauzl.ZipFile;
  try {
    zipfile = await yauzl.fromBufferPromise(buffer, { lazyEntries: true });
  } catch {
    throw new ValidationError('Could not read the archive — is it a valid .zip file?');
  }

  const candidates: ArchiveCandidate[] = [];
  let entryCount = 0;
  let totalUncompressed = 0;

  try {
    // Note: yauzl validates each entry's fileName itself (rejecting
    // zip-slip/absolute paths) during iteration, before our own isPathSafe
    // check below ever runs — both layers are kept, caught and rewrapped
    // uniformly here so every rejection reason surfaces as a ValidationError
    // (422), not a raw/uncaught Error (500).
    for await (const entry of zipfile.eachEntry()) {
      entryCount += 1;
      if (entryCount > MAX_ARCHIVE_ENTRIES) {
        throw new ValidationError(`Archive has too many entries (max ${MAX_ARCHIVE_ENTRIES}).`);
      }

      // Directory entries (trailing slash) carry no content — skip, no checks needed.
      if (/[/\\]$/.test(entry.fileName)) continue;

      if (!isPathSafe(entry.fileName)) {
        throw new ValidationError(`Archive rejected: unsafe file path "${entry.fileName}".`);
      }
      if (isExecutableEntry(entry)) {
        throw new ValidationError(
          `Archive rejected: contains an executable or script file "${entry.fileName}".`,
        );
      }
      if (entry.uncompressedSize > MAX_UNCOMPRESSED_ENTRY_BYTES) {
        throw new ValidationError(`Archive rejected: "${entry.fileName}" is too large.`);
      }
      totalUncompressed += entry.uncompressedSize;
      if (totalUncompressed > MAX_UNCOMPRESSED_TOTAL_BYTES) {
        throw new ValidationError('Archive rejected: total extracted content is too large.');
      }

      const lower = entry.fileName.toLowerCase();
      if (!lower.endsWith('.md') && !lower.endsWith('.markdown')) continue;

      const body = await readEntryText(zipfile, entry);
      candidates.push({ path: entry.fileName, body });
    }
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError(`Archive rejected: ${(err as Error).message}`);
  } finally {
    zipfile.close();
  }

  return resolveCandidates(candidates);
}

function resolveCandidates(candidates: ArchiveCandidate[]): ArchiveImportResult {
  if (candidates.length === 0) return { body: '', candidates };

  const rootIndex = candidates.findIndex((c) => c.path.replace(/^\.\//, '') === 'SKILL.md');
  const resolvedIndex = rootIndex >= 0 ? rootIndex : candidates.length === 1 ? 0 : undefined;
  if (resolvedIndex === undefined) return { body: '', candidates };

  const resolved = candidates[resolvedIndex]!;
  return {
    name: deriveNameFromMarkdown(resolved.body),
    body: resolved.body,
    candidates,
    resolvedIndex,
  };
}
