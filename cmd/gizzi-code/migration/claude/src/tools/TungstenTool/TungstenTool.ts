/**
 * Tungsten Tool
 * TEMPORARY SHIM
 */

export class TungstenTool {
  static async clearSessionsWithTungstenUsage(): Promise<void> {
    // Placeholder
  }

  static async resetInitializationState(): Promise<void> {
    // Placeholder
  }
}

export async function clearSessionsWithTungstenUsage(): Promise<void> {
  return TungstenTool.clearSessionsWithTungstenUsage()
}

export async function resetInitializationState(): Promise<void> {
  return TungstenTool.resetInitializationState()
}

export default { TungstenTool, clearSessionsWithTungstenUsage, resetInitializationState }
