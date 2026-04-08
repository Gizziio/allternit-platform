/**
 * Storage abstraction for Office add-ins.
 * Uses OfficeRuntime.storage when available (persists across sessions),
 * falls back to localStorage for web/testing environments.
 */

function isOfficeRuntimeAvailable(): boolean {
  return (
    typeof OfficeRuntime !== 'undefined' &&
    typeof OfficeRuntime.storage !== 'undefined'
  )
}

export const officeStorage = {
  async get<T>(key: string): Promise<T | null> {
    try {
      if (isOfficeRuntimeAvailable()) {
        const value = await OfficeRuntime.storage.getItem(key)
        return value ? (JSON.parse(value) as T) : null
      }
      const value = localStorage.getItem(key)
      return value ? (JSON.parse(value) as T) : null
    } catch {
      return null
    }
  },

  async set<T>(key: string, value: T): Promise<void> {
    const serialized = JSON.stringify(value)
    if (isOfficeRuntimeAvailable()) {
      await OfficeRuntime.storage.setItem(key, serialized)
      return
    }
    localStorage.setItem(key, serialized)
  },

  async remove(key: string): Promise<void> {
    if (isOfficeRuntimeAvailable()) {
      await OfficeRuntime.storage.removeItem(key)
      return
    }
    localStorage.removeItem(key)
  },
}
