/**
 * Allternit Status Bar Component
 * 
 * Ported from terminal app status-bar.tsx
 * Provides real-time session status display
 */

import { useState, useEffect, useMemo } from "react"
import { useAllternitTheme, AllternitRuntimeState, getStatusColor } from "../theme/allternit-theme.tsx"

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
  const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : undefined
  
  const displayedTools = compact 
    ? pendingTools.slice(0, 1)
    : pendingTools.slice(0, 3)
  
  const overflow = Math.max(0, pendingTools.length - displayedTools.length)
  
  return (
    <div 
      className="status-bar"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: compact ? "0.5rem 0.75rem" : "0.75rem 1rem",
        background: theme.bg,
        borderTop: `1px solid ${theme.muted}30`,
        fontFamily: "monospace",
        fontSize: compact ? "0.75rem" : "0.875rem",
      }}
    >
      {/* Left: Status & Tools */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {/* Status Indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {state !== "idle" && (
            <StatusIndicator color={statusColor} />
          )}
          <span style={{ color: statusColor, fontWeight: 600 }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {displayedTools.map((tool, i) => (
              <span 
                key={i}
                style={{ 
                  color: theme.fg,
                  fontSize: "0.8em",
                }}
              >
                <span style={{ color: theme.accent }}>{theme.glyph.tool}</span>{" "}
                <span style={{ color: theme.muted }}>{tool}</span>
              </span>
            ))}
            {overflow > 0 && (
              <span style={{ color: theme.muted, fontSize: "0.8em" }}>
                +{overflow} more
              </span>
            )}
          </div>
        )}
        
        {/* Retry Info */}
        {retryAttempt !== undefined && retryDelay !== undefined && (
          <span style={{ color: theme.status.connecting, fontSize: "0.8em" }}>
            Retry {retryAttempt} in {Math.ceil(retryDelay / 1000)}s
          </span>
        )}
      </div>
      
      {/* Right: Elapsed & Interrupt */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {/* Elapsed Time */}
        {elapsed !== undefined && !compact && (
          <span style={{ color: theme.muted, fontSize: "0.8em" }}>
            {elapsed}s
          </span>
        )}
        
        {/* Interrupt Button */}
        {state !== "idle" && onInterrupt && (
          <button
            onClick={onInterrupt}
            style={{
              padding: compact ? "0.25rem 0.5rem" : "0.375rem 0.75rem",
              background: interruptPending ? `${statusColor}20` : "transparent",
              border: `1px solid ${interruptPending ? statusColor : theme.muted}`,
              borderRadius: "4px",
              color: interruptPending ? statusColor : theme.fg,
              cursor: "pointer",
              fontSize: "0.8em",
              transition: "all 0.2s",
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
              <span style={{ color: theme.muted, marginLeft: "0.25rem" }}>
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
      style={{
        display: "inline-block",
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: color,
        animation: "pulse 1.5s ease-in-out infinite",
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

// CSS Animation
export const statusBarStyles = `
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
`
