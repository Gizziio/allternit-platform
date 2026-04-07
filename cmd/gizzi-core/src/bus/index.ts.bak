/**
 * GIZZI Bus Event System
 * 
 * Central event bus for decoupled communication between components.
 * Provides publish/subscribe pattern with type safety.
 * 
 * Usage:
 *   const MyEvent = BusEvent.define("my.event", z.object({ id: z.string() }))
 *   Bus.subscribe(MyEvent, (event) => console.log(event.properties.id))
 *   Bus.publish(MyEvent, { id: "123" })
 */

import { BusEvent, type BusSubscription } from "./types"

export namespace Bus {
  // In-memory subscription store
  const subscriptions = new Map<string, BusSubscription[]>()

  /**
   * Publish an event to all subscribers
   */
  export async function publish<Definition extends BusEvent.Definition>(
    def: Definition,
    properties: unknown
  ): Promise<void> {
    const payload = {
      type: def.type,
      properties,
    }

    // Notify specific subscribers
    const specificSubs = subscriptions.get(def.type) ?? []
    // Notify wildcard subscribers
    const wildcardSubs = subscriptions.get("*") ?? []
    
    const allSubs = [...specificSubs, ...wildcardSubs]
    
    // Execute all subscriptions concurrently
    await Promise.all(
      allSubs.map(async (sub) => {
        try {
          await sub(payload)
        } catch (error) {
          console.error(`Bus error in subscriber for ${def.type}:`, error)
        }
      })
    )
  }

  /**
   * Subscribe to a specific event type
   * Returns unsubscribe function
   */
  export function subscribe<Definition extends BusEvent.Definition>(
    def: Definition,
    callback: (event: { type: Definition["type"]; properties: unknown }) => void | Promise<void>
  ): () => void {
    const subs = subscriptions.get(def.type) ?? []
    subs.push(callback as BusSubscription)
    subscriptions.set(def.type, subs)

    // Return unsubscribe function
    return () => {
      const currentSubs = subscriptions.get(def.type) ?? []
      const index = currentSubs.indexOf(callback as BusSubscription)
      if (index !== -1) {
        currentSubs.splice(index, 1)
      }
    }
  }

  /**
   * Subscribe to a single event occurrence
   * Automatically unsubscribes after first event
   */
  export function once<Definition extends BusEvent.Definition>(
    def: Definition,
    callback: (event: { type: Definition["type"]; properties: unknown }) => void | Promise<void>
  ): void {
    const unsubscribe = subscribe(def, async (event) => {
      unsubscribe()
      await callback(event)
    })
  }

  /**
   * Subscribe to all events (wildcard)
   * Returns unsubscribe function
   */
  export function subscribeAll(
    callback: (event: { type: string; properties: unknown }) => void | Promise<void>
  ): () => void {
    const subs = subscriptions.get("*") ?? []
    subs.push(callback as BusSubscription)
    subscriptions.set("*", subs)

    // Return unsubscribe function
    return () => {
      const currentSubs = subscriptions.get("*") ?? []
      const index = currentSubs.indexOf(callback as BusSubscription)
      if (index !== -1) {
        currentSubs.splice(index, 1)
      }
    }
  }

  /**
   * Get current subscription count (for debugging)
   */
  export function stats(): { eventTypes: number; totalSubscriptions: number } {
    let total = 0
    for (const subs of subscriptions.values()) {
      total += subs.length
    }
    return {
      eventTypes: subscriptions.size,
      totalSubscriptions: total,
    }
  }

  /**
   * Clear all subscriptions (for testing)
   */
  export function clear(): void {
    subscriptions.clear()
  }
}

export { BusEvent }

// Re-export events
export {
  WorkspaceInitialized,
  WorkspaceUpdated,
  SessionStarted,
  SessionEnded,
  SessionForked,
  VerificationStarted,
  VerificationCompleted,
  ToolExecuted,
  ContextLoaded,
  ContextModified,
} from "./events"
