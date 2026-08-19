import { useEffect, useState, type ReactNode } from 'react'

type ThemePreference = 'system' | 'light' | 'dark'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveTheme(theme: ThemePreference): 'light' | 'dark' {
  return theme === 'system' ? getSystemTheme() : theme
}

export interface ThemeProviderProps {
  children: ReactNode
  defaultTheme?: ThemePreference
}

export function ThemeProvider({
  children,
  defaultTheme = 'light',
}: ThemeProviderProps) {
  const [theme] = useState<ThemePreference>(defaultTheme)

  useEffect(() => {
    const root = document.documentElement
    const resolved = resolveTheme(theme)
    root.setAttribute('data-theme', resolved)
    root.style.colorScheme = resolved
  }, [theme])

  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      const resolved = resolveTheme('system')
      document.documentElement.setAttribute('data-theme', resolved)
      document.documentElement.style.colorScheme = resolved
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  return <>{children}</>
}
