/**
 * Tests for simulation-engine
 * Mocks the LLM call boundary (`ai`'s generateText and
 * @/lib/ai/providers's getDefaultPluginModel) — no real model calls here.
 * Verifies: correct number of rounds run, every persona gets a turn per
 * round, and memory is written per turn.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateText } = vi.hoisted(() => ({ generateText: vi.fn() }));

vi.mock("ai", () => ({ generateText }));
vi.mock("@/lib/ai/providers", () => ({
  getDefaultPluginModel: vi.fn().mockResolvedValue({ modelId: "mock-model" }),
  getPluginModel: vi.fn().mockResolvedValue({ modelId: "mock-model" }),
}));

import { InMemoryMemoryStore } from "./memory-store";
import { runSimulation } from "./simulation-engine";

/**
 * The staged pipeline makes four kinds of calls, each with a distinctive
 * prompt: seed-graph extraction, persona JSON, plain-text turns, and the
 * final report.
 */
function mockGenerateTextImpl(prompt: string, callIndex: number): { text: string } {
  if (prompt.includes('"entities"')) {
    return {
      text: JSON.stringify({
        entities: [{ name: "City Council", type: "organization", stance: "proposing" }],
        relationships: [{ from: "City Council", to: "Retailers", relation: "regulates" }],
      }),
    };
  }
  if (prompt.includes('"executiveSummary"')) {
    return {
      text: JSON.stringify({
        executiveSummary: "The crowd was mixed.",
        riskSignals: ["backlash"],
        narrativePaths: ["acceptance"],
        confidence: "medium",
      }),
    };
  }
  if (prompt.includes('"name":')) {
    return {
      text: JSON.stringify({
        name: `Persona ${callIndex}`,
        bio: `Bio for persona ${callIndex}.`,
        traits: { mood: "curious" },
      }),
    };
  }
  return { text: `Turn output #${callIndex}` };
}

describe("runSimulation", () => {
  beforeEach(() => {
    generateText.mockReset();
    let callIndex = 0;
    generateText.mockImplementation(async ({ prompt }: { prompt: string }) => {
      callIndex += 1;
      return mockGenerateTextImpl(prompt, callIndex);
    });
  });

  it("runs the configured number of rounds and gives every persona a turn each round", async () => {
    const memoryStore = new InMemoryMemoryStore();
    const seed = { kind: "news" as const, text: "Seed text." };

    const world = await runSimulation(
      seed,
      { populationSize: 3, rounds: 2 },
      { memoryStore, concurrency: 5 }
    );

    expect(world.personas).toHaveLength(3);
    expect(world.currentRound).toBe(2);
    expect(world.roundSummaries).toHaveLength(2);
    expect(world.roundSummaries.map((s) => s.round)).toEqual([1, 2]);
    // Full participation is recorded per round.
    expect(world.roundSummaries.map((s) => `${s.agentsActed}/${s.agentsTotal}`)).toEqual(["3/3", "3/3"]);
    // Graph and report stages ran.
    expect(world.seedGraph?.entities[0]?.name).toBe("City Council");
    expect(world.report?.confidence).toBe("medium");
    // Round summaries use persona names, not internal unit ids.
    expect(world.roundSummaries[0].summary).not.toContain("local-");

    for (const persona of world.personas) {
      const events = await memoryStore.retrieve(persona.id, { limit: 10 });
      expect(events).toHaveLength(2);
      expect(events.map((e) => e.round)).toEqual([1, 2]);
    }
  });

  it("completes the round even if one persona's turn fails, without breaking other agents", async () => {
    let callIndex = 0;
    generateText.mockImplementation(async ({ prompt }: { prompt: string }) => {
      callIndex += 1;
      if (prompt.includes('"name":')) {
        return mockGenerateTextImpl(prompt, callIndex);
      }
      if (prompt.includes("Persona 2")) {
        throw new Error("model unavailable");
      }
      return mockGenerateTextImpl(prompt, callIndex);
    });

    const memoryStore = new InMemoryMemoryStore();
    const world = await runSimulation(
      { kind: "other" as const, text: "Seed." },
      { populationSize: 3, rounds: 1 },
      { memoryStore }
    );

    expect(world.personas).toHaveLength(3);
    // Every persona still exists in world state even though one turn failed.
    expect(world.roundSummaries).toHaveLength(1);
    // The degraded participation is recorded, not hidden.
    expect(world.roundSummaries[0].agentsActed).toBe(2);
    expect(world.roundSummaries[0].agentsTotal).toBe(3);
  });

  it("rejects with an abort error when cancelled mid-run", async () => {
    const controller = new AbortController();

    await expect(
      runSimulation(
        { kind: "news" as const, text: "Seed." },
        { populationSize: 2, rounds: 3 },
        {
          signal: controller.signal,
          onProgress: (event) => {
            if (event.stage === "personas" && event.completed >= 1) controller.abort();
          },
        }
      )
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("still returns a world when graph extraction and report generation fail", async () => {
    let callIndex = 0;
    generateText.mockImplementation(async ({ prompt }: { prompt: string }) => {
      callIndex += 1;
      if (prompt.includes('"entities"') || prompt.includes('"executiveSummary"')) {
        throw new Error("stage model down");
      }
      return mockGenerateTextImpl(prompt, callIndex);
    });

    const world = await runSimulation(
      { kind: "news" as const, text: "Seed." },
      { populationSize: 2, rounds: 1 }
    );

    expect(world.personas).toHaveLength(2);
    expect(world.seedGraph).toBeNull();
    expect(world.report).toBeUndefined();
    expect(world.roundSummaries).toHaveLength(1);
  });

  it("carries the previous round's summary into the next round's prompts", async () => {
    const seenPrompts: string[] = [];
    generateText.mockImplementation(async ({ prompt }: { prompt: string }) => {
      seenPrompts.push(prompt);
      if (prompt.includes('"name":')) {
        return { text: JSON.stringify({ name: "P", bio: "B", traits: {} }) };
      }
      return { text: "did a distinctive thing" };
    });

    await runSimulation({ kind: "other" as const, text: "Seed." }, { populationSize: 1, rounds: 2 });

    const roundTwoPrompt = seenPrompts.find((p) => p.includes("It is round 2"));
    expect(roundTwoPrompt).toBeDefined();
    expect(roundTwoPrompt).toContain("did a distinctive thing");
  });
});
