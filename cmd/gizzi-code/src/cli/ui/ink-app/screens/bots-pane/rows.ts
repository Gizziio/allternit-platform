// @ts-nocheck
/**
 * Pure row-formatting helpers for the /bots pane (Phase B5). Kept free of
 * ink/runtime imports so they are directly unit-testable; BotsRowList wraps
 * these segments in themed ink Text nodes.
 */
import type { BotRosterRow } from '@/runtime/bots/bot-roster.js'

export const EMPTY_BOTS_MESSAGE = 'No bots yet — press n to create one.'

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(0, max - 1))}…`
}

export interface BotRowSegments {
  /** Presence glyph — '●' when the bot is active, '○' otherwise. */
  glyph: string
  /** Theme color name for the glyph (dashboard visual language). */
  glyphColor: string
  /** "name — title" (name first; title omitted when empty). */
  identity: string
  /** Clipped description, '' when none. */
  description: string
  /** Model label, '' when unpinned. */
  model: string
  /** Unread badge text, '' when unreadCount is 0. */
  badge: string
}

const MAX_DESCRIPTION = 48

export function buildBotRowSegments(row: BotRosterRow): BotRowSegments {
  const active = row.active === true
  const title = (row.title ?? '').trim()
  return {
    glyph: active ? '●' : '○',
    glyphColor: active ? 'success' : 'inactive',
    identity: title && title !== row.name ? `${row.name} — ${title}` : row.name,
    description: truncate((row.description ?? '').replace(/\s+/g, ' ').trim(), MAX_DESCRIPTION),
    model: row.model ? ` · ${row.model}` : '',
    badge: row.unreadCount > 0 ? `[${row.unreadCount}]` : '',
  }
}

/**
 * Assemble the plain-text form of a roster row (used by tests and as the
 * fallback/aria-style summary). The ink component renders the same segments
 * with per-segment colors.
 */
export function formatBotRowText(row: BotRosterRow): string {
  const s = buildBotRowSegments(row)
  const desc = s.description ? `  ${s.description}` : ''
  const model = s.model
  const badge = s.badge ? ` ${s.badge}` : ''
  return `${s.glyph} ${s.identity}${desc}${model}${badge}`
}
