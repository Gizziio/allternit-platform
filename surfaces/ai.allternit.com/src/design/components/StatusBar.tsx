/**
 * Allternit Status Bar Component
 * 
 * Ported from terminal app status-bar.tsx
 * Provides real-time session status display
 */

import { useState, useEffect } from "react"
import { useAllternitTheme, AllternitRuntimeState, getStatusColor } from "../theme/allternit-theme.tsx"
import { cn } from "@/lib/utils"
import { useIsClient } from "@/lib/hooks/use-is-client"

export interface StatusBarProps {
  /** Current runtime state */
  state: AllternitRuntimeState
  /** Whether connection is being established */
  isConnecting?: boolean
  /** Number of pending/executing tools */
  pendingTools?: string[]
  /** Retry information */
  retryAttempt?: number
  retryDelay?: number
  /** Session start time */
  startedAt?: number
  /** Whether to show compact version */
  compact?: boolean
  /** Handler for interrupt/cancel */
  onInterrupt?: () => void
  /** Whether interrupt is pending */
  interruptPending?: boolean
}

export function StatusBar({
  state,
  isConnecting,
  pendingTools = [],
  retryAttempt,
  retryDelay,
  startedAt,
  compact = false,
  onInterrupt,
  interruptPending,
}: StatusBarProps) {
  const theme = useAllternitTheme()
  const isClient = useIsClient()
  const [now, setNow] = useState(Date.now())
  
  // Update elapsed time every second
  useEffect(() => {
    if (!startedAt || state === "idle") return
    
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [startedAt, state])
  
  const statusColor = getStatusColor(state, theme)
  const statusLabel = getStatusLabel(state, isConnecting)
  const statusHint = getStatusHint(state, isConnecting)
  const elapsed = isClient && startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : undefined
  
  const displayedTools = compact 
    ? pendingTools.slice(0, 1)
    : pendingTools.slice(0, 3)
  
  const overflow = Math.max(0, pendingTools.length - displayedTools.length)
  
  return (
    <div 
      className={cn(
        "flex justify-between items-center bg-[var(--status-bar-bg)] border-t border-solid border-white/5 font-mono",
        compact ? "p-2 px-3 text-[12px]" : "p-3 px-4 text-[14px]"
      )}
      style={{
        backgroundColor: theme.bg,
        borderTopColor: `${theme.muted}30`,
      }}
    >
      {/* Left: Status & Tools */}
      <div className="flex items-center gap-3">
        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          {state !== "idle" && (
            <StatusIndicator color={statusColor} />
          )}
          <span className="font-bold" style={{ color: statusColor }}>
            {theme.glyph.status} {statusLabel}
          </span>
        </div>
        
        {/* Hint (if not compact) */}
        {!compact && statusHint && (
          <span style={{ color: theme.muted }}>
            {theme.glyph.separator} {statusHint}
          </span>
        )}
        
        {/* Tools */}
        {displayedTools.length > 0 && (
          <div className="flex items-center gap-2">
            {displayedTools.map((tool) => (
              <span 
                key={tool}
                className="text-[0.8em]"
                style={{ color: theme.fg }}
              >
                <span style={{ color: theme.accent }}>{theme.glyph.tool}</span>{" "}
                <span style={{ color: theme.muted }}>{tool}</span>
              </span>
            ))}
            {overflow > 0 && (
              <span className="text-[0.8em]" style={{ color: theme.muted }}>
                +{overflow} more
              </span>
            )}
          </div>
        )}
        
        {/* Retry Info */}
        {retryAttempt !== undefined && retryDelay !== undefined && (
          <span className="text-[0.8em]" style={{ color: theme.status.connecting }}>
            Retry {retryAttempt} in {Math.ceil(retryDelay / 1000)}s
          </span>
        )}
      </div>
      
      {/* Right: Elapsed & Interrupt */}
      <div className="flex items-center gap-3">
        {/* Elapsed Time */}
        {elapsed !== undefined && !compact && (
          <span className="text-[0.8em]" style={{ color: theme.muted }}>
            {elapsed}s
          </span>
        )}
        
        {/* Interrupt Button */}
        {state !== "idle" && onInterrupt && (
          <button type="button"
            onClick={onInterrupt}
            className={cn(
              "rounded border border-solid cursor-pointer text-[0.8em] transition-all duration-200",
              compact ? "p-1 px-2" : "p-1.5 px-3",
              interruptPending ? "bg-[var(--status-pending-bg)] border-[var(--status-pending-border)]" : "bg-transparent border-[var(--status-border)]"
            )}
            style={{
              background: interruptPending ? `${statusColor}20` : "transparent",
              borderColor: interruptPending ? statusColor : theme.muted,
              color: interruptPending ? statusColor : theme.fg,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${statusColor}20`
              e.currentTarget.style.borderColor = statusColor
            }}
            onMouseLeave={(e) => {
              if (!interruptPending) {
                e.currentTarget.style.background = "transparent"
                e.currentTarget.style.borderColor = theme.muted
              }
            }}
          >
            Esc
            {!compact && (
              <span className="ml-1" style={{ color: theme.muted }}>
                {interruptPending ? "Press again" : "to interrupt"}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

/** Animated status indicator */
function StatusIndicator({ color }: { color: string }) {
  return (
    <span
      className="inline-block size-2 rounded-full animate-pulse"
      style={{
        background: color,
      }}
    />
  )
}

/** Get human-readable status label */
function getStatusLabel(state: AllternitRuntimeState, isConnecting?: boolean): string {
  if (isConnecting) return "Connecting"
  
  const labels: Record<AllternitRuntimeState, string> = {
    idle: "Idle",
    connecting: "Connecting",
    hydrating: "Hydrating",
    planning: "Thinking",
    web: "Researching",
    executing: "Running Tools",
    responding: "Responding",
    compacting: "Compacting",
  }
  
  return labels[state]
}

/** Get status hint/description */
function getStatusHint(state: AllternitRuntimeState, isConnecting?: boolean): string | undefined {
  if (isConnecting) return "Establishing connection..."
  
  const hints: Record<AllternitRuntimeState, string | undefined> = {
    idle: undefined,
    connecting: "Connecting to server...",
    hydrating: "Loading context...",
    planning: "Analyzing task...",
    web: "Searching web...",
    executing: "Executing tools...",
    responding: "Generating response...",
    compacting: "Optimizing memory...",
  }
  
  return hints[state]
}
