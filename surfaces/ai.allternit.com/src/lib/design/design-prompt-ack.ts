/**
 * `/design` deep-link acknowledgement (local-only).
 *
 * gizzi-code's `/design [prompt]` prints an `allternit://design?prompt=…` deep
 * link but had no way to know the studio actually consumed the prompt. When
 * the studio applies an `initialPrompt` into the composer it reports
 * consumption here; the gizzi server records it as
 * `~/.allternit/design-prompt-ack.json`, which the CLI reads back to confirm
 * pickup. Best-effort end to end: any failure (no gateway, offline) is
 * swallowed — the deep link itself already carried the prompt.
 */

import { gizziBaseUrl } from '@/lib/agents/api-config';

export interface DesignPromptAck {
  prompt: string;
  consumedAt: string;
  sessionId?: string;
}

/** Report that the studio applied a deep-linked prompt into the composer. */
export async function reportDesignPromptConsumed(prompt: string, sessionId?: string): Promise<void> {
  const trimmed = prompt.trim();
  if (!trimmed || typeof window === 'undefined') return;
  try {
    await fetch(`${gizziBaseUrl()}/v1/design/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: trimmed,
        consumedAt: new Date().toISOString(),
        ...(sessionId ? { sessionId } : {}),
      } satisfies DesignPromptAck),
    });
  } catch {
    // Local ack only — never block the studio on it.
  }
}
