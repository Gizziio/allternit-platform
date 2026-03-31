import { useState, useRef, useCallback } from 'react'
import { QuickActionOverlay } from './QuickActionOverlay'
import { MentionAutocomplete, useMention, MENTION_OPTIONS, type MentionOption } from './MentionAutocomplete'
import { CaptureCard } from './CaptureCard'
import type { CaptureResult } from '../types'

interface CaptureEntry {
  id: string
  url: string
  result?: CaptureResult
}

interface ChatInputWithCaptureProps {
  // Props to integrate with existing chat system
  onSendMessage: (text: string) => void
  placeholder?: string
}

export function ChatInputWithCapture({ onSendMessage, placeholder = "Ask me anything..." }: ChatInputWithCaptureProps) {
  const [inputText, setInputText] = useState('')
  const [showQuickAction, setShowQuickAction] = useState(false)
  const [showMention, setShowMention] = useState(false)
  const [detectedUrl, setDetectedUrl] = useState<string | null>(null)
  const [captureEntries, setCaptureEntries] = useState<CaptureEntry[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const [cursorPosition, setCursorPosition] = useState(0)

  // Detect URL in input
  const detectURL = useCallback((text: string): string | null => {
    const urlPattern = /(https?:\/\/[^\s]+)/i
    const match = text.match(urlPattern)
    return match ? match[1] : null
  }, [])

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const cursor = e.target.selectionStart || 0
    
    setInputText(value)
    setCursorPosition(cursor)

    // Check for @mention
    const mention = useMention(value, cursor)
    setShowMention(mention.isActive)

    // Check for URL
    const url = detectURL(value)
    if (url && url !== detectedUrl) {
      setDetectedUrl(url)
      setShowQuickAction(true)
    } else if (!url) {
      setDetectedUrl(null)
      setShowQuickAction(false)
    }
  }

  // Handle mention selection
  const handleMentionSelect = (option: MentionOption, url?: string) => {
    const mention = useMention(inputText, cursorPosition)
    
    // Replace the @mention with the command
    const beforeMention = inputText.slice(0, mention.startIndex)
    const afterMention = inputText.slice(cursorPosition)
    const newText = `${beforeMention}@${option.name}${url ? ` ${url}` : ''}${afterMention}`
    
    setInputText(newText)
    setShowMention(false)
    
    // If it's a quick command with current page URL, execute immediately
    if (option.id === 'quick' || option.id === 'deep') {
      handleMentionCommand(option.id, url)
    }
    
    inputRef.current?.focus()
  }

  // Handle @mention command execution
  const handleMentionCommand = async (command: string, url?: string) => {
    const targetUrl = url || await getCurrentPageUrl()
    if (!targetUrl) return

    const entry: CaptureEntry = {
      id: Date.now().toString(),
      url: targetUrl
    }
    setCaptureEntries(prev => [...prev, entry])
    setInputText('')
    setShowQuickAction(false)
  }

  // Get current page URL
  const getCurrentPageUrl = async (): Promise<string | null> => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      return tab?.url || null
    } catch {
      return null
    }
  }

  // Handle quick action selection
  const handleQuickAction = (mode: 'quick' | 'deep' | 'chat') => {
    if (!detectedUrl) return

    if (mode === 'chat') {
      // Send URL as regular chat message
      onSendMessage(detectedUrl)
      setInputText('')
      setShowQuickAction(false)
      setDetectedUrl(null)
      return
    }

    // Create capture entry for inline display
    const entry: CaptureEntry = {
      id: Date.now().toString(),
      url: detectedUrl
    }
    setCaptureEntries(prev => [...prev, entry])
    
    setInputText('')
    setShowQuickAction(false)
    setDetectedUrl(null)
  }

  // Handle capture completion
  const handleCaptureComplete = (id: string) => (result: CaptureResult) => {
    setCaptureEntries(prev => 
      prev.map(entry => 
        entry.id === id ? { ...entry, result } : entry
      )
    )
  }

  // Handle main form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim()) return

    // Check if input is a @command
    const mentionMatch = inputText.match(/^@(capture|quick|deep)\s*(https?:\/\/[^\s]+)?/i)
    if (mentionMatch) {
      const [, command, url] = mentionMatch
      handleMentionCommand(command.toLowerCase(), url)
      return
    }

    onSendMessage(inputText)
    setInputText('')
    setShowQuickAction(false)
    setDetectedUrl(null)
  }

  return (
    <div className="relative">
      {/* Inline Capture Cards */}
      {captureEntries.map(entry => (
        <CaptureCard
          key={entry.id}
          url={entry.url}
          onComplete={handleCaptureComplete(entry.id)}
          onClose={() => setCaptureEntries(prev => prev.filter(e => e.id !== entry.id))}
        />
      ))}

      {/* Quick Action Overlay */}
      {showQuickAction && detectedUrl && (
        <QuickActionOverlay
          url={detectedUrl}
          onQuick={() => handleQuickAction('quick')}
          onDeep={() => handleQuickAction('deep')}
          onChat={() => handleQuickAction('chat')}
          onClose={() => setShowQuickAction(false)}
        />
      )}

      {/* Mention Autocomplete */}
      {showMention && (
        <MentionAutocomplete
          query={useMention(inputText, cursorPosition).query}
          onSelect={handleMentionSelect}
          onClose={() => setShowMention(false)}
        />
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-center gap-2 bg-white/5 rounded-full px-4 py-2.5">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={handleInputChange}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-[13px] text-white placeholder-gray-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 text-white/60 
              hover:bg-white/15 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            →
          </button>
        </div>
      </form>

      {/* Help hint */}
      <div className="mt-2 text-[10px] text-gray-500 text-center">
        Tip: Paste a URL to capture, or use <code className="bg-[#667eea]/20 text-[#667eea] px-1 rounded">@capture</code> for quick access
      </div>
    </div>
  )
}

export { useMention, MENTION_OPTIONS }
export type { MentionOption, CaptureEntry }
