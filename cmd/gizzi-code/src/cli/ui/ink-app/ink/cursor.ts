/**
 * Cursor stub
 */

export interface Cursor {
  x: number
  y: number
}
export function createCursor(_x: number, _y: number): Cursor {
  return { x: 0, y: 0 }
  }
