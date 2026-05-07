/**
 * Allternit Streaming Hook
 * 
 * Integrates terminal stream-cancel patterns with workspace API
 * Provides real-time session state, tool execution, and interrupt capabilities
 */

import { useState, useCallback, useRef, useEffect } from "react"
import { useInterrupt } from "../design/useInterrupt"
import { WorkspaceAPI, SessionStatus } from "./types"
import { AllternitRuntimeState } from "../design/theme"

export type StreamState = {
  runtimeState: AllternitRuntimeState
  status: SessionStatus
  pendingTools: string[]
  retryInfo?: {
    attempt: number
    delay: number
  }
  startedAt?: number
}

export interface UseAllternitStreamOptions {
  workspace: WorkspaceAPI | null
  autoConnect?: boolean
}

export interface UseAllternitStreamReturn {
  /** Current stream state for UI */
  state: StreamState
  
  /** Whether currently connected/streaming */
  isActive: boolean
  
  /** Interrupt/cancel handlers */
  interrupt: {
    pending: boolean
    trigger: () => void
    reset: () => void
  }
  
  /** Start a new session with initial prompt */
  startSession: (prompt: string) => Promise<void>
  
  /** Send a message to active session */
  sendMessage: (message: string) => Promise<void>
  
  /** Force reconnect */
  reconnect: () => void
}

export function useAllternitStream({ 
  workspace, 
  autoConnect = true 
}: UseAllternitStreamOptions): UseAllternitStreamReturn {
  const [runtimeState, setRuntimeState] = useState<AllternitRuntimeState>("idle")
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("idle")
  const [pendingTools, setPendingTools] = useState<string[]>([])
  const [retryInfo, setRetryInfo] = useState<{ attempt: number; delay: number }>()
  const [startedAt, setStartedAt] = useState<number>()
  
  const abortRef = useRef<AbortController | null>(null)
  const sessionRef = useRef<string | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const { pending: interruptPending, trigger: triggerInterrupt, reset: resetInterrupt } = useInterrupt()
  
  // Map session status to runtime state
  const mapStatusToRuntime = useCallback((status: SessionStatus): AllternitRuntimeState => {
    switch (status) {
      case "connecting": return "connecting"
      case "hydrating": return "hydrating"
      case "planning": return "planning"
      case "web": return "web"
      case "executing": return "executing"
      case "responding": return "responding"
      case "compacting": return "compacting"
      default: return "idle"
    }
  }, [])
  
  // Clear any pending reconnect
  const clearReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])
  
  // Handle interrupt
  const handleInterrupt = useCallback(() => {
    if (interruptPending) {
      // Double interrupt = cancel session
      clearReconnect()
      if (abortRef.current) {
        abortRef.current.abort()
      }
      if (sessionRef.current && workspace) {
        workspace.endSession?.(sessionRef.current).catch(console.error)
      }
      setRuntimeState("idle")
      setSessionStatus("idle")
      resetInterrupt()
    } else {
      triggerInterrupt()
    }
  }, [interruptPending, triggerInterrupt, resetInterrupt, workspace, clearReconnect])
  
  // Start streaming session
  const startSession = useCallback(async (prompt: string) => {
    clearReconnect()
    
    if (abortRef.current) {
      abortRef.current.abort()
    }
    abortRef.current = new AbortController()
    
    setRuntimeState("connecting")
    setSessionStatus("connecting")
    setPendingTools([])
    setRetryInfo(undefined)
    setStartedAt(Date.now())
    
    if (!workspace) {
      setRuntimeState("idle")
      setSessionStatus("idle")
      return
    }
    
    try {
      // Create session
      const sessionId = await workspace.createSession?.()
      if (!sessionId) {
        throw new Error("Failed to create session")
      }
      sessionRef.current = sessionId
      
      // Send initial prompt
      if (workspace) {
        await workspace.sendPrompt?.(sessionId, prompt)
      }
      
      // Start polling/streaming
      // In real implementation, this would use WebSocket or SSE
      pollSessionState(sessionId)
      
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Failed to start session:", error)
        setRuntimeState("idle")
        setSessionStatus("idle")
        scheduleReconnect()
      }
    }
  }, [workspace, clearReconnect])
  
  // Send message to active session
  const sendMessage = useCallback(async (message: string) => {
    if (!sessionRef.current) {
      throw new Error("No active session")
    }
    
    if (!workspace) {
      throw new Error("Workspace not available")
    }
    
    await workspace.sendPrompt?.(sessionRef.current, message)
  }, [workspace])
  
  // Poll session state (simplified - real would use WebSocket)
  const pollSessionState = useCallback((sessionId: string) => {
    const poll = async () => {
      if (abortRef.current?.signal.aborted) return
      
      try {
        if (!workspace) return
        const state = await workspace.getSessionState?.(sessionId)
        if (!state) return
        
        setSessionStatus(state.status)
        setRuntimeState(mapStatusToRuntime(state.status))
        setPendingTools(state.pendingTools || [])
        
        if (state.status !== "idle" && state.status !== "error") {
          setTimeout(poll, 500)
        }
      } catch (error) {
        console.error("Poll error:", error)
        setRetryInfo({ attempt: 1, delay: 5000 })
        scheduleReconnect()
      }
    }
    
    poll()
  }, [workspace, mapStatusToRuntime])
  
  // Schedule reconnect with backoff
  const scheduleReconnect = useCallback(() => {
    if (!autoConnect) return
    
    clearReconnect()
    
    const delay = Math.min(30000, Math.pow(2, (retryInfo?.attempt || 0)) * 1000)
    setRetryInfo(prev => ({ attempt: (prev?.attempt || 0) + 1, delay }))
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (sessionRef.current) {
        pollSessionState(sessionRef.current)
      }
    }, delay)
  }, [autoConnect, retryInfo?.attempt, clearReconnect, pollSessionState])
  
  // Manual reconnect
  const reconnect = useCallback(() => {
    clearReconnect()
    setRetryInfo(undefined)
    if (sessionRef.current) {
      pollSessionState(sessionRef.current)
    }
  }, [clearReconnect, pollSessionState])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearReconnect()
      if (abortRef.current) {
        abortRef.current.abort()
      }
      if (sessionRef.current && workspace) {
        workspace.endSession?.(sessionRef.current).catch(console.error)
      }
    }
  }, [workspace, clearReconnect])
  
  const state: StreamState = {
    runtimeState,
    status: sessionStatus,
    pendingTools,
    retryInfo,
    startedAt,
  }
  
  return {
    state,
    isActive: runtimeState !== "idle" && runtimeState !== "connecting",
    interrupt: {
      pending: interruptPending,
      trigger: handleInterrupt,
      reset: resetInterrupt,
    },
    startSession,
    sendMessage,
    reconnect,
  }
}

// Extend WorkspaceAPI type with session methods
declare module "./types" {
  interface WorkspaceAPI {
    createSession?(): Promise<string>
    sendPrompt?(sessionId: string, prompt: string): Promise<void>
    getSessionState?(sessionId: string): Promise<{
      status: SessionStatus
      pendingTools: string[]
    }>
    endSession?(sessionId: string): Promise<void>
  }
}
