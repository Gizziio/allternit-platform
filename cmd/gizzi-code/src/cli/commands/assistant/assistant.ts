/**
 * Assistant Command
 * Handles assistant mode and install wizard functionality
 */

import { log } from '../../utils/log.js'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const ASSISTANT_DIR = join(homedir(), '.config', 'gizzi', 'assistant')

/**
 * Launch the assistant interface
 */
export function launchAssistant(): void {
  log('info', 'Launching Gizzi Assistant...')
  
  // Ensure assistant directory exists
  if (!existsSync(ASSISTANT_DIR)) {
    mkdirSync(ASSISTANT_DIR, { recursive: true })
  }
  
  // TODO: Implement full assistant TUI when requirements are finalized
  log('info', 'Assistant mode initialized')
  log('info', 'Assistant directory:', ASSISTANT_DIR)
}

/**
 * New install wizard for first-time setup
 */
export function NewInstallWizard(): void {
  log('info', 'Starting Gizzi installation wizard...')
  
  // Check if already configured
  const configDir = join(homedir(), '.config', 'gizzi')
  const isFirstTime = !existsSync(configDir)
  
  if (isFirstTime) {
    mkdirSync(configDir, { recursive: true })
    log('info', 'Created configuration directory')
  }
  
  // TODO: Implement interactive wizard when TUI requirements are finalized
  log('info', 'Installation wizard completed')
  log('info', 'Configuration directory:', configDir)
}

/**
 * Compute the default installation directory
 */
export function computeDefaultInstallDir(): string {
  const platform = process.platform
  
  switch (platform) {
    case 'darwin':
      return join(homedir(), 'Applications', 'Gizzi')
    case 'linux':
      return join(homedir(), '.local', 'share', 'gizzi')
    case 'win32':
      return join(homedir(), 'AppData', 'Local', 'Gizzi')
    default:
      return join(homedir(), '.gizzi')
  }
}

export default { launchAssistant, NewInstallWizard, computeDefaultInstallDir }
