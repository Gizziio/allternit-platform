import { useEffect, useState } from 'react'

type ConnectionState = 'connected' | 'disconnected' | 'checking'

interface ConnectionInfo {
  state: ConnectionState
  mode: 'native' | 'cloud' | 'none'
  desktopVersion?: string
}

export function ConnectionBadge() {
  const [connection, setConnection] = useState<ConnectionInfo>({
    state: 'checking',
    mode: 'none',
  })

  useEffect(() => {
    checkConnection()
    const interval = setInterval(checkConnection, 15_000)
    return () => clearInterval(interval)
  }, [])

  async function checkConnection() {
    setConnection((prev) => ({ ...prev, state: 'checking' }))
    try {
      const response = await chrome.runtime.sendMessage({ type: 'NATIVE_HOST_STATUS' })
      if (response?.ok) {
        setConnection({
          state: 'connected',
          mode: 'native',
          desktopVersion: response.status?.version,
        })
      } else {
        setConnection({ state: 'disconnected', mode: 'none' })
      }
    } catch {
      setConnection({ state: 'disconnected', mode: 'none' })
    }
  }

  const colors: Record<ConnectionState, string> = {
    connected: 'bg-emerald-400',
    disconnected: 'bg-red-400',
    checking: 'bg-amber-400 animate-pulse',
  }

  const labels: Record<ConnectionState, string> = {
    connected: 'Connected',
    disconnected: 'Disconnected',
    checking: 'Checking…',
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-[var(--bg-secondary,#F5EDE3)] px-2.5 py-1">
      <span className={`inline-block size-2 rounded-full ${colors[connection.state]}`} />
      <span className="text-xs text-[var(--text-primary,#2A1F16)]/70">
        {labels[connection.state]}
      </span>
      {connection.desktopVersion && (
        <span className="text-[10px] text-[var(--text-primary,#2A1F16)]/50">
          v{connection.desktopVersion}
        </span>
      )}
    </div>
  )
}
