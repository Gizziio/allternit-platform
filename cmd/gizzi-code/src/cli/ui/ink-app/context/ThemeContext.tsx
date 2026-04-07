import React, { createContext, useContext, useState, useCallback } from 'react';

export interface Theme {
  name: string;
  background: string;
  foreground: string;
  accent: string;
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  muted: string;
  border: string;
  text: string;
  textMuted: string;
  backgroundPanel: string;
  backgroundElement: string;
}
export const darkTheme: Theme = {
  name: 'dark',
  background: '#0d1117',
  foreground: '#c9d1d9',
  accent: '#d4b08c',
  primary: '#58a6ff',
  secondary: '#8b949e',
  success: '#3fb950',
  warning: '#d29922',
  error: '#f85149',
  info: '#58a6ff',
  muted: '#6e7681',
  border: '#30363d',
  text: '#c9d1d9',
  textMuted: '#8b949e',
  backgroundPanel: '#161b22',
  backgroundElement: '#21262d',
};
export const lightTheme: Theme = {
  name: 'light',
  background: '#ffffff',
  foreground: '#24292f',
  accent: '#d4a373',
  primary: '#0969da',
  secondary: '#57606a',
  success: '#1a7f37',
  warning: '#9a6700',
  error: '#cf222e',
  info: '#0969da',
  muted: '#6e7781',
  border: '#d0d7de',
  text: '#24292f',
  textMuted: '#57606a',
  backgroundPanel: '#f6f8fa',
  backgroundElement: '#eaeef2',
};

interface ThemeContextType {
  theme: Theme;
  mode: 'dark' | 'light';
  setMode: (mode: 'dark' | 'light') => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<'dark' | 'light'>('dark');
  const theme = mode === 'dark' ? darkTheme : lightTheme;
  const toggleMode = useCallback(() => {
    setMode(m => m === 'dark' ? 'light' : 'dark');
  }, []);
  return (
    <ThemeContext.Provider value={{ theme, mode, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
