/**
 * ANSI Control Characters and Escape Sequence Introducers
 *
 * Based on ECMA-48 / ANSI X3.64 standards.
 */

/**
 * C0 (7-bit) control characters
 */
export const C0 = {
  NUL: 0x00,
  SOH: 0x01,
  STX: 0x02,
  ETX: 0x03,
  EOT: 0x04,
  ENQ: 0x05,
  ACK: 0x06,
  BEL: 0x07,
  BS: 0x08,
  HT: 0x09,
  LF: 0x0a,
  VT: 0x0b,
  FF: 0x0c,
  CR: 0x0d,
  SO: 0x0e,
  SI: 0x0f,
  DLE: 0x10,
  DC1: 0x11,
  DC2: 0x12,
  DC3: 0x13,
  DC4: 0x14,
  NAK: 0x15,
  SYN: 0x16,
  ETB: 0x17,
  CAN: 0x18,
  EM: 0x19,
  SUB: 0x1a,
  ESC: 0x1b,
  FS: 0x1c,
  GS: 0x1d,
  RS: 0x1e,
  US: 0x1f,
  DEL: 0x7f,
} as const

// String constants for output generation
export const ESC = '\x1b'
export const BEL = '\x07'
export const SEP = ';'

/**
 * Escape sequence type introducers (byte after ESC)
 */
export const ESC_TYPE = {
  CSI: 0x5b, // [ - Control Sequence Introducer
  OSC: 0x5d, // ] - Operating System Command
  DCS: 0x50, // P - Device Control String
  APC: 0x5f, // _ - Application Program Command
  PM: 0x5e, // ^ - Privacy Message
  SOS: 0x58, // X - Start of String
  ST: 0x5c, // \ - String Terminator
} as const

/** Check if a byte is a C0 control character */
export function isC0(byte: number): boolean {
  return byte < 0x20 || byte === 0x7f
}

/**
 * Check if a byte is an ESC sequence final byte (0-9, :, ;, <, =, >, ?, @ through ~)
 * ESC sequences have a wider final byte range than CSI
 */
export function isEscFinal(byte: number): boolean {
  return byte >= 0x30 && byte <= 0x7e
}

// ANSI color/style codes for terminal output
export interface AnsiCode {
  type: 'ansi' | 'color' | 'style'
  code: string
  endCode?: string
}

// Simple ANSI code names (for backwards compatibility)
export type AnsiCodeName = 
  | 'reset' 
  | 'bold' 
  | 'dim' 
  | 'italic' 
  | 'underline' 
  | 'strikethrough'
  | 'black' 
  | 'red' 
  | 'green' 
  | 'yellow' 
  | 'blue' 
  | 'magenta' 
  | 'cyan' 
  | 'white'
  | 'gray'
  | 'bgBlack' 
  | 'bgRed' 
  | 'bgGreen' 
  | 'bgYellow' 
  | 'bgBlue' 
  | 'bgMagenta' 
  | 'bgCyan' 
  | 'bgWhite'
  | 'brightRed'
  | 'brightGreen'
  | 'brightYellow'
  | 'brightBlue'
  | 'brightMagenta'
  | 'brightCyan'
  | 'brightWhite'

// ANSI code to escape sequence mapping
const ansiCodeMap: Record<AnsiCodeName, string> = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  strikethrough: '\x1b[9m',
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
}

/**
 * Convert ANSI code names to escape sequences
 */
export function ansiCodesToString(codes: AnsiCodeName[]): string {
  return codes.map(code => ansiCodeMap[code] || '').join('')
}
