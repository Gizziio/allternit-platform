/**
 * Logout Command
 * Production-quality session termination
 */

import { logout, isAuthenticated, getCurrentUser } from '../../cli/utils/auth.js'
import { clearSession } from '../../utils/sessionStorage.js'
import { log } from '../../cli/utils/log.js'

export interface LogoutOptions {
  all?: boolean
  local?: boolean
}

/**
 * Execute logout command
 */
export default async function logoutCommand(args: string[], options: LogoutOptions = {}): Promise<void> {
  try {
    // Check if logged in
    if (!(await isAuthenticated())) {
      log('info', 'Not currently logged in')
      return
    }
    
    const user = await getCurrentUser()
    
    if (options.all) {
      // Clear all sessions
      await logout()
      await clearSession()
      log('info', `Logged out all sessions for ${user?.email}`)
    } else if (options.local) {
      // Just clear local session
      await clearSession()
      log('info', 'Cleared local session')
    } else {
      // Standard logout
      await logout()
      log('info', `Successfully logged out ${user?.email}`)
    }
  } catch (error) {
    if (error instanceof Error) {
      log('error', `Logout failed: ${error.message}`)
    } else {
      log('error', 'Logout failed with unknown error')
    }
    process.exit(1)
  }
}

/**
 * Clear all sessions (admin use)
 */
export async function clearAllSessions(): Promise<void> {
  await logout()
  await clearSession()
  log('info', 'All sessions cleared')
}

export { logout, isAuthenticated, clearSession }
