/**
 * Event Bus System
 * Central event management for the runtime
 */

import { Log } from './bus-event.js'

export interface BusEvent {
  type: string
  payload?: unknown
  timestamp: number
  source?: string
}

export type BusHandler = (event: BusEvent) => void | Promise<void>

export interface BusOptions {
  maxListeners?: number
  debug?: boolean
}

export class Bus {
  private handlers = new Map<string, Set<BusHandler>>()
  private options: Required<BusOptions>
  private log = Log.create({ service: 'bus' })

  constructor(options: BusOptions = {}) {
    this.options = {
      maxListeners: 100,
      debug: false,
      ...options,
    }
  }

  on(event: string, handler: BusHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    
    const handlers = this.handlers.get(event)!
    
    if (handlers.size >= this.options.maxListeners) {
      this.log.warn(`Max listeners (${this.options.maxListeners}) reached for event: ${event}`)
    }
    
    handlers.add(handler)
    
    if (this.options.debug) {
      this.log.debug(`Registered handler for: ${event}`)
    }
    
    return () => this.off(event, handler)
  }

  off(event: string, handler: BusHandler): void {
    const handlers = this.handlers.get(event)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.handlers.delete(event)
      }
      
      if (this.options.debug) {
        this.log.debug(`Unregistered handler for: ${event}`)
      }
    }
  }

  emit(event: string, payload?: unknown): void {
    const busEvent: BusEvent = {
      type: event,
      payload,
      timestamp: Date.now(),
    }
    
    const handlers = this.handlers.get(event)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          const result = handler(busEvent)
          if (result instanceof Promise) {
            result.catch(err => {
              this.log.error(`Async handler error for ${event}:`, err)
            })
          }
        } catch (err) {
          this.log.error(`Handler error for ${event}:`, err)
        }
      })
    }
    
    // Emit to wildcard handlers
    const wildcardHandlers = this.handlers.get('*')
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => {
        try {
          handler(busEvent)
        } catch (err) {
          this.log.error(`Wildcard handler error:`, err)
        }
      })
    }
    
    if (this.options.debug) {
      this.log.debug(`Emitted: ${event}`, payload)
    }
  }

  once(event: string, handler: BusHandler): () => void {
    const wrappedHandler = (e: BusEvent) => {
      this.off(event, wrappedHandler)
      handler(e)
    }
    return this.on(event, wrappedHandler)
  }

  clear(event?: string): void {
    if (event) {
      this.handlers.delete(event)
    } else {
      this.handlers.clear()
    }
    
    if (this.options.debug) {
      this.log.debug(`Cleared handlers${event ? ` for: ${event}` : ''}`)
    }
  }

  listenerCount(event: string): number {
    return this.handlers.get(event)?.size || 0
  }

  eventNames(): string[] {
    return Array.from(this.handlers.keys())
  }
}

// Global bus instance
export const GlobalBus = new Bus({ debug: false })

// Convenience functions
export function onGlobal(event: string, handler: BusHandler): () => void {
  return GlobalBus.on(event, handler)
}

export function offGlobal(event: string, handler: BusHandler): void {
  GlobalBus.off(event, handler)
}

export function emitGlobal(event: string, payload?: unknown): void {
  GlobalBus.emit(event, payload)
}

export function onceGlobal(event: string, handler: BusHandler): () => void {
  return GlobalBus.once(event, handler)
}

// Namespace helper
export function createNamespace(namespace: string): {
  on: (event: string, handler: BusHandler) => () => void
  off: (event: string, handler: BusHandler) => void
  emit: (event: string, payload?: unknown) => void
  once: (event: string, handler: BusHandler) => () => void
} {
  return {
    on: (event, handler) => GlobalBus.on(`${namespace}:${event}`, handler),
    off: (event, handler) => GlobalBus.off(`${namespace}:${event}`, handler),
    emit: (event, payload) => GlobalBus.emit(`${namespace}:${event}`, payload),
    once: (event, handler) => GlobalBus.once(`${namespace}:${event}`, handler),
  }
}

export default {
  Bus,
  GlobalBus,
  onGlobal,
  offGlobal,
  emitGlobal,
  onceGlobal,
  createNamespace,
}
