/**
 * HTML to Figma Capture Service
 * Handles DOM capture from content scripts
 */

import type { CaptureOptions, CaptureResult, LayerNode } from './types'

export class CaptureService {
  private static instance: CaptureService
  
  static getInstance(): CaptureService {
    if (!CaptureService.instance) {
      CaptureService.instance = new CaptureService()
    }
    return CaptureService.instance
  }

  /**
   * Capture current tab
   */
  async captureCurrentTab(options: CaptureOptions = {}): Promise<CaptureResult> {
    const start = Date.now()
    
    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      
      if (!tab?.id) {
        throw new Error('No active tab found')
      }

      // Inject and execute capture script
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: this.captureDOM,
        args: [options]
      })

      const domData = results[0]?.result
      
      if (!domData) {
        throw new Error('Failed to capture DOM')
      }

      // Convert to Figma layers
      const layers = this.convertToFigmaLayers(domData)

      return {
        success: true,
        layers,
        duration: Date.now() - start,
        url: tab.url || '',
        timestamp: Date.now()
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - start,
        url: '',
        timestamp: Date.now()
      }
    }
  }

  /**
   * Capture specific element
   */
  async captureElement(selector: string, options: CaptureOptions = {}): Promise<CaptureResult> {
    return this.captureCurrentTab({ ...options, selector })
  }

  /**
   * Capture script injected into page
   */
  private captureDOM(options: CaptureOptions): any {
    const selector = options.selector || 'body'
    const element = document.querySelector(selector)
    
    if (!element) {
      return null
    }

    const rect = element.getBoundingClientRect()
    const computed = window.getComputedStyle(element)

    // Collect child elements
    const children: any[] = []
    element.querySelectorAll('*').forEach((child, index) => {
      if (index > 100 && !options.fullPage) return // Limit for performance
      
      const childRect = child.getBoundingClientRect()
      const childComputed = window.getComputedStyle(child)
      
      // Skip invisible elements
      if (childRect.width === 0 || childRect.height === 0) return
      if (childComputed.display === 'none') return

      children.push({
        tag: child.tagName,
        className: child.className,
        id: child.id,
        rect: {
          x: childRect.x + window.scrollX,
          y: childRect.y + window.scrollY,
          width: childRect.width,
          height: childRect.height
        },
        styles: {
          backgroundColor: childComputed.backgroundColor,
          color: childComputed.color,
          fontSize: childComputed.fontSize,
          fontFamily: childComputed.fontFamily,
          borderRadius: childComputed.borderRadius,
          border: childComputed.border
        },
        text: child.textContent?.slice(0, 200) || ''
      })
    })

    return {
      tag: element.tagName,
      selector,
      rect: {
        x: rect.x + window.scrollX,
        y: rect.y + window.scrollY,
        width: rect.width,
        height: rect.height
      },
      styles: {
        backgroundColor: computed.backgroundColor,
        color: computed.color
      },
      children,
      title: document.title,
      url: location.href
    }
  }

  /**
   * Convert DOM data to Figma-compatible layers
   */
  private convertToFigmaLayers(domData: any): LayerNode {
    const root: LayerNode = {
      type: 'FRAME',
      name: domData.title || 'Captured Page',
      x: 0,
      y: 0,
      width: domData.rect.width,
      height: domData.rect.height,
      fills: this.parseColor(domData.styles.backgroundColor),
      children: []
    }

    // Convert children
    if (domData.children) {
      root.children = domData.children.map((child: any) => this.elementToLayer(child))
    }

    return root
  }

  /**
   * Convert single element to layer
   */
  private elementToLayer(element: any): LayerNode {
    // Determine type based on element
    const hasText = element.text && element.text.trim().length > 0
    const isImage = element.tag === 'IMG'
    
    const layer: LayerNode = {
      type: hasText ? 'TEXT' : (isImage ? 'RECTANGLE' : 'FRAME'),
      name: element.tag + (element.id ? `#${element.id}` : ''),
      x: element.rect.x,
      y: element.rect.y,
      width: element.rect.width,
      height: element.rect.height,
      fills: this.parseColor(element.styles.backgroundColor)
    }

    // Add text properties
    if (hasText && layer.type === 'TEXT') {
      layer.characters = element.text.trim()
      layer.fontSize = parseInt(element.styles.fontSize) || 16
      layer.fontFamily = element.styles.fontFamily?.split(',')[0]?.replace(/["']/g, '')
    }

    return layer
  }

  /**
   * Parse CSS color to Figma paint
   */
  private parseColor(color: string): any[] {
    if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
      return []
    }

    // Handle rgb/rgba
    const rgbMatch = color.match(/rgba?\(([^)]+)\)/)
    if (rgbMatch) {
      const parts = rgbMatch[1].split(',').map(p => parseFloat(p.trim()))
      return [{
        type: 'SOLID',
        color: {
          r: (parts[0] || 0) / 255,
          g: (parts[1] || 0) / 255,
          b: (parts[2] || 0) / 255
        },
        opacity: parts[3] ?? 1
      }]
    }

    return []
  }

  /**
   * Export layers to clipboard
   */
  async exportToClipboard(layers: LayerNode): Promise<void> {
    const json = JSON.stringify(layers, null, 2)
    await navigator.clipboard.writeText(json)
  }
}

export const captureService = CaptureService.getInstance()

// Convenience functions for quick/deep capture
export async function quickCapture(options: CaptureOptions = {}): Promise<CaptureResult> {
  return captureService.captureCurrentTab({
    ...options,
    fullPage: false,
    agents: { structure: true, style: false, layout: false }
  })
}

export async function deepCapture(options: CaptureOptions = {}): Promise<CaptureResult> {
  return captureService.captureCurrentTab({
    ...options,
    fullPage: true,
    agents: { structure: true, style: true, layout: true }
  })
}

export async function capturePage(options: CaptureOptions = {}): Promise<CaptureResult> {
  return captureService.captureCurrentTab(options)
}
