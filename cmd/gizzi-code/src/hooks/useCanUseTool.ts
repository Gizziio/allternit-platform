/**
 * useCanUseTool Hook
 */

import type { Tool } from '../cli/ui/ink-app/Tool.js'

export type CanUseToolFn = (tool: Tool) => boolean

export function useCanUseTool(): CanUseToolFn {
  return () => true
}
