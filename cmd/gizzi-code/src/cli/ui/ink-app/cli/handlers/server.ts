import { randomBytes } from 'crypto';
import { startServer } from '../../server/server.js';
import { SessionManager } from '../../server/sessionManager.js';
import { DangerousBackend } from '../../server/backends/dangerousBackend.js';
import { printBanner } from '../../server/serverBanner.js';
import { createServerLogger } from '../../server/serverLog.js';
import {
  writeServerLock,
  removeServerLock,
  probeRunningServer,
} from '../../server/lockfile.js';

export async function serverHandler(opts: {
  port: string;
  host: string;
  authToken?: string;
  unix?: string;
  workspace?: string;
  idleTimeout: string;
  maxSessions: string;
}): Promise<void> {
  const existing = await probeRunningServer();
  if (existing) {
    process.stderr.write(
      `A claude server is already running (pid ${existing.pid}) at ${existing.httpUrl}\n`,
    );
    process.exit(1);
  }

  const authToken =
    opts.authToken ?? `sk-ant-cc-${randomBytes(16).toString('base64url')}`;
  const config = {
    port: parseInt(opts.port, 10),
    host: opts.host,
    authToken,
    unix: opts.unix,
    workspace: opts.workspace,
    idleTimeoutMs: parseInt(opts.idleTimeout, 10),
    maxSessions: parseInt(opts.maxSessions, 10),
  };

  const backend = new DangerousBackend();
  const sessionManager = new SessionManager(backend, {
    idleTimeoutMs: config.idleTimeoutMs,
    maxSessions: config.maxSessions,
  });

  const logger = createServerLogger();
  const server = startServer(config, sessionManager, logger);
  const actualPort = server.port ?? config.port;

  printBanner(config, authToken, actualPort);

  await writeServerLock({
    pid: process.pid,
    port: actualPort,
    host: config.host,
    httpUrl: config.unix
      ? `unix:${config.unix}`
      : `http://${config.host}:${actualPort}`,
    startedAt: Date.now(),
  });

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    // Stop accepting new connections before tearing down sessions.
    server.stop(true);
    await sessionManager.destroyAll();
    await removeServerLock();
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}
