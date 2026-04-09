import { useState, useRef, useCallback, useEffect } from 'react'
import type { ExtensionSidepanelComposerProps } from '../../../../extension-shared/extension-sidepanel/ExtensionSidepanelShell.types'
import { QuickActionOverlay } from './QuickActionOverlay'
import { MentionAutocomplete, useMention, MENTION_OPTIONS, type MentionOption } from './MentionAutocomplete'
import { CaptureCard } from './CaptureCard'
import type { CaptureResult } from '../types'

interface CaptureEntry {
  id: string
  url: string
}

// Wraps the shell's composer with HTML→Figma capture functionality
export function CaptureComposer({
  isRunning,
  value,
  placeholder,
  onValueChange,
  onSubmit,
  onStop,
}: ExtensionSidepanelComposerProps) {
  const [showQuickAction, setShowQuickAction] = useState(false)
  const [showMention, setShowMention] = useState(false)
  const [detectedUrl, setDetectedUrl] = useState<string | null>(null)
  const [captureEntries, setCaptureEntries] = useState<CaptureEntry[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [cursorPosition, setCursorPosition] = useState(0)

  // Detect URL in input
  const detectURL = useCallback((text: string): string | null => {
    const urlPattern = /(https?:\/\/[^\s]+)/i
    const match = text.match(urlPattern)
    return match ? match[1] : null
  }, [])

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    const cursor = e.target.selectionStart || 0
    
    onValueChange(newValue)
    setCursorPosition(cursor)

    // Check for @mention
    const mention = useMention(newValue, cursor)
    setShowMention(mention.isActive)

    // Check for URL
    const url = detectURL(newValue)
    if (url && url !== detectedUrl) {
      setDetectedUrl(url)
      setShowQuickAction(true)
    } else if (!url) {
      setDetectedUrl(null)
      setShowQuickAction(false)
    }
  }

  // Handle mention selection
  const handleMentionSelect = (option: MentionOption) => {
    const mention = useMention(value, cursorPosition)
    
    // Replace the @mention with the command
    const beforeMention = value.slice(0, mention.startIndex)
    const afterMention = value.slice(cursorPosition)
    const newValue = `${beforeMention}@${option.name} ${afterMention}`
    
    onValueChange(newValue)
    setShowMention(false)
    
    // Focus back to textarea
    setTimeout(() => {
      textareaRef.current?.focus()
      const newCursorPos = beforeMention.length + option.name.length + 2
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  // Handle quick action selection
  const handleQuickAction = (mode: 'quick' | 'deep' | 'chat') => {
    if (!detectedUrl) return

    if (mode === 'chat') {
      // Send URL as regular chat message
      onSubmit(detectedUrl)
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
    
    // Clear input but keep it focused
    onValueChange('')
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

  // Handle key down for submit
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      
      // Check if input is a @command with URL
      const mentionMatch = value.match(/^@(capture|quick|deep)\s+(https?:\/\/[^\s]+)/i)
      if (mentionMatch) {
        const [, command, url] = mentionMatch
        const entry: CaptureEntry = {
          id: Date.now().toString(),
          url
        }
        setCaptureEntries(prev => [...prev, entry])
        onValueChange('')
        return
      }
      
      onSubmit()
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [value])

  return (
    <div className="relative">
      {/* Inline Capture Cards - shown above the input */}
      {captureEntries.length > 0 && (
        <div className="mb-3 space-y-2">
          {captureEntries.map(entry => (
            <CaptureCard
              key={entry.id}
              url={entry.url}
              onComplete={handleCaptureComplete(entry.id)}
              onClose={() => setCaptureEntries(prev => prev.filter(e => e.id !== entry.id))}
            />
          ))}
        </div>
      )}

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
          query={useMention(value, cursorPosition).query}
          onSelect={handleMentionSelect}
          onClose={() => setShowMention(false)}
        />
      )}

      {/* Composer Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
        className="relative rounded-[14px] border border-input bg-background/80 shadow-sm"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={isRunning}
          placeholder={placeholder}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="min-h-12 w-full resize-none bg-transparent px-4 py-3 pr-14 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />

        <button
          type={isRunning ? 'button' : 'submit'}
          onClick={isRunning ? onStop : undefined}
          disabled={!isRunning && value.trim().length === 0}
          aria-label={isRunning ? 'Stop task' : 'Send task'}
          className={`absolute bottom-1.5 right-1.5 inline-flex size-10 items-center justify-center rounded-xl transition-colors ${
            isRunning
              ? 'bg-destructive text-white hover:opacity-90'
              : value.trim().length > 0
                ? 'bg-zinc-300 text-zinc-950 hover:bg-zinc-200'
                : 'bg-muted text-muted-foreground'
          }`}
        >
          {isRunning ? (
            <svg className="size-3.5 fill-current" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1.5" />
            </svg>
          ) : (
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          )}
        </button>
      </form>

      {/* Help hint */}
      <div className="mt-1.5 text-[10px] text-muted-foreground text-center">
        Tip: Paste a URL to capture, or use{' '}
        <code className="bg-primary/10 text-primary px-1 rounded">@capture</code> for quick access
      </div>
    </div>
  )
}
