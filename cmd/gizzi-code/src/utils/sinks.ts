/**
 * Output Sinks
 */

export interface Sink {
  write(data: string): void
}

export function getSinks(): Sink[] {
  return []
}

// Merge-by-re-export: complete counterpart (local exports win on conflict)
export { initSinks } from "../shared/utils/sinks.js";
