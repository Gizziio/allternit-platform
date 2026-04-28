import { useState, useEffect, useCallback } from 'react'
import { capturePage, quickCapture, deepCapture } from '../capture'
import type { CaptureResult, CaptureOptions } from '../types'
import { openInBrowser } from '@/lib/openInBrowser';

interface CaptureCardProps {
  url: string
  onClose?: () => void
  onComplete?: (result: CaptureResult) => void
}

type CaptureState = 
  | { type: 'idle' }
  | { type: 'capturing'; phase: string; progress: number }
  | { type: 'success'; result: CaptureResult }
  | { type: 'error'; error: string }

export function CaptureCard({ url, onClose, onComplete }: CaptureCardProps) {
  const [state, setState] = useState<CaptureState>({ type: 'idle' })
  const [startTime] = useState(Date.now())

  const handleCapture = useCallback(async (mode: 'quick' | 'deep') => {
    setState({ type: 'capturing', phase: 'Initializing...', progress: 0 })

    try {
      const options: CaptureOptions = {
        url,
        fullPage: true,
        agents: {
          structure: true,
          style: mode === 'deep',
          layout: mode === 'deep'
        },
        onProgress: (phase, progress) => {
          setState({ type: 'capturing', phase, progress })
        }
      }

      const result = mode === 'quick' 
        ? await quickCapture(options)
        : await deepCapture(options)

      // Copy to clipboard
      await navigator.clipboard.writeText(JSON.stringify(result.json, null, 2))

      setState({ type: 'success', result })
      onComplete?.(result)
    } catch (error) {
      setState({ 
        type: 'error', 
        error: error instanceof Error ? error.message : 'Capture failed' 
      })
    }
  }, [url, onComplete])

  const handleCopy = async () => {
    if (state.type === 'success') {
      await navigator.clipboard.writeText(JSON.stringify(state.result.json, null, 2))
    }
  }

  const handleOpenFigma = () => {
    // Open Figma plugin deep link or just Figma
    openInBrowser('https://www.figma.com/')
  }

  const formatTime = () => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000)
    if (elapsed < 60) return `${elapsed}s ago`
    return `${Math.floor(elapsed / 60)}m ago`
  }

  // Idle state - show action buttons
  if (state.type === 'idle') {
    return (
      <div className="rounded-xl p-4 mb-4 border border-[#667eea]/25 bg-gradient-to-br from-[#667eea]/10 to-[#764ba2]/10">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center text-sm">
            🎨
          </div>
          <span className="text-[13px] font-semibold">HTML to Figma</span>
          <span className="ml-auto text-[11px] text-gray-400">Now</span>
        </div>
        <div className="text-[11px] text-gray-400 mb-3 px-2.5 py-1.5 bg-white/5 rounded-md truncate">
          {url}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleCapture('quick')}
            className="flex-1 py-2 px-3 rounded-lg text-[12px] flex items-center justify-center gap-1.5
              bg-[#4CAF50]/20 border border-[#4CAF50]/30 text-[#4CAF50]
              hover:bg-[#4CAF50]/30 transition-all hover:-translate-y-0.5"
          >
            <span>⚡</span>
            <span>Quick</span>
          </button>
          <button
            onClick={() => handleCapture('deep')}
            className="flex-1 py-2 px-3 rounded-lg text-[12px] flex items-center justify-center gap-1.5
              bg-[#9c27b0]/20 border border-[#9c27b0]/30 text-[#ba68c8]
              hover:bg-[#9c27b0]/30 transition-all hover:-translate-y-0.5"
          >
            <span>🔍</span>
            <span>Deep</span>
          </button>
        </div>
      </div>
    )
  }

  // Capturing state - show progress
  if (state.type === 'capturing') {
    return (
      <div className="rounded-xl p-4 mb-4 border border-[#667eea]/25 bg-gradient-to-br from-[#667eea]/10 to-[#764ba2]/10">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center text-sm">
            🎨
          </div>
          <span className="text-[13px] font-semibold">Capturing...</span>
          <span className="ml-auto text-[11px] text-gray-400">{formatTime()}</span>
        </div>
        <div className="text-[11px] text-gray-400 mb-3 px-2.5 py-1.5 bg-white/5 rounded-md truncate">
          {url}
        </div>
        <div className="mt-2">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-[18px] h-[18px] border-2 border-[#667eea]/30 border-t-[#667eea] rounded-full animate-spin" />
            <span className="text-[12px] text-gray-300">{state.phase}</span>
          </div>
          <div className="h-1 bg-white/10 rounded-sm overflow-hidden mb-1.5">
            <div 
              className="h-full bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-sm transition-all duration-300"
              style={{ width: `${state.progress}%` }}
            />
          </div>
          <div className="text-[10px] text-gray-400">Processing with AI agents...</div>
        </div>
      </div>
    )
  }

  // Success state - show results
  if (state.type === 'success') {
    const { layerCount, optimizedCount } = state.result
    return (
      <div className="rounded-xl p-4 mb-4 border border-[#4CAF50]/30 bg-gradient-to-br from-[#4CAF50]/10 to-[#4CAF50]/5">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#4CAF50] to-[#45a049] flex items-center justify-center text-sm">
            ✓
          </div>
          <span className="text-[13px] font-semibold text-[#4CAF50]">Capture Complete!</span>
          <span className="ml-auto text-[11px] text-gray-400">Just now</span>
        </div>
        <div className="text-[11px] text-gray-400 mb-3 px-2.5 py-1.5 bg-white/5 rounded-md truncate">
          {url}
        </div>
        <div className="flex gap-4 mb-3">
          <div className="flex flex-col">
            <span className="text-lg font-semibold text-[#4CAF50]">{layerCount}</span>
            <span className="text-[10px] text-gray-400">layers</span>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-semibold text-[#4CAF50]">{state.result.images?.length || 0}</span>
            <span className="text-[10px] text-gray-400">images</span>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-semibold text-[#4CAF50]">{optimizedCount || 0}</span>
            <span className="text-[10px] text-gray-400">optimized</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 py-2 px-3 rounded-lg text-[11px] flex items-center justify-center gap-1
              bg-[#4CAF50]/15 border border-[#4CAF50]/30 text-[#4CAF50]
              hover:bg-[#4CAF50]/25 transition-all"
          >
            <span>📋</span>
            <span>Copy JSON</span>
          </button>
          <button
            onClick={handleOpenFigma}
            className="flex-1 py-2 px-3 rounded-lg text-[11px] flex items-center justify-center gap-1
              bg-[#4CAF50]/15 border border-[#4CAF50]/30 text-[#4CAF50]
              hover:bg-[#4CAF50]/25 transition-all"
          >
            <span>🎨</span>
            <span>Open Figma</span>
          </button>
        </div>
      </div>
    )
  }

  // Error state
  return (
    <div className="rounded-xl p-4 mb-4 border border-[#f44336]/30 bg-gradient-to-br from-[#f44336]/10 to-[#f44336]/5">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#f44336] to-[#d32f2f] flex items-center justify-center text-sm">
          ✕
        </div>
        <span className="text-[13px] font-semibold text-[#f44336]">Capture Failed</span>
      </div>
      <div className="text-[12px] text-[#f44336] mb-3">{state.error}</div>
      <div className="flex gap-2">
        <button
          onClick={() => setState({ type: 'idle' })}
          className="px-4 py-2 rounded-lg text-[11px] bg-[#f44336]/15 border border-[#f44336]/30 text-[#f44336]
            hover:bg-[#f44336]/25 transition-all"
        >
          Try Again
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[11px] bg-white/10 text-gray-300
              hover:bg-white/15 transition-all"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  )
}

// Hook for URL detection
export function useURLDetection(text: string): string | null {
  const urlPattern = /(https?:\/\/[^\s]+)/i
  const match = text.match(urlPattern)
  return match ? match[1] : null
}

// Hook for @mention detection
export function useMentionDetection(text: string): { command: string | null; url: string | null } {
  const mentionPattern = /@(capture|quick|deep)\s*(https?:\/\/[^\s]+)?/i
  const match = text.match(mentionPattern)
  
  if (match) {
    return {
      command: match[1].toLowerCase(),
      url: match[2] || null
    }
  }
  
  return { command: null, url: null }
}
