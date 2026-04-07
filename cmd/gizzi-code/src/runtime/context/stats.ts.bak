/**
 * Stats Context
 */

export interface StatsStore {
  getStats(): Record<string, number>
  increment(key: string): void
}

export function createStatsStore(): StatsStore {
  const stats: Record<string, number> = {}
  return {
    getStats: () => ({ ...stats }),
    increment: (key: string) => {
      stats[key] = (stats[key] || 0) + 1
    },
  }
}
