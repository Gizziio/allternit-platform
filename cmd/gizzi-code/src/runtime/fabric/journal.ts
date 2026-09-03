/**
 * Local journal for Fabric capability invocations.
 *
 * Writes append-only JSON-lines receipts to the gizzi data directory. This is
 * the runtime side of the canonical workload audit trail:
 *
 *   trigger → workload → step → harness router → worker resolution →
 *   capability request → lease/policy → function → executor gateway →
 *   node/resource → result → artifact+receipt → journal
 *
 * The local journal is intentionally simple: one file per calendar day. A
 * future platform journal service can mirror these records or replace the
 * local store.
 */
import path from "node:path"
import { Log } from "@/shared/util/log"
import { Global } from "@/runtime/context/global"
import { Filesystem } from "@/runtime/util/filesystem"

const log = Log.create({ service: "fabric:journal" })

import { type FabricInvocationReceipt } from "@allternit/os-contracts"

export type FabricReceipt = FabricInvocationReceipt
export type FabricReceiptInput = Omit<FabricInvocationReceipt, "id" | "at">

function journalDir(): string {
  return path.join(Global.Path.data, "fabric-journal")
}

function journalPath(date = new Date()): string {
  const day = date.toISOString().slice(0, 10)
  return path.join(journalDir(), `${day}.ndjson`)
}

function receiptId(): string {
  return `rcpt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** Truncate a result to keep journal lines bounded. */
function summarizeResult(result: unknown): unknown {
  if (result === null || result === undefined) return result
  if (typeof result === "string") {
    return result.length > 4096 ? result.slice(0, 4096) + "…" : result
  }
  if (typeof result === "number" || typeof result === "boolean") return result
  if (Array.isArray(result)) {
    return result.length > 64 ? result.slice(0, 64) : result
  }
  if (typeof result === "object") {
    const obj = result as Record<string, unknown>
    const keys = Object.keys(obj)
    const out: Record<string, unknown> = {}
    for (const key of keys.slice(0, 32)) {
      const value = obj[key]
      if (typeof value === "string" && value.length > 1024) {
        out[key] = value.slice(0, 1024) + "…"
      } else if (typeof value === "object" && value !== null) {
        out[key] = "<object>"
      } else {
        out[key] = value
      }
    }
    if (keys.length > 32) out["…"] = `${keys.length - 32} more keys`
    return out
  }
  return String(result)
}

export namespace FabricJournal {
  /** Append a receipt to the local journal. */
  export async function write(receipt: FabricReceiptInput): Promise<FabricReceipt> {
    const entry: FabricReceipt = {
      ...receipt,
      id: receiptId(),
      at: new Date().toISOString(),
      result: summarizeResult(receipt.result),
      error: receipt.error && receipt.error.length > 2048 ? receipt.error.slice(0, 2048) + "…" : receipt.error,
    }
    const line = JSON.stringify(entry) + "\n"
    try {
      await Filesystem.append(journalPath(), line)
    } catch (err) {
      log.warn("failed to write fabric receipt", { error: err instanceof Error ? err.message : String(err) })
    }
    return entry
  }

  /** Read receipts from the current journal day. */
  export async function readRecent(limit = 100): Promise<FabricReceipt[]> {
    const file = journalPath()
    if (!(await Filesystem.exists(file))) return []
    const text = await Filesystem.readText(file).catch(() => "")
    const lines = text.split("\n").filter(Boolean)
    return lines.slice(-limit).map((line) => JSON.parse(line) as FabricReceipt)
  }
}
