/**
 * Status line types
 */

export interface StatusLineState {
  text: string
  type: 'info' | 'warning' | 'error' | 'success'
  timeout?: number
}
export interface StatusLineCommandInput {
  command: string
  args: string[]
  context?: Record<string, unknown>
  }
