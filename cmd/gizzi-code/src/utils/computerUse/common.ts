/**
 * Computer Use Common Utilities
 */

export interface ComputerUseConfig {
  enabled: boolean
  timeout?: number
}

export function getComputerUseConfig(): ComputerUseConfig {
  return { enabled: false }
}

export async function executeComputerAction(
  action: string,
  config?: ComputerUseConfig
): Promise<string> {
  return ''
}
