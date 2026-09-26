// D12 — terminal-state push. On completed | partial | needs_user | failed the
// requester is notified through its channel of record. Notify NEVER throws
// into the event path: failures land in the ledger as `notify.failed`.
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { EventLog, TerminalStatus } from "./log.js";

export interface TerminalNotification {
  task_id: string;
  status: TerminalStatus;
  caller_id: string;
  requester_kind: "bot" | "user" | "cli" | "system";
  thread_id: string | null;
  detail: string | null;
}

export interface McpNotifier {
  resourceUpdate(notification: TerminalNotification): Promise<void>;
}

// TODO(P5): real MCP resource update once the gateway's MCP surface lands.
export class NoopMcpNotifier implements McpNotifier {
  async resourceUpdate(): Promise<void> {}
}

export interface NotifierDeps {
  apiBase?: string; // CommRails (allternit-api) base URL
  notificationsDir?: string; // desktop-shell drop directory
  fetchImpl?: typeof fetch;
  log?: EventLog;
  mcp?: McpNotifier;
}

export class Notifier {
  private readonly apiBase: string;
  private readonly notificationsDir: string;
  private readonly fetchImpl: typeof fetch;
  private readonly mcp: McpNotifier;
  private log: EventLog | null;
  private pending = new Set<Promise<void>>();

  constructor(deps: NotifierDeps = {}) {
    this.apiBase = deps.apiBase ?? "http://127.0.0.1:18013";
    this.notificationsDir =
      deps.notificationsDir ?? join(homedir(), ".allternit", "notifications");
    this.fetchImpl = deps.fetchImpl ?? fetch;
    this.mcp = deps.mcp ?? new NoopMcpNotifier();
    this.log = deps.log ?? null;
  }

  setLog(log: EventLog): void {
    this.log = log;
  }

  notifyTerminal(notification: TerminalNotification): Promise<void> {
    const p = this.dispatch(notification);
    this.pending.add(p);
    void p.finally(() => this.pending.delete(p));
    return p;
  }

  // Await all in-flight notifications (tests, shutdown).
  async drain(): Promise<void> {
    await Promise.allSettled([...this.pending]);
  }

  private async dispatch(n: TerminalNotification): Promise<void> {
    try {
      if (n.requester_kind === "bot") {
        await this.sendCommRails(n);
      } else {
        this.writeDesktopDrop(n);
      }
      await this.mcp.resourceUpdate(n);
    } catch (err) {
      this.recordFailure(n, err);
    }
  }

  private async sendCommRails(n: TerminalNotification): Promise<void> {
    const res = await this.fetchImpl(
      `${this.apiBase}/api/rails/peers/${encodeURIComponent(n.caller_id)}/send`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          body: `subscription-gateway: task ${n.task_id} → ${n.status}${n.detail ? ` (${n.detail})` : ""}`,
          from: "subscription-gateway",
        }),
      }
    );
    if (!res.ok) {
      throw new Error(`commrails send failed: HTTP ${res.status}`);
    }
  }

  // Desktop-shell notification: a JSON drop file the shell watches for.
  private writeDesktopDrop(n: TerminalNotification): void {
    mkdirSync(this.notificationsDir, { recursive: true });
    const file = join(
      this.notificationsDir,
      `${new Date().toISOString().replace(/[:.]/g, "-")}-${n.task_id}.json`
    );
    writeFileSync(
      file,
      JSON.stringify({
        source: "subscription-gateway",
        task_id: n.task_id,
        status: n.status,
        thread_id: n.thread_id,
        detail: n.detail,
        created_at: new Date().toISOString(),
      })
    );
  }

  private recordFailure(n: TerminalNotification, err: unknown): void {
    this.log?.append({
      task_id: n.task_id,
      kind: "notify.failed",
      payload: {
        status: n.status,
        caller_id: n.caller_id,
        error: err instanceof Error ? err.message : String(err),
      },
      callers: [],
    });
  }
}
