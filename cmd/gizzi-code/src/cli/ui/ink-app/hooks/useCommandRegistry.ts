// @ts-nocheck
import { useCallback, useState } from 'react'

/**
 * Command registry hook (merge-rot repair: the ink screens were written
 * against this API but only a placeholder existed). Providers register
 * option lists; the registry flattens them for the command palette.
 */
export function useCommandRegistry() {
  const [providers, setProviders] = useState<Array<() => any[]>>([])

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

  const trigger = useCallback(() => {
    // Palette visibility is owned by the screens; kept for API shape.
  }, [])

  return { register, visibleOptions, suggestedOptions, trigger }
}

export function useCommandRegistry_ts(): void {
  // Not yet implemented
}

export default useCommandRegistry
