import { useEffect, useRef, useState } from 'react'
import { getGatewayOrigin } from '@/lib/platform-gateway'

export type ConnectivityState = 'online' | 'offline' | 'checking'

const CHECK_INTERVAL_MS = 30000 // 30 seconds
const CHECK_TIMEOUT_MS = 5000   // 5 second timeout per check

/**
 * Periodically pings the Allternit API gateway to detect backend availability.
 * Pauses when the tab is hidden to save battery/network.
 * Returns 'checking' initially, then 'online' or 'offline'.
 */
export function useConnectivity(): ConnectivityState {
  const [state, setState] = useState<ConnectivityState>('checking')
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let cancelled = false
    let interval: number | null = null

    async function check() {
      if (cancelled || document.hidden) return
      setState((prev) => (prev === 'offline' ? 'checking' : prev))

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const timeoutId = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS)

      try {
        // Ping the gateway health endpoint — returns 200 when healthy.
        await fetch(`${getGatewayOrigin()}/health`, {
          method: 'HEAD',
          signal: controller.signal,
          cache: 'no-store',
        })
        if (!cancelled) setState('online')
      } catch {
        if (!cancelled) setState('offline')
      } finally {
        clearTimeout(timeoutId)
      }
    }

    function start() {
      if (interval) return
      check()
      interval = window.setInterval(check, CHECK_INTERVAL_MS)
    }

    function stop() {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    }

    function onVisibilityChange() {
      if (document.hidden) {
        stop()
      } else {
        start()
      }
    }

    start()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      stop()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      abortRef.current?.abort()
    }
  }, [])

  return state
}
