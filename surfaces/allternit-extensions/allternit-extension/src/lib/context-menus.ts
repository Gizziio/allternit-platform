/**
 * Allternit Extension — Context Menu Integration
 *
 * Registers and handles right-click context menu items for the extension.
 * Provides quick access to agent tasks from any web page.
 */

export interface ContextMenuAction {
  id: string
  title: string
  contexts: chrome.contextMenus.ContextType[]
  handler: (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => Promise<void>
}

/** Standard context menu actions for the Allternit extension */
export const MENU_ACTIONS: ContextMenuAction[] = [
  {
    id: 'allternit-explain-selection',
    title: 'Allternit: Explain selection',
    contexts: ['selection'],
    handler: handleExplainSelection,
  },
  {
    id: 'allternit-summarize-page',
    title: 'Allternit: Summarize page',
    contexts: ['page'],
    handler: handleSummarizePage,
  },
  {
    id: 'allternit-capture-to-figma',
    title: 'Allternit: Capture to Figma',
    contexts: ['page', 'frame'],
    handler: handleCaptureToFigma,
  },
  {
    id: 'allternit-translate-selection',
    title: 'Allternit: Translate selection',
    contexts: ['selection'],
    handler: handleTranslateSelection,
  },
  {
    id: 'allternit-ask-about-image',
    title: 'Allternit: Ask about image',
    contexts: ['image'],
    handler: handleAskAboutImage,
  },
]

/** Register all context menus. Call from background.ts. */
export function registerContextMenus(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'allternit-root',
      title: 'Allternit',
      contexts: ['all'],
    })

    for (const action of MENU_ACTIONS) {
      chrome.contextMenus.create({
        id: action.id,
        parentId: 'allternit-root',
        title: action.title,
        contexts: action.contexts,
      })
    }
  })
}

/** Handle context menu clicks. Wire to chrome.contextMenus.onClicked. */
export function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab,
): void {
  const action = MENU_ACTIONS.find((a) => a.id === info.menuItemId)
  if (action) {
    void action.handler(info, tab)
  }
}

// ── Action handlers ─────────────────────────────────────────────────────

async function handleExplainSelection(info: chrome.contextMenus.OnClickData): Promise<void> {
  const text = info.selectionText ?? ''
  if (!text) return
  await sendTaskToSidepanel(`Explain the following text:\n\n${text}`)
}

async function handleSummarizePage(_info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab): Promise<void> {
  const url = tab?.url ?? ''
  const title = tab?.title ?? 'this page'
  await sendTaskToSidepanel(`Summarize the content of "${title}" (${url})`)
}

async function handleCaptureToFigma(_info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab): Promise<void> {
  if (!tab?.id) return
  await chrome.tabs.sendMessage(tab.id, { type: 'HTML_TO_FIGMA_CAPTURE' })
}

async function handleTranslateSelection(info: chrome.contextMenus.OnClickData): Promise<void> {
  const text = info.selectionText ?? ''
  if (!text) return
  await sendTaskToSidepanel(`Translate the following text to English:\n\n${text}`)
}

async function handleAskAboutImage(info: chrome.contextMenus.OnClickData): Promise<void> {
  const srcUrl = info.srcUrl
  if (!srcUrl) return
  await sendTaskToSidepanel(`Describe and analyze this image: ${srcUrl}`)
}

// ── Helpers ──────────────────────────────────────────────────────────────

async function sendTaskToSidepanel(task: string): Promise<void> {
  await chrome.runtime.sendMessage({
    type: 'PLATFORM_TASK_RUN',
    task,
    config: { source: 'context-menu' },
  })

  chrome.sidePanel.open?.({ windowId: (await chrome.windows.getCurrent()).id }).catch(() => {
    /* Side panel may already be open */
  })
}
