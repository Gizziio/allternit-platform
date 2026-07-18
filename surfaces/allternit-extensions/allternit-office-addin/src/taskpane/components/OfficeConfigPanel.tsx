import { ChevronDown, Copy, CornerUpLeft, Eye, EyeOff, Loader2, Building2, FolderOpen, KeyRound } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { OfficeAgentConfig } from '@/agent/useOfficeAgent'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getCapabilities } from '@/lib/officecli-client'
import { officeStorage } from '@/lib/storage'
import {
  getOfficeBootstrapState,
  setAuthToken,
  setOfficeContext,
  fetchWorkspaces,
  fetchProjects,
  getPlatformOrigin,
  type Workspace,
  type Project,
} from '@/lib/platform-gateway'

interface Props {
  config: OfficeAgentConfig | null
  onSave: (config: Partial<OfficeAgentConfig>) => Promise<void>
  onBack: () => void
}

const AUTH_TOKEN_KEY = 'allternit-office-auth-token'

export function OfficeConfigPanel({ config, onSave, onBack }: Props) {
  const [apiKey, setApiKey] = useState(config?.apiKey ?? '')
  const [baseURL, setBaseURL] = useState(config?.baseURL ?? '')
  const [model, setModel] = useState(config?.model ?? 'claude-sonnet-4-6')
  const [language, setLanguage] = useState<'en' | 'zh'>(config?.language ?? 'en')
  const [maxSteps, setMaxSteps] = useState<number | undefined>(config?.maxSteps)
  const [systemInstruction, setSystemInstruction] = useState(config?.systemInstruction ?? '')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [authToken, setAuthTokenLocal] = useState('')
  const [copied, setCopied] = useState(false)
  const [showToken, setShowToken] = useState(false)

  // Workspace / project picker state
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false)
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [contextError, setContextError] = useState<string | null>(null)
  const [contextSaved, setContextSaved] = useState(false)
  const [signInPending, setSignInPending] = useState(false)

  // OfficeCLI backend probe (gateway-hosted binary): version / unavailable.
  const [officeCli, setOfficeCli] = useState<{ available: boolean; label: string } | null>(null)
  useEffect(() => {
    let cancelled = false
    getCapabilities()
      .then((caps) => {
        if (cancelled) return
        setOfficeCli(
          caps.available
            ? { available: true, label: `OfficeCLI v${caps.version ?? 'unknown'}` }
            : { available: false, label: 'OfficeCLI unavailable (gateway)' },
        )
      })
      .catch(() => {
        if (!cancelled) setOfficeCli({ available: false, label: 'OfficeCLI unavailable (gateway)' })
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    setApiKey(config?.apiKey ?? '')
    setBaseURL(config?.baseURL ?? '')
    setModel(config?.model ?? 'claude-sonnet-4-6')
    setLanguage(config?.language ?? 'en')
    setMaxSteps(config?.maxSteps)
    setSystemInstruction(config?.systemInstruction ?? '')
  }, [config])

  useEffect(() => {
    officeStorage.get<string>(AUTH_TOKEN_KEY).then((t) => { if (t) setAuthTokenLocal(t) })
    // Restore current context from bootstrap state
    const state = getOfficeBootstrapState()
    if (state.context.workspaceId) setSelectedWorkspaceId(state.context.workspaceId)
    if (state.context.projectId) setSelectedProjectId(state.context.projectId)
  }, [])

  // Auto-fetch workspaces and projects when auth token is available
  useEffect(() => {
    if (!authToken) return
    let cancelled = false
    async function autoLoad() {
      try {
        setLoadingWorkspaces(true)
        setLoadingProjects(true)
        const [wsList, projList] = await Promise.all([
          fetchWorkspaces().catch(() => []),
          fetchProjects().catch(() => []),
        ])
        if (cancelled) return
        setWorkspaces(wsList)
        setProjects(projList)
      } catch {
        // ignore auto-load errors
      } finally {
        if (!cancelled) {
          setLoadingWorkspaces(false)
          setLoadingProjects(false)
        }
      }
    }
    void autoLoad()
    return () => { cancelled = true }
  }, [authToken])

  const handleCopyToken = async () => {
    if (!authToken) return
    try {
      await navigator.clipboard.writeText(authToken)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select the text so user can copy manually
      setCopied(false)
    }
  }

  const handleSave = async () => {
    // Validate baseURL
    let normalizedBaseURL = baseURL.trim()
    if (normalizedBaseURL) {
      try {
        const url = new URL(normalizedBaseURL)
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          alert('Base URL must use http:// or https://')
          return
        }
        normalizedBaseURL = url.toString().replace(/\/$/, '')
      } catch {
        alert('Please enter a valid URL (e.g., https://api.anthropic.com)')
        return
      }
    }

    setSaving(true)
    try {
      await onSave({ apiKey, baseURL: normalizedBaseURL, model, language, maxSteps: maxSteps || undefined, systemInstruction: systemInstruction || undefined })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleLoadWorkspaces = async () => {
    setLoadingWorkspaces(true)
    setContextError(null)
    try {
      const list = await fetchWorkspaces()
      setWorkspaces(list)
      if (list.length === 0) {
        setContextError('No workspaces found. Make sure you are signed in.')
      }
    } catch (err) {
      setContextError(err instanceof Error ? err.message : 'Failed to load workspaces')
    } finally {
      setLoadingWorkspaces(false)
    }
  }

  const handleLoadProjects = async () => {
    setLoadingProjects(true)
    setContextError(null)
    try {
      const list = await fetchProjects()
      setProjects(list)
      if (list.length === 0) {
        setContextError('No projects found.')
      }
    } catch (err) {
      setContextError(err instanceof Error ? err.message : 'Failed to load projects')
    } finally {
      setLoadingProjects(false)
    }
  }

  const handleSaveContext = () => {
    setAuthToken(authToken || null)
    setOfficeContext({
      workspaceId: selectedWorkspaceId || null,
      projectId: selectedProjectId || null,
    })
    setContextSaved(true)
    setTimeout(() => setContextSaved(false), 2000)
  }

  // Listen for auth token from popup bridge
  useEffect(() => {
    function handleAuthToken(event: Event) {
      const custom = event as CustomEvent<{ token: string }>
      if (custom.detail?.token) {
        setAuthTokenLocal(custom.detail.token)
        setSignInPending(false)
      }
    }
    window.addEventListener('allternit-office-auth-token-received', handleAuthToken)
    return () => window.removeEventListener('allternit-office-auth-token-received', handleAuthToken)
  }, [])

  const handleSignIn = () => {
    const platformOrigin = getPlatformOrigin()
    const url = `${platformOrigin}/office-auth-bridge`

    // Use Office Dialog API when available (recommended by Microsoft for add-in auth)
    if (Office.context?.ui?.displayDialogAsync) {
      setSignInPending(true)

      Office.context.ui.displayDialogAsync(
        url,
        { height: 60, width: 30, promptBeforeOpen: false },
        (asyncResult) => {
          if (asyncResult.status === Office.AsyncResultStatus.Failed) {
            setSignInPending(false)
            console.error('[OfficeAuth] dialog failed:', asyncResult.error.message)
            // Fall back to popup if dialog fails to open
            openAuthPopup(url)
            return
          }

          const dialog = asyncResult.value

          dialog.addEventHandler(
            Office.EventType.DialogMessageReceived,
            (args) => {
              if (!('message' in args)) return
              try {
                const data = JSON.parse(args.message) as { token?: string }
                if (data.token) {
                  setAuthTokenLocal(data.token)
                  setAuthToken(data.token)
                  setSignInPending(false)
                  dialog.close()
                }
              } catch {
                // ignore malformed messages
              }
            },
          )

          dialog.addEventHandler(Office.EventType.DialogEventReceived, () => {
            // Dialog closed without sending a token
            setSignInPending(false)
          })
        },
      )
      return
    }

    // Fallback for non-Office environments (browser testing, etc.)
    openAuthPopup(url)
  }

  function openAuthPopup(url: string) {
    const popup = window.open(url, 'allternit-office-auth', 'width=480,height=640,popup=true')

    if (!popup) {
      alert('Popup blocked. Please allow popups for this site and try again.')
      return
    }

    setSignInPending(true)
    const interval = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(interval)
        setSignInPending(false)
      }
    }, 500)

    const timeout = window.setTimeout(() => {
      window.clearInterval(interval)
      setSignInPending(false)
    }, 300000)

    const cleanup = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(cleanup)
        window.clearTimeout(timeout)
      }
    }, 1000)
  }

  return (
    <div className="flex flex-col gap-4 p-4 relative overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Settings</h2>
        <Button variant="ghost" size="icon-sm" onClick={onBack} className="absolute top-2 right-3 cursor-pointer">
          <CornerUpLeft className="size-3.5" />
        </Button>
      </div>

      {/* ── Context Section ── */}
      <div className="flex flex-col gap-2 p-3 rounded-md border" style={{ background: 'var(--bg-secondary)' }}>
        <div className="flex items-center gap-2">
          <KeyRound className="size-3.5 text-muted-foreground" />
          <label className="text-xs font-medium text-muted-foreground">Allternit Context</label>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Set your auth token and pick a workspace/project for this document.
        </p>

        {/* Auth Token */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-muted-foreground">Auth Token</label>
            <button
              onClick={handleSignIn}
              disabled={signInPending}
              className="text-[10px] text-[#D97757] hover:underline disabled:opacity-50"
            >
              {signInPending ? 'Signing in…' : 'Sign in with Allternit'}
            </button>
          </div>
          <div className="flex gap-2 items-center">
            <Input
              type={showToken ? 'text' : 'password'}
              placeholder="Paste your auth token…"
              value={authToken}
              onChange={(e) => setAuthTokenLocal(e.target.value)}
              className="text-xs h-7 font-mono"
            />
            <Button variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={() => setShowToken(!showToken)}>
              {showToken ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={handleCopyToken} disabled={!authToken}>
              {copied ? <span className="text-xs">✓</span> : <Copy className="size-3" />}
            </Button>
          </div>
        </div>

        {/* Workspace */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Building2 className="size-3" /> Workspace
            </label>
            <button
              onClick={() => void handleLoadWorkspaces()}
              disabled={loadingWorkspaces}
              className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {loadingWorkspaces ? <Loader2 className="size-3 animate-spin inline" /> : 'Load'}
            </button>
          </div>
          <select
            value={selectedWorkspaceId}
            onChange={(e) => setSelectedWorkspaceId(e.target.value)}
            className="h-7 text-xs rounded-md border px-2 outline-none"
            style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
          >
            <option value="">— Select workspace —</option>
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        {/* Project */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-muted-foreground flex items-center gap-1">
              <FolderOpen className="size-3" /> Project
            </label>
            <button
              onClick={() => void handleLoadProjects()}
              disabled={loadingProjects}
              className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {loadingProjects ? <Loader2 className="size-3 animate-spin inline" /> : 'Load'}
            </button>
          </div>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="h-7 text-xs rounded-md border px-2 outline-none"
            style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
          >
            <option value="">— Select project —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>

        {contextError && (
          <p className="text-[10px] text-red-400">{contextError}</p>
        )}

        <Button
          onClick={handleSaveContext}
          disabled={contextSaved}
          className="h-7 text-xs cursor-pointer mt-1"
          variant="outline"
        >
          {contextSaved ? '✓ Saved' : 'Save Context'}
        </Button>
      </div>

      {/* Base URL */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground">Base URL</label>
        <Input placeholder="https://api.anthropic.com" value={baseURL} onChange={(e) => setBaseURL(e.target.value)} className="text-xs h-8" />
      </div>

      {/* API Key */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground">API Key</label>
        <div className="flex gap-2 items-center">
          <Input type={showApiKey ? 'text' : 'password'} placeholder="sk-ant-…" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="text-xs h-8" />
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setShowApiKey(!showApiKey)}>
            {showApiKey ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
          </Button>
        </div>
      </div>

      {/* Model */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground">Model</label>
        <Input placeholder="claude-sonnet-4-6" value={model} onChange={(e) => setModel(e.target.value)} className="text-xs h-8" />
      </div>

      {/* Language */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground">Language</label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as 'en' | 'zh')}
          className="h-8 text-xs rounded-md border px-2 cursor-pointer outline-none"
          style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
        >
          <option value="en">English</option>
          <option value="zh">中文</option>
        </select>
      </div>

      {/* OfficeCLI backend status */}
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted-foreground">OfficeCLI</label>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={`size-1.5 rounded-full ${officeCli?.available ? 'bg-green-500' : 'bg-muted-foreground'}`} />
          {officeCli === null ? 'Checking…' : officeCli.label}
        </span>
      </div>

      {/* Advanced */}
      <button
        type="button"
        onClick={() => setAdvancedOpen(!advancedOpen)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer mt-1 font-bold"
      >
        Advanced
        <ChevronDown className="size-3 transition-transform" style={{ transform: advancedOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
      </button>

      {advancedOpen && (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Max Steps</label>
            <Input
              type="number" placeholder="40" min={1} max={200}
              value={maxSteps ?? ''}
              onChange={(e) => {
                const n = Number(e.target.value)
                setMaxSteps(Number.isNaN(n) ? undefined : n)
              }}
              className="text-xs h-8 [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">System Instruction</label>
            <textarea
              placeholder="Additional instructions for the agent…"
              value={systemInstruction}
              onChange={(e) => setSystemInstruction(e.target.value)}
              rows={3}
              className="text-xs rounded-md border px-3 py-2 resize-y min-h-[60px] outline-none"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
            />
          </div>
        </>
      )}

      <div className="flex gap-2 mt-2">
        <Button variant="outline" onClick={onBack} className="flex-1 h-8 text-xs cursor-pointer">Cancel</Button>
        <Button onClick={handleSave} disabled={saving} className="flex-1 h-8 text-xs cursor-pointer">
          {saving ? <Loader2 className="size-3 animate-spin" /> : 'Save'}
        </Button>
      </div>

      <div className="mt-2 pt-4 border-t flex justify-between text-[10px] text-muted-foreground">
        <span>Allternit Office Add-in</span>
        <a href="https://allternit.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground underline">allternit.com</a>
      </div>
    </div>
  )
}
