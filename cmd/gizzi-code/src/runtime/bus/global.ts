/**
 * Global Bus Instance
 * Pre-configured singleton for application-wide events
 */

import { Bus, GlobalBus, onGlobal, offGlobal, emitGlobal, onceGlobal } from './bus.js'
import type { BusEvent, BusHandler } from './bus-event.js'

// Re-export everything from bus
export { Bus, GlobalBus, onGlobal, offGlobal, emitGlobal, onceGlobal }
export type { BusEvent, BusHandler }

// Additional global utilities

/**
 * Wait for a specific event to be emitted
 */
export function waitForGlobal(event: string, timeout?: number): Promise<BusEvent> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    
    const cleanup = onceGlobal(event, (e) => {
      if (timer) clearTimeout(timer)
      resolve(e)
    })
    
    if (timeout) {
      timer = setTimeout(() => {
        cleanup()
        reject(new Error(`Timeout waiting for event: ${event}`))
      }, timeout)
    }
  })
}

/**
 * Check if there are listeners for an event
 */
export function hasGlobalListeners(event: string): boolean {
  return GlobalBus.listenerCount(event) > 0
}

/**
 * Get the number of listeners for an event
 */
export function globalListenerCount(event: string): number {
  return GlobalBus.listenerCount(event)
}

/**
 * Clear all global event handlers
 */
export function clearGlobalBus(event?: string): void {
  GlobalBus.clear(event)
}

/**
 * Create a namespaced event bus
 */
export function createNamespace(namespace: string) {
  return {
    on: (event: string, handler: BusHandler) => 
      onGlobal(`${namespace}:${event}`, handler),
    off: (event: string, handler: BusHandler) => 
      offGlobal(`${namespace}:${event}`, handler),
    emit: (event: string, payload?: unknown) => 
      emitGlobal(`${namespace}:${event}`, payload),
    once: (event: string, handler: BusHandler) => 
      onceGlobal(`${namespace}:${event}`, handler),
  }
}

// Common namespaces
export const AppBus = createNamespace('app')
export const CommandBus = createNamespace('command')
export const ToolBus = createNamespace('tool')
export const UiBus = createNamespace('ui')

export default {
  Bus,
  GlobalBus,
  onGlobal,
  offGlobal,
  emitGlobal,
  onceGlobal,
  waitForGlobal,
  hasGlobalListeners,
  globalListenerCount,
  clearGlobalBus,
  createNamespace,
  AppBus,
  CommandBus,
  ToolBus,
  UiBus,
}
