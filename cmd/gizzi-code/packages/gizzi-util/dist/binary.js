export const Binary = {
  search(items, needle, selector) {
    let low = 0
    let high = items.length - 1

    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      const current = selector(items[mid])
      if (current === needle) {
        return { found: true, index: mid }
      }
      if (current < needle) {
        low = mid + 1
      } else {
        high = mid - 1
      }
    }

    return { found: false, index: low }
  },
}
