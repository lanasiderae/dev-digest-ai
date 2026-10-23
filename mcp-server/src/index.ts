import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadMcpConfig, ConfigError } from './config.js';
import { createLogger } from './log.js';
import { createMcpServer, TOOL_COUNT } from './server.js';

/**
 * Entrypoint — the ONLY module allowed to call `process.exit`. Everything
 * else (config, logger, api client, server, tools) throws instead, so it
 * stays unit-testable. Zero writes to stdout from this file; stdout is owned
 * end to end by the JSON-RPC stdio transport once `connect()` is called.
 */
async function main() {
  let config;
  try {
    config = loadMcpConfig(process.env);
  } catch (err) {
    if (err instanceof ConfigError) {
      process.stderr.write(`devdigest-mcp: ${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }

  const log = createLogger(config.logLevel);
  const server = createMcpServer({ config, log });
  const transport = new StdioServerTransport();

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await server.connect(transport);
  log.info('devdigest-mcp started', { apiBase: config.apiBase, logLevel: config.logLevel, toolCount: TOOL_COUNT });
}

main().catch((err) => {
  process.stderr.write(`devdigest-mcp: fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
