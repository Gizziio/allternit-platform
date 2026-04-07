/**
 * Theme Utilities
 */

export interface Theme {
  name: string
  colors: Record<string, string>
}

export const defaultTheme: Theme = {
  name: 'default',
  colors: {},
}

export function getTheme(): Theme {
  return defaultTheme
}
