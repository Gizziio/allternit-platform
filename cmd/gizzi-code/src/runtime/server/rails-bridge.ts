/**
 * Rails bridge — forwards executor lifecycle events from the orchestrator
 * registries into rails (mail thread `executor:<slug>` + receipts) so agent
 * work leaves an evidence trail the platform surfaces can render.
 *
 * Fail-open by contract: rails being down must never block orchestration,
 * so every call is best-effort with a short timeout and no retries.
 */

import { appendFile, mkdir, readdir } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import type { OrchestrationEvent } from "@allternit/orchestrator"
import { gatewayUrl } from "@/shared/constants/allternitGateway"

const RAILS_BASE = process.env.GIZZI_RAILS_URL ?? gatewayUrl("/api/rails")
const SHARED_CONTEXT_RELATIVE = ".allternit/shared-context.md"

async function railsPost(path: string, body: unknown): Promise<void> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4_000)
    try {
      await fetch(`${RAILS_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }
  } catch {
    // Fail-open: evidence emission is observability, never a blocker.
  }
}

function threadFor(slug: string): string {
  return `wih:executor-${slug}`
}

async function postLifecycle(slug: string, line: string): Promise<void> {
  await railsPost("/mail/send", { thread: threadFor(slug), body: line })
}

/** Mirror one human-readable line into the workspace shared-context file. */
async function mirrorToSharedContext(workdir: string | undefined, slug: string, line: string): Promise<void> {
  if (!workdir) return
  try {
    const dir = join(workdir, ".allternit")
    await mkdir(dir, { recursive: true })
    const ts = new Date().toISOString()
    await appendFile(join(workdir, SHARED_CONTEXT_RELATIVE), `\n### executor ${slug} ${ts}\n${line}\n`, "utf8")
  } catch {
    // Workspaces without a writable root skip the mirror.
  }
}

/** Receipts for the completion notes and any evidence files the executor dropped. */
async function emitCompletionReceipts(slug: string, notesPath?: string): Promise<void> {
  if (notesPath) {
    await railsPost("/receipts/write", {
      run_id: slug,
      tool: "executor",
      outputs_ref: notesPath,
      exit_code: 0,
      summary: "completion notes",
    })
  }
  try {
    const evidenceDir = join(homedir(), ".agent-orchestrator", "evidence", slug)
    const files = await readdir(evidenceDir)
    for (const file of files) {
      await railsPost("/receipts/write", {
        run_id: slug,
        tool: "executor",
        outputs_ref: join(evidenceDir, file),
        summary: "executor evidence",
      })
    }
  } catch {
    // No evidence directory — nothing to emit.
  }
}

function describePayload(eventType: string, payload: unknown): string {
  if (!payload || typeof payload !== "object") return ""
  const record = payload as Record<string, unknown>
  const bits: string[] = []
  if (typeof record.workdir === "string") bits.push(`workdir=${record.workdir}`)
  if (typeof record.transcriptPath === "string") bits.push(`transcript=${record.transcriptPath}`)
  if (typeof record.prompt === "string") bits.push(`prompt=${record.prompt.slice(0, 120)}`)
  if (typeof record.reason === "string") bits.push(`reason=${record.reason}`)
  return bits.length ? ` (${bits.join(", ")})` : ""
}

/**
 * Single tap for every registry event (wired once in orchestrator.ts).
 * `workdir` is resolved by the caller from the registry records.
 */
export async function bridgeOrchestrationEvent(event: OrchestrationEvent, workdir?: string): Promise<void> {
  const { slug, eventType } = event
  const line = `${eventType}${describePayload(eventType, event.payload)}`

  switch (eventType) {
    case "session.spawned":
    case "session.prompted":
    case "session.done":
    case "session.dead":
    case "session.timeout":
    case "session.killed":
    case "review.pending":
      await postLifecycle(slug, line)
      await mirrorToSharedContext(workdir, slug, line)
      break
    case "review.accepted":
    case "review.rejected": {
      const decision = eventType === "review.accepted" ? "accepted" : "rejected"
      await postLifecycle(slug, line)
      await mirrorToSharedContext(workdir, slug, line)
      await railsPost("/mail/decide", { thread: threadFor(slug), decision })
      break
    }
    default:
      await postLifecycle(slug, line)
      break
  }

  if (eventType === "session.done") {
    const payload = event.payload as { report?: { notesPath?: string } } | undefined
    await emitCompletionReceipts(slug, payload?.report?.notesPath)
  }
}
