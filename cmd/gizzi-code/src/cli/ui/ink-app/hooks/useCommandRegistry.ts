// @ts-nocheck
import { useCallback, useState } from 'react'

/**
 * Command registry hook (merge-rot repair: the ink screens were written
 * against this API but only a placeholder existed). Providers register
 * option lists; the registry flattens them for the command palette.
 */
export function useCommandRegistry() {
  const [providers, setProviders] = useState<Array<() => any[]>>([])
  // Palette visibility for consumers that delegate it to the registry.
  // (MainScreen/MainScreenEnhanced own their own palette state and never
  // call trigger; both patterns are supported.)
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Returns an unregister function, matching the screens' useEffect cleanup.
  const register = useCallback((provider: () => any[]) => {
    setProviders(prev => [...prev, provider])
    return () => setProviders(prev => prev.filter(p => p !== provider))
  }, [])

  const visibleOptions = providers.flatMap(provider => {
    try {
      return provider() || []
    } catch {
      return []
    }
  })
  const suggestedOptions = visibleOptions.filter(o => o?.suggested)

  // Toggles the registry-owned palette (or forces it with a boolean arg).
  const trigger = useCallback((open?: boolean) => {
    setPaletteOpen(prev => (typeof open === 'boolean' ? open : !prev))
  }, [])

  return { register, visibleOptions, suggestedOptions, trigger, paletteOpen }
}

export default useCommandRegistry
