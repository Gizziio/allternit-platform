/**
 * CLI utilities
 * TEMPORARY SHIM
 */

export function logCLI(message: string): void {
  console.log(message)
}

export function parseArgs(args: string[]): Record<string, string> {
  return {}
}

export default { logCLI, parseArgs }
