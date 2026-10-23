import { describe, expect, it } from 'vitest';
import { ConfigError, loadMcpConfig } from './config.js';

function envWith(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...overrides } as NodeJS.ProcessEnv;
}

describe('loadMcpConfig', () => {
  it('defaults to a loopback api base, 300s run timeout, 30s request timeout, info log level', () => {
    const config = loadMcpConfig(envWith({}));
    expect(config.apiBase).toBe('http://127.0.0.1:3001');
    expect(config.runTimeoutMs).toBe(300_000);
    expect(config.requestTimeoutMs).toBe(30_000);
    expect(config.logLevel).toBe('info');
  });

  it('rejects a non-loopback http base without the opt-in, naming the variable', () => {
    expect(() => loadMcpConfig(envWith({ DEVDIGEST_API_BASE: 'http://example.com' }))).toThrow(ConfigError);
    try {
      loadMcpConfig(envWith({ DEVDIGEST_API_BASE: 'http://example.com' }));
    } catch (err) {
      expect((err as Error).message).toContain('DEVDIGEST_MCP_ALLOW_REMOTE_API');
    }
  });

  it('accepts a non-loopback http base once DEVDIGEST_MCP_ALLOW_REMOTE_API is set', () => {
    const config = loadMcpConfig(
      envWith({ DEVDIGEST_API_BASE: 'http://example.com', DEVDIGEST_MCP_ALLOW_REMOTE_API: 'true' }),
    );
    expect(config.apiBase).toBe('http://example.com');
  });

  it('accepts a non-loopback https base without any opt-in', () => {
    const config = loadMcpConfig(envWith({ DEVDIGEST_API_BASE: 'https://example.com' }));
    expect(config.apiBase).toBe('https://example.com');
  });

  it('rejects a non-http(s) protocol', () => {
    expect(() => loadMcpConfig(envWith({ DEVDIGEST_API_BASE: 'ftp://example.com' }))).toThrow(ConfigError);
  });

  it('rejects a base URL with a path', () => {
    expect(() => loadMcpConfig(envWith({ DEVDIGEST_API_BASE: 'http://127.0.0.1:3001/api' }))).toThrow(ConfigError);
  });

  it('rejects a non-numeric or negative timeout, naming the variable', () => {
    expect(() => loadMcpConfig(envWith({ DEVDIGEST_MCP_RUN_TIMEOUT_MS: 'abc' }))).toThrow(/DEVDIGEST_MCP_RUN_TIMEOUT_MS/);
    expect(() => loadMcpConfig(envWith({ DEVDIGEST_MCP_REQUEST_TIMEOUT_MS: '-5' }))).toThrow(
      /DEVDIGEST_MCP_REQUEST_TIMEOUT_MS/,
    );
  });

  it('validates the log level enum', () => {
    expect(() => loadMcpConfig(envWith({ DEVDIGEST_MCP_LOG_LEVEL: 'verbose' }))).toThrow(ConfigError);
    expect(loadMcpConfig(envWith({ DEVDIGEST_MCP_LOG_LEVEL: 'debug' })).logLevel).toBe('debug');
  });
});
