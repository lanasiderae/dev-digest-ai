import { lookup } from 'node:dns/promises';
import { ValidationError } from '../../../platform/errors.js';
import { URL_IMPORT_MAX_BYTES, URL_IMPORT_TIMEOUT_MS } from '../constants.js';
import { deriveNameFromMarkdown } from '../helpers.js';

/**
 * URL skill import. Basic SSRF guard (proportionate to this feature's scope,
 * not a full egress proxy): https-only, resolved-hostname private/loopback/
 * link-local rejection, no redirect-following (a redirect-based SSRF bypass
 * is rejected outright), a request timeout, and a streamed byte cap that
 * doesn't trust `Content-Length`.
 */

export interface UrlImportResult {
  name?: string;
  body: string;
}

function isPrivateOrLoopbackIp(ip: string): boolean {
  // IPv4
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 127 || // loopback
      a === 10 || // private
      a === 0 || // "this network"
      (a === 169 && b === 254) || // link-local
      (a === 172 && b >= 16 && b <= 31) || // private
      (a === 192 && b === 168) // private
    );
  }
  // IPv6
  const lower = ip.toLowerCase();
  if (lower === '::1') return true; // loopback
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) {
    return true; // link-local fe80::/10
  }
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local fc00::/7
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) — check the embedded IPv4.
  const mapped = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isPrivateOrLoopbackIp(mapped[1]!);
  return false;
}

export interface FetchSkillUrlOptions {
  fetchImpl?: typeof fetch;
  /** Injectable hostname resolver (defaults to node:dns/promises' `lookup`) —
   *  overridable in tests so the SSRF guard can be exercised without a real
   *  network/DNS round trip. */
  resolveImpl?: (hostname: string) => Promise<{ address: string }[]>;
}

export async function fetchSkillUrl(
  url: string,
  opts: FetchSkillUrlOptions = {},
): Promise<UrlImportResult> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const resolveImpl = opts.resolveImpl ?? ((hostname: string) => lookup(hostname, { all: true }));

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ValidationError('Not a valid URL.');
  }
  if (parsed.protocol !== 'https:') {
    throw new ValidationError('Only https:// URLs are supported.');
  }

  let addresses: { address: string }[];
  try {
    const result = await resolveImpl(parsed.hostname);
    addresses = Array.isArray(result) ? result : [result];
  } catch {
    throw new ValidationError('Could not resolve that host.');
  }
  if (addresses.some((a) => isPrivateOrLoopbackIp(a.address))) {
    throw new ValidationError('That host resolves to a private or internal address — refusing to fetch it.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), URL_IMPORT_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetchImpl(parsed, { signal: controller.signal, redirect: 'manual' });
  } catch (err) {
    throw new ValidationError(`Could not fetch that URL: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }

  if (res.status >= 300 && res.status < 400) {
    throw new ValidationError('That URL redirected — redirects are not followed for imports.');
  }
  if (!res.ok) {
    throw new ValidationError(`Fetch failed with status ${res.status}.`);
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType && !/^text\/|^application\/octet-stream/.test(contentType)) {
    throw new ValidationError(`Unexpected content type "${contentType}" — expected a text/Markdown response.`);
  }

  const body = await readBodyCapped(res, URL_IMPORT_MAX_BYTES);
  return { name: deriveNameFromMarkdown(body), body };
}

async function readBodyCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ValidationError('Response body is too large.');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
}
