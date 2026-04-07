/**
 * SDK Runtime Types
 */

export interface RuntimeConfig {
  version: string
  environment: 'development' | 'production' | 'test'
  debug?: boolean
}

export interface RuntimeState {
  initialized: boolean
  sessionId?: string
  lastActivity?: number
}

export type RuntimeEvent = 
  | { type: 'init'; config: RuntimeConfig }
  | { type: 'shutdown'; reason: string }
  | { type: 'error'; error: Error }
