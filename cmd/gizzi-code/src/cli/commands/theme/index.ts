/**
 * Theme Command
 * Production-quality theme management
 */

import { log } from '../../utils/log.js'
import { loadPreferences, savePreferences, getPreference } from '../../../utils/sessionStorage.js'
import { writeFile, readFile } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'

export type ThemeName = 'dark' | 'light' | 'system'

export interface ThemeConfig {
  name: ThemeName
  background: string
  foreground: string
  primary: string
  secondary: string
  success: string
  error: string
  warning: string
  muted: string
}

const THEMES: Record<ThemeName, ThemeConfig> = {
  dark: {
    name: 'dark',
    background: '#1a1a1a',
    foreground: '#e0e0e0',
    primary: '#6C5CE7',
    secondary: '#a29bfe',
    success: '#00b894',
    error: '#ff7675',
    warning: '#fdcb6e',
    muted: '#636e72',
  },
  light: {
    name: 'light',
    background: '#ffffff',
    foreground: '#2d3436',
    primary: '#6C5CE7',
    secondary: '#a29bfe',
    success: '#00b894',
    error: '#ff7675',
    warning: '#fdcb6e',
    muted: '#b2bec3',
  },
  system: {
    name: 'system',
    background: 'auto',
    foreground: 'auto',
    primary: '#6C5CE7',
    secondary: '#a29bfe',
    success: '#00b894',
    error: '#ff7675',
    warning: '#fdcb6e',
    muted: 'auto',
  },
}

/**
 * Get current theme
 */
export async function getCurrentTheme(): Promise<ThemeName> {
  const theme = await getPreference<ThemeName>('theme', 'dark')
  return THEMES[theme] ? theme : 'dark'
}

/**
 * Set theme
 */
export async function setTheme(name: ThemeName): Promise<void> {
  if (!THEMES[name]) {
    throw new Error(`Invalid theme: ${name}. Available: dark, light, system`)
  }
  
  const prefs = await loadPreferences()
  prefs.theme = name
  await savePreferences(prefs)
  
  // Write to config file for other tools to read
  try {
    const configDir = join(homedir(), '.config', 'gizzi')
    const themeFile = join(configDir, 'theme.json')
    await writeFile(themeFile, JSON.stringify(THEMES[name], null, 2))
  } catch {
    // Ignore write errors
  }
}

/**
 * Get system preferred theme
 */
function getSystemTheme(): ThemeName {
  // Check macOS appearance
  try {
    const { execSync } = require('child_process')
    const result = execSync('defaults read -g AppleInterfaceStyle', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
    if (result.trim() === 'Dark') return 'dark'
  } catch {
    // Not macOS or command failed
  }
  
  // Default to dark
  return 'dark'
}

/**
 * Get effective theme (resolves 'system' to actual theme)
 */
export async function getEffectiveTheme(): Promise<ThemeConfig> {
  const current = await getCurrentTheme()
  
  if (current === 'system') {
    const systemTheme = getSystemTheme()
    return THEMES[systemTheme]
  }
  
  return THEMES[current]
}

/**
 * Show current theme info
 */
async function showTheme(): Promise<void> {
  const current = await getCurrentTheme()
  const effective = await getEffectiveTheme()
  
  log('info', `Current theme: ${current}`)
  if (current === 'system') {
    log('info', `Effective theme: ${effective.name}`)
  }
  log('info', `Primary: ${effective.primary}`)
  log('info', `Background: ${effective.background}`)
  log('info', `Foreground: ${effective.foreground}`)
}

/**
 * List available themes
 */
function listThemes(): void {
  log('info', 'Available themes:')
  for (const [name, theme] of Object.entries(THEMES)) {
    const marker = name === 'dark' ? ' (default)' : ''
    log('info', `  • ${name}${marker}`)
  }
}

/**
 * Execute theme command
 */
export default async function themeCommand(args: string[]): Promise<void> {
  try {
    const subcommand = args[0] || 'show'
    
    switch (subcommand) {
      case 'show':
      case 'current':
        await showTheme()
        break
        
      case 'set': {
        const themeName = args[1] as ThemeName
        if (!themeName) {
          log('error', 'Please specify a theme name')
          listThemes()
          return
        }
        await setTheme(themeName)
        log('success', `Theme set to: ${themeName}`)
        break
      }
      
      case 'list':
      case 'ls':
        listThemes()
        break
        
      case 'dark':
        await setTheme('dark')
        log('success', 'Theme set to: dark')
        break
        
      case 'light':
        await setTheme('light')
        log('success', 'Theme set to: light')
        break
        
      default:
        // Try to use as theme name
        if (THEMES[subcommand as ThemeName]) {
          await setTheme(subcommand as ThemeName)
          log('success', `Theme set to: ${subcommand}`)
        } else {
          log('error', `Unknown theme: ${subcommand}`)
          listThemes()
        }
    }
  } catch (error) {
    if (error instanceof Error) {
      log('error', `Theme command failed: ${error.message}`)
    } else {
      log('error', 'Theme command failed with unknown error')
    }
  }
}

export { getCurrentTheme, setTheme, getEffectiveTheme, THEMES }
