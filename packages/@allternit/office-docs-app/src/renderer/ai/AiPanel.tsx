import { useCallback, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import type { Block } from '@allternit/office-docx-engine'
import type { AiSettings } from '../../shared/ipc'
import type { NumIds } from './protocol'
import { useI18n } from '../i18n/locale'
import { OfficeAgentLoop } from '@allternit/office-ai'

interface AiPanelProps {
  editor: Editor
  blocks: Block[]
  settings: AiSettings
  /** the document has no text yet — the empty-state copy offers drafting instead of editing */
  docEmpty?: boolean
  /** fallback numbering ids for documents created from the blank template */
  numIdFallback?: NumIds | null
  /** preset instruction pushed from the ribbon or start screen; autoRun sends it immediately */
  preset?: { text: string; nonce: number; autoRun?: boolean } | null
  /** false shows only the collapsed rail; the component stays mounted so panel state survives */
  open?: boolean
  /** expand from the collapsed rail */
  onExpand?: () => void
  /** collapse the panel to the sidebar rail */
  onCollapse?: () => void
  /** Absolute path of the currently open file (used for chat-history persistence) */
  filePath?: string | null
}

interface ChatEntry {
  role: 'user' | 'assistant'
  text: string
  streaming?: boolean
}

/**
 * AI assistant for Allternit Docs — a real chat panel streaming the platform
 * agent-chat endpoint via @allternit/office-ai. The document's text is
 * supplied as context on every run. Engine mutation through AI tools lands
 * with the Allternit skill runtime in a later phase.
 */
export function AiPanel({ blocks, docEmpty, preset, open, onExpand, onCollapse }: AiPanelProps) {
  const { t } = useI18n()
  const [chat, setChat] = useState<ChatEntry[]>([])
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const lastPresetNonce = useRef<number | null>(null)

  const loopRef = useRef<OfficeAgentLoop | null>(null)
  if (!loopRef.current) {
    loopRef.current = new OfficeAgentLoop({
      skill: {
        systemPrompt:
          'You are the Allternit Docs assistant. Help the user draft and edit the open document. Be concise and concrete.',
        buildContext: () => {
          const text = (blocks ?? [])
            .map((b) => b.runs?.map((r) => r.text).join('') ?? '')
            .filter((line) => line.trim())
            .join('\n')
          return text
            ? `Current document content:\n${text.slice(0, 6000)}`
            : 'The document is currently empty.'
        },
      },
      events: {
        onText: (text) => {
          setChat((previous) => {
            const next = [...previous]
            const last = next[next.length - 1]
            if (last?.role === 'assistant') {
              next[next.length - 1] = { ...last, text, streaming: false }
            } else {
              next.push({ role: 'assistant', text })
            }
            return next
          })
        },
        onDone: () => setBusy(false),
        onError: (error) => {
          setBusy(false)
          setChat((previous) => [
            ...previous,
            { role: 'assistant', text: `⚠ ${error}` },
          ])
        },
      },
    })
  }

  const run = useCallback(
    (instruction: string) => {
      const trimmed = instruction.trim()
      if (!trimmed || busy) return
      setChat((previous) => [...previous, { role: 'user', text: trimmed }])
      setPrompt('')
      setBusy(true)
      loopRef.current!.run(trimmed)
    },
    [busy],
  )

  // Ribbon/start-screen presets: run once per nonce.
  if (preset && preset.nonce !== lastPresetNonce.current) {
    lastPresetNonce.current = preset.nonce
    if (preset.autoRun) run(preset.text)
    else setPrompt(preset.text)
  }

  if (!open) {
    return (
      <button className="ai-rail" title={t('appExpandAiPanel')} onClick={onExpand}>
        <span className="ai-rail-text">AI</span>
      </button>
    )
  }

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <div className="ai-panel-title">Allternit AI</div>
        <div className="ai-panel-header-actions">
          <button type="button" title="Collapse" onClick={onCollapse}>
            ×
          </button>
        </div>
      </div>
      <div className="ai-panel-body">
        {chat.length === 0 ? (
          <div className="ai-empty">
            {docEmpty
              ? 'Describe the document you want — the assistant will draft it with your document as context.'
              : 'Ask about this document — summarize, rewrite, or extend it.'}
          </div>
        ) : (
          chat.map((entry, index) => (
            <div key={index} className={`ai-msg ai-msg-${entry.role}`}>
              <div className="ai-markdown" style={{ whiteSpace: 'pre-wrap' }}>
                {entry.text}
                {entry.streaming ? '…' : ''}
              </div>
            </div>
          ))
        )}
        {busy ? (
          <div className="ai-typing-row">
            <span className="ai-typing">
              <span className="ai-typing-dots">
                <span className="ai-typing-dot-slot">
                  <span className="ai-typing-dot-grow">●</span>
                </span>
              </span>
              <span className="ai-typing-label">Thinking…</span>
            </span>
          </div>
        ) : null}
      </div>
      <div className="ai-input-box">
        <textarea
          value={prompt}
          placeholder={docEmpty ? 'Describe the document to draft…' : 'Ask about this document…'}
          aria-label="AI instruction"
          rows={2}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              run(prompt)
            }
          }}
        />
        <div className="ai-input-footer">
          <span className="ai-input-hint">Enter to send · Shift+Enter for newline</span>
          {busy ? (
            <button
              className="ai-send-btn ai-stop-btn"
              aria-label="Stop"
              onClick={() => loopRef.current?.cancel()}
            >
              ■
            </button>
          ) : (
            <button
              className="ai-send-btn"
              aria-label="Send"
              disabled={!prompt.trim()}
              onClick={() => run(prompt)}
            >
              ↵
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
