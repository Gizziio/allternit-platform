import { expect, test } from "bun:test"
import {
  assertOwnedSubagentRun,
  needsSubagentSummaryContinuation,
  throwIfSubagentMessageFailed,
} from "../../src/runtime/agents/subagent-run-contract"

test("resume requires parent ownership", () => {
  expect(() => assertOwnedSubagentRun(
    { id: "child", parentID: "other", profile: "explore" },
    { parentSessionID: "parent", profile: "explore" },
  )).toThrow("not owned")
})

test("resume preserves the bound profile", () => {
  expect(() => assertOwnedSubagentRun(
    { id: "child", parentID: "parent", profile: "plan" },
    { parentSessionID: "parent", profile: "explore" },
  )).toThrow("belongs to profile plan")
})

test("legacy run titles retain profile ownership", () => {
  expect(() => assertOwnedSubagentRun(
    { id: "child", parentID: "parent", title: "Audit (@plan subagent)" },
    { parentSessionID: "parent", profile: "explore" },
  )).toThrow("belongs to profile plan")
})

test("summary policy requests bounded continuation only for inadequate handoffs", () => {
  const policy = { minChars: 200, continuationPrompt: "Expand the handoff", retries: 1 }
  expect(needsSubagentSummaryContinuation("too short", policy)).toBe(true)
  expect(needsSubagentSummaryContinuation("x".repeat(200), policy)).toBe(false)
  expect(needsSubagentSummaryContinuation("anything", undefined)).toBe(false)
})

test("structured assistant errors cannot masquerade as successful empty handoffs", () => {
  expect(() => throwIfSubagentMessageFailed({
    info: {
      role: "assistant",
      error: { name: "APIError", data: { message: "rate limited", statusCode: 429, code: "rate_limit" } },
    },
  })).toThrow("rate limited")
  expect(() => throwIfSubagentMessageFailed({ info: { role: "assistant" } })).not.toThrow()
})
