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
export declare const Brand: {
    /** Full brand name */
    readonly FULL: "gizzi-code";
    /** Short brand name */
    readonly SHORT: "gizzi";
    /** Code identifier */
    readonly CODE: "gizzi-code";
    /** Package name */
    readonly PACKAGE: "@gizzi/code";
};
/**
 * Brand version information
 * @constant {Readonly<{MAJOR: number; MINOR: number; PATCH: number; STRING: string}>}
 */
export declare const BrandVersion: {
    /** Major version */
    readonly MAJOR: 0;
    /** Minor version */
    readonly MINOR: 1;
    /** Patch version */
    readonly PATCH: 0;
    /** Full version string */
    readonly STRING: "0.1.0";
};
/**
 * Color hex value type
 * @typedef {`#${string}`} HexColor
 */
export type HexColor = `#${string}`;
/**
 * RGB color values
 * @interface RGBColor
 */
export interface RGBColor {
    readonly r: number;
    readonly g: number;
    readonly b: number;
}
/**
 * RGBA color values with alpha
 * @interface RGBAColor
 */
export interface RGBAColor extends RGBColor {
    readonly a: number;
}
/**
 * Complete color palette for a theme variant
 * @interface BrandColorPalette
 */
export interface BrandColorPalette {
    /** Primary brand color */
    readonly primary: HexColor;
    /** Secondary brand color */
    readonly secondary: HexColor;
    /** Accent color for highlights */
    readonly accent: HexColor;
    /** Background color */
    readonly background: HexColor;
    /** Surface color for cards/elevated elements */
    readonly surface: HexColor;
    /** Primary text color */
    readonly text: HexColor;
    /** Secondary/muted text color */
    readonly textMuted: HexColor;
    /** Error color */
    readonly error: HexColor;
    /** Warning color */
    readonly warning: HexColor;
    /** Success color */
    readonly success: HexColor;
    /** Info color */
    readonly info: HexColor;
    /** Border color */
    readonly border: HexColor;
    /** Divider color */
    readonly divider: HexColor;
}
/**
 * Complete brand color scheme with all theme variants
 * @interface BrandColorScheme
 */
export interface BrandColorScheme {
    /** Light theme colors */
    readonly light: BrandColorPalette;
    /** Dark theme colors */
    readonly dark: BrandColorPalette;
    /** High contrast theme colors */
    readonly highContrast: BrandColorPalette;
}
/**
 * Theme mode options
 * @typedef {'light' | 'dark' | 'high-contrast' | 'auto'} ThemeMode
 */
export type ThemeMode = 'light' | 'dark' | 'high-contrast' | 'auto';
/**
 * Default light theme color palette
 * @constant {Readonly<BrandColorPalette>}
 */
export declare const LightColors: BrandColorPalette;
/**
 * Default dark theme color palette
 * @constant {Readonly<BrandColorPalette>}
 */
export declare const DarkColors: BrandColorPalette;
/**
 * High contrast theme for accessibility
 * @constant {Readonly<BrandColorPalette>}
 */
export declare const HighContrastColors: BrandColorPalette;
/**
 * Complete brand color scheme
 * @constant {Readonly<BrandColorScheme>}
 */
export declare const BrandColors: BrandColorScheme;
/**
 * Brand typography configuration
 * @interface BrandTypography
 */
export interface BrandTypography {
    /** Font family stack */
    readonly fontFamily: string;
    /** Monospace font family for code */
    readonly fontFamilyMono: string;
    /** Base font size in pixels */
    readonly baseSize: number;
    /** Line height ratio */
    readonly lineHeight: number;
    /** Font weights */
    readonly weights: {
        readonly normal: number;
        readonly medium: number;
        readonly semibold: number;
        readonly bold: number;
    };
    /** Type scale sizes */
    readonly scale: {
        readonly xs: number;
        readonly sm: number;
        readonly base: number;
        readonly lg: number;
        readonly xl: number;
        readonly '2xl': number;
        readonly '3xl': number;
        readonly '4xl': number;
    };
}
/**
 * Default brand typography
 * @constant {Readonly<BrandTypography>}
 */
export declare const BrandTypography: BrandTypography;
/**
 * Brand spacing configuration (in rem units base)
 * @constant {Readonly<Record<string, number>>}
 */
export declare const BrandSpacing: {
    readonly none: 0;
    readonly xs: 0.25;
    readonly sm: 0.5;
    readonly md: 1;
    readonly lg: 1.5;
    readonly xl: 2;
    readonly '2xl': 3;
    readonly '3xl': 4;
    readonly '4xl': 6;
    readonly '5xl': 8;
};
/**
 * Brand border radius values
 * @constant {Readonly<Record<string, string>>}
 */
export declare const BrandBorderRadius: {
    readonly none: "0";
    readonly sm: "0.125rem";
    readonly md: "0.25rem";
    readonly lg: "0.5rem";
    readonly xl: "0.75rem";
    readonly '2xl': "1rem";
    readonly full: "9999px";
};
/**
 * Brand shadow values
 * @constant {Readonly<Record<string, string>>}
 */
export declare const BrandShadows: {
    readonly none: "none";
    readonly sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)";
    readonly md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)";
    readonly lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)";
    readonly xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)";
    readonly '2xl': "0 25px 50px -12px rgb(0 0 0 / 0.25)";
    readonly inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)";
};
/**
 * Brand breakpoints for responsive design
 * @constant {Readonly<Record<string, number>>}
 */
export declare const BrandBreakpoints: {
    readonly xs: 0;
    readonly sm: 640;
    readonly md: 768;
    readonly lg: 1024;
    readonly xl: 1280;
    readonly '2xl': 1536;
};
/**
 * Animation timing values
 * @constant {Readonly<Record<string, number>>}
 */
export declare const BrandAnimation: {
    readonly instant: 0;
    readonly fast: 100;
    readonly normal: 200;
    readonly slow: 300;
    readonly slower: 500;
};
/**
 * Easing functions
 * @constant {Readonly<Record<string, string>>}
 */
export declare const BrandEasing: {
    readonly linear: "linear";
    readonly ease: "ease";
    readonly easeIn: "ease-in";
    readonly easeOut: "ease-out";
    readonly easeInOut: "ease-in-out";
    readonly spring: "cubic-bezier(0.34, 1.56, 0.64, 1)";
};
/**
 * Complete brand configuration object
 * @interface BrandConfig
 */
export interface BrandConfig {
    readonly name: typeof Brand;
    readonly version: typeof BrandVersion;
    readonly colors: BrandColorScheme;
    readonly typography: BrandTypography;
    readonly spacing: typeof BrandSpacing;
    readonly borderRadius: typeof BrandBorderRadius;
    readonly shadows: typeof BrandShadows;
    readonly breakpoints: typeof BrandBreakpoints;
    readonly animation: typeof BrandAnimation;
    readonly easing: typeof BrandEasing;
}
/**
 * Complete brand configuration
 * @constant {Readonly<BrandConfig>}
 */
export declare const BrandConfig: BrandConfig;
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
export declare function getBrandColors(mode: ThemeMode, colors?: BrandColorScheme): BrandColorPalette;
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
export declare function hexToRgb(hex: HexColor): RGBColor | null;
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
export declare function rgbToHex(r: number, g: number, b: number): HexColor;
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
export declare function hexToRgba(hex: HexColor, alpha: number): string;
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
export declare function lightenColor(hex: HexColor, percent: number): HexColor;
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
export declare function darkenColor(hex: HexColor, percent: number): HexColor;
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
export declare function isLightColor(hex: HexColor): boolean;
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
export declare function getContrastText(backgroundColor: HexColor): {
    light: HexColor;
    dark: HexColor;
};
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
export declare function getBestContrastText(backgroundColor: HexColor): HexColor;
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
export declare function generateCSSVariables(mode: ThemeMode): Record<string, string>;
declare const _default: {
    Brand: {
        /** Full brand name */
        readonly FULL: "gizzi-code";
        /** Short brand name */
        readonly SHORT: "gizzi";
        /** Code identifier */
        readonly CODE: "gizzi-code";
        /** Package name */
        readonly PACKAGE: "@gizzi/code";
    };
    BrandVersion: {
        /** Major version */
        readonly MAJOR: 0;
        /** Minor version */
        readonly MINOR: 1;
        /** Patch version */
        readonly PATCH: 0;
        /** Full version string */
        readonly STRING: "0.1.0";
    };
    BrandColors: BrandColorScheme;
    BrandConfig: BrandConfig;
    LightColors: BrandColorPalette;
    DarkColors: BrandColorPalette;
    HighContrastColors: BrandColorPalette;
    BrandTypography: BrandTypography;
    BrandSpacing: {
        readonly none: 0;
        readonly xs: 0.25;
        readonly sm: 0.5;
        readonly md: 1;
        readonly lg: 1.5;
        readonly xl: 2;
        readonly '2xl': 3;
        readonly '3xl': 4;
        readonly '4xl': 6;
        readonly '5xl': 8;
    };
    BrandBorderRadius: {
        readonly none: "0";
        readonly sm: "0.125rem";
        readonly md: "0.25rem";
        readonly lg: "0.5rem";
        readonly xl: "0.75rem";
        readonly '2xl': "1rem";
        readonly full: "9999px";
    };
    BrandShadows: {
        readonly none: "none";
        readonly sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)";
        readonly md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)";
        readonly lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)";
        readonly xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)";
        readonly '2xl': "0 25px 50px -12px rgb(0 0 0 / 0.25)";
        readonly inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)";
    };
    BrandBreakpoints: {
        readonly xs: 0;
        readonly sm: 640;
        readonly md: 768;
        readonly lg: 1024;
        readonly xl: 1280;
        readonly '2xl': 1536;
    };
    BrandAnimation: {
        readonly instant: 0;
        readonly fast: 100;
        readonly normal: 200;
        readonly slow: 300;
        readonly slower: 500;
    };
    BrandEasing: {
        readonly linear: "linear";
        readonly ease: "ease";
        readonly easeIn: "ease-in";
        readonly easeOut: "ease-out";
        readonly easeInOut: "ease-in-out";
        readonly spring: "cubic-bezier(0.34, 1.56, 0.64, 1)";
    };
    getBrandColors: typeof getBrandColors;
    hexToRgb: typeof hexToRgb;
    rgbToHex: typeof rgbToHex;
    hexToRgba: typeof hexToRgba;
    lightenColor: typeof lightenColor;
    darkenColor: typeof darkenColor;
    isLightColor: typeof isLightColor;
    getContrastText: typeof getContrastText;
    getBestContrastText: typeof getBestContrastText;
    generateCSSVariables: typeof generateCSSVariables;
};
export default _default;
