'use client'

import { useRouter, useParams } from 'next/navigation'
import { useEffect, useRef, useState, useCallback } from 'react'
import { ArrowLeft, Terminal } from '@phosphor-icons/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { usePlatformUser } from '@/lib/platform-auth-client'
import { GATEWAY_BASE_URL } from '@/lib/agents/api-config'
import { SessionComposerRegion } from '@/components/session-composer'

interface TextPart {
  type: 'text'
  id: string
  sessionID: string
  messageID: string
  text: string
}

interface MessageInfo {
  id: string
  role: 'user' | 'assistant'
  sessionID: string
  time: { created: number; completed?: number }
  error?: string
}

interface GizziMessage {
  info: MessageInfo
  parts: TextPart[]
}

interface StatusInfo {
  type: 'idle' | 'busy' | 'retry'
}

interface SessionInfo {
  id: string
  slug: string
  directory: string
  summary?: { title?: string }
  time: { created: number; updated: number }
}

function titleFor(s: SessionInfo): string {
  return s.summary?.title?.trim() || s.slug || s.id.slice(0, 8)
}

export default function SessionDetailPage() {
  const { isLoaded, isSignedIn } = usePlatformUser()
  const router = useRouter()
  const params = useParams()
  const sessionID = params.id as string

  const [session, setSession] = useState<SessionInfo | null>(null)
  const [messages, setMessages] = useState<GizziMessage[]>([])
  const [status, setStatus] = useState<StatusInfo>({ type: 'idle' })
  const [isLoading, setIsLoading] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const esRef = useRef<EventSource | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const isStreaming = status.type !== 'idle'

  const fetchData = useCallback(async () => {
    try {
      const [sessRes, msgsRes, stRes] = await Promise.all([
        fetch(`${GATEWAY_BASE_URL}/v1/session/${sessionID}`),
        fetch(`${GATEWAY_BASE_URL}/v1/session/${sessionID}/messages`),
        fetch(`${GATEWAY_BASE_URL}/v1/session/status`),
      ])
      if (sessRes.ok) setSession(await sessRes.json())
      if (msgsRes.ok) setMessages(await msgsRes.json())
      if (stRes.ok) {
        const all: Record<string, StatusInfo> = await stRes.json()
        if (all[sessionID]) setStatus(all[sessionID])
      }
    } catch {
      // server may be offline
    } finally {
      setIsLoading(false)
    }
  }, [sessionID])

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    fetchData()

    const es = new EventSource(`${GATEWAY_BASE_URL}/v1/global/event`)
    esRef.current = es

    es.addEventListener('message', (e) => {
      try {
        const raw = JSON.parse(e.data)
        const evt = raw.payload ?? raw

        if (evt.type === 'message.part.updated') {
          const part: TextPart = evt.properties.part
          if (part.sessionID !== sessionID) return
          setMessages((prev) => {
            const mi = prev.findIndex((m) => m.info.id === part.messageID)
            if (mi < 0) return prev
            const msg = prev[mi]
            const pi = msg.parts.findIndex((p) => p.id === part.id)
            const newParts = pi >= 0 ? msg.parts.with(pi, part) : [...msg.parts, part]
            return prev.with(mi, { ...msg, parts: newParts })
          })
        }

        if (evt.type === 'message.part.delta') {
          const { sessionID: sid, messageID, partID, field, delta } = evt.properties as {
            sessionID: string; messageID: string; partID: string; field: string; delta: string
          }
          if (sid !== sessionID) return
          setMessages((prev) => {
            const mi = prev.findIndex((m) => m.info.id === messageID)
            if (mi < 0) return prev
            const msg = prev[mi]
            const pi = msg.parts.findIndex((p) => p.id === partID)
            if (pi < 0) return prev
            const part = msg.parts[pi]
            const updated = { ...part, [field]: ((part as Record<string, string>)[field] ?? '') + delta }
            return prev.with(mi, { ...msg, parts: msg.parts.with(pi, updated as TextPart) })
          })
        }

        if (evt.type === 'message.created') {
          const msg: GizziMessage = evt.properties.message ?? evt.properties
          if (msg?.info?.sessionID !== sessionID) return
          setMessages((prev) => {
            if (prev.some((m) => m.info.id === msg.info.id)) return prev
            return [...prev, msg]
          })
        }

        if (evt.type === 'session.status') {
          const { sessionID: sid, status: st } = evt.properties as { sessionID: string; status: StatusInfo }
          if (sid === sessionID) setStatus(st)
        }
      } catch {
        // ignore parse errors
      }
    })

    return () => {
      es.close()
      esRef.current = null
    }
  }, [isLoaded, isSignedIn, sessionID, fetchData])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = useCallback(async () => {
    if (!inputValue.trim() || isStreaming) return
    const text = inputValue.trim()
    setInputValue('')
    try {
      await fetch(`${GATEWAY_BASE_URL}/v1/session/${sessionID}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parts: [{ type: 'text', text }] }),
      })
    } catch {
      // ignore
    }
  }, [inputValue, isStreaming, sessionID])

  const handleStop = useCallback(async () => {
    try {
      await fetch(`${GATEWAY_BASE_URL}/v1/session/${sessionID}/abort`, { method: 'POST' })
    } catch {
      // ignore
    }
  }, [sessionID])

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace(`/sign-in?redirect_url=/shell/session/${sessionID}`)
    }
  }, [isLoaded, isSignedIn, router, sessionID])

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500">Loading…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <div className="sticky top-0 bg-white border-b z-10">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold truncate">
              {session ? titleFor(session) : sessionID.slice(0, 8)}
            </h1>
            {session?.directory && (
              <p className="text-xs text-gray-500 truncate">{session.directory}</p>
            )}
          </div>
          {status.type !== 'idle' && (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              status.type === 'busy'
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              {status.type === 'busy' ? 'running' : 'retrying'}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50">
        {isLoading ? (
          <div className="animate-pulse space-y-3 pt-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className={`h-14 bg-gray-200 rounded-2xl ${i % 2 === 0 ? 'ml-12' : 'mr-12'}`}
              />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <Terminal size={32} className="text-gray-400" />
            </div>
            <p className="text-gray-500">No messages yet</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.info.role === 'user'
            const text = msg.parts
              .filter((p) => p.type === 'text')
              .map((p) => p.text)
              .join('')
            return (
              <div key={msg.info.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                {isUser ? (
                  <div className="max-w-[85%] bg-blue-600 text-white rounded-2xl px-4 py-2.5 shadow-sm">
                    <p className="text-sm whitespace-pre-wrap">{text}</p>
                  </div>
                ) : (
                  <div className="max-w-[90%] bg-white border rounded-2xl px-4 py-3 shadow-sm text-sm text-gray-900 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                      {text || '\u200b'}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <SessionComposerRegion
        serverUrl={GATEWAY_BASE_URL}
        sessionID={sessionID}
        isLoading={isStreaming}
        value={inputValue}
        onValueChange={setInputValue}
        onSubmit={handleSubmit}
        onStop={handleStop}
      />
    </div>
  )
}
