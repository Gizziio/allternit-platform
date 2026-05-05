/**
 * @fileoverview Theme Context for TUI (Terminal User Interface)
 * 
 * Provides theme management with dark/light mode support for Ink-based CLI UI.
 * This context is referenced 60+ times across the codebase for consistent styling.
 * 
 * @module @gizzi-code/cli/ui/tui/context/theme
 * @version 1.0.0
 * @license MIT
 */

import React, { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';

/**
 * Color palette definitions for terminal UI themes
 */
export interface ThemeColors {
  /** Primary brand color - used for headers and key elements */
  primary: string;
  /** Secondary color - used for accents and highlights */
  secondary: string;
  /** Success color - used for positive states */
  success: string;
  /** Warning color - used for caution states */
  warning: string;
  /** Error color - used for error states */
  error: string;
  /** Info color - used for informational messages */
  info: string;
  /** Main text color */
  text: string;
  /** Muted/secondary text color */
  textMuted: string;
  /** Background color for containers */
  background: string;
  /** Surface color for elevated elements */
  surface: string;
  /** Border color for dividers and outlines */
  border: string;
  /** Cursor/highlight color */
  cursor: string;
  /** Selection background color */
  selection: string;
  /** Disabled state color */
  disabled: string;
}

/**
 * Spacing scale for consistent layout spacing
 */
export interface ThemeSpacing {
  /** Extra small spacing (1 character) */
  xs: number;
  /** Small spacing (2 characters) */
  sm: number;
  /** Medium spacing (4 characters) */
  md: number;
  /** Large spacing (6 characters) */
  lg: number;
  /** Extra large spacing (8 characters) */
  xl: number;
}

/**
 * Typography settings for terminal UI
 */
export interface ThemeTypography {
  /** Font family for code/monospace text */
  fontFamily: string;
  /** Font size (in terminal columns) */
  fontSize: number;
  /** Line height multiplier */
  lineHeight: number;
  /** Bold text weight */
  bold: boolean;
  /** Italic text style */
  italic: boolean;
  /** Underline text style */
  underline: boolean;
  /** Strikethrough text style */
  strikethrough: boolean;
}

/**
 * Complete theme interface combining all theme properties
 */
export interface Theme {
  /** Theme identifier */
  name: string;
  /** Mode identifier */
  mode: 'dark' | 'light';
  /** Color palette */
  colors: ThemeColors;
  /** Spacing scale */
  spacing: ThemeSpacing;
  /** Typography settings */
  typography: ThemeTypography;
}

/**
 * Default dark theme colors optimized for terminal readability
 */
const darkThemeColors: ThemeColors = {
  primary: '#6366f1',      // Indigo
  secondary: '#8b5cf6',    // Violet
  success: '#22c55e',      // Green
  warning: '#f59e0b',      // Amber
  error: '#ef4444',        // Red
  info: '#3b82f6',         // Blue
  text: '#f8fafc',         // Slate 50
  textMuted: '#94a3b8',    // Slate 400
  background: '#0f172a',   // Slate 900
  surface: '#1e293b',      // Slate 800
  border: '#334155',       // Slate 700
  cursor: '#6366f1',       // Indigo (matches primary)
  selection: '#312e81',    // Indigo 900
  disabled: '#475569',     // Slate 600
};

/**
 * Default light theme colors optimized for terminal readability
 */
const lightThemeColors: ThemeColors = {
  primary: '#4f46e5',      // Indigo 600
  secondary: '#7c3aed',    // Violet 600
  success: '#16a34a',      // Green 600
  warning: '#d97706',      // Amber 600
  error: '#dc2626',        // Red 600
  info: '#2563eb',         // Blue 600
  text: '#0f172a',         // Slate 900
  textMuted: '#64748b',    // Slate 500
  background: '#f8fafc',   // Slate 50
  surface: '#ffffff',      // White
  border: '#cbd5e1',       // Slate 300
  cursor: '#4f46e5',       // Indigo 600
  selection: '#c7d2fe',    // Indigo 200
  disabled: '#94a3b8',     // Slate 400
};

/**
 * Default spacing scale
 */
const defaultSpacing: ThemeSpacing = {
  xs: 1,
  sm: 2,
  md: 4,
  lg: 6,
  xl: 8,
};

/**
 * Default typography settings for terminal UI
 */
const defaultTypography: ThemeTypography = {
  fontFamily: '"Allternit Mono", "SFMono-Regular", Menlo, Monaco, Consolas, monospace',
  fontSize: 1,
  lineHeight: 1.2,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
};

/**
 * Complete default dark theme
 */
export const darkTheme: Theme = {
  name: 'dark',
  mode: 'dark',
  colors: darkThemeColors,
  spacing: defaultSpacing,
  typography: defaultTypography,
};

/**
 * Complete default light theme
 */
export const lightTheme: Theme = {
  name: 'light',
  mode: 'light',
  colors: lightThemeColors,
  spacing: defaultSpacing,
  typography: defaultTypography,
};

/**
 * Default theme (dark mode)
 */
export const defaultTheme: Theme = darkTheme;

/**
 * Theme context state interface
 */
interface ThemeContextState {
  /** Current active theme */
  theme: Theme;
  /** Current theme mode */
  mode: 'dark' | 'light';
  /** Toggle between dark and light modes */
  toggleMode: () => void;
  /** Set specific theme mode */
  setMode: (mode: 'dark' | 'light') => void;
  /** Set custom theme (merges with default) */
  setTheme: (theme: Partial<Theme>) => void;
  /** Reset to default theme */
  resetTheme: () => void;
}

/**
 * React context for theme state
 * @internal
 */
const ThemeContext = createContext<ThemeContextState | undefined>(undefined);

/**
 * Props for ThemeProvider component
 */
export interface ThemeProviderProps {
  /** Child components to wrap with theme context */
  children: ReactNode;
  /** Initial theme mode (defaults to 'dark') */
  initialMode?: 'dark' | 'light';
  /** Custom theme to merge with defaults */
  customTheme?: Partial<Theme>;
  /** Callback when theme changes */
  onThemeChange?: (theme: Theme) => void;
}

/**
 * Theme Provider Component
 * 
 * Wraps the application with theme context, providing dark/light mode support
 * and customizable theme properties.
 * 
 * @example
 * ```tsx
 * import { ThemeProvider } from './context/theme';
 * 
 * function App() {
 *   return (
 *     <ThemeProvider initialMode="dark">
 *       <MyApp />
 *     </ThemeProvider>
 *   );
 * }
 * ```
 */
export function ThemeProvider({
  children,
  initialMode = 'dark',
  customTheme,
  onThemeChange,
}: ThemeProviderProps): JSX.Element {
  const [mode, setModeState] = useState<'dark' | 'light'>(initialMode);
  const [customThemeState, setCustomThemeState] = useState<Partial<Theme> | undefined>(customTheme);

  /**
   * Get base theme based on current mode
   */
  const baseTheme = useMemo(() => {
    return mode === 'dark' ? darkTheme : lightTheme;
  }, [mode]);

  /**
   * Merged theme with any custom overrides
   */
  const theme = useMemo(() => {
    if (!customThemeState) return baseTheme;
    return {
      ...baseTheme,
      ...customThemeState,
      colors: { ...baseTheme.colors, ...customThemeState.colors },
      spacing: { ...baseTheme.spacing, ...customThemeState.spacing },
      typography: { ...baseTheme.typography, ...customThemeState.typography },
    };
  }, [baseTheme, customThemeState]);

  /**
   * Toggle between dark and light modes
   */
  const toggleMode = useCallback(() => {
    setModeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  /**
   * Set specific theme mode
   */
  const setMode = useCallback((newMode: 'dark' | 'light') => {
    setModeState(newMode);
  }, []);

  /**
   * Set custom theme properties
   */
  const setTheme = useCallback((newTheme: Partial<Theme>) => {
    setCustomThemeState((prev) => ({
      ...prev,
      ...newTheme,
      colors: { ...prev?.colors, ...newTheme.colors },
      spacing: { ...prev?.spacing, ...newTheme.spacing },
      typography: { ...prev?.typography, ...newTheme.typography },
    }));
  }, []);

  /**
   * Reset theme to defaults
   */
  const resetTheme = useCallback(() => {
    setCustomThemeState(undefined);
    setModeState(initialMode);
  }, [initialMode]);

  /**
   * Notify theme change callback
   */
  React.useEffect(() => {
    onThemeChange?.(theme);
  }, [theme, onThemeChange]);

  const value = useMemo(
    () => ({
      theme,
      mode,
      toggleMode,
      setMode,
      setTheme,
      resetTheme,
    }),
    [theme, mode, toggleMode, setMode, setTheme, resetTheme]
  );

  return React.createElement(ThemeContext.Provider, { value }, children);
}

/**
 * Hook to access theme context
 * 
 * Provides access to the current theme and theme manipulation functions.
 * Must be used within a ThemeProvider.
 * 
 * @returns ThemeContextState with theme data and control functions
 * @throws Error if used outside of ThemeProvider
 * 
 * @example
 * ```tsx
 * import { useTheme } from './context/theme';
 * 
 * function MyComponent() {
 *   const { theme, toggleMode } = useTheme();
 *   
 *   return (
 *     <Box>
 *       <Text color={theme.colors.primary}>Hello World</Text>
 *       <Button onClick={toggleMode}>Toggle Theme</Button>
 *     </Box>
 *   );
 * }
 * ```
 */
export function useTheme(): ThemeContextState {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * Hook to access only the theme object
 * 
 * Lightweight hook when only theme values are needed (no control functions).
 * Must be used within a ThemeProvider.
 * 
 * @returns Current theme object
 * @throws Error if used outside of ThemeProvider
 * 
 * @example
 * ```tsx
 * import { useThemeValue } from './context/theme';
 * 
 * function StyledText({ children }) {
 *   const theme = useThemeValue();
 *   return <Text color={theme.colors.text}>{children}</Text>;
 * }
 * ```
 */
export function useThemeValue(): Theme {
  const { theme } = useTheme();
  return theme;
}

/**
 * Hook to access theme colors only
 * 
 * Convenience hook for accessing the color palette.
 * Must be used within a ThemeProvider.
 * 
 * @returns ThemeColors object
 * @throws Error if used outside of ThemeProvider
 * 
 * @example
 * ```tsx
 * import { useColors } from './context/theme';
 * 
 * function StatusBadge({ status }) {
 *   const colors = useColors();
 *   const color = status === 'success' ? colors.success : colors.error;
 *   return <Text color={color}>{status}</Text>;
 * }
 * ```
 */
export function useColors(): ThemeColors {
  const { theme } = useTheme();
  return theme.colors;
}

/**
 * Hook to access theme spacing
 * 
 * Convenience hook for accessing the spacing scale.
 * Must be used within a ThemeProvider.
 * 
 * @returns ThemeSpacing object
 * @throws Error if used outside of ThemeProvider
 * 
 * @example
 * ```tsx
 * import { useSpacing } from './context/theme';
 * 
 * function PaddedBox({ children }) {
 *   const spacing = useSpacing();
 *   return <Box marginLeft={spacing.md}>{children}</Box>;
 * }
 * ```
 */
export function useSpacing(): ThemeSpacing {
  const { theme } = useTheme();
  return theme.spacing;
}

// Default export for the context
export { ThemeContext };
export default ThemeContext;
