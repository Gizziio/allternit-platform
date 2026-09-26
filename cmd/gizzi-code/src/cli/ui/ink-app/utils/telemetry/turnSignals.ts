/**
 * Per-turn signal extraction over the ink-app message list, kept out of
 * REPL.tsx so the assembly points stay one-liners. Everything here is
 * defensive: missing fields mean "not reported", never a guess.
 */
import type { Message } from '../../types/message.js'
import { getCurrentUsage, getTokenUsage } from '../tokens.js'

/**
 * True when any assistant message appended during this turn (from index
 * `fromIndex` on) carries the runtime's estimated-usage marker
 * (`usageEstimated` / `tokensEstimated` — see
 * src/runtime/session/context-event.ts and message-v2.ts). Providers that
 * report real usage never set it.
 */
export function turnUsageEstimated(
  messages: Message[],
  fromIndex: number,
): boolean {
  for (let i = Math.max(0, fromIndex); i < messages.length; i++) {
    const m = messages[i]
    if (!m || m.type !== 'assistant') continue
    const nested = m.message as {
      usageEstimated?: boolean
      tokensEstimated?: boolean
    }
    if (
      nested?.usageEstimated === true ||
      nested?.tokensEstimated === true ||
      (m as { usageEstimated?: boolean }).usageEstimated === true
    ) {
      return true
    }
  }
  return false
}

/**
 * 0–1 share of the context window in use, from the last usage-bearing
 * message (same basis as the footer and /usage: input + cache write +
 * cache read over the model's window). Null when nothing was reported.
 */
export function contextRatioFromMessages(
  messages: Message[],
  contextWindow: number,
): number | null {
  if (!Number.isFinite(contextWindow) || contextWindow <= 0) return null
  const usage = getCurrentUsage(messages)
  if (!usage) return null
  const used =
    usage.input_tokens +
    usage.cache_creation_input_tokens +
    usage.cache_read_input_tokens
  if (used <= 0) return null
  return Math.min(1, used / contextWindow)
}

/**
 * Reasoning tokens on the most recent usage-bearing message, when the
 * provider reports them (`reasoning_tokens` / `reasoning_output_tokens`).
 * Zero when absent.
 */
export function reasoningTokensFromMessages(messages: Message[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    const usage = m ? getTokenUsage(m) : undefined
    if (!usage) continue
    const extra = usage as typeof usage & {
      reasoning_tokens?: number
      reasoning_output_tokens?: number
    }
    const n = extra.reasoning_tokens ?? extra.reasoning_output_tokens ?? 0
    return typeof n === 'number' && Number.isFinite(n) ? n : 0
  }
  return 0
}
