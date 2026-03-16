/**
 * A2R Design Tokens
 * 
 * Centralized design system constants for A2R brand identity.
 * Based on comprehensive analysis of brand guidelines, browser UI patterns,
 * and platform modes.
 * 
 * @module a2r-design-tokens
 */

// ============================================================================
// Core Brand Colors (Sand/Nude Obsidian)
// ============================================================================

export const SAND = {
  50: '#FDF8F3',
  100: '#F5EDE3',
  200: '#E8D9C8',
  300: '#D4BFA8',
  400: '#C4A78A',
  500: '#D4B08C',  // Primary Identity Accent
  600: '#B08D6E',
  700: '#9A7658',
  800: '#7D5F46',
  900: '#664E3A',
  950: '#2A1F16',
} as const;

export const NUDE = {
  100: '#FAF0E6',
  200: '#F2E2D2',
  300: '#E6CCB2',
  400: '#D4B08C',  // Identity accent
  500: '#C49A6C',
  600: '#A67B5B',
} as const;

// ============================================================================
// Mode-Specific Color Palettes
// ============================================================================

export const MODE_COLORS = {
  chat: {
    accent: '#D4956A',           // Warm terracotta orange
    glow: 'rgba(212,149,106,0.28)',
    soft: 'rgba(212,149,106,0.14)',
    border: 'rgba(212,149,106,0.14)',
    wash: 'rgba(212,149,106,0.18)',
    fog: 'rgba(147,94,53,0.18)',
    edge: 'rgba(212,149,106,0.14)',
    panelTint: 'rgba(212,149,106,0.08)',
    shadow: 'rgba(83,51,24,0.12)',
    base: '#2B2520',
  },
  cowork: {
    accent: '#A78BFA',           // Soft violet purple
    glow: 'rgba(167,139,250,0.28)',
    soft: 'rgba(167,139,250,0.14)',
    border: 'rgba(167,139,250,0.16)',
    wash: 'rgba(167,139,250,0.18)',
    fog: 'rgba(93,74,166,0.2)',
    edge: 'rgba(167,139,250,0.16)',
    panelTint: 'rgba(167,139,250,0.08)',
    shadow: 'rgba(58,42,113,0.14)',
    base: '#25222B',
  },
  code: {
    accent: '#79C47C',           // Soft mint green
    glow: 'rgba(121,196,124,0.28)',
    soft: 'rgba(121,196,124,0.14)',
    border: 'rgba(121,196,124,0.16)',
    wash: 'rgba(121,196,124,0.18)',
    fog: 'rgba(67,129,71,0.2)',
    edge: 'rgba(121,196,124,0.16)',
    panelTint: 'rgba(121,196,124,0.08)',
    shadow: 'rgba(34,78,37,0.14)',
    base: '#202B22',
  },
  browser: {
    accent: '#69A8C8',           // Steel blue
    glow: 'rgba(105,168,200,0.26)',
    soft: 'rgba(105,168,200,0.14)',
    border: 'rgba(105,168,200,0.16)',
    wash: 'rgba(105,168,200,0.18)',
    fog: 'rgba(61,106,138,0.2)',
    edge: 'rgba(105,168,200,0.16)',
    panelTint: 'rgba(105,168,200,0.08)',
    shadow: 'rgba(29,62,80,0.14)',
    base: '#20262B',
  },
} as const;

export type AgentMode = keyof typeof MODE_COLORS;

// ============================================================================
// Background Colors (Obsidian System)
// ============================================================================

export const BACKGROUND = {
  primary: '#1A1612',
  secondary: '#2A211A',
  tertiary: '#362B22',
  elevated: '#3D3228',
  hover: 'rgba(255,255,255,0.04)',
  active: 'rgba(255,255,255,0.08)',
} as const;

// ============================================================================
// Glass Effects
// ============================================================================

export const GLASS = {
  thin: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(212,176,140,0.1)',
    blur: '16px',
  },
  base: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(212,176,140,0.15)',
    blur: '24px',
  },
  elevated: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(212,176,140,0.2)',
    blur: '32px',
  },
  thick: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(212,176,140,0.25)',
    blur: '40px',
  },
} as const;

// ============================================================================
// Text Colors
// ============================================================================

export const TEXT = {
  primary: '#ECECEC',
  secondary: '#9B9B9B',
  tertiary: '#6E6E6E',
  disabled: 'rgba(154,118,88,0.5)',
  inverse: '#FDF8F3',
} as const;

// ============================================================================
// Border Colors
// ============================================================================

export const BORDER = {
  subtle: 'rgba(154,118,88,0.1)',
  default: 'rgba(154,118,88,0.18)',
  strong: 'rgba(154,118,88,0.28)',
  hover: 'rgba(154,118,88,0.35)',
  focus: 'rgba(176,141,110,0.5)',
} as const;

// ============================================================================
// Status Colors
// ============================================================================

export const STATUS = {
  success: '#4ade80',
  warning: '#fbbf24',
  error: '#f87171',
  info: '#60a5fa',
  neutral: '#9B9B9B',
} as const;

// ============================================================================
// Shadows
// ============================================================================

export const SHADOW = {
  xs: '0 2px 8px rgba(0,0,0,0.15)',
  sm: '0 4px 16px rgba(0,0,0,0.18)',
  md: '0 8px 32px rgba(0,0,0,0.2)',
  lg: '0 12px 48px rgba(0,0,0,0.3)',
  xl: '0 20px 64px rgba(0,0,0,0.35)',
  glow: '0 0 20px rgba(212,176,140,0.25)',
} as const;

// ============================================================================
// Spacing (4px base grid)
// ============================================================================

export const SPACE = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
} as const;

// ============================================================================
// Border Radius
// ============================================================================

export const RADIUS = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '28px',
  full: '9999px',
} as const;

// ============================================================================
// Typography
// ============================================================================

export const TYPOGRAPHY = {
  fontFamily: {
    sans: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
    serif: 'Georgia, "Times New Roman", Times, serif',
    mono: '"SF Mono", "Fira Code", "JetBrains Mono", monospace',
  },
  size: {
    xs: '11px',
    sm: '13px',
    base: '14px',
    md: '15px',
    lg: '16px',
    xl: '18px',
    '2xl': '20px',
    '3xl': '24px',
  },
  weight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.625,
  },
} as const;

// ============================================================================
// Animation Timing
// ============================================================================

export const ANIMATION = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  spring: '400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  breathe: '4s ease-in-out infinite',
  pulse: '2s ease-in-out infinite',
  spin: '24s linear infinite',
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

export function getModeColors(mode: AgentMode) {
  return MODE_COLORS[mode];
}

export function createGlassStyle(intensity: keyof typeof GLASS) {
  const glass = GLASS[intensity];
  return {
    background: glass.background,
    backdropFilter: `blur(${glass.blur})`,
    WebkitBackdropFilter: `blur(${glass.blur})`,
    border: glass.border,
  };
}

export function createGlowStyle(color: string, intensity: number = 0.25) {
  return {
    boxShadow: `0 0 20px ${color.replace(')', `, ${intensity})`)}`,
  };
}

// ============================================================================
// Component Presets
// ============================================================================

export const COMPONENT_PRESETS = {
  card: {
    ...createGlassStyle('base'),
    borderRadius: RADIUS.lg,
    padding: SPACE[4],
  },
  cardHover: {
    transform: 'translateY(-4px) scale(1.02)',
    background: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.2)',
    boxShadow: SHADOW.xl,
  },
  button: {
    primary: {
      background: SAND[500],
      color: BACKGROUND.primary,
      borderRadius: RADIUS.md,
      padding: `${SPACE[2]} ${SPACE[4]}`,
      fontWeight: TYPOGRAPHY.weight.semibold,
      transition: ANIMATION.base,
    },
    secondary: {
      background: 'transparent',
      color: SAND[500],
      border: `1px solid ${SAND[500]}`,
      borderRadius: RADIUS.md,
      padding: `${SPACE[2]} ${SPACE[4]}`,
      fontWeight: TYPOGRAPHY.weight.semibold,
      transition: ANIMATION.base,
    },
    ghost: {
      background: 'transparent',
      color: TEXT.secondary,
      borderRadius: RADIUS.md,
      padding: `${SPACE[2]} ${SPACE[4]}`,
      transition: ANIMATION.base,
    },
  },
  input: {
    background: 'rgba(0,0,0,0.2)',
    border: `1px solid ${BORDER.default}`,
    borderRadius: RADIUS.md,
    padding: `${SPACE[3]} ${SPACE[4]}`,
    color: TEXT.primary,
    fontSize: TYPOGRAPHY.size.base,
    transition: ANIMATION.base,
    focus: {
      borderColor: SAND[500],
      boxShadow: `0 0 0 2px ${SAND[500]}33`,
    },
  },
  statusPill: {
    pending: { borderLeft: `2px solid rgba(255,255,255,0.12)` },
    running: { borderLeft: `2px solid rgba(212,176,140,0.45)` },
    completed: { borderLeft: `2px solid rgba(74,222,128,0.35)` },
    error: { borderLeft: `2px solid rgba(248,113,113,0.45)` },
  },
} as const;
