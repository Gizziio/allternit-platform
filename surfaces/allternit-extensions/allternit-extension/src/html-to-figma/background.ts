/**
 * HTML to Figma - Background Script Handler
 * Integrates with Allternit Extension background script
 */

import { captureService } from './capture'
import { StructureAgent } from './agents/structure'
import type { CaptureOptions, CaptureResult } from './types'

export interface HTMLToFigmaMessage {
  type: 'HTML_TO_FIGMA_CAPTURE' | 'HTML_TO_FIGMA_EXPORT'
  payload: {
    options?: CaptureOptions
    layers?: any
  }
}

const structureAgent = new StructureAgent()

/**
 * Handle HTML to Figma messages
 */
export async function handleHTMLToFigmaMessage(
  message: HTMLToFigmaMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
): Promise<boolean> {
  
  switch (message.type) {
    case 'HTML_TO_FIGMA_CAPTURE': {
      const result = await handleCapture(message.payload.options)
      sendResponse(result)
      return true
    }
    
    case 'HTML_TO_FIGMA_EXPORT': {
      await handleExport(message.payload.layers)
      sendResponse({ success: true })
      return true
    }
    
    default:
      return false
  }
}

/**
 * Handle capture request
 */
async function handleCapture(options?: CaptureOptions): Promise<CaptureResult> {
  // Capture from current tab
  const result = await captureService.captureCurrentTab(options)
  
  if (!result.success || !result.layers) {
    return result
  }

  // Apply cleanup agents if enabled
  if (options?.agents?.structure !== false) {
    const agentResult = await structureAgent.process(result.layers, {
      originalUrl: result.url,
      captureTimestamp: result.timestamp
    })
    
    result.layers = agentResult.layer
    
    // Log modifications
    if (agentResult.modifications.length > 0) {
      console.log('[HTML→Figma] Structure agent modifications:', 
        agentResult.modifications.length)
    }
  }

  return result
}

/**
 * Handle export to clipboard
 */
async function handleExport(layers: any): Promise<void> {
  await captureService.exportToClipboard(layers)
}

/**
 * Setup context menus for HTML→Figma
 */
export function setupHTMLToFigmaContextMenus(): void {
  // Parent menu
  chrome.contextMenus.create({
    id: 'allternit-html-to-figma',
    title: '🎨 Capture to Figma',
    contexts: ['page']
  })

  // Quick capture
  chrome.contextMenus.create({
    id: 'allternit-capture-quick',
    parentId: 'allternit-html-to-figma',
    title: '⚡ Quick Capture',
    contexts: ['page']
  })

  // Deep capture
  chrome.contextMenus.create({
    id: 'allternit-capture-deep',
    parentId: 'allternit-html-to-figma',
    title: '🔍 Deep Capture (with cleanup)',
    contexts: ['page']
  })

  // Selection capture
  chrome.contextMenus.create({
    id: 'allternit-capture-selection',
    title: '🎯 Capture Selection to Figma',
    contexts: ['selection']
  })
}

/**
 * Handle context menu clicks
 */
export async function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
): Promise<void> {
  switch (info.menuItemId) {
    case 'allternit-capture-quick':
      await captureService.captureCurrentTab({ agents: { structure: false } })
      showNotification('Quick capture complete! Check sidepanel.')
      break
      
    case 'allternit-capture-deep':
      await captureService.captureCurrentTab({ 
        agents: { structure: true, style: true, layout: true }
      })
      showNotification('Deep capture complete! Check sidepanel.')
      break
      
    case 'allternit-capture-selection':
      if (tab?.id) {
        // Execute selection capture in tab
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const selection = window.getSelection()?.toString()
            return { selection, url: location.href }
          }
        })
      }
      break
  }
}

/**
 * Show notification
 */
function showNotification(message: string): void {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: '/icon/48.png',
    title: 'Allternit HTML→Figma',
    message
  })
}
