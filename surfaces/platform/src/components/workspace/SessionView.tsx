/**
 * Session View Component
 * 
 * Integrated view showing terminal patterns ported to React:
 * - StatusBar from terminal app
 * - useAllternitStream for session management
 * - Workspace API integration
 * 
 * Pattern from terminal: ui/a2r/session-view.tsx
 */

import { useState, useCallback } from "react"
import { useWorkspace } from "../../agent-workspace/useWorkspace"
import { useAllternitStream } from "../../agent-workspace/useAllternitStream"
import { StatusBar } from "../../design/components/StatusBar"
import { AllternitThemeProvider, defaultTheme } from "../../design/theme"
import { GlassSurface } from "../../design/GlassSurface"

interface SessionViewProps {
  workspacePath: string
  compact?: boolean
}

export function SessionView({ workspacePath, compact = false }: SessionViewProps) {
  const [prompt, setPrompt] = useState("")
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([])
  
  // Get workspace API
  const { api: workspace, loading: workspaceLoading, error: workspaceError } = useWorkspace(
    workspacePath,
    { preferHttp: true }
  )
  
  // Get streaming session state (terminal patterns)
  const {
    state,
    isActive,
    interrupt,
    startSession,
    sendMessage,
    reconnect,
  } = useAllternitStream({ workspace, autoConnect: true })
  
  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || isActive) return
    
    const userMessage = prompt.trim()
    setMessages(prev => [...prev, { role: "user", content: userMessage }])
    setPrompt("")
    
    if (messages.length === 0) {
      // First message = new session
      await startSession(userMessage)
    } else {
      // Continue existing session
      await sendMessage(userMessage)
    }
  }, [prompt, isActive, messages.length, startSession, sendMessage])
  
  // Handle interrupt
  const handleInterrupt = useCallback(() => {
    interrupt.trigger()
  }, [interrupt])
  
  if (workspaceLoading) {
    return (
      <GlassSurface style={{ padding: "2rem", textAlign: "center" }}>
        <div style={{ color: "#666" }}>Loading workspace...</div>
      </GlassSurface>
    )
  }
  
  if (workspaceError) {
    return (
      <GlassSurface style={{ padding: "2rem" }}>
        <div style={{ color: "#ef4444" }}>
          Error: {workspaceError.message}
        </div>
        <button 
          onClick={reconnect}
          style={{ marginTop: "1rem", padding: "0.5rem 1rem" }}
        >
          Retry Connection
        </button>
      </GlassSurface>
    )
  }
  
  return (
    <AllternitThemeProvider theme={defaultTheme}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "8px",
          overflow: "hidden",
          background: "rgba(15,15,15,0.8)",
        }}
      >
        {/* Message History */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          {messages.length === 0 ? (
            <div
              style={{
                color: "#666",
                textAlign: "center",
                padding: "3rem 1rem",
              }}
            >
              <h3 style={{ marginBottom: "0.5rem", color: "#888" }}>
                A2R Terminal
              </h3>
              <p style={{ fontSize: "0.875rem" }}>
                Start a session to interact with your workspace
              </p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "80%",
                  padding: "0.75rem 1rem",
                  borderRadius: msg.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                  background: msg.role === "user" 
                    ? "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)" 
                    : "rgba(255,255,255,0.1)",
                  color: msg.role === "user" ? "white" : "#e0e0e0",
                }}
              >
                {msg.content}
              </div>
            ))
          )}
        </div>
        
        {/* Input Area */}
        <div
          style={{
            padding: "1rem",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(0,0,0,0.3)",
          }}
        >
          <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={isActive ? "Processing..." : "Type a message..."}
              disabled={isActive}
              style={{
                flex: 1,
                padding: "0.75rem 1rem",
                borderRadius: "6px",
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(0,0,0,0.5)",
                color: "#e0e0e0",
                fontSize: "0.875rem",
              }}
            />
            <button
              type="submit"
              disabled={isActive || !prompt.trim()}
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: "6px",
                border: "none",
                background: isActive ? "#666" : "#3b82f6",
                color: "white",
                cursor: isActive ? "not-allowed" : "pointer",
              }}
            >
              {isActive ? "..." : "Send"}
            </button>
          </form>
        </div>
        
        {/* Status Bar - Terminal Pattern */}
        <StatusBar
          state={state.runtimeState}
          isConnecting={state.status === "connecting"}
          pendingTools={state.pendingTools}
          retryAttempt={state.retryInfo?.attempt}
          retryDelay={state.retryInfo?.delay}
          startedAt={state.startedAt}
          compact={compact}
          onInterrupt={isActive ? handleInterrupt : undefined}
          interruptPending={interrupt.pending}
        />
      </div>
    </AllternitThemeProvider>
  )
}

export default SessionView
