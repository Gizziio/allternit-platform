/**
 * MemoryStore — per-agent event log.
 *
 * No Zep, no external SaaS dependency (see docs/SWARM_MIROFISH_PHASE_2_TASK.md
 * design decision 2) — introducing a new billed service is a product/cost
 * call for Eoj, not something to pull in mid-implementation. `InMemoryMemoryStore`
 * is a `Map`-backed store scoped to one simulation run's lifetime, which is
 * enough for Phase 2. Retrieval is deliberately simple (most-recent-N,
 * optionally keyword-filtered) — no embedding/vector search here, that's a
 * real feature for a later phase, not a Phase 2 scope item.
 *
 * Kept as an interface specifically so a future `DrizzleMemoryStore` can
 * implement it later (see design decision 3) without touching the
 * simulation engine's call sites.
 */

import type { AgentMemoryEvent } from "./types";

export interface MemoryRetrievalOptions {
  /** Max number of most-recent events to return. */
  limit?: number;
  /** If set, only events whose content contains this (case-insensitive). */
  keyword?: string;
}

export interface MemoryStore {
  append(agentId: string, event: AgentMemoryEvent): Promise<void>;
  retrieve(agentId: string, options?: MemoryRetrievalOptions): Promise<AgentMemoryEvent[]>;
}

const DEFAULT_RETRIEVAL_LIMIT = 5;

export class InMemoryMemoryStore implements MemoryStore {
  private readonly events = new Map<string, AgentMemoryEvent[]>();

  async append(agentId: string, event: AgentMemoryEvent): Promise<void> {
    const existing = this.events.get(agentId);
    if (existing) {
      existing.push(event);
    } else {
      this.events.set(agentId, [event]);
    }
  }

  async retrieve(
    agentId: string,
    options: MemoryRetrievalOptions = {}
  ): Promise<AgentMemoryEvent[]> {
    const limit = options.limit ?? DEFAULT_RETRIEVAL_LIMIT;
    const all = this.events.get(agentId) ?? [];

    const filtered = options.keyword
      ? all.filter((event) =>
          event.content.toLowerCase().includes(options.keyword!.toLowerCase())
        )
      : all;

    return filtered.slice(-limit);
  }
}
