/**
 * HTML to Figma Integration for A2R Extension
 * Types and interfaces for the capture system
 */

export interface CaptureOptions {
  selector?: string
  fullPage?: boolean
  waitFor?: number
  includeAssets?: boolean
  agents?: {
    structure?: boolean
    style?: boolean
    layout?: boolean
  }
}

export interface CaptureResult {
  success: boolean
  layers?: LayerNode
  error?: string
  duration: number
  url: string
  timestamp: number
}

export interface LayerNode {
  type: 'FRAME' | 'GROUP' | 'RECTANGLE' | 'TEXT' | 'SVG' | 'COMPONENT'
  name?: string
  x?: number
  y?: number
  width?: number
  height?: number
  fills?: Paint[]
  strokes?: Paint[]
  effects?: Effect[]
  children?: LayerNode[]
  [key: string]: any
}

export interface Paint {
  type: 'SOLID' | 'IMAGE' | 'GRADIENT'
  color?: Color
  opacity?: number
}

export interface Color {
  r: number
  g: number
  b: number
  a?: number
}

export interface Effect {
  type: 'DROP_SHADOW' | 'INNER_SHADOW'
  color: Color
  offset: { x: number; y: number }
  radius: number
}

export interface AgentResult {
  layer: LayerNode
  modifications: Modification[]
  warnings: string[]
}

export interface Modification {
  type: 'remove' | 'merge' | 'transform' | 'optimize'
  target: string
  description: string
}

export interface CleanupContext {
  originalUrl: string
  captureTimestamp: number
}
