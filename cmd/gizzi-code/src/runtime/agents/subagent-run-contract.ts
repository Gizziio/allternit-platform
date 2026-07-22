/** Canonical ownership and result contract shared by subagent launch backends. */

export type SubagentRunMode = "foreground" | "background"

export interface SubagentSummaryPolicy {
  readonly minChars: number
  readonly continuationPrompt: string
  readonly retries: number
}

export interface SubagentRunRequest {
  readonly parentSessionID: string
  readonly profile: string
  readonly prompt: string
  readonly description: string
  readonly mode: SubagentRunMode
  readonly resumeRunID?: string
  readonly summaryPolicy?: SubagentSummaryPolicy
}

export interface SubagentRunIdentity {
  readonly id: string
  readonly parentID?: string
  readonly profile?: string
  readonly title?: string
}

export interface SubagentRunResult {
  readonly runID: string
  readonly profile: string
  readonly status: "completed" | "failed" | "aborted" | "running"
  readonly summary?: string
  readonly outputPath?: string
  readonly error?: string
}

export function assertOwnedSubagentRun(
  run: SubagentRunIdentity,
  input: Pick<SubagentRunRequest, "parentSessionID" | "profile">,
): void {
  if (run.parentID !== input.parentSessionID) {
    throw new Error(`Subagent run ${run.id} is not owned by session ${input.parentSessionID}`)
  }
  if (run.profile && run.profile !== input.profile) {
    throw new Error(`Subagent run ${run.id} belongs to profile ${run.profile}, not ${input.profile}`)
  }

  // Compatibility for runs created before profile metadata was persisted.
  if (!run.profile && run.title) {
    const match = run.title.match(/\(@(.+?) subagent\)$/)
    if (match?.[1] && match[1] !== input.profile) {
      throw new Error(`Subagent run ${run.id} belongs to profile ${match[1]}, not ${input.profile}`)
    }
  }
}

export function needsSubagentSummaryContinuation(text: string, policy?: SubagentSummaryPolicy): boolean {
  return policy !== undefined && text.trim().length < policy.minChars
}

export function throwIfSubagentMessageFailed(message: { info?: { role?: string; error?: unknown } }): void {
  if (message.info?.role !== "assistant" || !message.info.error) return
  const error = message.info.error as any
  throw Object.assign(new Error(error.data?.message ?? error.message ?? error.name ?? "Subagent failed"), {
    code: error.data?.code,
    status: error.data?.statusCode ?? error.statusCode ?? error.status,
    data: error.data,
  })
}
