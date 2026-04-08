import { describe, expect, it } from "vitest";

import { coerceThoughtSteps, parseThoughtSteps } from "./thought-trace";

describe("parseThoughtSteps", () => {
  it("summarizes doc-search prompts without awkward trailing fragments", () => {
    const steps = parseThoughtSteps(
      "Use web search on https://ai-sdk.dev/docs and answer in one sentence with a source.",
    );

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      type: "search",
      summary: "Searching AI SDK docs",
    });
  });

  it("turns missing-context reasoning into a stable clarification summary", () => {
    const steps = parseThoughtSteps(
      'The user is asking for "the same recommendation" but I do not have context from a previous conversation. What recommendation are you referring to?',
    );

    expect(steps).toHaveLength(1);
    expect(steps[0]?.type).toBe("reasoning");
    expect(["Missing prior context", "Clarifying request"]).toContain(steps[0]?.summary);
  });

  it("extracts stronger reasoning headlines from doc review sentences", () => {
    const steps = parseThoughtSteps(
      'Looking at the docs, the most relevant feature would be "Coding Agents".',
    );

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      type: "reasoning",
      summary: "Identified Coding Agents as best fit",
    });
  });

  it("turns quoted documentation sections into explicit best-fit labels", () => {
    const steps = parseThoughtSteps(
      'The "Agents" section which covers building agents with tool calling is the best fit.',
    );

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      type: "reasoning",
      summary: "Identified Agents section as best fit",
    });
  });

  it("stabilizes final-answer phrasing into a calmer summary", () => {
    const steps = parseThoughtSteps(
      "AI SDK Core. Let me give a concise answer with two words that capture what this is.",
    );

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      type: "reasoning",
      summary: "Preparing concise answer",
    });
  });

  it("accepts backend-provided structured thought steps without reparsing raw text", () => {
    const steps = coerceThoughtSteps([
      {
        type: "search",
        summary: "Searching AI SDK docs",
        detail: "Use web search on https://ai-sdk.dev/docs",
        status: "completed",
        metadata: {
          searchQuery: "ai-sdk.dev/docs",
          results: 1,
        },
      },
      {
        type: "reasoning",
        summary: "Preparing concise answer",
        detail: "Give a concise answer with a source.",
        status: "completed",
      },
    ]);

    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({
      type: "search",
      summary: "Searching AI SDK docs",
      metadata: {
        searchQuery: "ai-sdk.dev/docs",
        results: 1,
      },
    });
    expect(steps[1]).toMatchObject({
      type: "reasoning",
      summary: "Preparing concise answer",
    });
  });
});
