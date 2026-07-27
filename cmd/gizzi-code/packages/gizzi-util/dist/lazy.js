export function lazy(factory) {
  let initialized = false
  let value

  return function lazyValue(...args) {
    if (!initialized) {
      value = factory(...args)
      initialized = true
    }
    return value
  }
}
