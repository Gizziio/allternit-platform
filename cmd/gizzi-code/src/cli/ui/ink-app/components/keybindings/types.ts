/**
 * Keybindings types
 * TEMPORARY SHIM
 */

export interface Keybinding {
  key: string
  command: string
  when?: string
}

export type KeybindingAction = string

export interface KeybindingConfig {
  bindings: Keybinding[]
}

// Context names for keybindings
export type KeybindingContextName = 
  | 'global' 
  | 'input' 
  | 'chat' 
  | 'sidebar' 
  | 'modal' 
  | 'terminal'
  | 'editor'
  | 'Global'
  | 'Chat'
  | 'Autocomplete'
  | 'Confirmation'
  | 'Help'
  | 'Transcript'
  | 'HistorySearch'
  | 'Task'
  | 'ThemePicker'
  | 'Settings'
  | 'Tabs'
  | 'Attachments'
  | 'Footer'
  | 'MessageSelector'
  | 'DiffDialog'
  | 'ModelPicker'
  | 'Select'
  | 'Plugin'
  | 'Scroll'
  | 'MessageActions'

// Keybinding block for validation
export interface KeybindingBlock {
  context: KeybindingContextName
  bindings: Record<string, string>
}

// Parsed binding
export interface ParsedBinding {
  keys?: string[]
  command?: string
  context: KeybindingContextName
  when?: string
  action?: string
  args?: unknown[]
  chord?: Chord
  priority?: number
}

// Parsed keystroke
export interface ParsedKeystroke {
  key: string
  modifiers: {
    ctrl?: boolean
    shift?: boolean
    alt?: boolean
    meta?: boolean
  }
  shift?: boolean
  ctrl?: boolean
  alt?: boolean
  meta?: boolean
  super?: boolean
  raw: string
}

// Keybinding match result
export interface KeybindingMatch {
  binding: ParsedBinding
  exact: boolean
  partial: boolean
}

// Chord type for key sequences
export type Chord = ParsedKeystroke[]
