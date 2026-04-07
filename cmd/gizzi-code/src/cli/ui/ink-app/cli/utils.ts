/**
 * CLI Utilities
 * TEMPORARY SHIM
 */

export function formatOutput(data: unknown): string {
  return String(data)
}

export function parseInput(input: string): unknown {
  return input
}

export default { formatOutput, parseInput }
