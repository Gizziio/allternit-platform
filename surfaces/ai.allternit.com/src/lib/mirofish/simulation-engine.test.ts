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
}));

import { InMemoryMemoryStore } from "./memory-store";
import { runSimulation } from "./simulation-engine";

/** Persona-builder prompts ask for a JSON persona; turn prompts ask for plain text. */
function mockGenerateTextImpl(prompt: string, callIndex: number): { text: string } {
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
