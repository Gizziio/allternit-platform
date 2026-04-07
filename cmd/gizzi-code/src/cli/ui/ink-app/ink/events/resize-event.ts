/**
 * Resize event stub
 */

export interface ResizeEvent {
  type: 'resize'
  width: number
  height: number
}
export function createResizeEvent(_width: number, _height: number): ResizeEvent {
  return { type: 'resize', width: 80, height: 24 }
  }
