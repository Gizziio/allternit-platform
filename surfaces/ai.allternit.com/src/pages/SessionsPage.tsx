// @ts-nocheck
'use client'

import { useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState, useCallback } from 'react'
import { ArrowsClockwise, Terminal, Clock, X, DownloadSimple, MagnifyingGlass } from '@phosphor-icons/react'
import { usePlatformUser, usePlatformAuth } from '@/lib/platform-auth-client'
import { GATEWAY_BASE_URL } from '@/lib/agents/api-config'

interface GizziSession {
  id: string
  slug: string
  projectID: string
  directory: string
  summary?: { title?: string }
  time: { created: number; updated: number }
}

interface StatusInfo {
  type: 'idle' | 'busy' | 'retry'
}

interface TraceEntry {
  sequence: number
  kind: string
  time: number
  messageID?: string
  partID?: string
  data?: unknown
}

function titleFor(s: GizziSession): string {
  return s.summary?.title?.trim() || s.slug || s.id.slice(0, 8)
}

export default function SessionsPage() {
  const { isLoaded, isSignedIn } = usePlatformUser()
  const { getToken } = usePlatformAuth()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<GizziSession[]>([])
  const [statuses, setStatuses] = useState<Record<string, StatusInfo>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [inspectedSession, setInspectedSession] = useState<GizziSession | null>(null)
  const esRef = useRef<EventSource | null>(null)

  const authHeaders = useCallback(async () => {
    const token = await getToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [getToken])

  const fetchData = useCallback(async () => {
    try {
      const headers = await authHeaders()
      const [sessRes, stRes] = await Promise.all([
        fetch(`${GATEWAY_BASE_URL}/v1/session/list`, { headers }),
        fetch(`${GATEWAY_BASE_URL}/v1/session/status`, { headers }),
      ])
      if (sessRes.ok) {
        const list: GizziSession[] = await sessRes.json()
        setSessions(list.sort((a, b) => b.time.updated - a.time.updated))
      }
      if (stRes.ok) {
        setStatuses(await stRes.json())
      }
    } catch {
      // server may be offline
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    fetchData()

    const es = new EventSource(`${GATEWAY_BASE_URL}/v1/global/event`)
    esRef.current = es

    const onMessage = (e: MessageEvent) => {
      try {
        const raw = JSON.parse(e.data)
        const evt = raw.payload ?? raw

        if (evt.type === 'session.updated') {
          const info: GizziSession = evt.properties.info
          setSessions((prev) => {
            const idx = prev.findIndex((s) => s.id === info.id)
            const next = idx >= 0 ? prev.map((s, i) => i === idx ? info : s) : [info, ...prev]
            return [...next].sort((a: GizziSession, b: GizziSession) => b.time.updated - a.time.updated)
          })
        }

        if (evt.type === 'session.status') {
          const { sessionID, status } = evt.properties as { sessionID: string; status: StatusInfo }
          setStatuses((prev) => ({ ...prev, [sessionID]: status }))
        }
      } catch {
        // ignore parse errors
      }
    }

    es.addEventListener('message', onMessage)

    return () => {
      es.removeEventListener('message', onMessage)
      es.close()
      esRef.current = null
    }
  }, [isLoaded, isSignedIn, fetchData])

  const statusBadge = (id: string) => {
    const st = statuses[id]
    if (!st || st.type === 'idle') return null
    if (st.type === 'busy') {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
          running
        </span>
      )
    }
    if (st.type === 'retry') {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
          retrying
        </span>
      )
    }
    return null
  }

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      navigate(`/sign-in?redirect_url=/shell/sessions`, { replace: true })
    }
  }, [isLoaded, isSignedIn, navigate])

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-50">
        <p className="text-zinc-500">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="sticky top-0 bg-white border-b z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold">Sessions</h1>
          <button type="button"
            onClick={() => { setIsRefreshing(true); fetchData() }}
            disabled={isRefreshing}
            className="p-2 hover:bg-zinc-100 rounded-full disabled:opacity-50 transition-colors"
          >
            <ArrowsClockwise size={20} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="divide-y">
        {isLoading ? (
          <div className="p-8">
            <div className="animate-pulse space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-zinc-200 rounded-lg" />
              ))}
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="inline-flex items-center justify-center size-20  bg-zinc-100 rounded-full mb-4">
              <Terminal size={40} className="text-zinc-400" />
            </div>
            <h3 className="text-lg font-medium text-zinc-900 mb-2">No sessions</h3>
            <p className="text-zinc-500">Start a session in Gizzi to see it here</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className="flex w-full items-center gap-2 px-4 py-4 text-left hover:bg-zinc-50 transition-colors"
            >
              <button type="button" onClick={() => setInspectedSession(session)} className="min-w-0 flex-1 text-left">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium truncate">{titleFor(session)}</h3>
                    {statusBadge(session.id)}
                  </div>
                  <p className="text-sm text-zinc-500 truncate">{session.directory}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-zinc-400 flex-shrink-0 mt-0.5">
                  <Clock size={12} />
                  <span>{new Date(session.time.updated).toLocaleString()}</span>
                </div>
              </div>
              </button>
              <button
                type="button"
                onClick={() => setInspectedSession(session)}
                className="grid size-9 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-200 active:scale-[0.97]"
                aria-label={`Inspect ${titleFor(session)}`}
                title="Inspect durable trace"
              >
                <MagnifyingGlass size={16} />
              </button>
            </div>
          ))
        )}
      </div>
      {inspectedSession && (
        <SessionTraceInspector session={inspectedSession} onClose={() => setInspectedSession(null)} />
      )}
    </div>
  )
}

function SessionTraceInspector({ session, onClose }: { session: GizziSession; onClose: () => void }) {
  const [entries, setEntries] = useState<TraceEntry[]>([])
  const [head, setHead] = useState(0)
  const [filter, setFilter] = useState('')
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const headers = await authHeaders()
      const response = await fetch(`${GATEWAY_BASE_URL}/v1/session/${encodeURIComponent(session.id)}/replay?limit=1000&snapshot=true`, { headers })
      if (!response.ok) throw new Error(`Replay request failed (${response.status})`)
      const page = await response.json()
      setEntries(page.entries ?? [])
      setHead(page.head ?? 0)
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }, [session.id, authHeaders])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 2_000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const visible = entries.filter((entry) => !filter || entry.kind.toLowerCase().includes(filter.toLowerCase()))

  return (
    <aside className="fixed inset-y-3 right-3 z-50 flex w-[min(680px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/90 shadow-2xl backdrop-blur-xl dark:border-zinc-700 dark:bg-zinc-950/90">
      <header className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{titleFor(session)}</h2>
          <p className="truncate text-xs text-zinc-500">Trace head {head} · {entries.length} loaded</p>
        </div>
        <a
          href={`${GATEWAY_BASE_URL}/v1/session/${encodeURIComponent(session.id)}/support-bundle`}
          className="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 active:scale-[0.97] dark:hover:bg-zinc-800"
          aria-label="Export redacted support bundle"
          title="Export redacted support bundle"
        >
          <DownloadSimple size={16} />
        </a>
        <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 active:scale-[0.97] dark:hover:bg-zinc-800" aria-label="Close inspector">
          <X size={16} />
        </button>
      </header>
      <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
        <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
          <MagnifyingGlass size={14} className="text-zinc-400" />
          <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter event kinds" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
      </div>
      {error && <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">{error}</div>}
      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
        {visible.length === 0 ? (
          <p className="p-8 text-center font-sans text-zinc-500">No matching trace events.</p>
        ) : visible.map((entry) => (
          <details key={entry.sequence} className="group border-b border-zinc-100 py-2 dark:border-zinc-800">
            <summary className="flex cursor-pointer list-none items-center gap-3 rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900">
              <span className="w-12 shrink-0 text-right text-zinc-400">#{entry.sequence}</span>
              <span className="min-w-0 flex-1 truncate font-semibold text-zinc-700 dark:text-zinc-200">{entry.kind}</span>
              <time className="shrink-0 text-zinc-400">{new Date(entry.time).toLocaleTimeString()}</time>
            </summary>
            <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-950 p-3 text-[11px] leading-relaxed text-zinc-200">{JSON.stringify(entry, null, 2)}</pre>
          </details>
        ))}
      </div>
    </aside>
  )
}
