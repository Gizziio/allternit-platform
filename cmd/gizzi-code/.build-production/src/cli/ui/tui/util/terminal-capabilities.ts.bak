/**
 * Terminal Capability Detection
 * 
 * Detects terminal graphics capabilities:
 * - Kitty graphics protocol
 * - iTerm2 inline images
 * - Sixel support
 * - True color (RGB)
 * - Unicode support
 * 
 * Usage:
 * const caps = detectTerminalCapabilities()
 * if (caps.kittyGraphics) { /* use kitty protocol * / }
 */

import { createSignal, createMemo } from "solid-js"

export interface TerminalCapabilities {
  kittyGraphics: boolean
  iterm2Inline: boolean
  sixel: boolean
  trueColor: boolean
  unicode: boolean
  mouseSupport: boolean
  name: string
  bestImageMethod: "kitty" | "iterm2" | "sixel" | "ascii" | "browser"
}

let cachedCapabilities: TerminalCapabilities | null = null

export function detectTerminalCapabilities(): TerminalCapabilities {
  // Return cached if available
  if (cachedCapabilities) {
    return cachedCapabilities
  }
  
  // Detect terminal from environment variables
  const term = process.env.TERM || ""
  const termProgram = process.env.TERM_PROGRAM || ""
  const colorterm = process.env.COLORTERM || ""
  
  // Start with defaults
  const caps: TerminalCapabilities = {
    kittyGraphics: false,
    iterm2Inline: false,
    sixel: false,
    trueColor: false,
    unicode: true, // Assume modern terminal
    mouseSupport: true, // Assume modern terminal
    name: term || "unknown",
    bestImageMethod: "browser" as const,
  }
  
  // Detect Kitty terminal
  if (termProgram === "kitty" || term.includes("kitty")) {
    caps.kittyGraphics = true
    caps.trueColor = true
    caps.bestImageMethod = "kitty"
  }
  
  // Detect iTerm2
  if (termProgram === "iTerm2" || termProgram === "Apple_Terminal") {
    if (termProgram === "iTerm2") {
      caps.iterm2Inline = true
      caps.trueColor = true
      caps.bestImageMethod = "iterm2"
    } else {
      // Apple Terminal.app - no inline images
      caps.bestImageMethod = "browser"
    }
  }
  
  // Detect Sixel support (Linux terminals)
  if (term.includes("sixel") || process.env.SIXEL_SUPPORT === "1") {
    caps.sixel = true
    caps.bestImageMethod = caps.bestImageMethod === "browser" ? "sixel" : caps.bestImageMethod
  }
  
  // Detect true color support
  if (colorterm === "truecolor" || colorterm === "24bit") {
    caps.trueColor = true
  }
  
  // Check for Windows Terminal
  if (process.env.WT_SESSION || termProgram === "WindowsTerminal") {
    caps.trueColor = true
    caps.unicode = true
    caps.mouseSupport = true
    // Windows Terminal doesn't support kitty/sixel yet
    caps.bestImageMethod = "browser"
  }
  
  // Cache and return
  cachedCapabilities = caps
  
  console.log("Terminal capabilities detected:", caps)
  return caps
}

// Reactive hook for terminal capabilities
export function useTerminalCapabilities() {
  const [caps, setCaps] = createSignal<TerminalCapabilities>(detectTerminalCapabilities())
  
  // Re-detect on mount (in case env changes)
  // In full implementation, could listen for terminal change events
  return createMemo(() => caps())
}

// Helper to check if terminal supports a specific feature
export function supportsFeature(feature: "kitty-graphics" | "iterm2-images" | "sixel" | "true-color") {
  const caps = detectTerminalCapabilities()
  
  switch (feature) {
    case "kitty-graphics":
      return caps.kittyGraphics
    case "iterm2-images":
      return caps.iterm2Inline
    case "sixel":
      return caps.sixel
    case "true-color":
      return caps.trueColor
    default:
      return false
  }
}

// Get best image display method for current terminal
export function getBestImageMethod(): "kitty" | "iterm2" | "sixel" | "ascii" | "browser" {
  const caps = detectTerminalCapabilities()
  return caps.bestImageMethod
}
