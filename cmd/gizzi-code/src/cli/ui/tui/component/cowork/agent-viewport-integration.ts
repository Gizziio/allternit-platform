/**
 * Agent-Viewport Integration
 * 
 * Allows agent to:
 * - Display output in viewport
 * - Control browser
 * - Show artifacts
 * - Render markdown/code/diffs
 * 
 * Usage:
 * const agentViewport = createAgentViewportIntegration()
 * agentViewport.displayMarkdown("# Hello")
 * agentViewport.openBrowser("https://example.com")
 */

import { getBrowserService } from "./browser-service"
import type { ViewportContent } from "./viewport"

export interface AgentViewportAPI {
  // Content display
  displayMarkdown: (content: string) => void
  displayCode: (content: string, language?: string) => void
  displayDiff: (diffContent: string) => void
  displayArtifact: (options: { type: string; name: string; path?: string; description?: string }) => void
  displayImage: (src: string, alt?: string) => void
  
  // Browser control
  openBrowser: (url?: string) => Promise<void>
  closeBrowser: () => Promise<void>
  navigateTo: (url: string) => Promise<void>
  takeScreenshot: () => Promise<void>
  
  // Status
  showLoading: (message?: string) => void
  showError: (error: string, suggestion?: string) => void
  clearViewport: () => void
  
  // Events
  onViewportChange: (callback: (content: ViewportContent | undefined) => void) => () => void
}

// Viewport state
let currentViewportContent: ViewportContent | undefined = undefined
const viewportChangeListeners: Array<(content: ViewportContent | undefined) => void> = []

function setViewportContent(content: ViewportContent | undefined) {
  currentViewportContent = content
  viewportChangeListeners.forEach(listener => listener(content))
}

export function createAgentViewportIntegration(): AgentViewportAPI {
  const browser = getBrowserService()
  
  return {
    // Content display
    displayMarkdown(content: string) {
      setViewportContent({
        type: "markdown",
        data: content
      })
    },
    
    displayCode(content: string, language?: string) {
      setViewportContent({
        type: "code",
        data: content,
        language
      })
    },
    
    displayDiff(diffContent: string) {
      setViewportContent({
        type: "diff",
        data: diffContent
      })
    },
    
    displayArtifact(options: { type: string; name: string; path?: string; description?: string }) {
      setViewportContent({
        type: "artifact",
        title: options.name,
        path: options.path,
        description: options.description,
        artifactType: options.type
      })
    },
    
    displayImage(src: string, alt?: string) {
      setViewportContent({
        type: "image",
        src,
        title: alt || "Image",
        artifactType: "image"
      })
    },
    
    // Browser control
    async openBrowser(url?: string) {
      await browser.launch()
      if (url) {
        await browser.navigate(url)
      }
      setViewportContent({
        type: "web",
        url: url || "about:blank",
        title: url || "New Tab"
      })
    },
    
    async closeBrowser() {
      await browser.close()
      setViewportContent(undefined)
    },
    
    async navigateTo(url: string) {
      await browser.navigate(url)
      setViewportContent({
        type: "web",
        url,
        title: url
      })
    },
    
    async takeScreenshot() {
      const screenshot = await browser.screenshot()
      setViewportContent({
        type: "image",
        src: `data:image/png;base64,${screenshot.toString('base64')}`,
        title: "Screenshot",
        artifactType: "image"
      })
    },
    
    // Status
    showLoading(message?: string) {
      setViewportContent({
        type: "loading",
        title: message || "Loading..."
      })
    },
    
    showError(error: string, suggestion?: string) {
      setViewportContent({
        type: "error",
        error: suggestion ? `${error}\n${suggestion}` : error
      })
    },
    
    clearViewport() {
      setViewportContent(undefined)
    },
    
    // Events
    onViewportChange(callback: (content: ViewportContent | undefined) => void) {
      viewportChangeListeners.push(callback)
      return () => {
        const index = viewportChangeListeners.indexOf(callback)
        if (index > -1) {
          viewportChangeListeners.splice(index, 1)
        }
      }
    }
  }
}

// Singleton instance
let agentViewportInstance: AgentViewportAPI | null = null

export function getAgentViewportIntegration(): AgentViewportAPI {
  if (!agentViewportInstance) {
    agentViewportInstance = createAgentViewportIntegration()
  }
  return agentViewportInstance
}
