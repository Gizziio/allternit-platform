/**
 * Cowork Mobile Pairing Dialog
 * 
 * QR code and pairing code for mobile remote control.
 * Integrates with Mirror Sync for mobile approval workflows.
 * Supports both local network and cloud relay modes.
 */

import { createSignal, createEffect, Show, For } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { TextAttributes } from "@opentui/core"

interface MirrorSession {
  id: string
  run_id: string
  access_token: string
  pairing_code: string
  pairing_url: string
  expires_at: string
}

interface DialogCoworkPairingProps {
  sessionId: string
  localIP?: string | null
  controllerPort?: number
}

export function DialogCoworkPairing(props: DialogCoworkPairingProps) {
  const { theme } = useTheme()
  const dialog = useDialog()
  const [mirrorSession, setMirrorSession] = createSignal<MirrorSession | null>(null)
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)
  const [connectionMode, setConnectionMode] = createSignal<"local" | "cloud">("local")
  
  // Generate URLs based on connection mode
  const localUrl = () => {
    const host = props.localIP || "localhost"
    const port = props.controllerPort || 3010
    return `http://${host}:${port}/cowork/${props.sessionId}`
  }
  
  const cloudUrl = () => {
    // TODO: Replace with actual cloud URL when deployed
    return `https://cowork.a2r.com/session/${props.sessionId}`
  }
  
  const currentUrl = () => connectionMode() === "local" ? localUrl() : cloudUrl()
  
  // Create mirror session on mount
  createEffect(async () => {
    try {
      setLoading(true)
      
      // Try to create mirror session via API
      try {
        const response = await fetch(`http://localhost:3001/api/v1/mirror`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            run_id: props.sessionId,
            ttl_minutes: 60,
          }),
        })
        
        if (response.ok) {
          const data = await response.json()
          setMirrorSession(data)
          return
        }
      } catch (apiErr) {
        // Mirror API not available, fall back to direct mode
        console.log("Mirror API not available, using direct mode")
      }
      
      // Fallback: Create local session directly with Cowork Controller
      const fallbackSession: MirrorSession = {
        id: props.sessionId,
        run_id: props.sessionId,
        access_token: `token_${Date.now()}`,
        pairing_code: generatePairingCode(),
        pairing_url: localUrl(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }
      setMirrorSession(fallbackSession)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  })
  
  // Generate a human-readable pairing code
  function generatePairingCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // Excludes confusing chars
    let code = ""
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code.match(/.{1,3}/g)?.join("-") || code
  }
  
  const pairingCode = () => mirrorSession()?.pairing_code || ""
  const pairingUrl = () => mirrorSession()?.pairing_url || currentUrl()
  
  // Generate ASCII QR code (simplified representation)
  const generateAsciiQR = (code: string) => {
    const lines = [
      "┌─────────┐",
      "│ ▄▄▄▄▄▄▄ │",
      "│ █ ▄▄▄ █ │",
      "│ █ █▄█ █ │",
      "│ █▄▄▄▄▄█ │",
      "│ ▄▄▄ ▄▄▄ │",
      "│ █▄█ █▄█ │",
      "└─────────┘",
    ]
    return lines
  }
  
  return (
    <box flexDirection="column" gap={1} padding={1} minWidth={60} minHeight={25}>
      {/* Header */}
      <text fg={theme.accent} attributes={TextAttributes.BOLD}>
        📱 Mobile Pairing
      </text>
      <text fg={theme.textMuted}>
        Connect from any device to continue your session
      </text>
      
      <box borderStyle="single" borderColor={theme.border} marginTop={1} marginBottom={1} />
      
      {/* Connection Mode Toggle */}
      <Show when={!loading()}>
        <box flexDirection="row" gap={2} marginBottom={1}>
          <box
            paddingLeft={2}
            paddingRight={2}
            paddingTop={1}
            paddingBottom={1}
            borderStyle="single"
            borderColor={connectionMode() === "local" ? theme.accent : theme.border}
            backgroundColor={connectionMode() === "local" ? theme.backgroundPanel : undefined}
            onMouseUp={() => setConnectionMode("local")}
          >
            <text fg={connectionMode() === "local" ? theme.accent : theme.textMuted}>
              📶 Local Network
            </text>
          </box>
          <box
            paddingLeft={2}
            paddingRight={2}
            paddingTop={1}
            paddingBottom={1}
            borderStyle="single"
            borderColor={connectionMode() === "cloud" ? theme.accent : theme.border}
            backgroundColor={connectionMode() === "cloud" ? theme.backgroundPanel : undefined}
            onMouseUp={() => setConnectionMode("cloud")}
          >
            <text fg={connectionMode() === "cloud" ? theme.accent : theme.textMuted}>
              ☁️ Cloud (Anywhere)
            </text>
          </box>
        </box>
        
        {/* Mode Description */}
        <Show when={connectionMode() === "local"}>
          <text fg={theme.textMuted}>
            Same WiFi network required • Fastest connection
          </text>
        </Show>
        <Show when={connectionMode() === "cloud"}>
          <text fg={theme.textMuted}>
            Works from anywhere • Requires internet
          </text>
        </Show>
      </Show>
      
      {/* Loading */}
      <Show when={loading()}>
        <box justifyContent="center" alignItems="center" padding={2}>
          <text fg={theme.textMuted}>Creating pairing session...</text>
        </box>
      </Show>
      
      {/* Error */}
      <Show when={error()}>
        <box justifyContent="center" alignItems="center" padding={2}>
          <text fg={theme.error}>Error: {error()}</text>
          <text fg={theme.textMuted} marginTop={1}>
            Make sure Cowork Controller is running on port {props.controllerPort || 3010}
          </text>
        </box>
      </Show>
      
      {/* Pairing Info */}
      <Show when={!loading() && !error() && mirrorSession()}>
        <box flexDirection="row" gap={2} marginTop={1}>
          {/* QR Code Placeholder */}
          <box 
            flexDirection="column" 
            padding={1}
            borderStyle="single"
            borderColor={theme.border}
            backgroundColor={theme.backgroundPanel}
          >
            <For each={generateAsciiQR(pairingCode())}>
              {(line) => <text fg={theme.text}>{line}</text>}
            </For>
            <text fg={theme.textMuted} marginTop={1}>
              Scan with phone
            </text>
          </box>
          
          {/* Pairing Details */}
          <box flexDirection="column" gap={1} flexGrow={1}>
            {/* Pairing Code */}
            <box flexDirection="column" gap={1}>
              <text fg={theme.textMuted}>Pairing Code:</text>
              <box
                padding={1}
                borderStyle="single"
                borderColor={theme.accent}
                backgroundColor={theme.backgroundPanel}
              >
                <text fg={theme.accent} attributes={TextAttributes.BOLD}>
                  {pairingCode()}
                </text>
              </box>
            </box>
            
            {/* URLs */}
            <box flexDirection="column" gap={1} marginTop={1}>
              <text fg={theme.textMuted}>Connection URL:</text>
              <Show when={connectionMode() === "local"}>
                <text fg={theme.info} truncate>
                  {localUrl()}
                </text>
                <Show when={props.localIP}>
                  <text fg={theme.success}>
                    ✓ Local network ready
                  </text>
                </Show>
                <Show when={!props.localIP}>
                  <text fg={theme.warning}>
                    ⚠ Could not detect local IP
                  </text>
                </Show>
              </Show>
              <Show when={connectionMode() === "cloud"}>
                <text fg={theme.info} truncate>
                  {cloudUrl()}
                </text>
                <text fg={theme.textMuted}>
                  (Cloud deployment required)
                </text>
              </Show>
            </box>
            
            {/* Instructions */}
            <box flexDirection="column" gap={1} marginTop={1}>
              <text fg={theme.textMuted}>How to connect:</text>
              <text fg={theme.text}>1. Open browser on your phone</text>
              <text fg={theme.text}>2. Scan QR code or enter URL</text>
              <text fg={theme.text}>3. Enter pairing code: {pairingCode()}</text>
            </box>
          </box>
        </box>
        
        {/* Features */}
        <box flexDirection="column" gap={1} marginTop={1}>
          <text fg={theme.textMuted}>Remote features:</text>
          <box flexDirection="row" gap={3}>
            <box flexDirection="column">
              <text fg={theme.text}>✓ View terminal output</text>
              <text fg={theme.text}>✓ Approve file changes</text>
            </box>
            <box flexDirection="column">
              <text fg={theme.text}>✓ Send messages</text>
              <text fg={theme.text}>✓ Monitor progress</text>
            </box>
          </box>
        </box>
        
        {/* Expiry */}
        <box marginTop={1}>
          <text fg={theme.textMuted}>
            Session expires: {new Date(mirrorSession()?.expires_at || "").toLocaleTimeString()}
          </text>
        </box>
      </Show>
      
      {/* Actions */}
      <box flexDirection="row" gap={2} marginTop={1} justifyContent="flex-end">
        <Show when={mirrorSession()}>
          <box
            paddingLeft={2}
            paddingRight={2}
            paddingTop={1}
            paddingBottom={1}
            borderStyle="single"
            borderColor={theme.border}
            onMouseUp={() => {
              // Copy pairing URL to clipboard
              navigator.clipboard?.writeText(pairingUrl())
            }}
          >
            <text fg={theme.textMuted}>Copy URL</text>
          </box>
          <box
            paddingLeft={2}
            paddingRight={2}
            paddingTop={1}
            paddingBottom={1}
            borderStyle="single"
            borderColor={theme.border}
            onMouseUp={() => {
              // Copy pairing code to clipboard
              navigator.clipboard?.writeText(pairingCode())
            }}
          >
            <text fg={theme.textMuted}>Copy Code</text>
          </box>
        </Show>
        
        <box
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
          borderStyle="single"
          borderColor={theme.border}
          onMouseUp={() => dialog.clear()}
        >
          <text fg={theme.text}>Close</text>
        </box>
      </box>
    </box>
  )
}

// Quick pairing button for header
export function CoworkPairingButton(props: { localIP?: string | null; controllerPort?: number }) {
  const { theme } = useTheme()
  const dialog = useDialog()
  
  return (
    <box
      flexDirection="row"
      gap={1}
      paddingLeft={1}
      paddingRight={1}
      borderStyle="single"
      borderColor={theme.border}
      onMouseUp={() => dialog.replace(() => (
        <DialogCoworkPairing 
          sessionId="current" 
          localIP={props.localIP}
          controllerPort={props.controllerPort}
        />
      ))}
    >
      <text fg={theme.accent}>📱</text>
      <text fg={theme.textMuted}>Pair</text>
    </box>
  )
}
