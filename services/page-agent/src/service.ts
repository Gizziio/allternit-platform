/**
 * Page-agent service stub.
 *
 * Models session lifecycle (run / stop / status) and can be backed by the
 * local gizzi brain runtime or by `/api/page-agent/*` proxies. This is a
 * shared surface-agnostic stub; server-side implementations fill in the
 * persistent backend store.
 */

import type { PageAgentBridgeConfig } from "./config.js";
import { runPageAgentTask, stopPageAgentTask } from "./client.js";
import type { PageAgentCallbacks } from "./client.js";
import type { PageAgentRunResult, PageAgentSession, PageAgentStatus } from "./types.js";

export interface PageAgentServiceConfig {
  /** Default runtime base URL (gizzi brain / thin client). */
  runtimeBaseUrl?: string;
  /** Maximum concurrent sessions before old ones are evicted. */
  maxSessions?: number;
}

export class PageAgentService {
  private sessions = new Map<string, PageAgentSession>();
  private config: Required<PageAgentServiceConfig>;

  constructor(config: PageAgentServiceConfig = {}) {
    this.config = {
      runtimeBaseUrl: config.runtimeBaseUrl ?? "http://127.0.0.1:4096",
      maxSessions: config.maxSessions ?? 20,
    };
  }

  /**
   * Start a new page-agent session for the given goal.
   */
  async run(
    goal: string,
    bridgeConfig?: PageAgentBridgeConfig,
    callbacks?: PageAgentCallbacks,
  ): Promise<PageAgentSession> {
    const id = crypto.randomUUID();
    const session: PageAgentSession = {
      id,
      status: "running",
      goal,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.sessions.set(id, session);
    this.evictIfNeeded();

    await runPageAgentTask({
      goal,
      config: bridgeConfig,
      callbacks: {
        onSession: (runtimeSessionId) => {
          session.id = runtimeSessionId;
          this.sessions.set(runtimeSessionId, session);
          callbacks?.onSession?.(runtimeSessionId);
        },
        onActivity: (activity) => {
          session.updatedAt = Date.now();
          callbacks?.onActivity?.(activity);
        },
        onHistoryEvent: (event) => {
          session.updatedAt = Date.now();
          callbacks?.onHistoryEvent?.(event);
        },
        onDone: (result: PageAgentRunResult) => {
          session.status = result.success ? "completed" : "error";
          session.updatedAt = Date.now();
          callbacks?.onDone?.(result);
        },
      },
    });

    return session;
  }

  /**
   * Stop a running session.
   */
  async stop(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = "idle";
      session.updatedAt = Date.now();
    }
    await stopPageAgentTask(sessionId);
  }

  /**
   * Get the current status of a session.
   */
  status(sessionId: string): PageAgentStatus {
    return this.sessions.get(sessionId)?.status ?? "idle";
  }

  /**
   * List active sessions, most recently updated first.
   */
  list(): PageAgentSession[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );
  }

  /**
   * Remove a session from the local index.
   */
  remove(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private evictIfNeeded() {
    if (this.sessions.size <= this.config.maxSessions) return;
    const sorted = this.list();
    const toRemove = sorted.slice(this.config.maxSessions);
    for (const session of toRemove) {
      this.sessions.delete(session.id);
    }
  }
}

export function createPageAgentService(
  config?: PageAgentServiceConfig,
): PageAgentService {
  return new PageAgentService(config);
}
