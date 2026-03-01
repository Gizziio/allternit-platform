/**
 * @fileoverview Breakpoint Token System
 * 
 * Comprehensive responsive breakpoint tokens.
 * Used for media queries and responsive design.
 * 
 * @module design/tokens/breakpoints
 * @version 1.0.0
 */

/**
 * Breakpoint values
 * Standard responsive breakpoints
 */
export const breakpoints = {
  /** 320px - Small mobile phones */
  xs: '320px',
  /** 480px - Large mobile phones */
  sm: '480px',
  /** 640px - Small tablets / large phones */
  md: '640px',
  /** 768px - Tablets */
  lg: '768px',
  /** 1024px - Small desktops / large tablets */
  xl: '1024px',
  /** 1280px - Desktops */
  '2xl': '1280px',
  /** 1536px - Large desktops */
  '3xl': '1536px',
} as const;

/**
 * Breakpoint values in pixels (for JS calculations)
 */
export const breakpointsPx = {
  xs: 320,
  sm: 480,
  md: 640,
  lg: 768,
  xl: 1024,
  '2xl': 1280,
  '3xl': 1536,
} as const;

/**
 * Mobile-first media queries (min-width)
 * Use for progressive enhancement
 */
export const media = {
  /** (min-width: 320px) - Small mobile and up */
  xs: `(min-width: ${breakpoints.xs})`,
  /** (min-width: 480px) - Mobile and up */
  sm: `(min-width: ${breakpoints.sm})`,
  /** (min-width: 640px) - Large mobile and up */
  md: `(min-width: ${breakpoints.md})`,
  /** (min-width: 768px) - Tablet and up */
  lg: `(min-width: ${breakpoints.lg})`,
  /** (min-width: 1024px) - Desktop and up */
  xl: `(min-width: ${breakpoints.xl})`,
  /** (min-width: 1280px) - Large desktop and up */
  '2xl': `(min-width: ${breakpoints['2xl']})`,
  /** (min-width: 1536px) - Extra large desktop and up */
  '3xl': `(min-width: ${breakpoints['3xl']})`,
} as const;

/**
 * Desktop-first media queries (max-width)
 * Use for graceful degradation
 */
export const mediaMax = {
  /** (max-width: 319px) - Below small mobile */
  xs: `(max-width: ${breakpointsPx.xs - 1}px)`,
  /** (max-width: 479px) - Below mobile */
  sm: `(max-width: ${breakpointsPx.sm - 1}px)`,
  /** (max-width: 639px) - Below large mobile */
  md: `(max-width: ${breakpointsPx.md - 1}px)`,
  /** (max-width: 767px) - Below tablet */
  lg: `(max-width: ${breakpointsPx.lg - 1}px)`,
  /** (max-width: 1023px) - Below desktop */
  xl: `(max-width: ${breakpointsPx.xl - 1}px)`,
  /** (max-width: 1279px) - Below large desktop */
  '2xl': `(max-width: ${breakpointsPx['2xl'] - 1}px)`,
  /** (max-width: 1535px) - Below extra large desktop */
  '3xl': `(max-width: ${breakpointsPx['3xl'] - 1}px)`,
} as const;

/**
 * Range media queries
 * Target specific device ranges
 */
export const mediaRange = {
  /** Only mobile phones */
  mobileOnly: `(max-width: ${breakpointsPx.md - 1}px)`,
  /** Only tablets */
  tabletOnly: `(min-width: ${breakpoints.md}) and (max-width: ${breakpointsPx.xl - 1}px)`,
  /** Only desktops */
  desktopOnly: `(min-width: ${breakpoints.xl})`,
  /** Mobile and tablet */
  mobileAndTablet: `(max-width: ${breakpointsPx.xl - 1}px)`,
  /** Tablet and desktop */
  tabletAndDesktop: `(min-width: ${breakpoints.md})`,
} as const;

/**
 * Orientation media queries
 * Target device orientation
 */
export const orientation = {
  /** Portrait orientation */
  portrait: '(orientation: portrait)',
  /** Landscape orientation */
  landscape: '(orientation: landscape)',
} as const;

/**
 * Feature media queries
 * Target device capabilities
 */
export const features = {
  /** High resolution displays */
  highRes: '(-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)',
  /** Hover capable devices */
  hover: '(hover: hover)',
  /** Touch devices */
  touch: '(hover: none) and (pointer: coarse)',
  /** Reduced motion preference */
  reducedMotion: '(prefers-reduced-motion: reduce)',
  /** Dark mode preference */
  darkMode: '(prefers-color-scheme: dark)',
  /** Light mode preference */
  lightMode: '(prefers-color-scheme: light)',
  /** High contrast mode */
  highContrast: '(prefers-contrast: high)',
} as const;

/**
 * Container query breakpoints
 * For container-based responsive design
 */
export const containerBreakpoints = {
  /** 240px - Extra small container */
  xs: '15rem',
  /** 320px - Small container */
  sm: '20rem',
  /** 448px - Medium container */
  md: '28rem',
  /** 576px - Large container */
  lg: '36rem',
  /** 704px - Extra large container */
  xl: '44rem',
} as const;

/**
 * Container size names
 * Semantic container query names
 */
export const containerSizes = {
  xs: 'xs',
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  xl: 'xl',
} as const;

/**
 * Complete breakpoints tokens object
 */
export const breakpointTokens = {
  breakpoints,
  breakpointsPx,
  media,
  mediaMax,
  mediaRange,
  orientation,
  features,
  container: {
    breakpoints: containerBreakpoints,
    sizes: containerSizes,
  },
} as const;

/** Breakpoints type */
export type Breakpoints = typeof breakpoints;
/** Breakpoints in pixels type */
export type BreakpointsPx = typeof breakpointsPx;
/** Media queries type */
export type Media = typeof media;
/** Max-width media type */
export type MediaMax = typeof mediaMax;
/** Range media type */
export type MediaRange = typeof mediaRange;
/** Orientation type */
export type Orientation = typeof orientation;
/** Features type */
export type Features = typeof features;
/** Container breakpoints type */
export type ContainerBreakpoints = typeof containerBreakpoints;
/** Container sizes type */
export type ContainerSizes = typeof containerSizes;
/** Complete breakpoint tokens type */
export type BreakpointTokens = typeof breakpointTokens;

export default breakpointTokens;
