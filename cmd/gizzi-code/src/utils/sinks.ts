/**
 * Output Sinks
 */

export interface Sink {
  write(data: string): void
}

export function getSinks(): Sink[] {
  return []
}
