import { ChevronDown, Copy, CornerUpLeft, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { OfficeAgentConfig } from '@/agent/useOfficeAgent'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { officeStorage } from '@/lib/storage'

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
  const [authToken, setAuthToken] = useState('')
  const [copied, setCopied] = useState(false)
  const [showToken, setShowToken] = useState(false)

  useEffect(() => {
    setApiKey(config?.apiKey ?? '')
    setBaseURL(config?.baseURL ?? '')
    setModel(config?.model ?? 'claude-sonnet-4-6')
    setLanguage(config?.language ?? 'en')
    setMaxSteps(config?.maxSteps)
    setSystemInstruction(config?.systemInstruction ?? '')
  }, [config])

  useEffect(() => {
    officeStorage.get<string>(AUTH_TOKEN_KEY).then((t) => { if (t) setAuthToken(t) })
  }, [])

  const handleCopyToken = async () => {
    if (!authToken) return
    await navigator.clipboard.writeText(authToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({ apiKey, baseURL, model, language, maxSteps: maxSteps || undefined, systemInstruction: systemInstruction || undefined })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 relative overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Settings</h2>
        <Button variant="ghost" size="icon-sm" onClick={onBack} className="absolute top-2 right-3 cursor-pointer">
          <CornerUpLeft className="size-3.5" />
        </Button>
      </div>

      {/* Auth Token */}
      <div className="flex flex-col gap-1.5 p-3 rounded-md border" style={{ background: 'var(--bg-secondary)' }}>
        <label className="text-xs font-medium text-muted-foreground">Auth Token</label>
        <p className="text-[10px] text-muted-foreground mb-1">Allow Allternit agents to call this add-in.</p>
        <div className="flex gap-2 items-center">
          <Input
            readOnly
            value={
              authToken
                ? showToken
                  ? authToken
                  : `${authToken.slice(0, 4)}${'•'.repeat(Math.max(0, authToken.length - 8))}${authToken.slice(-4)}`
                : 'Not set'
            }
            className="text-xs h-8 font-mono"
          />
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setShowToken(!showToken)} disabled={!authToken}>
            {showToken ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={handleCopyToken} disabled={!authToken}>
            {copied ? <span className="text-xs">✓</span> : <Copy className="size-3" />}
          </Button>
        </div>
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
              onChange={(e) => setMaxSteps(e.target.value ? Number(e.target.value) : undefined)}
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
