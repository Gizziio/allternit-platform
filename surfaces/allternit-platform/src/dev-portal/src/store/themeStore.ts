import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeMode, ThemeState } from '../types';

interface ThemeStore extends ThemeState {
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  initializeTheme: () => void;
}

const getSystemTheme = (): boolean => {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const applyTheme = (isDark: boolean) => {
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      mode: 'system',
      isDark: getSystemTheme(),

      setMode: (mode: ThemeMode) => {
        const isDark = mode === 'system' ? getSystemTheme() : mode === 'dark';
        applyTheme(isDark);
        set({ mode, isDark });
      },

      toggleTheme: () => {
        const currentIsDark = get().isDark;
        const newIsDark = !currentIsDark;
        applyTheme(newIsDark);
        set({ 
          isDark: newIsDark, 
          mode: newIsDark ? 'dark' : 'light' 
        });
      },

      initializeTheme: () => {
        const { mode } = get();
        const isDark = mode === 'system' ? getSystemTheme() : mode === 'dark';
        applyTheme(isDark);
        set({ isDark });

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
          if (get().mode === 'system') {
            applyTheme(e.matches);
            set({ isDark: e.matches });
          }
        });
      },
    }),
    {
      name: 'allternit-theme-storage',
    }
  )
);
