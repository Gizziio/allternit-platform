/**
 * @fileoverview Typography Token System
 * 
 * Comprehensive typography tokens for the allternit platform.
 * Includes font families, sizes, weights, line heights, and letter spacing.
 * 
 * @module design/tokens/typography
 * @version 1.0.0
 */

/**
 * Font family definitions
 * Primary, mono, and display typefaces
 */
export const fontFamily = {
  /**
   * Allternit Sans — Primary UI font stack
   * Used for: app UI, navigation, buttons, labels, dashboards, settings
   */
  sans: '"Allternit Sans", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  /**
   * Allternit Mono — Code and protocol font stack
   * Used for: code, logs, traces, terminal output, agent execution steps
   */
  mono: '"Allternit Mono", "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  /**
   * Allternit Sans — Display font for headlines
   * Same stack as sans, used for visual consistency
   */
  display: '"Allternit Sans", Inter, system-ui, -apple-system, sans-serif',
  /**
   * Allternit Serif — Editorial and research font stack
   * Used for: research articles, whitepapers, essays, reports, institutional text
   */
  serif: '"Allternit Serif", Georgia, ui-serif, Cambria, "Times New Roman", Times, serif',
} as const;

/**
 * Font size scale
 * Consistent sizing from xs to 9xl
 * Based on 1rem (16px) base with type scale
 */
export const fontSize = {
  /** 10px - Captions, badges */
  '2xs': '0.625rem',
  /** 12px - Small text, labels */
  xs: '0.75rem',
  /** 14px - Body small, buttons */
  sm: '0.875rem',
  /** 16px - Base body text */
  base: '1rem',
  /** 18px - Large body text */
  lg: '1.125rem',
  /** 20px - Small headings */
  xl: '1.25rem',
  /** 24px - H4, large headings */
  '2xl': '1.5rem',
  /** 30px - H3, section headings */
  '3xl': '1.875rem',
  /** 36px - H2, major headings */
  '4xl': '2.25rem',
  /** 48px - H1, hero text */
  '5xl': '3rem',
  /** 60px - Display text */
  '6xl': '3.75rem',
  /** 72px - Large display */
  '7xl': '4.5rem',
  /** 96px - Extra large display */
  '8xl': '6rem',
  /** 128px - Maximum display */
  '9xl': '8rem',
} as const;

/**
 * Font size in pixels (for reference)
 * Mapping of size tokens to pixel values
 */
export const fontSizePx = {
  '2xs': 10,
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
  '6xl': 60,
  '7xl': 72,
  '8xl': 96,
  '9xl': 128,
} as const;

/**
 * Font weight scale
 * From thin to black
 */
export const fontWeight = {
  /** 100 - Hairline */
  thin: '100',
  /** 200 - Extra light */
  extralight: '200',
  /** 300 - Light */
  light: '300',
  /** 400 - Normal/Regular */
  normal: '400',
  /** 500 - Medium */
  medium: '500',
  /** 600 - Semi-bold */
  semibold: '600',
  /** 700 - Bold */
  bold: '700',
  /** 800 - Extra bold */
  extrabold: '800',
  /** 900 - Black */
  black: '900',
} as const;

/**
 * Line height scale
 * Vertical rhythm and readability
 */
export const lineHeight = {
  /** 1 - No extra spacing, for headings */
  none: '1',
  /** 1.25 - Tight, for large headings */
  tight: '1.25',
  /** 1.375 - Snug, for medium headings */
  snug: '1.375',
  /** 1.5 - Normal, for body text */
  normal: '1.5',
  /** 1.625 - Relaxed, for long-form text */
  relaxed: '1.625',
  /** 2 - Loose, for spacious layouts */
  loose: '2',
} as const;

/**
 * Letter spacing scale
 * Tracking adjustments for different sizes
 */
export const letterSpacing = {
  /** -0.05em - Very tight, for large display */
  tighter: '-0.05em',
  /** -0.025em - Tight, for headings */
  tight: '-0.025em',
  /** 0 - Normal spacing */
  normal: '0em',
  /** 0.025em - Wide, for small caps */
  wide: '0.025em',
  /** 0.05em - Wider, for labels */
  wider: '0.05em',
  /** 0.1em - Widest, for all-caps */
  widest: '0.1em',
} as const;

/**
 * Typography presets
 * Predefined text styles for common use cases
 */
export const textPreset = {
  /** Hero display text */
  hero: {
    fontSize: fontSize['5xl'],
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  /** Main page title */
  title: {
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  /** Section heading */
  heading: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.snug,
    letterSpacing: letterSpacing.tight,
  },
  /** Subsection heading */
  subheading: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.snug,
    letterSpacing: letterSpacing.normal,
  },
  /** Standard body text */
  body: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  /** Small body text */
  bodySmall: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  /** Caption/label text */
  caption: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.wide,
  },
  /** Button text style */
  button: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.none,
    letterSpacing: letterSpacing.wide,
  },
  /** Code/monospace text */
  code: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
    fontFamily: fontFamily.mono,
  },
} as const;

/**
 * Complete typography tokens object
 */
export const typography = {
  fontFamily,
  fontSize,
  fontSizePx,
  fontWeight,
  lineHeight,
  letterSpacing,
  textPreset,
} as const;

/** Font family type */
export type FontFamily = typeof fontFamily;
/** Font size type */
export type FontSize = typeof fontSize;
/** Font size in pixels type */
export type FontSizePx = typeof fontSizePx;
/** Font weight type */
export type FontWeight = typeof fontWeight;
/** Line height type */
export type LineHeight = typeof lineHeight;
/** Letter spacing type */
export type LetterSpacing = typeof letterSpacing;
/** Text preset type */
export type TextPreset = typeof textPreset;
/** Complete typography type */
export type Typography = typeof typography;

export default typography;
