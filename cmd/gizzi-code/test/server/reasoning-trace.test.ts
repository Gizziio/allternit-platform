// @ts-nocheck
import { describe, expect, test } from "bun:test"

import { buildReasoningTrace } from "../../src/server/routes/reasoning-trace"

describe("buildReasoningTrace", () => {
  test("labels AI SDK doc searches without leaking raw prompt fragments", () => {
    const trace = buildReasoningTrace(
      "Use web search on https://ai-sdk.dev/docs and answer in one sentence with a source.",
    )

    expect(trace?.steps).toHaveLength(1)
    expect(trace?.steps[0]).toMatchObject({
      type: "search",
      summary: "Searching AI SDK docs",
    })
  })

  test("extracts a stronger doc-review reasoning headline", () => {
    const trace = buildReasoningTrace(
      'Looking at the docs, the most relevant feature would be "Coding Agents".',
    )

    expect(trace?.headline).toBe("Identified Coding Agents as best fit")
    expect(trace?.steps[0]).toMatchObject({
      type: "reasoning",
      summary: "Identified Coding Agents as best fit",
    })
  })

  test("turns quoted documentation sections into explicit best-fit labels", () => {
    const trace = buildReasoningTrace(
      'The "Agents" section which covers building agents with tool calling is the best fit.',
    )

    expect(trace?.headline).toBe("Identified Agents section as best fit")
    expect(trace?.steps[0]).toMatchObject({
      type: "reasoning",
      summary: "Identified Agents section as best fit",
    })
  })

  test("stabilizes concise-answer phrasing into a calmer reasoning step", () => {
    const trace = buildReasoningTrace(
      "AI SDK Core. Let me give a concise answer with two words that capture what this is.",
    )

    expect(trace?.steps.at(-1)).toMatchObject({
      type: "reasoning",
      summary: "Preparing concise answer",
    })
  })
})
