/**
 * Bus Event Types
 * 
 * Type definitions for the GIZZI event bus system.
 */

import type { ZodType } from "zod"

export namespace BusEvent {
  export type Definition = {
    type: string
    properties: ZodType
  }

  export function define<Type extends string, Properties extends ZodType>(
    type: Type,
    properties: Properties
  ) {
    return {
      type,
      properties,
    }
  }
}

export type BusSubscription<T = unknown> = (event: T) => void | Promise<void>

export interface BusState {
  subscriptions: Map<string, BusSubscription[]>
}
