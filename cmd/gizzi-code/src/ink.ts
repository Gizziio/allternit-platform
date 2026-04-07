/**
 * Ink CLI rendering utilities
 * React-based CLI UI components
 */

import type { ReactNode } from 'react'

// Re-export from ink
export {
  render,
  Box,
  Text,
  useInput,
  useApp,
  useStdout,
  useStdin,
  Spacer,
  Newline,
  Static,
  Transform,
  measureElement,
  useFocus,
  useFocusManager,
} from 'ink'

export type { BoxProps, TextProps, RenderOptions } from 'ink'

// Key handling types
export interface Key {
  name?: string
  ctrl?: boolean
  shift?: boolean
  meta?: boolean
  sequence?: string
}

// String width calculation (for text wrapping)
export function stringWidth(str: string): number {
  // Strip ANSI codes and count visible characters
  const withoutAnsi = str.replace(/\u001b\[[0-9;]*m/g, '')
  // Approximate width (for proper implementation, use string-width package)
  return [...withoutAnsi].length
}

// Terminal size hook
export interface TerminalSize {
  width: number
  height: number
}

export function useTerminalSize(): TerminalSize {
  // Default fallback
  return {
    width: process.stdout.columns || 80,
    height: process.stdout.rows || 24,
  }
}

// Color utilities
export type InkColor =
  | 'black'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'magenta'
  | 'cyan'
  | 'white'
  | 'gray'
  | 'grey'
  | 'redBright'
  | 'greenBright'
  | 'yellowBright'
  | 'blueBright'
  | 'magentaBright'
  | 'cyanBright'
  | 'whiteBright'
  | string
  | number
  | undefined

// Common key codes
export const KeyCodes = {
  RETURN: '\r',
  ENTER: '\n',
  TAB: '\t',
  ESC: '\u001b',
  BACKSPACE: '\u007f',
  CTRL_C: '\u0003',
  CTRL_D: '\u0004',
  CTRL_Z: '\u001a',
  UP: '\u001b[A',
  DOWN: '\u001b[B',
  RIGHT: '\u001b[C',
  LEFT: '\u001b[D',
} as const

// Spinner states
export type SpinnerType =
  | 'dots'
  | 'dots2'
  | 'dots3'
  | 'dots4'
  | 'dots5'
  | 'dots6'
  | 'dots7'
  | 'dots8'
  | 'dots9'
  | 'dots10'
  | 'dots11'
  | 'dots12'
  | 'line'
  | 'line2'
  | 'pipe'
  | 'star'
  | 'star2'
  | 'flip'
  | 'hamburger'
  | 'growVertical'
  | 'growHorizontal'
  | 'balloon'
  | 'balloon2'
  | 'noise'
  | 'bounce'
  | 'boxBounce'
  | 'boxBounce2'
  | 'triangle'
  | 'arc'
  | 'circle'
  | 'squareCorners'
  | 'circleQuarters'
  | 'circleHalves'
  | 'squish'
  | 'toggle'
  | 'toggle2'
  | 'toggle3'
  | 'toggle4'
  | 'toggle5'
  | 'toggle6'
  | 'toggle7'
  | 'toggle8'
  | 'toggle9'
  | 'toggle10'
  | 'toggle11'
  | 'toggle12'
  | 'toggle13'

export const SPINNER_FRAMES: Record<SpinnerType, string[]> = {
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  dots2: ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'],
  dots3: ['⠋', '⠙', '⠚', '⠞', '⠖', '⠦', '⠴', '⠲', '⠳', '⠓'],
  dots4: ['⠄', '⠆', '⠇', '⠋', '⠙', '⠸', '⠰', '⠠', '⠰', '⠸', '⠙', '⠋', '⠇', '⠆'],
  dots5: ['⠋', '⠙', '⠚', '⠒', '⠂', '⠂', '⠒', '⠲', '⠴', '⠦', '⠖', '⠒', '⠐', '⠐', '⠒', '⠓', '⠋'],
  dots6: ['⠁', '⠉', '⠙', '⠚', '⠒', '⠂', '⠂', '⠒', '⠲', '⠴', '⠤', '⠄', '⠄', '⠤', '⠴', '⠲', '⠒', '⠂', '⠂', '⠒', '⠚', '⠙', '⠉', '⠁'],
  dots7: ['⠈', '⠉', '⠋', '⠓', '⠒', '⠐', '⠐', '⠒', '⠖', '⠦', '⠤', '⠠', '⠠', '⠤', '⠦', '⠖', '⠒', '⠐', '⠐', '⠒', '⠓', '⠋', '⠉', '⠈'],
  dots8: ['⠁', '⠁', '⠉', '⠙', '⠚', '⠒', '⠂', '⠂', '⠒', '⠲', '⠴', '⠤', '⠄', '⠄', '⠤', '⠠', '⠠', '⠤', '⠦', '⠖', '⠒', '⠐', '⠐', '⠒', '⠓', '⠋', '⠉', '⠈', '⠈'],
  dots9: ['⢹', '⢺', '⢼', '⣸', '⣇', '⡧', '⡗', '⡏'],
  dots10: ['⢄', '⢂', '⢁', '⡁', '⡈', '⡐', '⡠'],
  dots11: ['⠁', '⠂', '⠄', '⡀', '⢀', '⠠', '⠐', '⠈'],
  dots12: ['⢀⠀', '⡀⠀', '⠄⠀', '⢂⠀', '⡂⠀', '⠅⠀', '⢃⠀', '⡃⠀', '⠍⠀', '⢋⠀', '⡋⠀', '⠍⠁', '⢋⠁', '⡋⠁', '⠍⠉', '⢋⠉', '⡋⠉', '⠍⠙', '⢋⠙', '⡋⠙', '⠍⠚', '⢋⠚', '⡋⠚', '⠍⠒', '⢋⠒', '⡋⠒', '⠍⠂', '⢋⠂', '⡋⠂', '⠍⡀', '⢋⡀', '⡋⡀', '⠍⡄', '⢋⡄', '⡋⡄', '⠍⡆', '⢋⡆', '⡋⡆', '⠍⡇', '⢋⡇', '⡋⡇', '⠍⡏', '⢋⡏', '⡋⡏', '⠍⡹', '⢋⡹', '⡋⡹', '⠍⢹', '⢋⢹', '⡋⢹', '⠍⣸', '⢋⣸', '⡋⣸', '⠍⣴', '⢋⣴', '⡋⣴', '⠍⣦', '⢋⣦', '⡋⣦', '⠍⣇', '⢋⣇', '⡋⣇', '⠍⡧', '⢋⡧', '⡋⡧', '⠍⡗', '⢋⡗', '⡋⡗', '⠍⡏'],
  line: ['-', '\\', '|', '/'],
  line2: ['⠂', '-', '–', '—', '–', '-'],
  pipe: ['┤', '┘', '┴', '└', '├', '┌', '┬', '┐'],
  star: ['✶', '✸', '✹', '✺', '✹', '✷'],
  star2: ['+', 'x', '*'],
  flip: ['_', '_', '_', '-', '`', '`', "'", '´', '-', '_', '_', '_'],
  hamburger: ['☱', '☲', '☴'],
  growVertical: ['▁', '▃', '▄', '▅', '▆', '▇', '▆', '▅', '▄', '▃'],
  growHorizontal: ['▏', '▎', '▍', '▌', '▋', '▊', '▉', '▊', '▋', '▌', '▍', '▎'],
  balloon: ['.', 'o', 'O', '@', '*'],
  balloon2: ['.', 'o', 'O', '°', 'O', 'o', '.'],
  noise: ['▓', '▒', '░'],
  bounce: ['⠁', '⠂', '⠄', '⠂'],
  boxBounce: ['▖', '▘', '▝', '▗'],
  boxBounce2: ['▌', '▀', '▐', '▄'],
  triangle: ['◢', '◣', '◤', '◥'],
  arc: ['◜', '◠', '◝', '◞', '◡', '◟'],
  circle: ['◡', '⊙', '◠'],
  squareCorners: ['◰', '◳', '◲', '◱'],
  circleQuarters: ['◴', '◷', '◶', '◵'],
  circleHalves: ['◐', '◓', '◑', '◒'],
  squish: ['╫', '╪'],
  toggle: ['⊶', '⊷'],
  toggle2: ['▫', '▪'],
  toggle3: ['□', '■'],
  toggle4: ['■', '□', '▪', '▫'],
  toggle5: ['▮', '▯'],
  toggle6: ['ဝ', '၀'],
  toggle7: ['⦾', '⦿'],
  toggle8: ['◍', '◌'],
  toggle9: ['◉', '◎'],
  toggle10: ['㊂', '㊀', '㊁'],
  toggle11: ['⬇', '⬆'],
  toggle12: ['▹', '▿', '◃'],
  toggle13: ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█', '▉', '▊', '▋', '▌', '▍', '▎', '▏', '▎', '▍', '▌', '▋', '▊', '▉', '█', '▇', '▆', '▅', '▄', '▃', '▂', '▁'],
}

// Default export
export default {
  stringWidth,
  useTerminalSize,
  KeyCodes,
  SPINNER_FRAMES,
}
