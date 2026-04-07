/**
 * Array Utilities
 */

export function count<T>(arr: T[], predicate: (item: T) => boolean): number {
  return arr.filter(predicate).length
}
