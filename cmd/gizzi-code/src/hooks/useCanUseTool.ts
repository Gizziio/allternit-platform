/**
 * useCanUseTool Hook
 */

import type { Tool } from '../runtime/tools/Tool.js'

export type CanUseToolFn = (tool: Tool) => boolean

export function useCanUseTool(): CanUseToolFn {
  return () => true
}
