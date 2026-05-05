/**
 * @fileoverview Branding utilities and configuration for gizzi-code
 * @module runtime/brand/brand
 *
 * Provides centralized brand constants, color schemes, and theming
 * configuration for the gizzi-code runtime environment.
 */
/**
 * Brand name constants
 * @constant {Readonly<{FULL: string; SHORT: string; CODE: string; PACKAGE: string}>}
 */
export const Brand = {
    /** Full brand name */
    FULL: 'gizzi-code',
    /** Short brand name */
    SHORT: 'gizzi',
    /** Code identifier */
    CODE: 'gizzi-code',
    /** Package name */
    PACKAGE: '@gizzi/code',
};
/**
 * Brand version information
 * @constant {Readonly<{MAJOR: number; MINOR: number; PATCH: number; STRING: string}>}
 */
export const BrandVersion = {
    /** Major version */
    MAJOR: 0,
    /** Minor version */
    MINOR: 1,
    /** Patch version */
    PATCH: 0,
    /** Full version string */
    STRING: '0.1.0',
};
/**
 * Default light theme color palette
 * @constant {Readonly<BrandColorPalette>}
 */
export const LightColors = {
    primary: '#2563eb',
    secondary: '#64748b',
    accent: '#8b5cf6',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#0f172a',
    textMuted: '#64748b',
    error: '#ef4444',
    warning: '#f59e0b',
    success: '#10b981',
    info: '#3b82f6',
    border: '#e2e8f0',
    divider: '#cbd5e1',
};
/**
 * Default dark theme color palette
 * @constant {Readonly<BrandColorPalette>}
 */
export const DarkColors = {
    primary: '#3b82f6',
    secondary: '#94a3b8',
    accent: '#a78bfa',
    background: '#0f172a',
    surface: '#1e293b',
    text: '#f8fafc',
    textMuted: '#94a3b8',
    error: '#f87171',
    warning: '#fbbf24',
    success: '#34d399',
    info: '#60a5fa',
    border: '#334155',
    divider: '#475569',
};
/**
 * High contrast theme for accessibility
 * @constant {Readonly<BrandColorPalette>}
 */
export const HighContrastColors = {
    primary: '#005fcc',
    secondary: '#404040',
    accent: '#6622cc',
    background: '#000000',
    surface: '#0a0a0a',
    text: '#ffffff',
    textMuted: '#cccccc',
    error: '#ff3333',
    warning: '#ffaa00',
    success: '#00cc66',
    info: '#0099ff',
    border: '#666666',
    divider: '#555555',
};
/**
 * Complete brand color scheme
 * @constant {Readonly<BrandColorScheme>}
 */
export const BrandColors = {
    light: LightColors,
    dark: DarkColors,
    highContrast: HighContrastColors,
};
/**
 * Default brand typography
 * @constant {Readonly<BrandTypography>}
 */
export const BrandTypography = {
    fontFamily: '"Allternit Sans", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    fontFamilyMono: '"Allternit Mono", "SFMono-Regular", Menlo, Monaco, Consolas, monospace',
    baseSize: 16,
    lineHeight: 1.5,
    weights: {
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
    },
    scale: {
        xs: 0.75, // 12px
        sm: 0.875, // 14px
        base: 1, // 16px
        lg: 1.125, // 18px
        xl: 1.25, // 20px
        '2xl': 1.5, // 24px
        '3xl': 1.875, // 30px
        '4xl': 2.25, // 36px
    },
};
/**
 * Brand spacing configuration (in rem units base)
 * @constant {Readonly<Record<string, number>>}
 */
export const BrandSpacing = {
    none: 0,
    xs: 0.25, // 4px
    sm: 0.5, // 8px
    md: 1, // 16px
    lg: 1.5, // 24px
    xl: 2, // 32px
    '2xl': 3, // 48px
    '3xl': 4, // 64px
    '4xl': 6, // 96px
    '5xl': 8, // 128px
};
/**
 * Brand border radius values
 * @constant {Readonly<Record<string, string>>}
 */
export const BrandBorderRadius = {
    none: '0',
    sm: '0.125rem', // 2px
    md: '0.25rem', // 4px
    lg: '0.5rem', // 8px
    xl: '0.75rem', // 12px
    '2xl': '1rem', // 16px
    full: '9999px',
};
/**
 * Brand shadow values
 * @constant {Readonly<Record<string, string>>}
 */
export const BrandShadows = {
    none: 'none',
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
};
/**
 * Brand breakpoints for responsive design
 * @constant {Readonly<Record<string, number>>}
 */
export const BrandBreakpoints = {
    xs: 0,
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536,
};
/**
 * Animation timing values
 * @constant {Readonly<Record<string, number>>}
 */
export const BrandAnimation = {
    instant: 0,
    fast: 100,
    normal: 200,
    slow: 300,
    slower: 500,
};
/**
 * Easing functions
 * @constant {Readonly<Record<string, string>>}
 */
export const BrandEasing = {
    linear: 'linear',
    ease: 'ease',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
};
/**
 * Complete brand configuration
 * @constant {Readonly<BrandConfig>}
 */
export const BrandConfig = {
    name: Brand,
    version: BrandVersion,
    colors: BrandColors,
    typography: BrandTypography,
    spacing: BrandSpacing,
    borderRadius: BrandBorderRadius,
    shadows: BrandShadows,
    breakpoints: BrandBreakpoints,
    animation: BrandAnimation,
    easing: BrandEasing,
};
/**
 * Get brand colors for a specific theme mode
 *
 * @param {ThemeMode} mode - Theme mode to get colors for
 * @param {BrandColorScheme} colors - Color scheme to use (defaults to BrandColors)
 * @returns {BrandColorPalette} Color palette for the specified mode
 *
 * @example
 * ```typescript
 * const darkColors = getBrandColors('dark');
 * console.log(darkColors.background); // '#0f172a'
 * ```
 */
export function getBrandColors(mode, colors = BrandColors) {
    switch (mode) {
        case 'light':
            return colors.light;
        case 'dark':
            return colors.dark;
        case 'high-contrast':
            return colors.highContrast;
        case 'auto':
            // Auto-detect based on system preference
            if (typeof window !== 'undefined' && window.matchMedia) {
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                return prefersDark ? colors.dark : colors.light;
            }
            return colors.light;
        default:
            return colors.light;
    }
}
/**
 * Convert hex color to RGB values
 *
 * @param {HexColor} hex - Hex color value
 * @returns {RGBColor | null} RGB values or null if invalid
 *
 * @example
 * ```typescript
 * const rgb = hexToRgb('#2563eb');
 * console.log(rgb); // { r: 37, g: 99, b: 235 }
 * ```
 */
export function hexToRgb(hex) {
    const cleanHex = hex.replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(cleanHex)) {
        return null;
    }
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return { r, g, b };
}
/**
 * Convert RGB values to hex color
 *
 * @param {number} r - Red value (0-255)
 * @param {number} g - Green value (0-255)
 * @param {number} b - Blue value (0-255)
 * @returns {HexColor} Hex color value
 *
 * @example
 * ```typescript
 * const hex = rgbToHex(37, 99, 235);
 * console.log(hex); // '#2563eb'
 * ```
 */
export function rgbToHex(r, g, b) {
    const clamp = (n) => Math.max(0, Math.min(255, n));
    const toHex = (n) => clamp(n).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
/**
 * Convert hex color to RGBA with alpha
 *
 * @param {HexColor} hex - Hex color value
 * @param {number} alpha - Alpha value (0-1)
 * @returns {string} RGBA color string
 *
 * @example
 * ```typescript
 * const rgba = hexToRgba('#2563eb', 0.5);
 * console.log(rgba); // 'rgba(37, 99, 235, 0.5)'
 * ```
 */
export function hexToRgba(hex, alpha) {
    const rgb = hexToRgb(hex);
    if (!rgb) {
        throw new Error(`Invalid hex color: ${hex}`);
    }
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.max(0, Math.min(1, alpha))})`;
}
/**
 * Lighten a hex color by a percentage
 *
 * @param {HexColor} hex - Hex color value
 * @param {number} percent - Percentage to lighten (0-100)
 * @returns {HexColor} Lightened hex color
 *
 * @example
 * ```typescript
 * const lightBlue = lightenColor('#2563eb', 20);
 * ```
 */
export function lightenColor(hex, percent) {
    const rgb = hexToRgb(hex);
    if (!rgb) {
        throw new Error(`Invalid hex color: ${hex}`);
    }
    const amount = Math.floor((255 * percent) / 100);
    return rgbToHex(rgb.r + amount, rgb.g + amount, rgb.b + amount);
}
/**
 * Darken a hex color by a percentage
 *
 * @param {HexColor} hex - Hex color value
 * @param {number} percent - Percentage to darken (0-100)
 * @returns {HexColor} Darkened hex color
 *
 * @example
 * ```typescript
 * const darkBlue = darkenColor('#2563eb', 20);
 * ```
 */
export function darkenColor(hex, percent) {
    const rgb = hexToRgb(hex);
    if (!rgb) {
        throw new Error(`Invalid hex color: ${hex}`);
    }
    const amount = Math.floor((255 * percent) / 100);
    return rgbToHex(rgb.r - amount, rgb.g - amount, rgb.b - amount);
}
/**
 * Check if a color is light (for determining text contrast)
 *
 * @param {HexColor} hex - Hex color value
 * @returns {boolean} True if the color is light
 *
 * @example
 * ```typescript
 * const isLight = isLightColor('#ffffff'); // true
 * const isDark = isLightColor('#000000');  // false
 * ```
 */
export function isLightColor(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) {
        return false;
    }
    // Calculate relative luminance
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance > 0.5;
}
/**
 * Get the appropriate text color (light or dark) for contrast against a background
 *
 * @param {HexColor} backgroundColor - Background hex color
 * @returns {{ light: HexColor; dark: HexColor }} Text colors for contrast
 *
 * @example
 * ```typescript
 * const textColors = getContrastText('#2563eb');
 * console.log(textColors.light); // '#ffffff' (use this for dark backgrounds)
 * ```
 */
export function getContrastText(backgroundColor) {
    return {
        light: '#ffffff',
        dark: '#0f172a',
    };
}
/**
 * Get the best text color for contrast against a background
 *
 * @param {HexColor} backgroundColor - Background hex color
 * @returns {HexColor} Best text color for contrast
 *
 * @example
 * ```typescript
 * const textColor = getBestContrastText('#0f172a'); // '#ffffff'
 * ```
 */
export function getBestContrastText(backgroundColor) {
    return isLightColor(backgroundColor) ? '#0f172a' : '#ffffff';
}
/**
 * CSS custom properties (variables) generator for brand colors
 *
 * @param {ThemeMode} mode - Theme mode
 * @returns {Record<string, string>} CSS variable names and values
 *
 * @example
 * ```typescript
 * const cssVars = generateCSSVariables('dark');
 * // { '--gizzi-primary': '#3b82f6', ... }
 * ```
 */
export function generateCSSVariables(mode) {
    const colors = getBrandColors(mode);
    const prefix = '--gizzi';
    return {
        [`${prefix}-primary`]: colors.primary,
        [`${prefix}-secondary`]: colors.secondary,
        [`${prefix}-accent`]: colors.accent,
        [`${prefix}-background`]: colors.background,
        [`${prefix}-surface`]: colors.surface,
        [`${prefix}-text`]: colors.text,
        [`${prefix}-text-muted`]: colors.textMuted,
        [`${prefix}-error`]: colors.error,
        [`${prefix}-warning`]: colors.warning,
        [`${prefix}-success`]: colors.success,
        [`${prefix}-info`]: colors.info,
        [`${prefix}-border`]: colors.border,
        [`${prefix}-divider`]: colors.divider,
    };
}
// Default export
export default {
    Brand,
    BrandVersion,
    BrandColors,
    BrandConfig,
    LightColors,
    DarkColors,
    HighContrastColors,
    BrandTypography,
    BrandSpacing,
    BrandBorderRadius,
    BrandShadows,
    BrandBreakpoints,
    BrandAnimation,
    BrandEasing,
    getBrandColors,
    hexToRgb,
    rgbToHex,
    hexToRgba,
    lightenColor,
    darkenColor,
    isLightColor,
    getContrastText,
    getBestContrastText,
    generateCSSVariables,
};
