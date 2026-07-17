/**
 * Tests for InMemoryMemoryStore
 * Verifies append/retrieve, per-agent isolation, the most-recent-N limit,
 * and keyword filtering.
 */

import { describe, it, expect } from "vitest";

import { InMemoryMemoryStore } from "./memory-store";

describe("InMemoryMemoryStore", () => {
  it("returns an empty array for an agent with no events", async () => {
    const store = new InMemoryMemoryStore();
    expect(await store.retrieve("agent-1")).toEqual([]);
  });

  it("appends and retrieves events in insertion order", async () => {
    const store = new InMemoryMemoryStore();
    await store.append("agent-1", { round: 1, content: "hello", timestamp: 1 });
    await store.append("agent-1", { round: 2, content: "world", timestamp: 2 });

    const events = await store.retrieve("agent-1", { limit: 10 });
    expect(events.map((e) => e.content)).toEqual(["hello", "world"]);
  });

  it("keeps separate agents isolated from each other", async () => {
    const store = new InMemoryMemoryStore();
    await store.append("agent-1", { round: 1, content: "a1", timestamp: 1 });
    await store.append("agent-2", { round: 1, content: "a2", timestamp: 1 });

    expect(await store.retrieve("agent-1")).toEqual([{ round: 1, content: "a1", timestamp: 1 }]);
    expect(await store.retrieve("agent-2")).toEqual([{ round: 1, content: "a2", timestamp: 1 }]);
  });

  it("returns only the most recent `limit` events", async () => {
    const store = new InMemoryMemoryStore();
    for (let round = 1; round <= 5; round++) {
      await store.append("agent-1", { round, content: `event-${round}`, timestamp: round });
    }

    const events = await store.retrieve("agent-1", { limit: 2 });
    expect(events.map((e) => e.round)).toEqual([4, 5]);
  });

  it("defaults to a limit of 5 most-recent events", async () => {
    const store = new InMemoryMemoryStore();
    for (let round = 1; round <= 8; round++) {
      await store.append("agent-1", { round, content: `event-${round}`, timestamp: round });
    }

    const events = await store.retrieve("agent-1");
    expect(events.map((e) => e.round)).toEqual([4, 5, 6, 7, 8]);
  });

  it("filters by keyword, case-insensitively", async () => {
    const store = new InMemoryMemoryStore();
    await store.append("agent-1", { round: 1, content: "Prices rose sharply", timestamp: 1 });
    await store.append("agent-1", { round: 2, content: "Nothing much happened", timestamp: 2 });
    await store.append("agent-1", { round: 3, content: "prices fell back", timestamp: 3 });

    const events = await store.retrieve("agent-1", { keyword: "PRICES", limit: 10 });
    expect(events.map((e) => e.round)).toEqual([1, 3]);
  });
});
