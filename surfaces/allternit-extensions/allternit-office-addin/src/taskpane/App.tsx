import { useEffect, useMemo, useState } from 'react'
import { getBridge } from '@/lib/bridge-factory'
import { getOfficeHost, getOfficeHostDisplayName, getOfficeManifestUrl, getOfficeProductTarget } from '@/lib/host-detector'
import {
  convertBytesToMarkdown,
  filenameForConversion,
  readCurrentDocumentBytes,
  type MarkdownConversionResult,
} from '@/lib/markdown-conversion'
import {
  bootstrapOfficeRuntime,
  getOfficeBootstrapState,
  getPlatformOrigin,
  resolveOfficeDocumentSnapshot,
  setAuthToken,
  syncOfficeRuntimeState,
  type OfficeBindingSnapshot,
} from '@/lib/platform-gateway'

type BridgeStatus = 'connecting' | 'connected' | 'error' | 'companion'

type MarkdownPanelState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; result: MarkdownConversionResult }
  | { kind: 'error'; message: string }

function useSyncDarkClass() {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => document.documentElement.classList.toggle('dark', media.matches)
    sync()
    media.addEventListener?.('change', sync)
    return () => media.removeEventListener?.('change', sync)
  }, [])
}

const HOST_ACCENTS = {
  word: '#2B579A',
  excel: '#217346',
  powerpoint: '#D24726',
  unknown: '#B08D6E',
} as const

const HOST_PRODUCTS = {
  word: {
    role: 'Writing and review',
    description: 'Draft, revise, research, and review the active document.',
    actions: ['Review this document', 'Rewrite the selection', 'Create an outline', 'Check citations'],
  },
  excel: {
    role: 'Analysis and modeling',
    description: 'Inspect formulas, clean data, model scenarios, and explain the workbook.',
    actions: ['Analyze this workbook', 'Audit formulas', 'Clean the selected range', 'Build a chart'],
  },
  powerpoint: {
    role: 'Narrative and slide design',
    description: 'Strengthen the story, revise slides, create notes, and improve consistency.',
    actions: ['Review the deck story', 'Rewrite this slide', 'Create speaker notes', 'Check consistency'],
  },
  unknown: {
    role: 'Office developer preview',
    description: 'Open this product from its matching Microsoft Office host.',
    actions: [],
  },
} as const

export default function App() {
  useSyncDarkClass()
  const liveHost = getOfficeHost()
  const host = getOfficeProductTarget()
  const hostLabel = getOfficeHostDisplayName()
  const accent = HOST_ACCENTS[host]
  const [status, setStatus] = useState<BridgeStatus>(liveHost === 'unknown' ? 'companion' : 'connecting')
  const [binding, setBinding] = useState<OfficeBindingSnapshot | null>(null)
  const [documentLabel, setDocumentLabel] = useState(`${hostLabel} document`)
  const [error, setError] = useState<string | null>(null)
  const [connectionAttempt, setConnectionAttempt] = useState(0)
  const [markdownPanel, setMarkdownPanel] = useState<MarkdownPanelState>({ kind: 'idle' })
  const platformOrigin = useMemo(() => getPlatformOrigin(), [])
  const product = HOST_PRODUCTS[host]

  const viewAsMarkdown = async () => {
    setMarkdownPanel({ kind: 'loading' })
    try {
      const bytes = await readCurrentDocumentBytes()
      const documentUrl = typeof Office !== 'undefined' ? Office.context?.document?.url : undefined
      const result = await convertBytesToMarkdown(bytes, filenameForConversion(host, documentUrl))
      setMarkdownPanel({ kind: 'ready', result })
    } catch (reason) {
      setMarkdownPanel({ kind: 'error', message: reason instanceof Error ? reason.message : String(reason) })
    }
  }

  const connectAllternit = () => {
    const authUrl = `${platformOrigin}/office-auth-bridge`
    const officeUi = typeof Office !== 'undefined' ? Office.context?.ui : undefined

    if (officeUi?.displayDialogAsync) {
      officeUi.displayDialogAsync(authUrl, { height: 65, width: 35, displayInIframe: false }, (result) => {
        if (result.status !== Office.AsyncResultStatus.Succeeded || !result.value) {
          setError(result.error?.message ?? 'Could not open Allternit sign in.')
          return
        }

        const dialog = result.value
        dialog.addEventHandler(Office.EventType.DialogMessageReceived, (event) => {
          try {
            if (!('message' in event)) throw new Error('The sign-in dialog did not return a message.')
            const payload = JSON.parse(event.message ?? '{}') as { token?: string }
            if (!payload.token) throw new Error('No authentication token was returned.')
            setAuthToken(payload.token)
            dialog.close()
            setStatus('connecting')
            setError(null)
            setConnectionAttempt((attempt) => attempt + 1)
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Could not finish Allternit sign in.')
          }
        })
        dialog.addEventHandler(Office.EventType.DialogEventReceived, () => dialog.close())
      })
      return
    }

    const popup = window.open(authUrl, 'allternit-office-auth', 'popup=yes,width=520,height=720')
    if (!popup) setError('Allow popups for this add-in, then try connecting again.')
  }

  const steerAgent = (instruction: string) => {
    if (window.parent === window) {
      window.open(`${platformOrigin}/?officeHost=${host}&prompt=${encodeURIComponent(instruction)}`, '_blank', 'noopener,noreferrer')
      return
    }
    window.parent.postMessage({ source: 'allternit-office-addin', type: 'steer-agent', payload: { host, instruction, bindingId: binding?.id ?? null } }, '*')
  }

  useEffect(() => {
    if (liveHost === 'unknown') return
    let cancelled = false
    let heartbeat: number | undefined

    const connect = async () => {
      try {
        const context = await getBridge().getContext()
        if (cancelled) return
        setDocumentLabel(context.label)
        const document = await resolveOfficeDocumentSnapshot(context)
        const bootstrap = getOfficeBootstrapState()
        const result = await bootstrapOfficeRuntime({
          document,
          platform: {
            taskpane_origin: window.location.origin,
            taskpane_url: window.location.href,
            manifest_url: getOfficeManifestUrl(),
            platform_origin: platformOrigin,
          },
          runtimeState: {
            status: 'bridge-ready',
            page_label: context.label,
            connected: true,
          },
          workspaceId: bootstrap.context.workspaceId,
          projectId: bootstrap.context.projectId,
        })
        if (cancelled) return
        setBinding(result.binding)
        setStatus('connected')
        setError(null)
        heartbeat = window.setInterval(() => {
          void syncOfficeRuntimeState({
            bindingId: result.binding.id,
            runtimeState: { status: 'bridge-ready', page_label: context.label, connected: true },
            workspaceId: bootstrap.context.workspaceId,
            projectId: bootstrap.context.projectId,
          }).catch(() => setStatus('error'))
        }, 10_000)
      } catch (reason) {
        if (cancelled) return
        setStatus('error')
        setError(reason instanceof Error ? reason.message : String(reason))
      }
    }

    void connect()
    return () => {
      cancelled = true
      if (heartbeat) window.clearInterval(heartbeat)
    }
  }, [connectionAttempt, host, liveHost, platformOrigin])

  useEffect(() => {
    const reconnect = () => {
      setStatus('connecting')
      setError(null)
      setConnectionAttempt((attempt) => attempt + 1)
    }
    window.addEventListener('allternit-office-auth-token-received', reconnect)
    return () => window.removeEventListener('allternit-office-auth-token-received', reconnect)
  }, [])

  return (
    <main className="flex h-full min-h-0 flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <header className="flex shrink-0 items-center gap-3 border-b border-[var(--border-default)] bg-[var(--glass-bg-thick)] px-4 py-3">
        <div className="flex size-9 items-center justify-center rounded-xl text-sm font-black" style={{ color: accent, background: `color-mix(in srgb, ${accent} 14%, transparent)` }}>A//</div>
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">Allternit for {hostLabel}</div><div className="truncate text-[11px] text-[var(--text-tertiary)]">{product.role}</div></div>
        <span className="flex items-center gap-1.5 rounded-full border border-[var(--border-default)] px-2 py-1 text-[10px] font-semibold text-[var(--text-secondary)]"><span className={`size-1.5 rounded-full ${status === 'connected' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : 'bg-amber-500 animate-pulse'}`} />{status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting' : status === 'companion' ? 'No Office host' : 'Reconnect needed'}</span>
      </header>

      <section className="flex min-h-0 flex-1 flex-col justify-between overflow-y-auto p-4">
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 shadow-[var(--shadow-sm)]">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Attached document</div>
            <div className="break-words text-sm font-semibold">{documentLabel}</div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-[var(--text-tertiary)]">
              <span className="rounded-full bg-[var(--bg-secondary)] px-2 py-1">{hostLabel}</span>
              {binding?.workspace_id && <span className="rounded-full bg-[var(--bg-secondary)] px-2 py-1">Workspace attached</span>}
              {binding?.project_id && <span className="rounded-full bg-[var(--bg-secondary)] px-2 py-1">Project attached</span>}
            </div>
            {status === 'connected' && markdownPanel.kind === 'idle' && (
              <button
                type="button"
                onClick={() => void viewAsMarkdown()}
                className="mt-3 rounded-lg px-3 py-2 text-[11px] font-bold text-white"
                style={{ background: accent }}
                data-testid="view-as-markdown"
              >
                View as Markdown
              </button>
            )}
            {markdownPanel.kind === 'loading' && (
              <div className="mt-3 text-[11px] text-[var(--text-secondary)]">Converting to Markdown…</div>
            )}
            {markdownPanel.kind === 'error' && (
              <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-[11px] leading-relaxed text-red-600">
                <div>{markdownPanel.message}</div>
                <button
                  type="button"
                  onClick={() => void viewAsMarkdown()}
                  className="mt-2 rounded-lg px-3 py-1.5 text-[11px] font-bold text-white"
                  style={{ background: accent }}
                >
                  Retry
                </button>
              </div>
            )}
            {markdownPanel.kind === 'ready' && (
              <div className="mt-3" data-testid="markdown-panel">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="rounded-full bg-[var(--bg-secondary)] px-2 py-1 text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">
                    {markdownPanel.result.format ?? 'markdown'}
                  </span>
                  <div className="flex items-center gap-2">
                    <a
                      href={`${platformOrigin}/markdown-preview`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold underline"
                      style={{ color: accent }}
                    >
                      Open in platform
                    </a>
                    <button
                      type="button"
                      onClick={() => setMarkdownPanel({ kind: 'idle' })}
                      className="text-[11px] font-semibold text-[var(--text-tertiary)]"
                    >
                      Close
                    </button>
                  </div>
                </div>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-3 font-mono text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  {markdownPanel.result.markdown}
                </pre>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border-default)] p-4" style={{ background: `color-mix(in srgb, ${accent} 7%, var(--bg-primary))` }}>
            <div className="text-xs font-bold">{product.role}</div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">{product.description} The platform brain owns models, skills, approvals, memory, and execution history.</p>
          </div>

          {product.actions.length > 0 && <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Start with Computer Agent</div>
            <div className="grid grid-cols-2 gap-2">{product.actions.map((action) => <button key={action} type="button" disabled={status !== 'connected'} onClick={() => steerAgent(action)} className="min-h-14 rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-2 text-left text-[11px] font-semibold leading-4 text-[var(--text-primary)] transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-45">{action}</button>)}</div>
          </div>}

          {status === 'companion' && <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] leading-relaxed text-[var(--text-secondary)]">Open this add-in from Word, Excel, or PowerPoint. Loading its webpage by itself cannot provide Office document access.</div>}
          {error && <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-[11px] leading-relaxed text-red-600">
            <div>{error}</div>
            {liveHost !== 'unknown' && <button type="button" onClick={connectAllternit} className="mt-3 rounded-lg px-3 py-2 text-[11px] font-bold text-white" style={{ background: accent }}>Connect Allternit</button>}
          </div>}
        </div>

        <footer className="mt-5 border-t border-[var(--border-subtle)] pt-3 text-[10px] leading-relaxed text-[var(--text-tertiary)]">Platform brain · Browser/computer-use harness · {binding ? `Binding ${binding.id.slice(0, 8)}` : 'Waiting for binding'}</footer>
      </section>
    </main>
  )
}
