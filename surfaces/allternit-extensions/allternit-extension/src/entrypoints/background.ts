/**
 * Allternit Extension — Background Service Worker
 *
 * Unified background for browser-agent + page-agent capabilities.
 *
 * Connection channels:
 *   Native (BA)  com.allternit.desktop  — browser-agent cowork mode (TCP 3011 bridge)
 *   Native (PA)  com.allternit.desktop  — page-agent remote task mode (TCP 3011 bridge)
 *   Cloud WS     wss://api.allternit.com/v1/extension  — browser-agent cloud mode
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
  console.log('[Allternit Extension] Background Service Worker started')

  // ── Page-agent setup ──────────────────────────────────────────────────────

  setupTabChangeEvents()

  chrome.storage.local.get('AllternitExtUserAuthToken').then((result) => {
    if (result.AllternitExtUserAuthToken) return
    chrome.storage.local.set({ AllternitExtUserAuthToken: crypto.randomUUID() })
  })

  // Side panel behavior
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})

  // Remote task execution via com.allternit.desktop native messaging
  remoteTaskHandler.start()

  // ── Browser-agent setup ───────────────────────────────────────────────────

  // Connects via com.allternit.desktop native messaging (cowork mode, default)
  // or wss://api.allternit.com/v1/extension (cloud mode)
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
