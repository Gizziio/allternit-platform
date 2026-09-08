import type {
  ComputerUseHostAdapter,
  Logger,
  OsPermissionsState,
} from './engine/types.js'
import { format } from 'util'
import { logForDebugging } from '../debug.js'
import { COMPUTER_USE_MCP_SERVER_NAME } from './common.js'
import { createCliExecutor } from './executor.js'
import { getChicagoEnabled, getChicagoSubGates } from './gates.js'

class DebugLogger implements Logger {
  silly(message: string, ...args: unknown[]): void {
    logForDebugging(format(message, ...args), { level: 'debug' })
  }
  debug(message: string, ...args: unknown[]): void {
    logForDebugging(format(message, ...args), { level: 'debug' })
  }
  info(message: string, ...args: unknown[]): void {
    logForDebugging(format(message, ...args), { level: 'info' })
  }
  warn(message: string, ...args: unknown[]): void {
    logForDebugging(format(message, ...args), { level: 'warn' })
  }
  error(message: string, ...args: unknown[]): void {
    logForDebugging(format(message, ...args), { level: 'error' })
  }
}

let cached: ComputerUseHostAdapter | undefined

/**
 * Process-lifetime singleton. Built once on first CU tool call.
 *
 * The native backend probed macOS TCC (Accessibility / Screen Recording)
 * here via @ant/computer-use-swift. The engine backend has no OS permission
 * concept — reachability surfaces naturally as a fetch error at dispatch
 * time with the engine's message — so this always reports granted.
 */
export function getComputerUseHostAdapter(): ComputerUseHostAdapter {
  if (cached) return cached
  cached = {
    serverName: COMPUTER_USE_MCP_SERVER_NAME,
    logger: new DebugLogger(),
    executor: createCliExecutor({
      getMouseAnimationEnabled: () => getChicagoSubGates().mouseAnimation,
      getHideBeforeActionEnabled: () => getChicagoSubGates().hideBeforeAction,
    }),
    ensureOsPermissions: async (): Promise<OsPermissionsState> => ({
      granted: true,
    }),
    isDisabled: () => !getChicagoEnabled(),
    getSubGates: getChicagoSubGates,
    // cleanup.ts never has anything to unhide with the engine backend (it
    // never hides host apps), but keep the flag for contract parity.
    getAutoUnhideEnabled: () => true,

    // Pixel-validation JPEG decode+crop was never available synchronously on
    // the native backend either (async-only image processor); null keeps the
    // designed fallback (validation skipped). The sub-gate defaults to false.
    cropRawPatch: () => null,
  }
  return cached
}
