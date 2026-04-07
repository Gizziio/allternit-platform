/**
 * Cowork Collaboration Context
 * 
 * WebSocket client for real-time collaboration in Cowork mode.
 * Supports both local network (WebSocket) and cloud relay (polling).
 * Hybrid mode: tries local first, falls back to cloud.
 * 
 * Architecture:
 * - Local: WebSocket (fast, same network)
 * - Cloud: HTTP Polling (enterprise scalable, firewall-friendly)
 */

import { createSignal, createEffect, onCleanup, onMount } from "solid-js"
import { createSimpleContext } from "@/cli/ui/tui/context/helper"
import { Log } from "@/runtime/util/log"
import { PollingCloudRelayClient, createPollingCloudRelayClient, DEFAULT_POLLING_RELAY_URL } from "@allternit/cowork-controller/cloud-relay-polling"

export type ConnectionMode = "local" | "cloud" | "hybrid"
export type ConnectionState = "disconnected" | "connecting" | "connected_local" | "connected_cloud" | "error"
export type CloudProtocol = "websocket" | "polling"

export interface CoworkClient {
  id: string
  name: string
  connectedAt: number
  isActive: boolean
  source: "local" | "cloud"
}

export interface CollaborationEvent {
  type: "join" | "leave" | "activity" | "cursor" | "typing" | "output"
  clientId: string
  timestamp: number
  data?: any
}

export interface CoworkCollaborationState {
  isConnected: boolean
  connectionState: ConnectionState
  connectionMode: ConnectionMode
  cloudProtocol: CloudProtocol
  clients: CoworkClient[]
  events: CollaborationEvent[]
  pendingApprovals: PendingApproval[]
  localIP: string | null
  cloudUrl: string | null
}

export interface PendingApproval {
  id: string
  type: "file_write" | "bash_command" | "tool_execution"
  title: string
  description?: string
  requester: string
  timestamp: number
}

const COWORK_CONTROLLER_PORT = 3010

export const {
  use: useCoworkCollaboration,
  provider: CoworkCollaborationProvider,
} = createSimpleContext({
  name: "CoworkCollaboration",
  init: (props: {
    sessionId?: string
    enabled?: boolean
    mode?: ConnectionMode
    cloudProtocol?: CloudProtocol
  }) => {
    const [isConnected, setIsConnected] = createSignal(false)
    const [connectionState, setConnectionState] = createSignal<ConnectionState>("disconnected")
    const [connectionMode, setConnectionMode] = createSignal<ConnectionMode>(props.mode || "hybrid")
    const [cloudProtocol, setCloudProtocol] = createSignal<CloudProtocol>(props.cloudProtocol || "polling")
    const [clients, setClients] = createSignal<CoworkClient[]>([])
    const [events, setEvents] = createSignal<CollaborationEvent[]>([])
    const [pendingApprovals, setPendingApprovals] = createSignal<PendingApproval[]>([])
    const [localIP, setLocalIP] = createSignal<string | null>(null)
    const [cloudUrl, setCloudUrl] = createSignal<string | null>(null)
    const [ws, setWs] = createSignal<WebSocket | null>(null)
    const [pollingClient, setPollingClient] = createSignal<PollingCloudRelayClient | null>(null)
    
    const log = Log.create({ service: "cowork.collaboration" })

    // Get local IP address
    const detectLocalIP = async (): Promise<string | null> => {
      try {
        const { getLocalIPAddress } = await import("@allternit/cowork-controller/service-manager")
        return await getLocalIPAddress()
      } catch {
        return null
      }
    }
    
    // Connect to local Cowork Controller (WebSocket)
    const connectLocal = async (): Promise<boolean> => {
      if (!props.sessionId) return false
      
      try {
        setConnectionState("connecting")
        const ip = localIP() || await detectLocalIP()
        setLocalIP(ip)
        
        const host = ip || "localhost"
        const wsUrl = `ws://${host}:${COWORK_CONTROLLER_PORT}/cowork/${props.sessionId}`
        
        log.info("Connecting to local Cowork Controller", { url: wsUrl })
        
        const socket = new WebSocket(wsUrl)
        
        return new Promise((resolve) => {
          const timeout = setTimeout(() => {
            socket.close()
            resolve(false)
          }, 5000)
          
          socket.onopen = () => {
            clearTimeout(timeout)
            log.info("Connected to local Cowork Controller", { sessionId: props.sessionId })
            setIsConnected(true)
            setConnectionState("connected_local")
            setCloudUrl(`http://${host}:${COWORK_CONTROLLER_PORT}/cowork/${props.sessionId}`)
            
            // Send join event
            socket.send(JSON.stringify({
              type: "join",
              clientType: "tui",
              timestamp: Date.now(),
            }))
            
            resolve(true)
          }
          
          socket.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data)
              handleMessage(data, "local")
            } catch (err) {
              log.error("Failed to parse WebSocket message", { error: err })
            }
          }
          
          socket.onclose = () => {
            clearTimeout(timeout)
            log.info("Disconnected from local Cowork Controller")
            setIsConnected(false)
            setConnectionState("disconnected")
            setClients([])
            
            // If in hybrid mode, try cloud fallback
            if (connectionMode() === "hybrid") {
              log.info("Local disconnected, trying cloud fallback...")
              connectCloud()
            }
            
            resolve(false)
          }
          
          socket.onerror = (error) => {
            clearTimeout(timeout)
            log.error("Local WebSocket error", { error })
            resolve(false)
          }
          
          setWs(socket)
        })
      } catch (err) {
        log.error("Failed to connect locally", { error: err })
        return false
      }
    }
    
    // Connect to cloud relay (HTTP Polling)
    const connectCloud = async (): Promise<boolean> => {
      if (!props.sessionId) return false
      
      try {
        setConnectionState("connecting")
        
        log.info("Connecting to cloud relay (polling)", { sessionId: props.sessionId })
        
        // Always use polling for cloud (enterprise scalable)
        const client = createPollingCloudRelayClient({
          relayUrl: DEFAULT_POLLING_RELAY_URL,
          sessionId: props.sessionId,
          pollInterval: 500, // 500ms poll interval
        })
        
        client.onMessage((message) => {
          handleMessage(message as any, "cloud")
        })
        
        client.onError((error) => {
          log.error("Cloud relay error", { error: error.message })
          setConnectionState("error")
        })
        
        await client.start()
        setPollingClient(client)
        
        setIsConnected(true)
        setConnectionState("connected_cloud")
        setCloudUrl(`https://cowork.a2r.com/session/${props.sessionId}`)
        setCloudProtocol("polling")
        
        log.info("Connected to cloud relay (polling)")
        return true
      } catch (err) {
        log.error("Failed to connect to cloud relay", { error: err })
        setConnectionState("error")
        return false
      }
    }
    
    // Main connect function
    const connect = async () => {
      if (!props.enabled || !props.sessionId) return
      
      const mode = connectionMode()
      
      if (mode === "local") {
        await connectLocal()
      } else if (mode === "cloud") {
        await connectCloud()
      } else {
        // Hybrid: try local first, then cloud
        const localSuccess = await connectLocal()
        if (!localSuccess) {
          await connectCloud()
        }
      }
    }
    
    const disconnect = () => {
      // Disconnect local WebSocket
      const socket = ws()
      if (socket) {
        socket.close()
        setWs(null)
      }
      
      // Disconnect polling client
      const client = pollingClient()
      if (client) {
        client.stop()
        setPollingClient(null)
      }
      
      setIsConnected(false)
      setConnectionState("disconnected")
      setClients([])
    }
    
    const handleMessage = (data: any, source: "local" | "cloud") => {
      switch (data.type) {
        case "clients":
          setClients((data.clients || []).map((c: any) => ({ ...c, source })))
          break
          
        case "join":
          setClients(prev => [...prev, { ...data.client, source }])
          setEvents(prev => [...prev, {
            type: "join",
            clientId: data.client.id,
            timestamp: Date.now(),
          }])
          break
          
        case "leave":
          setClients(prev => prev.filter(c => c.id !== data.clientId))
          setEvents(prev => [...prev, {
            type: "leave",
            clientId: data.clientId,
            timestamp: Date.now(),
          }])
          break
          
        case "approval_request":
          setPendingApprovals(prev => [...prev, {
            id: data.id,
            type: data.approvalType,
            title: data.title,
            description: data.description,
            requester: data.requester,
            timestamp: Date.now(),
          }])
          break
          
        case "activity":
          setEvents(prev => [...prev, {
            type: data.activityType || "activity",
            clientId: data.clientId,
            timestamp: Date.now(),
            data: data.data,
          }])
          break
          
        case "output":
          setEvents(prev => [...prev, {
            type: "output",
            clientId: data.clientId || "unknown",
            timestamp: Date.now(),
            data: data.data,
          }])
          break
      }
    }
    
    // Send approval response
    const respondToApproval = (approvalId: string, approved: boolean, reason?: string) => {
      // Try polling client first (cloud)
      const client = pollingClient()
      if (client?.isActive()) {
        client.sendApprovalResponse(approvalId, approved, reason)
        setPendingApprovals(prev => prev.filter(a => a.id !== approvalId))
        return
      }
      
      // Fall back to local WebSocket
      const socket = ws()
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "approval_response",
          approvalId,
          approved,
          reason,
          timestamp: Date.now(),
        }))
        setPendingApprovals(prev => prev.filter(a => a.id !== approvalId))
      }
    }
    
    // Broadcast activity to other clients
    const broadcastActivity = (activityType: string, data?: any) => {
      const message = {
        type: "activity",
        activityType,
        data,
        timestamp: Date.now(),
      }
      
      // Try polling client first (cloud)
      const client = pollingClient()
      if (client?.isActive()) {
        client.sendMessage(message as any)
        return
      }
      
      // Fall back to local WebSocket
      const socket = ws()
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message))
      }
    }

    // Send terminal output to viewers
    const broadcastOutput = (output: string, metadata?: Record<string, any>) => {
      const client = pollingClient()
      if (client?.isActive()) {
        client.sendOutput(output, metadata)
        return
      }
      
      const socket = ws()
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "output",
          data: output,
          metadata,
          timestamp: Date.now(),
        }))
      }
    }
    
    // Connect on mount if enabled
    onMount(() => {
      if (props.enabled) {
        detectLocalIP().then(ip => {
          if (ip) setLocalIP(ip)
        })
        connect()
      }
    })
    
    // Cleanup on unmount
    onCleanup(() => {
      disconnect()
    })
    
    // Reconnect when session changes
    createEffect(() => {
      const id = props.sessionId
      if (id && props.enabled) {
        disconnect()
        connect()
      }
    })
    
    return {
      isConnected,
      connectionState,
      connectionMode,
      cloudProtocol,
      setConnectionMode,
      clients,
      events,
      pendingApprovals,
      localIP,
      cloudUrl,
      connect,
      disconnect,
      respondToApproval,
      broadcastActivity,
      broadcastOutput,
      clientCount: () => clients().length,
      hasPendingApprovals: () => pendingApprovals().length > 0,
      connectionStatus: () => {
        const state = connectionState()
        switch (state) {
          case "connected_local": return "Connected (Local)"
          case "connected_cloud": return `Connected (Cloud ${cloudProtocol().toUpperCase()})`
          case "connecting": return "Connecting..."
          case "error": return "Connection Error"
          default: return "Disconnected"
        }
      },
    }
  },
})

// Hook for using collaboration features
export function useCollaborationStatus() {
  const collab = useCoworkCollaboration()
  
  return {
    isConnected: collab.isConnected,
    viewerCount: () => collab.clients().length + 1, // +1 for self
    viewers: collab.clients,
    pendingApprovals: collab.pendingApprovals,
    hasPendingApprovals: collab.hasPendingApprovals,
    connectionState: collab.connectionState,
    cloudProtocol: collab.cloudProtocol,
    connectionStatus: collab.connectionStatus,
    localIP: collab.localIP,
    cloudUrl: collab.cloudUrl,
  }
}
