export function signal() {
  let resolve: any
  const promise = new Promise((r) => (resolve = r))
  return {
    trigger() {
      return resolve()
    },
    wait() {
      return promise
    },
  }
}

export type Signal<T> = {
  get: () => T
  set: (value: T) => void
  emit: (value?: T) => void
  clear: () => void
  subscribe: (listener: (value?: T) => void) => () => void
}

export function createSignal<T>(initialValue?: T): Signal<T> {
  let value = initialValue
  const listeners = new Set<(value?: T) => void>()
  
  const get = () => value as T
  const set = (newValue: T) => {
    value = newValue
    listeners.forEach(listener => listener(value))
  }
  const emit = (emittedValue?: T) => {
    const val = emittedValue !== undefined ? emittedValue : value
    listeners.forEach(listener => listener(val))
  }
  const subscribe = (listener: (value?: T) => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
  const clear = () => {
    listeners.clear()
  }
  
  return { get, set, emit, clear, subscribe }
}
