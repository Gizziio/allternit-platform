/**
 * Adaptive agent batch scheduling derived from MoonshotAI/kimi-code
 * packages/agent-core-v2/src/session/swarm/agentRunBatch.ts @ 3086e47.
 *
 * Copyright (c) 2026 Moonshot AI. MIT licensed; see docs/upstream/KIMI_CODE.md.
 * Adapted to an Allternit-owned launcher contract and dependency-free retry math.
 */

export interface AdaptiveRunTask<T = unknown> {
  readonly data: T
  readonly timeoutMs?: number
  readonly signal?: AbortSignal
}

export interface AdaptiveRunHandle<R = string> {
  /** Stable ID used to retry the same agent after provider throttling. */
  readonly runID: string
  readonly completion: Promise<R>
}

export interface AdaptiveRunContext {
  readonly signal: AbortSignal
  readonly retryRunID?: string
  readonly onReady: () => void
}

export interface AdaptiveRunLauncher<T, R> {
  launch(task: AdaptiveRunTask<T>, context: AdaptiveRunContext): Promise<AdaptiveRunHandle<R>>
  suspended?(event: { task: AdaptiveRunTask<T>; runID: string; reason: string }): void
}

export interface AdaptiveRunResult<T, R> {
  readonly task: AdaptiveRunTask<T>
  readonly runID?: string
  readonly status: "completed" | "failed" | "aborted"
  readonly state?: "started" | "not_started"
  readonly result?: R
  readonly error?: string
}

export interface AdaptiveRunBatchOptions {
  readonly maxConcurrency?: number
  readonly initialBurst?: number
  readonly rampIntervalMs?: number
  readonly retryBaseMs?: number
  readonly capacityRecoveryMs?: number
  readonly capacityShrinkIntervalMs?: number
  readonly isRateLimitError?: (error: unknown) => boolean
}

type State<T> = {
  readonly index: number
  readonly task: AdaptiveRunTask<T>
  runID?: string
  retryCount: number
  retryReadyAt: number
  started: boolean
}

type Attempt<T> = {
  readonly state: State<T>
  readonly controller: AbortController
  ready: boolean
  timedOut: boolean
  cleanup: () => void
}

type RateLimited = { type: "rate_limited"; runID: string; error: string }

const USER_ABORT_STARTED = "The user interrupted this agent batch before this agent finished."
const USER_ABORT_QUEUED = "The user interrupted this agent batch before this agent started."
const SUSPENDED_REASON = "Provider rate limit; agent requeued for retry."

export function isProviderRateLimit(error: unknown): boolean {
  if (!error || typeof error !== "object") return /(?:^|\D)429(?:\D|$)|rate.?limit/i.test(String(error))
  const value = error as Record<string, unknown>
  const status = value.status ?? value.statusCode ?? value.code
  if (status === 429 || status === "429" || status === "rate_limit_exceeded") return true
  const cause = value.cause
  if (cause && cause !== error && isProviderRateLimit(cause)) return true
  const data = value.data
  if (data && data !== error && isProviderRateLimit(data)) return true
  const nested = value.error
  if (nested && nested !== error && isProviderRateLimit(nested)) return true
  return /(?:^|\D)429(?:\D|$)|rate.?limit/i.test(String(value.message ?? error))
}

export class AdaptiveRunBatch<T, R> {
  private readonly states: State<T>[]
  private readonly pending: State<T>[]
  private readonly results: Array<AdaptiveRunResult<T, R> | undefined>
  private readonly active = new Set<Attempt<T>>()
  private readonly controller = new AbortController()
  private readonly burst: number
  private readonly rampMs: number
  private readonly retryBaseMs: number
  private readonly recoveryMs: number
  private readonly shrinkMs: number
  private readonly rateLimited: (error: unknown) => boolean
  private rampTimer?: ReturnType<typeof setTimeout>
  private retryTimer?: ReturnType<typeof setTimeout>
  private resolve?: (results: AdaptiveRunResult<T, R>[]) => void
  private started = false
  private finished = false
  private launchCount = 0
  private rateLimitMode = false
  private readyCount = 0
  private capacity = 1
  private lastRateLimitAt?: number
  private lastShrinkAt?: number
  private lastRecoveryAt?: number
  private globalRetryMs: number
  private nextLaunchAt = 0

  constructor(
    private readonly launcher: AdaptiveRunLauncher<T, R>,
    tasks: readonly AdaptiveRunTask<T>[],
    private readonly options: AdaptiveRunBatchOptions = {},
  ) {
    if (options.maxConcurrency !== undefined && (!Number.isInteger(options.maxConcurrency) || options.maxConcurrency <= 0)) {
      throw new Error("maxConcurrency must be a positive integer")
    }
    this.burst = options.initialBurst ?? 5
    this.rampMs = options.rampIntervalMs ?? 700
    this.retryBaseMs = options.retryBaseMs ?? 3_000
    this.recoveryMs = options.capacityRecoveryMs ?? 180_000
    this.shrinkMs = options.capacityShrinkIntervalMs ?? 2_000
    this.globalRetryMs = this.retryBaseMs
    this.rateLimited = options.isRateLimitError ?? isProviderRateLimit
    this.states = tasks.map((task, index) => ({ index, task, retryCount: 0, retryReadyAt: 0, started: false }))
    this.pending = [...this.states]
    this.results = Array.from({ length: tasks.length })
  }

  run(): Promise<AdaptiveRunResult<T, R>[]> {
    if (this.started) throw new Error("AdaptiveRunBatch.run() can only be called once")
    this.started = true
    return new Promise((resolve) => {
      this.resolve = resolve
      if (this.states.length === 0) return this.finish([])
      for (const state of this.states) {
        if (!state.task.signal) continue
        if (state.task.signal.aborted) return this.cancel(state.task.signal.reason)
        state.task.signal.addEventListener("abort", this.onTaskAbort, { once: true })
      }
      this.schedule()
    })
  }

  cancel(reason: unknown = new Error("Agent batch cancelled")): void {
    if (this.finished) return
    this.controller.abort(reason)
    this.finish(this.states.map((state) => this.results[state.index] ?? {
      task: state.task,
      runID: state.runID,
      status: "aborted",
      state: state.started || state.runID ? "started" : "not_started",
      error: state.started || state.runID ? USER_ABORT_STARTED : USER_ABORT_QUEUED,
    }))
  }

  private readonly onTaskAbort = (event: Event) => {
    const signal = event.currentTarget as AbortSignal
    this.cancel(signal.reason)
  }

  private schedule(): void {
    if (this.finished || this.controller.signal.aborted || this.finishIfComplete()) return
    if (this.rateLimitMode) this.scheduleThrottled()
    else this.scheduleNormal()
  }

  private scheduleNormal(): void {
    while (this.launchCount < this.burst && this.pending.length && !this.atLimit()) {
      this.start(this.pending.shift()!)
      this.launchCount += 1
    }
    if (!this.pending.length || this.rampTimer || this.atLimit()) return
    this.rampTimer = setTimeout(() => {
      this.rampTimer = undefined
      if (this.finished || this.rateLimitMode || this.atLimit()) return
      this.start(this.pending.shift()!)
      this.launchCount += 1
      this.schedule()
    }, this.rampMs)
  }

  private scheduleThrottled(): void {
    this.clearRetryTimer()
    if (!this.pending.length) return
    const now = Date.now()
    this.recover(now)
    if (this.active.size >= this.throttledCapacity()) return this.wake(this.nextRecoveryAt(), now)
    const allowed = Math.max(this.nextLaunchAt, this.nextPendingAt())
    const wakeAt = Math.min(allowed, this.nextRecoveryAt())
    if (wakeAt > now) return this.wake(wakeAt, now)
    const index = this.pending.findIndex((state) => state.retryReadyAt <= now)
    if (index < 0) return
    this.start(this.pending.splice(index, 1)[0]!)
    this.nextLaunchAt = now + this.globalRetryMs
    this.wakeNext(now)
  }

  private start(state: State<T>): void {
    const attempt: Attempt<T> = {
      state,
      controller: new AbortController(),
      ready: false,
      timedOut: false,
      cleanup: () => {},
    }
    attempt.cleanup = this.link(attempt)
    this.active.add(attempt)
    void this.attempt(attempt).then(
      (outcome) => this.settle(attempt, outcome),
      (error) => this.settle(attempt, this.failure(attempt, error)),
    )
  }

  private async attempt(attempt: Attempt<T>): Promise<AdaptiveRunResult<T, R> | RateLimited> {
    const state = attempt.state
    let handle: AdaptiveRunHandle<R>
    try {
      attempt.controller.signal.throwIfAborted()
      handle = await this.launcher.launch(state.task, {
        signal: attempt.controller.signal,
        retryRunID: state.runID,
        onReady: () => this.markReady(attempt),
      })
    } catch (error) {
      if (this.rateLimited(error) && state.runID) return { type: "rate_limited", runID: state.runID, error: this.message(error) }
      return this.failure(attempt, error)
    }
    state.runID = handle.runID
    try {
      const result = await handle.completion
      return { task: state.task, runID: handle.runID, status: "completed", result }
    } catch (error) {
      if (this.rateLimited(error)) return { type: "rate_limited", runID: handle.runID, error: this.message(error) }
      return this.failure(attempt, error)
    }
  }

  private settle(attempt: Attempt<T>, outcome: AdaptiveRunResult<T, R> | RateLimited): void {
    if (!this.active.delete(attempt)) return
    attempt.cleanup()
    if (this.finished) return
    if ("status" in outcome) this.results[attempt.state.index] = outcome
    else if (this.onlyUnfinished(attempt.state)) {
      this.results[attempt.state.index] = {
        task: attempt.state.task, runID: outcome.runID, status: "failed", state: "started", error: outcome.error,
      }
    } else this.requeue(attempt, outcome)
    this.schedule()
  }

  private requeue(attempt: Attempt<T>, outcome: RateLimited): void {
    const state = attempt.state
    state.runID = outcome.runID
    state.retryCount += 1
    const delay = this.retryBaseMs * 2 ** Math.max(0, state.retryCount - 1)
    const now = Date.now()
    state.retryReadyAt = now + delay
    this.pending.unshift(state)
    this.launcher.suspended?.({ task: state.task, runID: outcome.runID, reason: SUSPENDED_REASON })
    this.lastRateLimitAt = now
    if (!this.rateLimitMode) {
      this.rateLimitMode = true
      this.clearRampTimer()
      this.capacity = Math.max(1, this.readyCount)
      this.shrink(now, true)
    } else this.shrink(now, false)
    if (!attempt.ready) this.globalRetryMs = Math.max(this.globalRetryMs * 2, delay)
    this.nextLaunchAt = Math.max(this.nextLaunchAt, now + (attempt.ready ? this.retryBaseMs : this.globalRetryMs))
  }

  private markReady(attempt: Attempt<T>): void {
    if (attempt.ready || !this.active.has(attempt)) return
    attempt.ready = true
    attempt.state.started = true
    if (!this.rateLimitMode) this.readyCount += 1
    else {
      this.globalRetryMs = this.retryBaseMs
      this.nextLaunchAt = Date.now() + this.retryBaseMs
      this.schedule()
    }
  }

  private failure(attempt: Attempt<T>, error: unknown): AdaptiveRunResult<T, R> {
    const aborted = attempt.controller.signal.aborted && !attempt.timedOut
    return {
      task: attempt.state.task,
      runID: attempt.state.runID,
      status: aborted ? "aborted" : "failed",
      state: attempt.state.runID ? "started" : "not_started",
      error: attempt.timedOut ? "Agent timed out." : aborted ? USER_ABORT_STARTED : this.message(error),
    }
  }

  private link(attempt: Attempt<T>): () => void {
    const abort = () => attempt.controller.abort(this.controller.signal.reason)
    this.controller.signal.addEventListener("abort", abort, { once: true })
    const timeout = attempt.state.task.timeoutMs === undefined ? undefined : setTimeout(() => {
      attempt.timedOut = true
      attempt.controller.abort(new Error("Agent timed out"))
    }, attempt.state.task.timeoutMs)
    return () => {
      if (timeout) clearTimeout(timeout)
      this.controller.signal.removeEventListener("abort", abort)
    }
  }

  private atLimit(): boolean {
    return this.options.maxConcurrency !== undefined && this.active.size >= this.options.maxConcurrency
  }

  private throttledCapacity(): number {
    return Math.min(this.capacity, this.options.maxConcurrency ?? Number.POSITIVE_INFINITY)
  }

  private shrink(now: number, force: boolean): void {
    if (!force && this.lastShrinkAt !== undefined && now - this.lastShrinkAt < this.shrinkMs) return
    this.capacity = Math.max(1, this.capacity - 1)
    this.lastShrinkAt = now
  }

  private recover(now: number): void {
    if (this.nextRecoveryAt() > now) return
    this.capacity += 1
    this.lastRecoveryAt = now
    this.nextLaunchAt = Math.min(this.nextLaunchAt, now)
  }

  private nextRecoveryAt(): number {
    if (!this.pending.length || this.lastRateLimitAt === undefined) return Number.POSITIVE_INFINITY
    return Math.max(this.lastRateLimitAt, this.lastRecoveryAt ?? 0) + this.recoveryMs
  }

  private nextPendingAt(): number {
    return this.pending.reduce((value, state) => Math.min(value, state.retryReadyAt), Number.POSITIVE_INFINITY)
  }

  private wakeNext(now: number): void {
    if (!this.pending.length) return
    const at = this.active.size >= this.throttledCapacity()
      ? this.nextRecoveryAt()
      : Math.min(Math.max(this.nextLaunchAt, this.nextPendingAt()), this.nextRecoveryAt())
    this.wake(at, now)
  }

  private wake(at: number, now: number): void {
    if (!Number.isFinite(at) || at <= now) return
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined
      this.schedule()
    }, at - now)
  }

  private onlyUnfinished(state: State<T>): boolean {
    return this.results.every((result, index) => index === state.index || result !== undefined)
  }

  private finishIfComplete(): boolean {
    if (!this.results.every(Boolean)) return false
    this.finish(this.results as AdaptiveRunResult<T, R>[])
    return true
  }

  private finish(results: AdaptiveRunResult<T, R>[]): void {
    if (this.finished) return
    this.finished = true
    this.cleanup()
    this.resolve?.(results)
  }

  private cleanup(): void {
    this.clearRampTimer()
    this.clearRetryTimer()
    for (const state of this.states) state.task.signal?.removeEventListener("abort", this.onTaskAbort)
    for (const attempt of this.active) attempt.cleanup()
    this.active.clear()
  }

  private clearRampTimer(): void {
    if (this.rampTimer) clearTimeout(this.rampTimer)
    this.rampTimer = undefined
  }

  private clearRetryTimer(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = undefined
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }
}

export function resolveAdaptiveConcurrency(
  env: Readonly<Record<string, string | undefined>> = process.env,
): number | undefined {
  const raw = env.GIZZI_AGENT_SWARM_MAX_CONCURRENCY
  if (raw === undefined || raw.trim() === "") return undefined
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`GIZZI_AGENT_SWARM_MAX_CONCURRENCY must be a positive integer, got ${JSON.stringify(raw)}`)
  }
  return value
}
