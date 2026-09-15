/**
 * Local adapter backing the gizzi-code Computer Use subtree.
 *
 * Replaces the `@ant/computer-use-mcp` package (and its `/types` and
 * `/sentinelApps` subpath imports), which was never vendored into this repo.
 * The executor backend is the Allternit Computer Use Engine via
 * `@allternit/computer-use` (sdk/computer-use).
 */

export * from './types.js'
export { bindSessionContext } from './session.js'
export type { CuDispatch } from './session.js'
export { buildComputerUseTools } from './tools.js'
export type { CuToolSpec } from './tools.js'
export { createComputerUseMcpServer } from './server.js'
export {
  createEngineExecutor,
  resolveEngineEndpoint,
} from './executor.js'
export type { EngineExecutorOptions } from './executor.js'
export { getSentinelCategory, SENTINEL_APPS } from './sentinel.js'
export type { SentinelApp, SentinelCategory } from './sentinel.js'
