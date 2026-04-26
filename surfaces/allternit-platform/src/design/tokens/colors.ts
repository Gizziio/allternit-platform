/**
 * @fileoverview Semantic Color Token System
 * 
 * Comprehensive color tokens for the allternit platform.
 * Supports light and dark modes through CSS variable mapping.
 * 
 * @module design/tokens/colors
 * @version 1.0.0
 */

/**
 * Brand color scale
 * Primary brand identity colors with full 50-950 scale
 */
export const brand = {
  /** Lightest brand tint - used for subtle backgrounds */
  50: '#f0f9ff',
  /** Very light brand tint */
  100: '#e0f2fe',
  /** Light brand tint - hover states */
  200: '#bae6fd',
  /** Light-mid brand tint */
  300: '#7dd3fc',
  /** Mid brand tint */
  400: '#38bdf8',
  /** Primary brand color - DEFAULT */
  500: '#0ea5e9',
  /** Mid-dark brand shade */
  600: '#0284c7',
  /** Dark brand shade - active states */
  700: '#0369a1',
  /** Very dark brand shade */
  800: '#075985',
  /** Darkest brand shade */
  900: '#0c4a6e',
  /** Deepest brand shade */
  950: '#082f49',
  /** Default brand color reference */
  DEFAULT: '#0ea5e9',
  /** Light variant for dark backgrounds */
  light: '#38bdf8',
  /** Dark variant for light backgrounds */
  dark: '#0284c7',
} as const;

/**
 * Secondary brand color scale
 * Complementary brand colors
 */
export const secondary = {
  50: '#fdf4ff',
  100: '#fae8ff',
  200: '#f5d0fe',
  300: '#f0abfc',
  400: '#e879f9',
  500: '#d946ef',
  600: '#c026d3',
  700: '#a21caf',
  800: '#86198f',
  900: '#701a75',
  950: '#4a044e',
  DEFAULT: '#d946ef',
  light: '#e879f9',
  dark: '#c026d3',
} as const;

/**
 * Accent color scale
 * Highlight and emphasis colors
 */
export const accent = {
  50: '#fff7ed',
  100: '#ffedd5',
  200: '#fed7aa',
  300: '#fdba74',
  400: '#fb923c',
  500: '#f97316',
  600: '#ea580c',
  700: '#c2410c',
  800: '#9a3412',
  900: '#7c2d12',
  950: '#431407',
  DEFAULT: '#f97316',
  light: '#fb923c',
  dark: '#ea580c',
} as const;

/**
 * Semantic success colors
 * Positive actions, confirmations, success states
 */
export const success = {
  /** Light mode success color */
  light: '#22c55e',
  /** Dark mode success color - slightly brighter for visibility */
  dark: '#4ade80',
  /** Success color scale 50-950 */
  50: '#f0fdf4',
  100: '#dcfce7',
  200: '#bbf7d0',
  300: '#86efac',
  400: '#4ade80',
  500: '#22c55e',
  600: '#16a34a',
  700: '#15803d',
  800: '#166534',
  900: '#14532d',
  950: '#052e16',
  DEFAULT: '#22c55e',
} as const;

/**
 * Semantic warning colors
 * Cautionary states, alerts requiring attention
 */
export const warning = {
  /** Light mode warning color */
  light: '#f59e0b',
  /** Dark mode warning color */
  dark: '#fbbf24',
  /** Warning color scale 50-950 */
  50: '#fffbeb',
  100: '#fef3c7',
  200: '#fde68a',
  300: '#fcd34d',
  400: '#fbbf24',
  500: '#f59e0b',
  600: '#d97706',
  700: '#b45309',
  800: '#92400e',
  900: '#78350f',
  950: '#451a03',
  DEFAULT: '#f59e0b',
} as const;

/**
 * Semantic danger/error colors
 * Errors, destructive actions, critical alerts
 */
export const danger = {
  /** Light mode danger color */
  light: '#ef4444',
  /** Dark mode danger color */
  dark: '#f87171',
  /** Danger color scale 50-950 */
  50: '#fef2f2',
  100: '#fee2e2',
  200: '#fecaca',
  300: '#fca5a5',
  400: '#f87171',
  500: '#ef4444',
  600: '#dc2626',
  700: '#b91c1c',
  800: '#991b1b',
  900: '#7f1d1d',
  950: '#450a0a',
  DEFAULT: '#ef4444',
} as const;

/**
 * Semantic info colors
 * Informational states, neutral alerts
 */
export const info = {
  /** Light mode info color */
  light: '#3b82f6',
  /** Dark mode info color */
  dark: '#60a5fa',
  /** Info color scale 50-950 */
  50: '#eff6ff',
  100: '#dbeafe',
  200: '#bfdbfe',
  300: '#93c5fd',
  400: '#60a5fa',
  500: '#3b82f6',
  600: '#2563eb',
  700: '#1d4ed8',
  800: '#1e40af',
  900: '#1e3a8a',
  950: '#172554',
  DEFAULT: '#3b82f6',
} as const;

/**
 * Neutral gray scale
 * Complete 50-950 scale for all UI grayscale needs
 */
export const neutral = {
  /** Near-white - page backgrounds */
  50: '#f8fafc',
  /** Very light - card backgrounds */
  100: '#f1f5f9',
  /** Light - borders, dividers */
  200: '#e2e8f0',
  /** Light-mid - disabled states */
  300: '#cbd5e1',
  /** Mid - placeholder text */
  400: '#94a3b8',
  /** Base gray - icons */
  500: '#64748b',
  /** Mid-dark - secondary text */
  600: '#475569',
  /** Dark - primary text light mode */
  700: '#334155',
  /** Very dark - headings light mode */
  800: '#1e293b',
  /** Deepest - near black */
  900: '#0f172a',
  /** Deepest gray - black equivalent */
  950: '#020617',
} as const;

/**
 * Surface colors
 * Background and container colors with CSS variable mapping
 */
export const surface = {
  /** Primary page background */
  primary: {
    light: '#ffffff',
    dark: '#0a0a0a',
    /** CSS variable reference */
    var: 'var(--bg-primary)',
  },
  /** Secondary/elevated surface */
  secondary: {
    light: '#f8fafc',
    dark: '#141414',
    var: 'var(--bg-secondary)',
  },
  /** Tertiary surface - inputs, cards */
  tertiary: {
    light: '#f1f5f9',
    dark: '#1a1a1a',
    var: 'var(--bg-tertiary)',
  },
  /** Elevated surface - popovers, modals */
  elevated: {
    light: '#ffffff',
    dark: '#1e1e1e',
    var: 'var(--bg-elevated)',
  },
  /** Overlay - backdrops, scrims */
  overlay: {
    light: 'rgba(0, 0, 0, 0.5)',
    dark: 'rgba(0, 0, 0, 0.7)',
    var: 'var(--bg-overlay)',
  },
} as const;

/**
 * Text colors
 * Typography colors with CSS variable mapping
 */
export const text = {
  /** Primary text - high emphasis */
  primary: {
    light: '#0f172a',
    dark: '#f8fafc',
    var: 'var(--text-primary)',
  },
  /** Secondary text - medium emphasis */
  secondary: {
    light: '#475569',
    dark: '#94a3b8',
    var: 'var(--text-secondary)',
  },
  /** Tertiary/muted text - low emphasis */
  muted: {
    light: '#64748b',
    dark: '#64748b',
    var: 'var(--text-tertiary)',
  },
  /** Disabled text - non-interactive */
  disabled: {
    light: '#94a3b8',
    dark: '#475569',
    var: 'var(--text-disabled)',
  },
  /** Inverse text - on colored backgrounds */
  inverse: {
    light: '#ffffff',
    dark: '#0f172a',
    var: 'var(--text-inverse)',
  },
  /** Brand-colored text */
  brand: {
    light: '#0ea5e9',
    dark: '#38bdf8',
    var: 'var(--text-brand)',
  },
  /** Link text */
  link: {
    light: '#2563eb',
    dark: '#60a5fa',
    var: 'var(--text-link)',
  },
} as const;

/**
 * Border colors
 * Stroke and divider colors
 */
export const border = {
  /** Default border - subtle dividers */
  default: {
    light: '#e2e8f0',
    dark: '#27272a',
    var: 'var(--border-default)',
  },
  /** Subtle border - very light dividers */
  subtle: {
    light: '#f1f5f9',
    dark: '#1e1e1e',
    var: 'var(--border-subtle)',
  },
  /** Strong border - visible dividers */
  strong: {
    light: '#cbd5e1',
    dark: '#3f3f46',
    var: 'var(--border-strong)',
  },
  /** Focus ring border */
  focus: {
    light: '#0ea5e9',
    dark: '#38bdf8',
    var: 'var(--border-focus)',
  },
  /** Error state border */
  error: {
    light: '#ef4444',
    dark: '#f87171',
    var: 'var(--border-error)',
  },
} as const;

/**
 * Glass morphism colors
 * Semi-transparent colors for glass effects
 */
export const glass = {
  /** Light glass background */
  bg: {
    light: 'rgba(255, 255, 255, 0.7)',
    dark: 'rgba(20, 20, 20, 0.7)',
    var: 'var(--glass-bg)',
  },
  /** Thicker glass for elevated surfaces */
  bgThick: {
    light: 'rgba(255, 255, 255, 0.85)',
    dark: 'rgba(30, 30, 30, 0.85)',
    var: 'var(--glass-bg-thick)',
  },
  /** Thin glass for subtle effects */
  bgThin: {
    light: 'rgba(255, 255, 255, 0.4)',
    dark: 'rgba(10, 10, 10, 0.4)',
    var: 'var(--glass-bg-thin)',
  },
  /** Glass border color */
  border: {
    light: 'rgba(255, 255, 255, 0.2)',
    dark: 'rgba(255, 255, 255, 0.1)',
    var: 'var(--glass-border)',
  },
} as const;

/**
 * Chat mode specific colors
 * Colors for the chat interface mode
 */
export const chat = {
  /** Primary chat color */
  primary: '#007aff',
  /** Secondary chat accent */
  secondary: '#5856d6',
  /** Glow effect color */
  glow: 'rgba(0, 122, 255, 0.2)',
  /** Gradient for hero elements */
  gradient: 'linear-gradient(135deg, #007aff 0%, #5856d6 100%)',
} as const;

/**
 * Cowork mode specific colors
 * Colors for the collaboration interface mode
 */
export const cowork = {
  /** Primary cowork color */
  primary: '#af52de',
  /** Secondary cowork accent */
  secondary: '#ff2d55',
  /** Glow effect color */
  glow: 'rgba(175, 82, 222, 0.2)',
  /** Gradient for hero elements */
  gradient: 'linear-gradient(135deg, #af52de 0%, #ff2d55 100%)',
} as const;

/**
 * Code mode specific colors
 * Colors for the code editor interface mode
 */
export const code = {
  /** Primary code color */
  primary: '#34c759',
  /** Secondary code accent */
  secondary: '#30b0c7',
  /** Glow effect color */
  glow: 'rgba(52, 199, 89, 0.2)',
  /** Gradient for hero elements */
  gradient: 'linear-gradient(135deg, #34c759 0%, #30b0c7 100%)',
} as const;

/**
 * Semantic colors collection
 * Combined semantic color tokens
 */
export const semantic = {
  success,
  warning,
  danger,
  info,
} as const;

/**
 * Mode-specific colors
 * Colors for different UI modes
 */
export const mode = {
  chat,
  cowork,
  code,
} as const;

/**
 * Complete color tokens object
 * All color tokens organized by category
 */
export const colors = {
  brand,
  secondary,
  accent,
  semantic,
  neutral,
  surface,
  text,
  border,
  glass,
  mode,
} as const;

/** Brand color type */
export type BrandColors = typeof brand;
/** Secondary color type */
export type SecondaryColors = typeof secondary;
/** Accent color type */
export type AccentColors = typeof accent;
/** Semantic colors collection type */
export type SemanticColors = typeof semantic;
/** Success color type */
export type SuccessColors = typeof success;
/** Warning color type */
export type WarningColors = typeof warning;
/** Danger color type */
export type DangerColors = typeof danger;
/** Info color type */
export type InfoColors = typeof info;
/** Neutral color type */
export type NeutralColors = typeof neutral;
/** Surface color type */
export type SurfaceColors = typeof surface;
/** Text color type */
export type TextColors = typeof text;
/** Border color type */
export type BorderColors = typeof border;
/** Glass color type */
export type GlassColors = typeof glass;
/** Mode colors type */
export type ModeColors = typeof mode;
/** Chat mode colors type */
export type ChatColors = typeof chat;
/** Cowork mode colors type */
export type CoworkColors = typeof cowork;
/** Code mode colors type */
export type CodeColors = typeof code;
/** Complete colors type */
export type Colors = typeof colors;

export default colors;
