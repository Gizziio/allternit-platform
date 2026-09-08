/**
 * Bot Assets API
 *
 * Client for the Rust API bot avatar asset endpoints (spec Phase 2):
 *   POST /api/bots/:id/avatar — store `{type, data}` (surface BotAvatar union)
 *   GET  /api/bots/:id/avatar — fetch the stored avatar
 *
 * Graceful degradation: any failure (network down, 404, invalid payload)
 * resolves to `false`/`null` — avatar sync is best-effort and must never
 * break the form flow.
 *
 * @module bot-assets-api
 */

import { BotAvatarSchema, type BotAvatar } from './bot-avatar.service';

export async function saveBotAvatar(botId: string, avatar: unknown): Promise<boolean> {
  const parsed = BotAvatarSchema.safeParse(avatar);
  if (!parsed.success) return false;
  try {
    const response = await fetch(`/api/bots/${encodeURIComponent(botId)}/avatar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Returns the stored avatar, or null when none exists / unreachable. */
export async function getBotAvatar(botId: string): Promise<BotAvatar | null> {
  try {
    const response = await fetch(`/api/bots/${encodeURIComponent(botId)}/avatar`);
    if (response.status === 404) return null;
    if (!response.ok) return null;
    const parsed = BotAvatarSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
