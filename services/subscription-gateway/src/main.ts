// Boot — order matters: config → keychain gate (D3: refuse without it) →
// store+migrations → events/http wiring → UDS (+TCP if enabled) → log binds.
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Express } from "express";
import { loadConfig, type Config } from "./config.js";
import { openDatabase, type Db } from "./store/db.js";
import { EventLog } from "./events/log.js";
import { SseHub } from "./events/sse.js";
import { CallerOutbox } from "./events/outbox.js";
import { Notifier } from "./events/notify.js";
import {
  KeychainUnavailable,
  requireKeychain,
  type KeychainBackend,
} from "./security/keychain.js";
import { closeServer, createServer, listenTcp, listenUds } from "./http/server.js";
import { createScheduler } from "./queue/scheduler.js";
import { StaticRouter } from "./router/resolve.js";

export interface BootDeps {
  env?: NodeJS.ProcessEnv;
  keychain?: KeychainBackend;
  fetchImpl?: typeof fetch;
  logger?: (line: string) => void;
  exit?: (code: number) => void;
}

export interface RunningGateway {
  config: Config;
  db: Db;
  app: Express;
  servers: Server[];
  log: EventLog;
  outbox: CallerOutbox;
  hub: SseHub;
  notifier: Notifier;
  close(): Promise<void>;
}

function packageVersion(): string {
  const raw = readFileSync(new URL("../package.json", import.meta.url), "utf8");
  return (JSON.parse(raw) as { version?: string }).version ?? "0.1.0";
}

export async function boot(deps: BootDeps = {}): Promise<RunningGateway> {
  const logger = deps.logger ?? ((line: string) => console.log(line));
  const exit = deps.exit ?? ((code: number) => process.exit(code));
  const config = loadConfig(deps.env ?? process.env);

  let keychain: KeychainBackend;
  try {
    keychain = requireKeychain(deps.keychain);
  } catch (err) {
    if (err instanceof KeychainUnavailable) {
      logger(`subscription-gateway: ${err.message}`);
      exit(1);
    }
    throw err;
  }

  const db = openDatabase(config.dbPath);
  const hub = new SseHub();
  const outbox = new CallerOutbox(db);
  const log = new EventLog(db, hub);
  const notifier = new Notifier({
    apiBase: config.apiBase,
    notificationsDir: join(homedir(), ".allternit", "notifications"),
    fetchImpl: deps.fetchImpl,
    log,
  });
  log.setNotifier(notifier);

  const app = createServer({
    db,
    config,
    keychain,
    log,
    outbox,
    hub,
    notifier,
    router: new StaticRouter(),
    scheduler: createScheduler(),
    version: packageVersion(),
  });

  const servers: Server[] = [];
  servers.push(await listenUds(app, config.udsPath));
  logger(`subscription-gateway: listening on unix:${config.udsPath}`);
  if (config.tcp.enabled) {
    servers.push(await listenTcp(app, config.tcp.host, config.tcp.port));
    logger(
      `subscription-gateway: listening on http://${config.tcp.host}:${config.tcp.port} (token required)`
    );
  }

  return {
    config,
    db,
    app,
    servers,
    log,
    outbox,
    hub,
    notifier,
    async close() {
      await notifier.drain();
      await Promise.all(servers.map((s) => closeServer(s)));
      db.pragma("wal_checkpoint(TRUNCATE)");
      db.close();
    },
  };
}

async function main(): Promise<void> {
  const gateway = await boot();
  const shutdown = () => {
    void gateway.close().then(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

const invokedDirectly =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  void main();
}
