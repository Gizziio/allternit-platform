// @ts-nocheck
/**
 * Token-counting helpers extracted from analyzeContext.ts so toolSearch.ts can
 * use them without pulling in the full analyzeContext graph (which depends on
 * runtime/gizzi-core/context.ts and would create a circular ESM dependency).
 *
 * NOTE: tokenEstimation and api/toolToAPISchema are imported dynamically inside
 * the async functions rather than at the top level. This keeps this module a
 * true leaf so the bundler does not pull it into the heavy ESM cycles rooted in
 * api.ts / tokenEstimation.ts.
 */
import type { ToolPermissionContext, Tools } from '../../runtime/tools/Tool.js'
import type { AgentDefinitionsResult } from '../../runtime/tools/AgentTool/loadAgentsDir.js'
import { errorMessage } from './errors.js'
import { logForDebugging } from './debug.js'
import { logError } from './log.js'

async function loadTokenEstimation() {
  const { countMessagesTokensWithAPI, countTokensViaHaikuFallback } = await import(
    '../../runtime/services/tokenEstimation.js'
  )
  return { countMessagesTokensWithAPI, countTokensViaHaikuFallback }
}

async function loadToolToAPISchema() {
  const { toolToAPISchema } = await import('./api.js')
  return toolToAPISchema
}

/**
 * Fixed token overhead added by the API when tools are present.
 * The API adds a tool prompt preamble (~500 tokens) once per API call when tools are present.
 * When we count tools individually via the token counting API, each call includes this overhead,
 * leading to N × overhead instead of 1 × overhead for N tools.
 * We subtract this overhead from per-tool counts to show accurate tool content sizes.
 */
export const TOOL_TOKEN_COUNT_OVERHEAD = 500

export async function countTokensWithFallback(
  messages: Anthropic.Beta.Messages.BetaMessageParam[],
  tools: Anthropic.Beta.Messages.BetaToolUnion[],
): Promise<number | null> {
  const { countMessagesTokensWithAPI, countTokensViaHaikuFallback } =
    await loadTokenEstimation()
  try {
    const result = await countMessagesTokensWithAPI(messages as any, tools as any)
    if (result !== null) {
      return result
    }
    logForDebugging(
      `countTokensWithFallback: API returned null, trying haiku fallback (${tools.length} tools)`,
    )
  } catch (err) {
    logForDebugging(`countTokensWithFallback: API failed: ${errorMessage(err)}`)
    logError(err)
  }

  try {
    const fallbackResult = await countTokensViaHaikuFallback(messages as any, tools as any)
    if (fallbackResult === null) {
      logForDebugging(
        `countTokensWithFallback: haiku fallback also returned null (${tools.length} tools)`,
      )
    }
    return fallbackResult
  } catch (err) {
    logForDebugging(
      `countTokensWithFallback: haiku fallback failed: ${errorMessage(err)}`,
    )
    logError(err)
    return null
  }
}

export async function countToolDefinitionTokens(
  tools: Tools,
  getToolPermissionContext: () => Promise<ToolPermissionContext>,
  agentInfo: AgentDefinitionsResult | null,
  model?: string,
): Promise<number> {
  const [toolToAPISchema] = await Promise.all([
    loadToolToAPISchema(),
    // Warm tokenEstimation in parallel with toolToAPISchema so the first call
    // after startup still has both caches ready.
    loadTokenEstimation(),
  ])
  const toolSchemas = await Promise.all(
    tools.map(tool =>
      toolToAPISchema(tool, {
        getToolPermissionContext,
        tools,
        agents: agentInfo?.activeAgents ?? [],
        model,
      }),
    ),
  )
  const result = await countTokensWithFallback([], toolSchemas as any)
  if (result === null || result === 0) {
    const toolNames = tools.map(t => t.name).join(', ')
    logForDebugging(
      `countToolDefinitionTokens returned ${result} for ${tools.length} tools: ${toolNames.slice(0, 100)}${toolNames.length > 100 ? '...' : ''}`,
    )
  }
  return result ?? 0
}
