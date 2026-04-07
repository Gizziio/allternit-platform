/**
 * Load plugin commands
 */
import { log } from '../log.js'

export async function loadPluginCommands(): Promise<void> {
  log('info', 'Loading plugin commands')
}

export default {
  loadPluginCommands,
}
