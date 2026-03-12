/**
 * Cowork Mode - Collaborative workspace with browser viewport
 * 
 * Layout:
 * - Left: Terminal/Code (standard TUI)
 * - Right: Viewport (for browser previews, artifacts, images)
 * 
 * Features:
 * - Hybrid browser integration (a2r-browser-dev)
 * - Dynamic viewport for content display
 * - Mode switcher in top right
 * - Keyboard shortcuts: 'o' open browser, 's' screenshot
 */

import { createMemo, createSignal, Show, onMount, onCleanup } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useMode } from "@/cli/ui/tui/component/mode-switcher"
import { useAgent } from "@/cli/ui/tui/component/agent-toggle"
import { GIZZIFrame, GIZZIHeader, GIZZIStatusBar } from "@/cli/ui/components/gizzi"
import { RGBA, TextAttributes } from "@opentui/core"
import { useTerminalDimensions, useKeyboard } from "@opentui/solid"
import { ModeSwitcher, AgentToggle } from "@/cli/ui/tui/component/mode-switcher"
import { Viewport, type ViewportContent } from "@/cli/ui/tui/component/cowork/viewport"
import { useRoute } from "@/cli/ui/tui/context/route"
import { handleErrorBoundary, displayErrorInViewport } from "@/cli/ui/tui/util/error-handling"

// Lazy load browser service (only when needed)
let BrowserServiceClass: any = null
async function getBrowserService() {
  if (!BrowserServiceClass) {
    const module = await import("@/cli/ui/tui/component/cowork/browser-service")
    BrowserServiceClass = module.getBrowserService
  }
  return BrowserServiceClass()
}

export function Cowork() {
  const { theme } = useTheme()
  const { mode, setMode } = useMode()
  const { enabled: agentEnabled, toggle: toggleAgent } = useAgent()
  const dimensions = useTerminalDimensions()
  const route = useRoute()
  
  // Cowork Brand Color: Purple Accent (#9A7BAA)
  const coworkAccent = RGBA.fromInts(154, 123, 170)
  
  const sidebarVisible = createMemo(() => dimensions().width > 100)
  
  // Browser state
  const [viewportContent, setViewportContent] = createSignal<ViewportContent | undefined>()
  const [browserStatus, setBrowserStatus] = createSignal<"closed" | "opening" | "open" | "error">("closed")
  const [currentUrl, setCurrentUrl] = createSignal<string>("")
  
  // Browser service instance (lazy loaded)
  let browser: any = null
  
  // Initialize browser service
  onMount(async () => {
    try {
      browser = await getBrowserService()
      
      // Listen to browser events (only if browser loaded successfully)
      if (browser) {
        const handleStatusChange = (status: any) => {
          setBrowserStatus(status.state)
          if (status.url) setCurrentUrl(status.url)
        }

        browser.on("status-change", handleStatusChange)
        browser.on("navigate", (url: string) => {
          setViewportContent({
            type: "web",
            url,
            title: url
          })
        })
        
        // Cleanup event listeners on unmount
        onCleanup(() => {
          if (browser) {
            browser.off("status-change", handleStatusChange)
            browser.off("navigate")
          }
        })
      }
    } catch (error) {
      console.error("Failed to load browser service:", error)
    }
  })
  
  // Keyboard shortcuts using @opentui/core
  useKeyboard((event) => {
    // Only handle shortcuts when not typing in input
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }
    
    if (event.key === 'o' || event.key === 'O') {
      openBrowser()
    } else if (event.key === 's' || event.key === 'S') {
      takeScreenshot()
    } else if (event.key === 'c' || event.key === 'C') {
      closeBrowser()
    }
  })
  
  // Browser actions
  async function openBrowser() {
    if (!browser) {
      try {
        browser = await getBrowserService()
      } catch (error) {
        const friendly = handleErrorBoundary(error, "browser-init")
        setViewportContent({
          type: "error",
          error: friendly.message + "\n💡 " + friendly.suggestion
        })
        return
      }
    }
    
    try {
      await browser.launch()
      setViewportContent({
        type: "web",
        url: "about:blank",
        title: "New Tab"
      })
    } catch (error) {
      const friendly = handleErrorBoundary(error, "browser-launch")
      setViewportContent({
        type: "error",
        error: friendly.message + "\n💡 " + friendly.suggestion
      })
    }
  }

  async function takeScreenshot() {
    if (!browser) {
      setViewportContent({
        type: "error",
        error: "Browser not open\n💡 Press 'o' to open browser first"
      })
      return
    }
    
    try {
      const screenshot = await browser.screenshot()
      // Display screenshot in viewport as base64 image
      const base64 = screenshot.toString('base64')
      setViewportContent({
        type: "image",
        src: `data:image/png;base64,${base64}`,
        title: "Screenshot",
        artifactType: "image"
      })
    } catch (error) {
      const friendly = handleErrorBoundary(error, "screenshot")
      setViewportContent({
        type: "error",
        error: friendly.message + "\n💡 " + friendly.suggestion
      })
    }
  }

  async function closeBrowser() {
    if (!browser) return
    
    try {
      await browser.close()
      setViewportContent(undefined)
    } catch (error) {
      const friendly = handleErrorBoundary(error, "browser-close")
      console.error("Close failed:", friendly.message)
    }
  }
  
  async function navigateToUrl(url: string) {
    if (!browser) return
    
    try {
      await browser.navigate(url)
    } catch (error) {
      const friendly = handleErrorBoundary(error, "browser-navigate")
      console.error("Navigation failed:", friendly.message)
    }
  }
  
  // Content loading functions
  async function loadMarkdown(content: string) {
    setViewportContent({
      type: "markdown",
      data: content
    })
  }
  
  async function loadCode(content: string, language?: string) {
    setViewportContent({
      type: "code",
      data: content,
      language
    })
  }
  
  async function loadDiff(diffContent: string) {
    setViewportContent({
      type: "diff",
      data: diffContent
    })
  }
  
  async function loadArtifact(options: { type: string; name: string; path?: string; description?: string }) {
    setViewportContent({
      type: "artifact",
      title: options.name,
      path: options.path,
      description: options.description,
      artifactType: options.type
    })
  }
  
  return (
    <GIZZIFrame
      header={
        <GIZZIHeader
          title="COWORK MODE"
          right={
            <box flexDirection="row" gap={2} alignItems="center">
              <text fg={coworkAccent}>[ COLLABORATIVE ]</text>
              <ModeSwitcher activeMode={mode} onModeChange={setMode} size="small" showLabels={false} />
              <AgentToggle enabled={agentEnabled} onToggle={toggleAgent} size="small" />
            </box>
          }
        />
      }
      statusBar={
        <GIZZIStatusBar
          hint={browserStatus() === "open" ? `Browser: ${currentUrl()}` : "Cowork mode - Ready"}
          mode={browserStatus() === "open" ? "executing" : "idle"}
        />
      }
    >
      <box flexDirection="row" flexGrow={1} backgroundColor={RGBA.fromInts(15, 17, 21)}>
        {/* Left: Terminal/Code Area */}
        <box flexGrow={1} padding={2} flexDirection="column" gap={1}>
          <text fg={coworkAccent} attributes={TextAttributes.BOLD}>
            TERMINAL / CODE
          </text>
          <box border={["bottom"]} borderColor={theme.border} paddingBottom={1} />
          
          <box flexGrow={1} justifyContent="center" alignItems="center">
            <box flexDirection="column" gap={2} padding={2}>
              <text fg={theme.text} textAlign="center">
                Cowork Mode - Terminal Area
              </text>
              <text fg={theme.textMuted} textAlign="center" style={{ fontSize: 0.9 }}>
                Standard terminal interface for commands
              </text>
              <text fg={theme.textMuted} textAlign="center" style={{ fontSize: 0.9 }}>
                Keyboard: [o]pen browser, [s]creenshot, [c]lose
              </text>
            </box>
          </box>
          
          {/* Command input placeholder */}
          <box
            border={["top"]}
            borderColor={theme.border}
            paddingTop={1}
            flexDirection="row"
            gap={1}
          >
            <text fg={coworkAccent}>╭─</text>
            <text fg={theme.textMuted} italic={true}>
              Type command or press 'o' to open browser...
            </text>
          </box>
        </box>

        {/* Right: Viewport (Browser/Artifacts) */}
        <Show when={sidebarVisible()}>
          <Viewport
            content={viewportContent()}
            title="VIEWPORT"
            interactive={true}
            onOpenBrowser={openBrowser}
            onScreenshot={takeScreenshot}
            onClose={closeBrowser}
          />
        </Show>
      </box>
    </GIZZIFrame>
  )
}
