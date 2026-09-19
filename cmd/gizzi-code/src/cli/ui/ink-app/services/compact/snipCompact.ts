import type { Message } from '../../types/message.js'

export function snipCompact_ts(): void {
  // Not yet implemented
}

// ---------------------------------------------------------------------------
// HISTORY_SNIP runtime contract.
//
// These exports are consumed behind `feature('HISTORY_SNIP')` DCE flags
// (messages.ts, attachments.ts, query.ts). External builds compile the flag
// to false, so the lazy requires below never execute there; the real runtime
// implementation ships behind the flag. The stubs keep the module's type
// surface complete for type-checking and return conservative no-op values.
// ---------------------------------------------------------------------------

export function isSnipRuntimeEnabled(): boolean {
  return false
}

export function shouldNudgeForSnips(_messages: Message[]): boolean {
  return false
}

export const SNIP_NUDGE_TEXT = ''

export function snipCompactIfNeeded(messages: Message[]): {
  messages: Message[]
  tokensFreed: number
  boundaryMessage?: Message
} {
  return { messages, tokensFreed: 0 }
}

export default snipCompact_ts
