/**
 * A2R Extension — Background Service Worker
 *
 * Unified background for browser-agent + page-agent capabilities.
 *
 * Connection channels:
 *   Local WS     ws://localhost:3000/ws/extension    — browser-agent local mode
 *   Native (BA)  com.a2r.native_host                 — browser-agent cowork mode
 *   Native (PA)  com.a2r.desktop                     — page-agent remote task mode
 *
 * Populated by:
 *   MERGE-2  page-agent core (TabsController, RemotePageController, agent)
 *   MERGE-3  browser-agent connection layer (WebSocketClient, NativeMessaging)
 */

import { handlePageControlMessage } from '@/agent/RemotePageController.background'
import { handleTabControlMessage, setupTabChangeEvents } from '@/agent/TabsController.background'
import { remoteTaskHandler } from '@/agent/remote-task-handler'
import { browserAgentConnection } from '@/browser-agent/connection'
import { 
  handleHTMLToFigmaMessage, 
  setupHTMLToFigmaContextMenus,
  handleContextMenuClick 
} from '@/html-to-figma'

export default defineBackground(() => {
  console.log('[A2R Extension] Background Service Worker started')

  // ── Page-agent setup ──────────────────────────────────────────────────────

  setupTabChangeEvents()

  chrome.storage.local.get('A2RExtUserAuthToken').then((result) => {
    if (result.A2RExtUserAuthToken) return
    chrome.storage.local.set({ A2RExtUserAuthToken: crypto.randomUUID() })
  })

  // Side panel behavior
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})

  // Remote task execution via com.a2r.desktop native messaging
  remoteTaskHandler.start()

  // ── Browser-agent setup ───────────────────────────────────────────────────

  // Connects to thin-client on ws://localhost:3000/ws/extension (local mode)
  // or via com.a2r.native_host (cowork mode)
  browserAgentConnection.initialize()

  // ── HTML to Figma setup ───────────────────────────────────────────────────

  setupHTMLToFigmaContextMenus()

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    handleContextMenuClick(info, tab)
  })

  // ── Message router ────────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, sender, sendResponse): true | undefined => {
    // HTML to Figma messages
    if (message.type?.startsWith('HTML_TO_FIGMA')) {
      return handleHTMLToFigmaMessage(message, sender, sendResponse)
    }
    
    if (message.type === 'TAB_CONTROL') {
      return handleTabControlMessage(message, sender, sendResponse)
    }
    if (message.type === 'PAGE_CONTROL') {
      return handlePageControlMessage(message, sender, sendResponse)
    }
    // Browser-agent content script messages are handled by browserAgentConnection
    if (message.type === 'BROWSER_ACTION' || message.type === 'CONTENT_READY') {
      return browserAgentConnection.handleContentMessage(message, sender, sendResponse)
    }
    sendResponse({ error: 'Unknown message type' })
    return undefined
  })
})
