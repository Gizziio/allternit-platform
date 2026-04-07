/**
 * Built-in Plugins
 * Production-quality plugin management
 */

import { readdir, readFile, access, constants } from 'fs/promises'
import { join, extname } from 'path'
import { log } from '../utils/log.js'

export interface Plugin {
  name: string
  version: string
  description: string
  author?: string
  main: string
  hooks?: string[]
  commands?: string[]
  enabled: boolean
}

// Registry of loaded plugins
const loadedPlugins = new Map<string, Plugin>()

/**
 * Get built-in plugins directory
 */
function getBuiltinPluginsDir(): string {
  return join(__dirname, 'builtin')
}

/**
 * Load a plugin from file
 */
async function loadPluginFile(filePath: string): Promise<Plugin | null> {
  try {
    const ext = extname(filePath)
    if (ext === '.json') {
      const content = await readFile(filePath, 'utf8')
      const plugin: Plugin = JSON.parse(content)
      return validatePlugin(plugin) ? plugin : null
    }
    
    if (ext === '.ts' || ext === '.js') {
      const module = await import(filePath)
      const plugin = module.default || module.plugin
      if (plugin && validatePlugin(plugin)) {
        return plugin
      }
    }
    
    return null
  } catch (error) {
    log('error', `Failed to load plugin from ${filePath}:`, error)
    return null
  }
}

/**
 * Validate plugin structure
 */
function validatePlugin(plugin: unknown): plugin is Plugin {
  if (typeof plugin !== 'object' || plugin === null) return false
  
  const p = plugin as Plugin
  return (
    typeof p.name === 'string' &&
    p.name.length > 0 &&
    typeof p.version === 'string' &&
    typeof p.main === 'string'
  )
}

/**
 * Get all built-in plugins
 */
export async function getBuiltinPlugins(): Promise<Plugin[]> {
  const plugins: Plugin[] = []
  const dir = getBuiltinPluginsDir()
  
  try {
    await access(dir, constants.F_OK)
    const files = await readdir(dir)
    
    for (const file of files) {
      if (file.endsWith('.plugin.ts') || file.endsWith('.plugin.js') || file === 'plugin.json') {
        const filePath = join(dir, file)
        const plugin = await loadPluginFile(filePath)
        if (plugin) {
          plugins.push(plugin)
          loadedPlugins.set(plugin.name, plugin)
        }
      }
    }
  } catch {
    // Directory doesn't exist or is empty
  }
  
  return plugins
}

/**
 * Get a specific plugin
 */
export async function getPlugin(name: string): Promise<Plugin | null> {
  // Check cache first
  if (loadedPlugins.has(name)) {
    return loadedPlugins.get(name)!
  }
  
  // Load all and find
  const plugins = await getBuiltinPlugins()
  return plugins.find(p => p.name === name) || null
}

/**
 * Enable a plugin
 */
export async function enablePlugin(name: string): Promise<boolean> {
  const plugin = await getPlugin(name)
  if (!plugin) return false
  
  plugin.enabled = true
  log('info', `Enabled plugin: ${name}`)
  return true
}

/**
 * Disable a plugin
 */
export async function disablePlugin(name: string): Promise<boolean> {
  const plugin = await getPlugin(name)
  if (!plugin) return false
  
  plugin.enabled = false
  log('info', `Disabled plugin: ${name}`)
  return true
}

/**
 * Execute a plugin hook
 */
export async function executeHook(hookName: string, context: unknown): Promise<void> {
  for (const [name, plugin] of loadedPlugins) {
    if (!plugin.enabled) continue
    if (!plugin.hooks?.includes(hookName)) continue
    
    try {
      const module = await import(plugin.main)
      if (module[hookName]) {
        await module[hookName](context)
      }
    } catch (error) {
      log('error', `Plugin ${name} hook ${hookName} failed:`, error)
    }
  }
}

export default {
  getBuiltinPlugins,
  getPlugin,
  enablePlugin,
  disablePlugin,
  executeHook,
}
