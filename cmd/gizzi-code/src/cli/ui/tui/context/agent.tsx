/**
 * Agent Context - Global agent state management
 * 
 * Provides:
 * - Agent enabled/disabled state
 * - Agent mounting control
 * - Agent configuration
 * - Works in both Code and Cowork modes
 */

import { createContext, useContext, createMemo, createEffect, createSignal, onMount } from "solid-js"
import { useKV } from "@/cli/ui/tui/context/kv"

const AGENT_STORAGE_KEY = "gizzi-agent-enabled"

interface AgentContextValue {
  enabled: boolean
  setEnabled: (enabled: boolean) => void
  toggle: () => void
  agentId?: string
  setAgentId: (id: string | undefined) => void
}

// Create context with default values
const AgentContext = createContext<AgentContextValue>({
  enabled: false,
  setEnabled: () => {},
  toggle: () => {},
  agentId: undefined,
  setAgentId: () => {},
})

// Provider component
export function AgentProvider(props: { children: any }) {
  const kv = useKV()
  const [enabled, setEnabledState] = createSignal(false)
  const [agentId, setAgentIdState] = createSignal<string | undefined>()
  
  // Load saved agent preference on mount
  onMount(() => {
    if (kv.ready) {
      const saved = kv.get(AGENT_STORAGE_KEY, false) as boolean
      setEnabledState(saved)
    }
  })
  
  // Save agent state when it changes
  createEffect(() => {
    const isEnabled = enabled()
    if (kv.ready) {
      kv.set(AGENT_STORAGE_KEY, isEnabled)
    }
  })
  
  const value = createMemo<AgentContextValue>(() => ({
    enabled: enabled(),
    setEnabled: (newEnabled: boolean) => {
      setEnabledState(newEnabled)
    },
    toggle: () => {
      setEnabledState(!enabled())
    },
    agentId: agentId(),
    setAgentId: (id: string | undefined) => {
      setAgentIdState(id)
    },
  }))
  
  return (
    <AgentContext.Provider value={value()}>
      {props.children}
    </AgentContext.Provider>
  )
}

// Hook for consuming agent context
export function useAgent() {
  const context = useContext(AgentContext)
  if (!context) {
    throw new Error("useAgent must be used within AgentProvider")
  }
  return context
}

// HOC for agent-aware components
export function withAgent<P extends object>(
  Component: (props: P & { agentEnabled: boolean }) => any
) {
  return function WithAgent(props: P) {
    const agent = useAgent()
    return <Component {...props} agentEnabled={agent.enabled} />
  }
}
