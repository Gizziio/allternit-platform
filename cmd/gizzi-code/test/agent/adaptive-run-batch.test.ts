import { expect, test } from "bun:test"
import {
  AdaptiveRunBatch,
  isProviderRateLimit,
  resolveAdaptiveConcurrency,
  type AdaptiveRunLauncher,
} from "../../src/runtime/agents/adaptive-run-batch"

test("recognizes structured and wrapped provider rate limits", () => {
  expect(isProviderRateLimit({ status: 429 })).toBe(true)
  expect(isProviderRateLimit({ code: "rate_limit_exceeded" })).toBe(true)
  expect(isProviderRateLimit({ cause: { statusCode: 429 } })).toBe(true)
  expect(isProviderRateLimit({ data: { statusCode: 429 } })).toBe(true)
  expect(isProviderRateLimit(new Error("provider returned 429 Too Many Requests"))).toBe(true)
  expect(isProviderRateLimit(new Error("invalid request"))).toBe(false)
})

test("validates the explicit swarm concurrency cap", () => {
  expect(resolveAdaptiveConcurrency({})).toBeUndefined()
  expect(resolveAdaptiveConcurrency({ GIZZI_AGENT_SWARM_MAX_CONCURRENCY: "3" })).toBe(3)
  expect(() => resolveAdaptiveConcurrency({ GIZZI_AGENT_SWARM_MAX_CONCURRENCY: "0" })).toThrow()
  expect(() => resolveAdaptiveConcurrency({ GIZZI_AGENT_SWARM_MAX_CONCURRENCY: "many" })).toThrow()
})

test("returns ordered partial results instead of rejecting the whole batch", async () => {
  const launcher: AdaptiveRunLauncher<number, string> = {
    async launch(task, context) {
      context.onReady()
      return {
        runID: `agent-${task.data}`,
        completion: task.data === 2 ? Promise.reject(new Error("bad task")) : Promise.resolve(`ok-${task.data}`),
      }
    },
  }
  const results = await new AdaptiveRunBatch(launcher, [{ data: 1 }, { data: 2 }, { data: 3 }]).run()
  expect(results.map((result) => result.status)).toEqual(["completed", "failed", "completed"])
  expect(results[1]?.error).toBe("bad task")
})

test("requeues a 429 on the same agent and continues remaining work", async () => {
  const attempts = new Map<number, number>()
  const suspended: string[] = []
  const launcher: AdaptiveRunLauncher<number, string> = {
    async launch(task, context) {
      const count = (attempts.get(task.data) ?? 0) + 1
      attempts.set(task.data, count)
      context.onReady()
      const runID = context.retryRunID ?? `agent-${task.data}`
      return {
        runID,
        completion: task.data === 1 && count === 1
          ? Promise.reject(Object.assign(new Error("throttled"), { status: 429 }))
          : Promise.resolve(`ok-${task.data}`),
      }
    },
    suspended(event) {
      suspended.push(event.runID)
    },
  }

  const results = await new AdaptiveRunBatch(launcher, [{ data: 1 }, { data: 2 }], {
    initialBurst: 1,
    rampIntervalMs: 1,
    retryBaseMs: 1,
    capacityRecoveryMs: 5,
    capacityShrinkIntervalMs: 1,
  }).run()

  expect(attempts.get(1)).toBe(2)
  expect(suspended).toEqual(["agent-1"])
  expect(results.map((result) => result.result)).toEqual(["ok-1", "ok-2"])
})

test("pre-aborted work returns explicit not-started cancellation results", async () => {
  const controller = new AbortController()
  controller.abort(new Error("cancelled"))
  const launcher: AdaptiveRunLauncher<number, string> = {
    async launch() {
      throw new Error("must not launch")
    },
  }
  const results = await new AdaptiveRunBatch(launcher, [{ data: 1, signal: controller.signal }]).run()
  expect(results[0]).toMatchObject({ status: "aborted", state: "not_started" })
})
