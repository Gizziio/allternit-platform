import { useEffect, useRef } from 'react'

interface QuickActionOverlayProps {
  url: string
  onQuick: () => void
  onDeep: () => void
  onChat: () => void
  onClose: () => void
  autoDismiss?: number // ms to auto-dismiss, default 5000
}

export function QuickActionOverlay({
  url,
  onQuick,
  onDeep,
  onChat,
  onClose,
  autoDismiss = 5000
}: QuickActionOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-dismiss after timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, autoDismiss)

    return () => clearTimeout(timer)
  }, [autoDismiss, onClose])

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

  const displayUrl = url.replace(/^https?:\/\//, '').slice(0, 40) + (url.length > 40 ? '...' : '')

  return (
    <div 
      ref={containerRef}
      className="absolute bottom-full left-4 right-4 mb-2 z-50
        bg-gradient-to-br from-[#667eea]/95 to-[#764ba2]/95
        rounded-xl p-3.5 shadow-xl animate-[slideUp_0.2s_ease-out]"
      style={{
        animation: 'slideUp 0.2s ease-out'
      }}
    >
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎨</span>
          <span className="text-[13px] font-semibold text-white">Capture to Figma?</span>
        </div>
        <button 
          onClick={onClose}
          className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
        >
          <span className="text-[11px]">×</span>
        </button>
      </div>
      
      <div className="text-[11px] text-white/80 mb-2.5 px-2 py-1 bg-black/20 rounded-md truncate">
        {displayUrl}
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={onQuick}
          className="flex-1 py-2 px-2 rounded-lg text-[11px] text-white
            bg-[#4CAF50]/40 border border-[#4CAF50]/50
            hover:bg-[#4CAF50]/50 transition-all
            flex items-center justify-center gap-1"
        >
          <span>⚡</span>
          <span>Quick</span>
        </button>
        <button
          onClick={onDeep}
          className="flex-1 py-2 px-2 rounded-lg text-[11px] text-white
            bg-[#9c27b0]/40 border border-[#9c27b0]/50
            hover:bg-[#9c27b0]/50 transition-all
            flex items-center justify-center gap-1"
        >
          <span>🔍</span>
          <span>Deep</span>
        </button>
        <button
          onClick={onChat}
          className="flex-1 py-2 px-2 rounded-lg text-[11px] text-white
            bg-white/15 border border-white/20
            hover:bg-white/25 transition-all
            flex items-center justify-center gap-1"
        >
          <span>💬</span>
          <span>Chat</span>
        </button>
      </div>
    </div>
  )
}
