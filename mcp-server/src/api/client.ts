import type { z } from 'zod';
import type { Logger } from '../log.js';

/**
 * Thin HTTP client of the DevDigest API — no auth header, by design: the API
 * runs as a single-default-workspace local server with no auth layer (see
 * `server/src/adapters/auth/local.ts`), so there's nothing to attach here.
 *
 * Every response is validated against its `@devdigest/shared` Zod schema
 * (the same contracts the API itself serializes through) — this module never
 * trusts an unvalidated JSON body.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface DevDigestApi {
  get<T>(path: string, schema: z.ZodType<T>): Promise<T>;
  post<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T>;
}

export function createApi(opts: {
  baseUrl: string;
  requestTimeoutMs: number;
  log: Logger;
  /** Test seam — defaults to the global `fetch`. Mirrors the server's
   *  `ContainerOverrides.skillsUrlFetch` plain-function DI precedent. */
  fetchImpl?: typeof fetch;
}): DevDigestApi {
  const fetchImpl = opts.fetchImpl ?? fetch;

  async function request<T>(method: 'GET' | 'POST', path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
    const url = `${opts.baseUrl}${path}`;
    const startedAt = Date.now();
    let res: Response;
    try {
      res = await fetchImpl(url, {
        method,
        headers: body !== undefined ? { 'content-type': 'application/json' } : {},
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(opts.requestTimeoutMs),
      });
    } catch (err) {
      opts.log.error('devdigest-api request failed', { method, path, durationMs: Date.now() - startedAt });
      throw new ApiError(
        0,
        `Cannot reach the DevDigest API at ${opts.baseUrl}. Is it running? (cd server && pnpm dev) — ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    opts.log.info('devdigest-api request', { method, path, status: res.status, durationMs: Date.now() - startedAt });

    if (!res.ok) {
      throw new ApiError(res.status, `${method} ${path} -> ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError(res.status, `${method} ${path} response did not match the expected shape: ${parsed.error.message}`);
    }
    return parsed.data;
  }

  return {
    get: (path, schema) => request('GET', path, undefined, schema),
    post: (path, body, schema) => request('POST', path, body, schema),
  };
}
