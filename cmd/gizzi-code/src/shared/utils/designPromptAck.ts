import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

/**
 * `/design` deep-link acknowledgement receipt (local-only, no network surface).
 *
 * The A:// Studio reports consumption of an `allternit://design?prompt=…`
 * prompt via POST /v1/design/ack; gizzi-code persists it here and the
 * `/design` CLI command reads it back to confirm the studio picked the prompt
 * up. One receipt per machine — the file is small and the CLI only cares about
 * the latest pickup.
 */

export interface DesignPromptAck {
  prompt: string
  consumedAt: string
  sessionId?: string
}

export function designAckPath(): string {
  return process.env.ALLTERNIT_DESIGN_ACK_PATH ?? join(homedir(), ".allternit", "design-prompt-ack.json")
}

export async function readDesignAck(): Promise<DesignPromptAck | undefined> {
  try {
    const raw = await readFile(designAckPath(), "utf8")
    const parsed = JSON.parse(raw) as Partial<DesignPromptAck>
    if (typeof parsed?.prompt !== "string" || typeof parsed?.consumedAt !== "string") return undefined
    return {
      prompt: parsed.prompt,
      consumedAt: parsed.consumedAt,
      ...(typeof parsed.sessionId === "string" ? { sessionId: parsed.sessionId } : {}),
    }
  } catch {
    return undefined
  }
}

export async function writeDesignAck(ack: DesignPromptAck): Promise<void> {
  const target = designAckPath()
  await mkdir(dirname(target), { recursive: true })
  const temporary = `${target}.tmp`
  await writeFile(temporary, JSON.stringify(ack, null, 2), { mode: 0o600 })
  await rename(temporary, target)
}
