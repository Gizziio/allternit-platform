/**
 * Tests for persona-builder output hardening — covering the failure modes
 * observed in live testing (see docs/MIROFISH_TEST_RESULTS.md): malformed
 * persona JSON shipped raw to the UI, and total generation failure
 * completing as a silent empty run.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateText } = vi.hoisted(() => ({ generateText: vi.fn() }));

vi.mock("ai", () => ({ generateText }));
vi.mock("@/lib/ai/providers", () => ({
  getDefaultPluginModel: vi.fn().mockResolvedValue({ modelId: "mock-model" }),
}));

import { buildPersonas } from "./persona-builder";

const SEED = { kind: "news" as const, text: "A congestion charge was announced." };

describe("buildPersonas", () => {
  beforeEach(() => {
    generateText.mockReset();
  });

  it("retries once on unparseable JSON and uses the retry's parse", async () => {
    let calls = 0;
    generateText.mockImplementation(async () => {
      calls += 1;
      if (calls === 1) return { text: "sorry, here is a persona: {broken json" };
      return { text: JSON.stringify({ name: "Ada", bio: "An engineer.", traits: {} }) };
    });

    const personas = await buildPersonas(SEED, 1);

    expect(calls).toBe(2);
    expect(personas).toHaveLength(1);
    expect(personas[0].name).toBe("Ada");
  });

  it("falls back without leaking unit ids or raw JSON when both attempts are unparseable", async () => {
    generateText.mockResolvedValue({ text: '{"name": "Lucas", "bio": "truncated…' });

    const personas = await buildPersonas(SEED, 2);

    expect(personas).toHaveLength(2);
    for (const persona of personas) {
      expect(persona.name).toMatch(/^Persona \d+$/);
      expect(persona.name).not.toContain("local-");
      expect(persona.bio).not.toContain("{");
      expect(persona.bio).not.toContain('"');
    }
  });

  it("throws with the underlying cause when every generation fails", async () => {
    generateText.mockRejectedValue(new Error("Gateway request failed: Failed to fetch"));

    await expect(buildPersonas(SEED, 3)).rejects.toThrow(
      /All 3 persona generations failed.*Failed to fetch/
    );
  });

  it("tolerates partial failure and keeps the survivors", async () => {
    let calls = 0;
    generateText.mockImplementation(async () => {
      calls += 1;
      if (calls === 2) throw new Error("one bad call");
      return { text: JSON.stringify({ name: `P${calls}`, bio: "Bio.", traits: {} }) };
    });

    const personas = await buildPersonas(SEED, 3, { concurrency: 1 });

    expect(personas).toHaveLength(2);
  });

  it("grounds prompts in the seed graph when one is provided", async () => {
    const prompts: string[] = [];
    generateText.mockImplementation(async ({ prompt }: { prompt: string }) => {
      prompts.push(prompt);
      return { text: JSON.stringify({ name: "G", bio: "B.", traits: {} }) };
    });

    await buildPersonas(SEED, 1, {
      seedGraph: {
        entities: [{ name: "City Council", type: "organization", stance: "proposing" }],
        relationships: [{ from: "City Council", to: "Commuters", relation: "affects" }],
      },
    });

    expect(prompts[0]).toContain("City Council");
    expect(prompts[0]).toContain("Ground this persona");
  });
});
