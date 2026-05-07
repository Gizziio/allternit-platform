'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useCallback } from 'react'
import { ArrowsClockwise, Terminal, Clock } from '@phosphor-icons/react'
import { usePlatformUser } from '@/lib/platform-auth-client'
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

function titleFor(s: GizziSession): string {
  return s.summary?.title?.trim() || s.slug || s.id.slice(0, 8)
}

export default function SessionsPage() {
  const { isLoaded, isSignedIn } = usePlatformUser()
  const router = useRouter()
  const [sessions, setSessions] = useState<GizziSession[]>([])
  const [statuses, setStatuses] = useState<Record<string, StatusInfo>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const esRef = useRef<EventSource | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [sessRes, stRes] = await Promise.all([
        fetch(`${GATEWAY_BASE_URL}/v1/session/list`),
        fetch(`${GATEWAY_BASE_URL}/v1/session/status`),
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

    es.addEventListener('message', (e) => {
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
    })

    return () => {
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
      router.replace(`/sign-in?redirect_url=/shell/sessions`)
    }
  }, [isLoaded, isSignedIn, router])

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 bg-white border-b z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold">Sessions</h1>
          <button
            onClick={() => { setIsRefreshing(true); fetchData() }}
            disabled={isRefreshing}
            className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-50 transition-colors"
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
                <div key={i} className="h-16 bg-gray-200 rounded-lg" />
              ))}
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
              <Terminal size={40} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No sessions</h3>
            <p className="text-gray-500">Start a session in Gizzi to see it here</p>
          </div>
        ) : (
          sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => router.push(`/shell/session/${session.id}`)}
              className="w-full px-4 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium truncate">{titleFor(session)}</h3>
                    {statusBadge(session.id)}
                  </div>
                  <p className="text-sm text-gray-500 truncate">{session.directory}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0 mt-0.5">
                  <Clock size={12} />
                  <span>{new Date(session.time.updated).toLocaleString()}</span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
