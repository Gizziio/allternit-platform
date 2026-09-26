import { mkdtempSync, rmSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Config } from "../src/config.js";
import { loadConfig } from "../src/config.js";
import { EventLog } from "../src/events/log.js";
import { Notifier } from "../src/events/notify.js";
import { CallerOutbox } from "../src/events/outbox.js";
import { SseHub } from "../src/events/sse.js";
import { createServer, type GatewayDeps } from "../src/http/server.js";
import type { KeychainBackend } from "../src/security/keychain.js";
import { openDatabase, type Db } from "../src/store/db.js";
import type { Task } from "@allternit/subscription-fabric-contracts";

export function tmpStateDir(): string {
  return mkdtempSync(join(tmpdir(), "subs-gw-test-"));
}

export function cleanupDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

export function fakeKeychain(initial: Record<string, string> = {}): KeychainBackend {
  const items = { ...initial };
  return {
    available: () => true,
    get: (account) => items[account] ?? null,
    set: (account, value) => {
      items[account] = value;
    },
  };
}

export interface TestDeps extends GatewayDeps {
  cleanup(): void;
}

export function makeDeps(stateDir: string, opts: { fetchImpl?: typeof fetch } = {}): TestDeps {
  const config: Config = loadConfig({ SUBS_GATEWAY_STATE_DIR: stateDir });
  const db: Db = openDatabase(":memory:");
  const hub = new SseHub();
  const outbox = new CallerOutbox(db);
  const log = new EventLog(db, hub);
  const notifier = new Notifier({
    apiBase: config.apiBase,
    notificationsDir: join(stateDir, "notifications"),
    fetchImpl: opts.fetchImpl,
    log,
  });
  log.setNotifier(notifier);
  const keychain = fakeKeychain();
  const app = createServer({
    db,
    config,
    keychain,
    log,
    outbox,
    hub,
    notifier,
    version: "0.1.0-test",
  });
  return {
    db,
    config,
    keychain,
    log,
    outbox,
    hub,
    notifier,
    app,
    cleanup() {
      db.close();
    },
  };
}

export function sampleTask(overrides: Partial<Task> = {}): Task {
  const now = new Date().toISOString();
  return {
    task_id: "task-1",
    idempotency_key: null,
    capability: "chat.create",
    capability_version: 1,
    requester: { kind: "bot", id: "bot-1", bot_id: "bot-1" },
    thread_id: null,
    project_id: null,
    parent_task_id: null,
    prompt: "hello",
    inputs: [],
    options: {},
    routing: {
      mode: "auto",
      allow_fallback: true,
      allow_metered: false,
      allow_thread_migration: false,
    },
    constraints: {
      sensitivity: "internal",
      deadline_at: null,
      max_metered_usd: null,
      required_export_format: null,
    },
    approval_id: null,
    priority: "normal",
    status: "queued",
    status_detail: null,
    route_decision: null,
    attempts: [],
    result: null,
    error: null,
    created_at: now,
    updated_at: now,
    completed_at: null,
    ...overrides,
  } as Task;
}

export interface UdsResponse {
  status: number;
  body: unknown;
}

export function udsRequest(
  socketPath: string,
  opts: {
    method?: string;
    path: string;
    token?: string;
    headers?: Record<string, string>;
    body?: unknown;
  }
): Promise<UdsResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath,
        path: opts.path,
        method: opts.method ?? "GET",
        headers: {
          ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
          ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
          ...opts.headers,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          let body: unknown = data;
          try {
            body = JSON.parse(data);
          } catch {
            // plain text body
          }
          resolve({ status: res.statusCode ?? 0, body });
        });
      }
    );
    req.on("error", reject);
    if (opts.body !== undefined) req.write(JSON.stringify(opts.body));
    req.end();
  });
}

export interface SseEvent {
  id: string | null;
  event: string;
  data: string;
}

export function parseSseChunk(buffer: string): { events: SseEvent[]; rest: string } {
  const events: SseEvent[] = [];
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const part of parts) {
    const lines = part.split("\n").filter((l) => l.length > 0);
    if (lines.every((l) => l.startsWith(":"))) continue; // heartbeat comment
    const ev: SseEvent = { id: null, event: "message", data: "" };
    for (const line of lines) {
      if (line.startsWith("id: ")) ev.id = line.slice(4);
      else if (line.startsWith("event: ")) ev.event = line.slice(7);
      else if (line.startsWith("data: ")) ev.data = line.slice(6);
    }
    if (ev.data !== "" || ev.id !== null) events.push(ev);
  }
  return { events, rest };
}

export function openSse(
  port: number,
  path: string,
  token: string
): {
  received: SseEvent[];
  close(): void;
  waitFor(count: number, timeoutMs?: number): Promise<SseEvent[]>;
} {
  const received: SseEvent[] = [];
  let buffer = "";
  const req = http.get(
    {
      host: "127.0.0.1",
      port,
      path,
      headers: { authorization: `Bearer ${token}` },
    },
    (res) => {
      res.on("data", (chunk) => {
        buffer += chunk.toString();
        const parsed = parseSseChunk(buffer);
        buffer = parsed.rest;
        received.push(...parsed.events);
      });
    }
  );
  return {
    received,
    close() {
      req.destroy();
    },
    waitFor(count: number, timeoutMs = 3000): Promise<SseEvent[]> {
      const start = Date.now();
      return new Promise((resolve, reject) => {
        const tick = () => {
          if (received.length >= count) return resolve(received);
          if (Date.now() - start > timeoutMs)
            return reject(new Error(`timed out waiting for ${count} SSE events (got ${received.length})`));
          setTimeout(tick, 20);
        };
        tick();
      });
    },
  };
}
