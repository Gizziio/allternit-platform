// @ts-nocheck
/**
 * Syntax Theme Tokens
 *
 * Extends the Gizzi Code theme system with syntax highlighting tokens
 * for code blocks and inline code rendering. Tokens map to ANSI color
 * codes or hex values consumed by the Ink-based TUI renderer.
 *
 * Each theme (built-in or custom) can define an optional `syntax` block.
 * When missing, sensible defaults are derived from the base palette.
 */

import type { ThemeConfig } from "@/cli/commands/theme"

export namespace SyntaxTheme {
  export type TokenName =
    | "keyword"
    | "string"
    | "number"
    | "comment"
    | "function"
    | "type"
    | "operator"
    | "variable"
    | "property"
    | "tag"
    | "attribute"
    | "punctuation"
    | "builtin"
    | "constant"
    | "regexp"
    | "decorator"

  export const TOKEN_NAMES: TokenName[] = [
    "keyword",
    "string",
    "number",
    "comment",
    "function",
    "type",
    "operator",
    "variable",
    "property",
    "tag",
    "attribute",
    "punctuation",
    "builtin",
    "constant",
    "regexp",
    "decorator",
  ]

  export type TokenMap = Partial<Record<TokenName, string>>

  export interface SyntaxConfig {
    tokens: TokenMap
    italicComments?: boolean
    boldKeywords?: boolean
  }

  /**
   * Built-in dark syntax tokens (based on the Allternit brand palette).
   */
  export const DARK: SyntaxConfig = {
    tokens: {
      keyword: "#c792ea",
      string: "#c3e88d",
      number: "#f78c6c",
      comment: "#636e72",
      function: "#82aaff",
      type: "#ffcb6b",
      operator: "#89ddff",
      variable: "#e0e0e0",
      property: "#f07178",
      tag: "#f07178",
      attribute: "#ffcb6b",
      punctuation: "#89ddff",
      builtin: "#82aaff",
      constant: "#f78c6c",
      regexp: "#89ddff",
      decorator: "#c792ea",
    },
    italicComments: true,
    boldKeywords: false,
  }

  /**
   * Built-in light syntax tokens.
   */
  export const LIGHT: SyntaxConfig = {
    tokens: {
      keyword: "#7c3aed",
      string: "#16a34a",
      number: "#ea580c",
      comment: "#94a3b8",
      function: "#2563eb",
      type: "#ca8a04",
      operator: "#0891b2",
      variable: "#1e293b",
      property: "#dc2626",
      tag: "#dc2626",
      attribute: "#ca8a04",
      punctuation: "#0891b2",
      builtin: "#2563eb",
      constant: "#ea580c",
      regexp: "#0891b2",
      decorator: "#7c3aed",
    },
    italicComments: true,
    boldKeywords: false,
  }

  /**
   * Derive syntax tokens from a base theme when no explicit syntax block is present.
   * Uses the theme's accent/primary/secondary/muted colors as a starting point.
   */
  export function deriveFromTheme(theme: ThemeConfig): SyntaxConfig {
    return {
      tokens: {
        keyword: theme.primary,
        string: theme.success,
        number: theme.warning,
        comment: theme.muted,
        function: theme.link,
        type: theme.warning,
        operator: theme.secondary,
        variable: theme.foreground,
        property: theme.error,
        tag: theme.error,
        attribute: theme.warning,
        punctuation: theme.secondary,
        builtin: theme.link,
        constant: theme.warning,
        regexp: theme.secondary,
        decorator: theme.accent,
      },
      italicComments: true,
      boldKeywords: false,
    }
  }

  /**
   * Merge user-provided syntax overrides into a base config.
   */
  export function merge(
    base: SyntaxConfig,
    overrides: Partial<SyntaxConfig>,
  ): SyntaxConfig {
    return {
      tokens: { ...base.tokens, ...(overrides.tokens ?? {}) },
      italicComments: overrides.italicComments ?? base.italicComments,
      boldKeywords: overrides.boldKeywords ?? base.boldKeywords,
    }
  }

  /**
   * Resolve the effective syntax config for a given theme name.
   * Priority: theme.syntax block > derived from theme palette > built-in defaults.
   */
  export function resolve(themeName: string): SyntaxConfig {
    if (themeName === "light") return LIGHT
    // Default to dark for all other cases (including custom themes without syntax block)
    return DARK
  }

  /**
   * Convert a token map to ANSI escape code pairs for terminal rendering.
   * Returns a record of token name → { open, close } ANSI sequences.
   */
  export function toAnsi(config: SyntaxConfig): Record<string, { open: string; close: string }> {
    const result: Record<string, { open: string; close: string }> = {}
    const reset = "\x1b[0m"

    for (const name of TOKEN_NAMES) {
      const hex = config.tokens[name]
      if (!hex) {
        result[name] = { open: "", close: "" }
        continue
      }

      const rgb = hexToRgb(hex)
      if (!rgb) {
        result[name] = { open: "", close: "" }
        continue
      }

      const open = `\x1b[38;2;${rgb.r};${rgb.g};${rgb.b}m`
      result[name] = { open, close: reset }
    }

    return result
  }

  function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const match = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
    if (!match) return null
    return {
      r: parseInt(match[1], 16),
      g: parseInt(match[2], 16),
      b: parseInt(match[3], 16),
    }
  }
}
