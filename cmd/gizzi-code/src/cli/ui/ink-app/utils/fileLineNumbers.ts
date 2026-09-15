// @ts-nocheck
/**
 * Line-number formatting helpers.
 *
 * Kept separate from file.ts because this file reads a GrowthBook killswitch,
 * and growthbook.ts imports config.ts. Putting it here breaks the import cycle:
 *   config -> file -> growthbook -> config
 */
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../services/analytics/growthbook.js'

/**
 * Whether to use the compact line-number prefix format (`N\t` instead of
 * `     N→`). The padded-arrow format costs 9 bytes/line overhead; at
 * 1.35B Read calls × 132 lines avg this is 2.18% of fleet uncached input
 * (bq-queries/read_line_prefix_overhead_verify.sql).
 *
 * Ant soak validated no Edit error regression (6.29% vs 6.86% baseline).
 * Killswitch pattern: GB can disable if issues surface externally.
 */
export function isCompactLinePrefixEnabled(): boolean {
  // 3P default: killswitch off = compact format enabled. Client-side only —
  // no server support needed, safe for Bedrock/Vertex/Foundry.
  return !getFeatureValue_CACHED_MAY_BE_STALE(
    'tengu_compact_line_prefix_killswitch',
    false,
  )
}

/**
 * Adds cat -n style line numbers to the content.
 */
export function addLineNumbers({
  content,
  // 1-indexed
  startLine,
}: {
  content: string
  startLine: number
}): string {
  if (!content) {
    return ''
  }

  const lines = content.split(/\r?\n/)

  if (isCompactLinePrefixEnabled()) {
    return lines
      .map((line, index) => `${index + startLine}\t${line}`)
      .join('\n')
  }

  return lines
    .map((line, index) => {
      const numStr = String(index + startLine)
      if (numStr.length >= 6) {
        return `${numStr}→${line}`
      }
      return `${numStr.padStart(6, ' ')}→${line}`
    })
    .join('\n')
}

/**
 * Inverse of addLineNumbers — strips the `N→` or `N\t` prefix from a single
 * line. Co-located so format changes here and in addLineNumbers stay in sync.
 */
export function stripLineNumberPrefix(line: string): string {
  const match = line.match(/^\s*\d+[\u2192\t](.*)$/)
  return match?.[1] ?? line
}
