/**
 * A2R Extension — Content Script
 *
 * Unified content script combining:
 *   - page-agent DOM observation (RemotePageController injection + mask overlay)
 *   - page-agent page-API bridge (exposeAgentToPage for auth'd pages)
 *   - browser-agent action executor (BROWSER.ACT, BROWSER.WAIT messages from background)
 */

import { initPageController } from '@/agent/RemotePageController.content'

const DEBUG_PREFIX = '[A2R Content]'

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_end',

  main() {
    console.debug(`${DEBUG_PREFIX} Loaded on ${window.location.href}`)

    // ── Page-agent DOM controller ─────────────────────────────────────────────
    // Sets up the PageController mask overlay and routes PAGE_CONTROL messages
    // from background → this content script.
    initPageController()

    // ── Page-API bridge (opt-in) ──────────────────────────────────────────────
    // If auth tokens match, expose MultiPageAgent to the host page via
    // window.postMessage so apps can drive the agent programmatically.
    chrome.storage.local.get('A2RExtUserAuthToken').then((result) => {
      const extToken = result.A2RExtUserAuthToken
      if (!extToken) return

      const pageToken = localStorage.getItem('A2RExtUserAuthToken')
      if (!pageToken || pageToken !== extToken) return

      console.log(`${DEBUG_PREFIX} Auth tokens match — exposing agent to page`)
      exposeAgentToPage().then(() => injectScript('/main-world.js'))
    })

    // ── Notify background ─────────────────────────────────────────────────────
    chrome.runtime.sendMessage({ type: 'CONTENT_READY', url: location.href }).catch(() => {
      // Background may not be listening yet on fresh installs — safe to ignore
    })
  },
})

// ── Page-API bridge implementation ───────────────────────────────────────────

async function exposeAgentToPage() {
  const { MultiPageAgent } = await import('@/agent/MultiPageAgent')

  let agent: InstanceType<typeof MultiPageAgent> | null = null

  window.addEventListener('message', async (e) => {
    const data = e.data
    if (typeof data !== 'object' || data === null) return
    if (data.channel !== 'PAGE_AGENT_EXT_REQUEST') return

    const { action, payload, id } = data

    switch (action) {
      case 'execute': {
        if (agent && agent.status === 'running') {
          window.postMessage(
            {
              channel: 'PAGE_AGENT_EXT_RESPONSE',
              id,
              action: 'execute_result',
              error: 'Agent is already running. Please wait until it finishes.',
            },
            '*'
          )
          return
        }

        try {
          const { task, config } = payload
          agent?.dispose()
          agent = new MultiPageAgent(config)

          agent.addEventListener('statuschange', () => {
            if (!agent) return
            window.postMessage(
              { channel: 'PAGE_AGENT_EXT_RESPONSE', id, action: 'status_change_event', payload: agent.status },
              '*'
            )
          })

          agent.addEventListener('activity', (event) => {
            if (!agent) return
            window.postMessage(
              { channel: 'PAGE_AGENT_EXT_RESPONSE', id, action: 'activity_event', payload: (event as CustomEvent).detail },
              '*'
            )
          })

          agent.addEventListener('historychange', () => {
            if (!agent) return
            window.postMessage(
              { channel: 'PAGE_AGENT_EXT_RESPONSE', id, action: 'history_change_event', payload: agent.history },
              '*'
            )
          })

          const result = await agent.execute(task)
          window.postMessage(
            { channel: 'PAGE_AGENT_EXT_RESPONSE', id, action: 'execute_result', payload: result },
            '*'
          )
        } catch (error) {
          window.postMessage(
            { channel: 'PAGE_AGENT_EXT_RESPONSE', id, action: 'execute_result', error: (error as Error).message },
            '*'
          )
        }
        break
      }

      case 'stop': {
        agent?.stop()
        break
      }

      default:
        console.warn(`${DEBUG_PREFIX} Unknown page action:`, action)
    }
  })
}

// ── Browser-agent action executor ─────────────────────────────────────────────
// Handles BROWSER.ACT and BROWSER.WAIT messages sent from background.ts
// (via chrome.tabs.sendMessage) when the thin-client requests DOM actions.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse): true | undefined => {
  if (message.type === 'BROWSER.ACT') {
    const { action, target, value, options } = message

    ;(async () => {
      try {
        switch (action) {
          case 'click':
            await executeClick(target)
            break
          case 'type':
            await executeType(target, value ?? '')
            break
          case 'scroll':
            await executeScroll(options?.direction ?? 'down', options?.amount ?? 300)
            break
          case 'hover':
            await executeHover(target)
            break
          case 'clear':
            await executeClear(target)
            break
          default:
            throw new Error(`Unknown browser action: ${action}`)
        }
        sendResponse({ success: true })
      } catch (err) {
        sendResponse({ success: false, error: (err as Error).message })
      }
    })()

    return true // async sendResponse
  }

  if (message.type === 'BROWSER.WAIT') {
    const { condition, timeout = 5000 } = message

    ;(async () => {
      try {
        if (condition?.type === 'time') {
          await delay(condition.ms ?? 1000)
        } else if (condition?.type === 'element') {
          await waitForElement(condition.target, timeout)
        } else {
          await delay(timeout)
        }
        sendResponse({ success: true })
      } catch (err) {
        sendResponse({ success: false, error: (err as Error).message })
      }
    })()

    return true
  }

  return undefined
})

// ── DOM helpers ───────────────────────────────────────────────────────────────

type Target =
  | { type: 'selector'; value: string }
  | { type: 'text'; value: string; exact?: boolean }
  | { type: 'role'; role: string; name?: string }
  | { type: 'xpath'; value: string }
  | { type: 'coordinates'; x: number; y: number }

function resolveElement(target: Target): Element | null {
  switch (target.type) {
    case 'selector':
      return document.querySelector(target.value)
    case 'text': {
      const xpath = target.exact
        ? `//*[text()='${target.value}']`
        : `//*[contains(text(),'${target.value}')]`
      const r = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
      return r.singleNodeValue as Element | null
    }
    case 'role': {
      const sel = target.name
        ? `[role="${target.role}"][aria-label="${target.name}"]`
        : `[role="${target.role}"]`
      return document.querySelector(sel)
    }
    case 'xpath': {
      const r = document.evaluate(target.value, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
      return r.singleNodeValue as Element | null
    }
    case 'coordinates':
      return document.elementFromPoint(target.x, target.y)
    default:
      return null
  }
}

function highlight(el: Element, color: string) {
  const h = el as HTMLElement
  const prev = h.style.outline
  h.style.outline = `2px solid ${color}`
  setTimeout(() => { h.style.outline = prev }, 800)
}

async function executeClick(target: Target): Promise<void> {
  const el = resolveElement(target)
  if (!el) throw new Error(`Element not found: ${JSON.stringify(target)}`)
  highlight(el, '#22c55e')
  const rect = el.getBoundingClientRect()
  el.dispatchEvent(new MouseEvent('click', {
    bubbles: true, cancelable: true,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  }))
}

async function executeType(target: Target, text: string): Promise<void> {
  const el = resolveElement(target) as HTMLElement | null
  if (!el) throw new Error(`Element not found: ${JSON.stringify(target)}`)
  el.focus()
  highlight(el, '#3b82f6')
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.value = text
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  } else if (el.isContentEditable) {
    el.textContent = text
    el.dispatchEvent(new Event('input', { bubbles: true }))
  } else {
    throw new Error('Element is not editable')
  }
}

async function executeClear(target: Target): Promise<void> {
  const el = resolveElement(target) as HTMLInputElement | HTMLTextAreaElement | null
  if (!el) throw new Error(`Element not found: ${JSON.stringify(target)}`)
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.value = ''
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
}

async function executeScroll(direction: string, amount: number): Promise<void> {
  const scrollX = direction === 'left' ? -amount : direction === 'right' ? amount : 0
  const scrollY = direction === 'up' ? -amount : direction === 'down' ? amount : 0
  window.scrollBy({ left: scrollX, top: scrollY, behavior: 'smooth' })
}

async function executeHover(target: Target): Promise<void> {
  const el = resolveElement(target)
  if (!el) throw new Error(`Element not found: ${JSON.stringify(target)}`)
  el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
  el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }))
}

async function waitForElement(target: Target, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (resolveElement(target)) return
    await delay(100)
  }
  throw new Error(`Timeout waiting for element: ${JSON.stringify(target)}`)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = chrome.runtime.getURL(src)
    s.onload = () => { s.remove(); resolve() }
    s.onerror = reject
    ;(document.head || document.documentElement).appendChild(s)
  })
}
