/**
 * GizziHeader - Dynamic mounted header for Home and Session views
 * 
 * Based on Claude Code header design, adapted for Gizzi Code
 * 
 * Features:
 * - Responsive (full width vs compact)
 * - Dynamic data (model, provider, user, path)
 * - Recent activity (sessions + tasks)
 * - What's New (PR additions, new features)
 * - Gizzi mascot integration
 */

import { Show, createMemo, For } from "solid-js"
import { RGBA, TextAttributes } from "@opentui/core"
import { useTheme } from "@/cli/ui/ink-app/context/theme"
import { useSync } from "@/cli/ui/ink-app/context/sync"
import { useKV } from "@/cli/ui/ink-app/context/kv"
import { useTerminalDimensions } from "@opentui/solid"
import { GIZZIMascot } from "@/cli/ui/components/gizzi/mascot"
import { Installation } from "@/shared/installation"

export function GizziHeader() {
  const { theme } = useTheme()
  const sync = useSync()
  const kv = useKV()
  const dimensions = useTerminalDimensions()
  
  // Get terminal width for responsive rendering
  const isCompact = createMemo(() => dimensions().width < 100)
  
  // Dynamic user/account info
  const userInfo = createMemo(() => {
    // Clerk user info from sync data
    const user = sync.data?.user
    const email = user?.email || "Not signed in"
    const org = user?.organization || "Personal"
    return { email, org }
  })
  
  // Current model/provider (dynamic)
  const currentModel = createMemo(() => {
    const provider = sync.data?.provider?.[0] as { model?: string; name?: string } | undefined
    if (!provider) return "No model selected"
    return `${String(provider.model || "Unknown")} - ${String(provider.name || "Unknown")}`
  })
  
  // Current path
  const currentPath = createMemo(() => {
    return String(sync.data?.path?.directory || process.cwd())
  })
  
  // Recent activity (sessions + tasks combined)
  const recentActivity = createMemo(() => {
    const sessionData = sync.data?.session
    if (!sessionData || !Array.isArray(sessionData)) return []
    
    return sessionData.slice(0, 3).map((s: any) => ({
      type: "session" as const,
      time: formatTimeAgo(s.time?.updated),
      label: String(s.name || "Untitled Session"),
      id: String(s.id || "")
    }))
  })
  
  // What's New - PR additions and new features
  const whatsNew = createMemo(() => [
    {
      type: "feature" as const,
      title: "Cowork Mode",
      description: "Collaborative workspace with browser integration",
      link: "/release-notes#cowork-mode"
    },
    {
      type: "fix" as const,
      title: "Performance Improvements",
      description: "Faster TUI rendering and reduced memory usage",
      link: "/release-notes#performance"
    },
    {
      type: "feature" as const,
      title: "Agent Toggle",
      description: "Enable/disable autonomous agent actions",
      link: "/release-notes#agent-toggle"
    }
  ])
  
  // Compact view (small terminals)
  if (isCompact()) {
    return (
      <box
        flexDirection="column"
        borderStyle="single"
        borderColor={RGBA.fromInts(212, 176, 140, 100)}
        marginBottom={1}
      >
        {/* Top row: Mascot + Basic info */}
        <box flexDirection="row" gap={2} padding={1}>
          {/* Gizzi Mascot (small) */}
          <box>
            <GIZZIMascot state="idle" compact={true} />
          </box>
          
          {/* Info */}
          <box flexDirection="column" gap={0}>
            <text fg={theme.text} attributes={TextAttributes.BOLD}>
              Gizzi Code {Installation.VERSION}
            </text>
            <text fg={theme.textMuted}>
              {currentModel()}
            </text>
            <text fg={theme.textMuted}>
              {currentPath()}
            </text>
          </box>
        </box>
        
        {/* Announcement line (if any) */}
        <box paddingTop={1} paddingBottom={1} paddingLeft={1}>
          <text fg={theme.textMuted}>
            * Welcome to Gizzi Code - Type /help for commands
          </text>
        </box>
      </box>
    )
  }
  
  // Full width view (large terminals)
  return (
    <box
      flexDirection="column"
      borderStyle="single"
      borderColor={RGBA.fromInts(212, 176, 140, 150)}
      marginBottom={1}
    >
      {/* Main header row */}
      <box flexDirection="row" gap={4} padding={1}>
        {/* Left Section: Mascot + User Info */}
        <box flexDirection="column" gap={1} width={40}>
          {/* Gizzi Mascot */}
          <box alignItems="center">
            <GIZZIMascot state="pleased" compact={false} />
          </box>
          
          {/* User Info */}
          <box flexDirection="column" gap={0}>
            <text fg={theme.text} attributes={TextAttributes.BOLD}>
              Welcome back!
            </text>
            <text fg={theme.textMuted}>
              {userInfo().email}
            </text>
            <text fg={theme.textMuted}>
              {userInfo().org}
            </text>
            <text fg={theme.textMuted}>
              {currentPath()}
            </text>
          </box>
          
          {/* Model/Provider */}
          <box paddingTop={1}>
            <text fg={theme.accent}>
              {currentModel()}
            </text>
          </box>
        </box>
        
        {/* Divider */}
        <box
          width={1}
          borderStyle="single"
          borderColor={RGBA.fromInts(212, 176, 140, 100)}
        />
        
        {/* Right Section: Recent Activity + What's New */}
        <box flexDirection="column" gap={2} flexGrow={1}>
          {/* Recent Activity */}
          <box flexDirection="column" gap={0}>
            <text fg={theme.textMuted} attributes={TextAttributes.BOLD}>
              Recent activity
            </text>
            <For each={recentActivity()}>
              {(item) => (
                <text fg={theme.text}>
                  {item.time}  {item.label}
                </text>
              )}
            </For>
            <Show when={recentActivity().length === 0}>
              <text fg={theme.textMuted}>
                No recent sessions - Start a new conversation
              </text>
            </Show>
          </box>
          
          {/* What's New */}
          <box flexDirection="column" gap={0}>
            <text fg={theme.textMuted} attributes={TextAttributes.BOLD}>
              What's new
            </text>
            <For each={whatsNew()}>
              {(item) => (
                <box flexDirection="column" gap={0}>
                  <text fg={item.type === "feature" ? theme.success : theme.text}>
                    {item.title}
                  </text>
                  <text fg={theme.textMuted}>
                    {item.description}
                  </text>
                </box>
              )}
            </For>
          </box>
        </box>
      </box>
      
      {/* Bottom info line */}
      <box
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={1}
        borderStyle="single"
        borderColor={RGBA.fromInts(212, 176, 140, 100)}
      >
      </box>
    </box>
  )
}

// Helper: Format timestamp as "Xd ago"
function formatTimeAgo(timestamp: number | undefined): string {
  if (!timestamp || typeof timestamp !== 'number') return "Unknown"
  const now = Date.now()
  const diff = now - timestamp
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}
