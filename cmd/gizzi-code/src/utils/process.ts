/**
 * Process Utilities
 */

export function getProcessInfo(): { pid: number; ppid: number } {
  return { pid: process.pid, ppid: process.ppid }
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
