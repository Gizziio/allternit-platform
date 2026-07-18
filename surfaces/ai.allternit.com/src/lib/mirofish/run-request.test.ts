/**
 * Tests for run-request interpretation — the natural-language single entry
 * point. Covers stated vs default config, clamping, and the never-fatal
 * fallback (prompt-as-seed) on unparseable model output.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateText } = vi.hoisted(() => ({ generateText: vi.fn() }));

vi.mock("ai", () => ({ generateText }));
vi.mock("@/lib/ai/providers", () => ({
  getDefaultPluginModel: vi.fn().mockResolvedValue({ modelId: "mock-model" }),
  getPluginModel: vi.fn().mockResolvedValue({ modelId: "mock-model" }),
}));

import { DEFAULT_POPULATION, DEFAULT_ROUNDS, interpretRunRequest } from "./run-request";

describe("interpretRunRequest", () => {
  beforeEach(() => {
    generateText.mockReset();
  });

  it("uses stated counts, detected kind, and the extracted graph", async () => {
    generateText.mockResolvedValue({
      text: JSON.stringify({
        seedText: "A 30% congestion charge was announced downtown.",
        kind: "news",
        populationSize: 8,
        rounds: 3,
        entities: [{ name: "Retailers", type: "group", stance: "opposed" }],
        relationships: [{ from: "City Council", to: "Retailers", relation: "charges" }],
      }),
    });

    const request = await interpretRunRequest(
      "Simulate how 8 retailers react to the congestion charge over 3 rounds"
    );

    expect(request.seed.kind).toBe("news");
    expect(request.seed.text).toBe("A 30% congestion charge was announced downtown.");
    expect(request.populationSize).toBe(8);
    expect(request.rounds).toBe(3);
    expect(request.statedPopulation).toBe(true);
    expect(request.statedRounds).toBe(true);
    expect(request.seedGraph?.entities[0]?.name).toBe("Retailers");
  });

  it("defaults unstated counts and clamps out-of-range ones", async () => {
    generateText.mockResolvedValue({
      text: JSON.stringify({
        seedText: "Some policy draft.",
        kind: "policy",
        populationSize: 9000,
        rounds: null,
        entities: [],
        relationships: [],
      }),
    });

    const request = await interpretRunRequest("React to this policy draft: …");

    expect(request.populationSize).toBe(50); // clamped to MAX
    expect(request.rounds).toBe(DEFAULT_ROUNDS);
    expect(request.statedRounds).toBe(false);
    expect(request.seedGraph).toBeNull(); // no entities extracted
  });

  it("falls back to prompt-as-seed with defaults when the response is unparseable", async () => {
    generateText.mockResolvedValue({ text: "I cannot help with that" });

    const prompt = "Just some raw material with no JSON anywhere";
    const request = await interpretRunRequest(prompt);

    expect(request.seed.text).toBe(prompt);
    expect(request.seed.kind).toBe("other");
    expect(request.populationSize).toBe(DEFAULT_POPULATION);
    expect(request.rounds).toBe(DEFAULT_ROUNDS);
    expect(request.seedGraph).toBeNull();
  });

  it("falls back when the model call itself fails", async () => {
    generateText.mockRejectedValue(new Error("backend down"));

    const request = await interpretRunRequest("material");

    expect(request.seed.text).toBe("material");
    expect(request.populationSize).toBe(DEFAULT_POPULATION);
  });
});
