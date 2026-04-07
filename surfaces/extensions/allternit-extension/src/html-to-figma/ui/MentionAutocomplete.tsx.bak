import { useState, useEffect, useRef } from 'react'

interface MentionOption {
  id: string
  name: string
  description: string
  icon: string
  shortcut: string
  color: string
}

const MENTION_OPTIONS: MentionOption[] = [
  {
    id: 'capture',
    name: 'capture',
    description: 'Capture website to Figma',
    icon: '🎨',
    shortcut: '@capture',
    color: 'from-[#667eea] to-[#764ba2]'
  },
  {
    id: 'quick',
    name: 'quick',
    description: 'Quick capture current page',
    icon: '⚡',
    shortcut: '@quick',
    color: 'from-[#4CAF50] to-[#45a049]'
  },
  {
    id: 'deep',
    name: 'deep',
    description: 'Deep capture with all agents',
    icon: '🔍',
    shortcut: '@deep',
    color: 'from-[#9c27b0] to-[#ba68c8]'
  }
]

interface MentionAutocompleteProps {
  query: string // The text after @
  onSelect: (option: MentionOption, url?: string) => void
  onClose: () => void
}

export function MentionAutocomplete({ query, onSelect, onClose }: MentionAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const filteredOptions = MENTION_OPTIONS.filter(opt => 
    opt.name.toLowerCase().includes(query.toLowerCase()) ||
    opt.description.toLowerCase().includes(query.toLowerCase())
  )

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (filteredOptions.length === 0) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev => (prev + 1) % filteredOptions.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev => (prev - 1 + filteredOptions.length) % filteredOptions.length)
          break
        case 'Enter':
          e.preventDefault()
          onSelect(filteredOptions[selectedIndex])
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [filteredOptions, selectedIndex, onSelect, onClose])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  if (filteredOptions.length === 0) {
    onClose()
    return null
  }

  return (
    <div 
      ref={containerRef}
      className="absolute bottom-full left-4 right-4 mb-2 z-50
        bg-[#252542] border border-[#667eea]/30 rounded-xl overflow-hidden
        shadow-xl animate-[slideUp_0.15s_ease-out]"
      style={{ animation: 'slideUp 0.15s ease-out' }}
    >
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      
      {filteredOptions.map((option, index) => (
        <div
          key={option.id}
          className={`flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer transition-colors
            ${index === selectedIndex ? 'bg-[#667eea]/20' : 'hover:bg-[#667eea]/10'}`}
          onClick={() => onSelect(option)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <div className={`w-7 h-7 rounded-md bg-gradient-to-br ${option.color} 
            flex items-center justify-center text-xs`}>
            {option.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium">{option.name}</div>
            <div className="text-[11px] text-gray-400">{option.description}</div>
          </div>
          <code className="text-[11px] text-[#667eea] bg-[#667eea]/15 px-1.5 py-0.5 rounded">
            {option.shortcut}
          </code>
        </div>
      ))}
    </div>
  )
}

// Hook for detecting @mentions
export function useMention(text: string, cursorPosition: number): {
  isActive: boolean
  query: string
  startIndex: number
} {
  // Find the word at cursor position
  const textBeforeCursor = text.slice(0, cursorPosition)
  const lastAtIndex = textBeforeCursor.lastIndexOf('@')
  
  if (lastAtIndex === -1) {
    return { isActive: false, query: '', startIndex: -1 }
  }
  
  // Check if there's a space between @ and cursor (would mean we're not in a mention)
  const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1)
  if (textAfterAt.includes(' ')) {
    return { isActive: false, query: '', startIndex: -1 }
  }
  
  return {
    isActive: true,
    query: textAfterAt,
    startIndex: lastAtIndex
  }
}

export { MENTION_OPTIONS }
export type { MentionOption }
