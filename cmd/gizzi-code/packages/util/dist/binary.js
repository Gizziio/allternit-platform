/**
 * @a2r/util/binary — Binary search utilities
 */

export const Binary = {
  /**
   * Binary search an array sorted by a key function.
   * Returns { index, found } where index is the insertion point if not found.
   */
  search(arr, target, keyFn) {
    let lo = 0
    let hi = arr.length - 1
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1
      const k = keyFn(arr[mid])
      if (k === target) return { index: mid, found: true }
      if (k < target) lo = mid + 1
      else hi = mid - 1
    }
    return { index: lo, found: false }
  },
}
