/**
 * Appshots — capture logic.
 *
 * Functions for capturing a sanitized page snapshot, extracting agent session
 * data from the Allternit platform, and generating thumbnails.
 *
 * NOTE: This module is designed to run in the content-script context.
 * Functions that touch the DOM should only be called from a content script.
 * Storage/API helpers are safe in any extension context.
 */

import type { AgentSnapshot, Appshot, CapturedMessage, CapturedToolCall } from './types'

// ── Page capture ──────────────────────────────────────────────────────────────

/**
 * Capture the current page's DOM as a sanitized HTML string.
 * Must be called from a content script running in the target page.
 */
export function capturePageSnapshot(): string {
	// Clone the document to avoid mutating the live DOM
	const clone = document.documentElement.cloneNode(true) as HTMLElement

	// Remove elements that should not appear in a snapshot
	const removableSelectors = [
		'script',
		'noscript',
		'iframe',
		'object',
		'embed',
		'link[rel="stylesheet"]',
		'style',
		'[data-appshot-remove]',
		// Remove extension-injected UI
		'[data-allternit-extension-ready]',
		'.allternit-appshot-fab',
	]

	for (const selector of removableSelectors) {
		for (const el of clone.querySelectorAll(selector)) {
			el.remove()
		}
	}

	// Sanitize remaining attributes that could execute code or leak data
	sanitizeAttributes(clone)

	// Inline computed styles for a faithful offline render
	inlineCriticalStyles(clone)

	return `<!DOCTYPE html>\n${clone.outerHTML}`
}

/**
 * Remove dangerous and sensitive attributes from all elements in the tree.
 */
function sanitizeAttributes(root: HTMLElement): void {
	const sensitiveAttrs = [
		'onclick',
		'onmouseover',
		'onmouseout',
		'onfocus',
		'onblur',
		'onchange',
		'onsubmit',
		'onkeydown',
		'onkeyup',
		'onkeypress',
		'onload',
		'onerror',
	]

	for (const el of root.querySelectorAll('*')) {
		for (const attr of sensitiveAttrs) {
			el.removeAttribute(attr)
		}

		// Strip href="javascript:..." links
		const href = el.getAttribute('href')
		if (href && href.trim().toLowerCase().startsWith('javascript:')) {
			el.removeAttribute('href')
		}

		// Strip data attributes that might contain app state / tokens
		for (const attr of Array.from(el.attributes)) {
			if (attr.name.startsWith('data-') && attr.name !== 'data-appshot-keep') {
				// Keep data-* attributes that are purely presentational (e.g. data-slot)
				// but strip ones that look like they hold sensitive values
				if (looksSensitive(attr.value)) {
					el.removeAttribute(attr.name)
				}
			}
		}
	}
}

/**
 * Heuristic: does the attribute value look like a token, secret, or PII?
 */
function looksSensitive(value: string): boolean {
	if (value.length > 64) return true // long encoded strings
	if (/^(ey[A-Za-z0-9_-]{10,}\.)/.test(value)) return true // JWT-like
	if (/^(sk-|pk-|token|secret|key)/.test(value.toLowerCase())) return true
	return false
}

/**
 * Inline a subset of computed styles so the snapshot renders faithfully
 * without external stylesheets. Only inlines layout-critical properties.
 */
function inlineCriticalStyles(root: HTMLElement): void {
	const criticalProps = [
		'display',
		'position',
		'top',
		'right',
		'bottom',
		'left',
		'flex',
		'flex-direction',
		'align-items',
		'justify-content',
		'grid-template-columns',
		'grid-template-rows',
		'gap',
		'width',
		'height',
		'max-width',
		'max-height',
		'overflow',
		'margin',
		'padding',
		'background-color',
		'color',
		'font-family',
		'font-size',
		'font-weight',
		'line-height',
		'text-align',
		'text-decoration',
		'border',
		'border-radius',
		'opacity',
		'box-shadow',
		'transform',
	]

	const liveElements = document.querySelectorAll('*')
	const clonedElements = root.querySelectorAll('*')

	// Map live → cloned by index (both trees share the same structure)
	for (let i = 0; i < clonedElements.length; i++) {
		const live = liveElements[i]
		const cloned = clonedElements[i] as HTMLElement
		if (!live || !cloned) continue

		try {
			const computed = window.getComputedStyle(live)
			const inlined: string[] = []
			for (const prop of criticalProps) {
				const val = computed.getPropertyValue(prop)
				if (val && val !== '' && val !== 'none' && val !== 'auto' && val !== 'normal') {
					inlined.push(`${prop}:${val}`)
				}
			}
			if (inlined.length > 0) {
				const existing = cloned.getAttribute('style') ?? ''
				cloned.setAttribute('style', `${existing};${inlined.join(';')}`)
			}
		} catch {
			// getComputedStyle can throw on detached or special elements — skip
		}
	}
}

// ── Agent session capture ─────────────────────────────────────────────────────

/**
 * Extract the current agent session data from the Allternit platform page.
 *
 * Looks for the agent state in the page's `window.__ALLTERNIT_AGENT_STATE__`
 * global (injected by the platform) or falls back to scraping the conversation
 * DOM if the global is unavailable.
 */
export function captureAgentSession(): AgentSnapshot | undefined {
	// Try the structured global first
	const win = window as unknown as Record<string, unknown>
	const state = win.__ALLTERNIT_AGENT_STATE__ as
		| {
				sessionId?: string
				model?: string
				totalTokens?: number
				messages?: CapturedMessage[]
				toolCalls?: CapturedToolCall[]
		  }
		| undefined

	if (state && state.sessionId) {
		return {
			sessionId: state.sessionId,
			model: state.model ?? 'unknown',
			totalTokens: state.totalTokens ?? 0,
			messages: state.messages ?? [],
			toolCalls: state.toolCalls ?? [],
		}
	}

	// Fallback: scrape conversation from DOM (best-effort)
	return scrapeAgentFromDom()
}

/**
 * Best-effort scrape of agent conversation from the page DOM.
 * Targets common chat-UI patterns used by the Allternit platform.
 */
function scrapeAgentFromDom(): AgentSnapshot | undefined {
	const messages: CapturedMessage[] = []

	// Look for message containers with role indicators
	const messageEls = document.querySelectorAll('[data-message-role], [data-role], .message')

	for (const el of messageEls) {
		const role = (
			el.getAttribute('data-message-role') ??
			el.getAttribute('data-role') ??
			el.classList.contains('user')
				? 'user'
				: el.classList.contains('assistant')
					? 'assistant'
					: 'user'
		) as 'user' | 'assistant'

		const text = el.textContent?.trim() ?? ''
		if (text.length === 0) continue

		messages.push({
			role,
			content: text.slice(0, 5000), // cap per-message content
			timestamp: new Date().toISOString(),
		})
	}

	if (messages.length === 0) return undefined

	return {
		sessionId: `scraped-${Date.now()}`,
		model: 'unknown',
		totalTokens: 0,
		messages,
		toolCalls: [],
	}
}

// ── Thumbnail generation ──────────────────────────────────────────────────────

/**
 * Generate a small base64-encoded PNG thumbnail from the current page.
 *
 * Uses the extension's `chrome.tabs.captureVisibleTab` API when called from
 * the background/sidepanel context. From a content script, falls back to
 * rendering the captured HTML into a canvas via an offscreen iframe.
 *
 * Returns a base64 data URL string, or undefined if capture fails.
 */
export async function generateThumbnailFromTab(): Promise<string | undefined> {
	try {
		// chrome.tabs is only available in extension pages (background, sidepanel, popup)
		// — not in content scripts. Guard with a typeof check.
		if (typeof chrome?.tabs?.captureVisibleTab !== 'function') return undefined

		const dataUrl = await chrome.tabs.captureVisibleTab({
			format: 'png',
			quality: 60,
		})
		return dataUrl
	} catch {
		// captureVisibleTab requires activeTab or <all_urls> and may fail
		// on chrome:// pages or when the window is minimized
		return undefined
	}
}

/**
 * Generate a thumbnail from raw HTML by rendering it in a hidden iframe
 * and drawing to a canvas. Useful when tab capture is not available.
 */
export async function generateThumbnailFromHtml(html: string): Promise<string | undefined> {
	return new Promise((resolve) => {
		const iframe = document.createElement('iframe')
		iframe.style.cssText =
			'position:fixed;top:-9999px;left:-9999px;width:1280px;height:800px;border:none;visibility:hidden;'
		iframe.sandbox.add('allow-same-origin')

		document.body.appendChild(iframe)

		const doc = iframe.contentDocument
		if (!doc) {
			iframe.remove()
			resolve(undefined)
			return
		}

		doc.open()
		doc.write(html)
		doc.close()

		// Wait for render, then draw to canvas
		setTimeout(() => {
			try {
				const canvas = document.createElement('canvas')
				canvas.width = 320
				canvas.height = 200
				const ctx = canvas.getContext('2d')
				if (!ctx) {
					iframe.remove()
					resolve(undefined)
					return
				}

				// Draw white background
				ctx.fillStyle = '#FDF8F3'
				ctx.fillRect(0, 0, canvas.width, canvas.height)

				// Attempt to draw the iframe content (same-origin only)
				const iframeBody = iframe.contentDocument?.body
				if (iframeBody) {
					// Use foreignObject SVG to render HTML on canvas
					const svgData = `
						<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200">
							<foreignObject width="100%" height="100%">
								<div xmlns="http://www.w3.org/1999/xhtml" style="transform:scale(0.25);transform-origin:top left;width:1280px;height:800px;overflow:hidden;">
									${iframeBody.innerHTML}
								</div>
							</foreignObject>
						</svg>`
					const blob = new Blob([svgData], { type: 'image/svg+xml' })
					const url = URL.createObjectURL(blob)
					const img = new Image()
					img.onload = () => {
						ctx.drawImage(img, 0, 0, 320, 200)
						URL.revokeObjectURL(url)
						iframe.remove()
						resolve(canvas.toDataURL('image/png', 0.6))
					}
					img.onerror = () => {
						URL.revokeObjectURL(url)
						iframe.remove()
						resolve(undefined)
					}
					img.src = url
				} else {
					iframe.remove()
					resolve(undefined)
				}
			} catch {
				iframe.remove()
				resolve(undefined)
			}
		}, 500)
	})
}

// ── Full capture orchestrator ─────────────────────────────────────────────────

/**
 * Capture a complete Appshot of the current page.
 * Must be called from a content script context.
 */
export async function captureFullAppshot(title?: string): Promise<Appshot> {
	const capturedHtml = capturePageSnapshot()
	const agentContext = captureAgentSession()

	// Try tab-based thumbnail first (only works from extension pages like
	// the sidepanel/background), then fall back to HTML-based rendering
	// (works from content scripts that have DOM access).
	let thumbnail: string | undefined
	try {
		thumbnail = await generateThumbnailFromTab()
	} catch {
		// chrome.tabs not available (e.g. content script context)
	}
	if (!thumbnail) {
		try {
			thumbnail = await generateThumbnailFromHtml(capturedHtml)
		} catch {
			// HTML thumbnail generation is best-effort
		}
	}

	const appshot: Appshot = {
		id: crypto.randomUUID(),
		title: title ?? document.title ?? 'Untitled Appshot',
		createdAt: new Date().toISOString(),
		pageUrl: window.location.href,
		pageTitle: document.title,
		thumbnail,
		capturedHtml,
		agentContext,
		annotations: [],
	}

	return appshot
}
