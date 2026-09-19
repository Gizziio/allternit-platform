// biome-ignore-all assist/source/organizeImports: ANT-ONLY import markers must not be reordered
import { z } from 'zod/v4'
import { lazySchema } from '../utils/lazySchema.js'
import { type HookEvent, HOOK_EVENTS } from './../entrypoints/agentSdkTypes.ts'
// HookInput only exists in the canonical SDK tree (the ink-app
// entrypoints/sdk fork has no hookTypes module).
import type { HookInput } from '../../../../entrypoints/sdk/hookTypes.js'
import type { PermissionUpdate } from './permissions.ts'
import type { Message } from './message.ts'
import type { PermissionResult } from './../utils/permissions/PermissionResult.ts'
import { permissionBehaviorSchema } from './../utils/permissions/PermissionRule.ts'
import { permissionUpdateSchema } from './../utils/permissions/PermissionUpdateSchema.ts'
import type { AppState } from '../state/AppState.js'
import type { AttributionState } from '../utils/commitAttribution.js'

export function isHookEvent(value: string): value is HookEvent {
  return HOOK_EVENTS.includes(value as HookEvent)
}

// Prompt elicitation protocol types. The `prompt` key acts as discriminator
// (mirroring the {async:true} pattern), with the id as its value.
export const promptRequestSchema = lazySchema(() =>
  z.object({
    prompt: z.string(), // request id
    message: z.string(),
    options: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        description: z.string().optional(),
      }),
    ),
  }),
)

export type PromptRequest = z.infer<ReturnType<typeof promptRequestSchema>>

export type PromptResponse = {
  prompt_response: string // request id
  selected: string
}

// Sync hook response schema
export const syncHookResponseSchema = lazySchema(() =>
  z.object({
    continue: z
      .boolean()
      .describe('Whether Gizzi should continue after hook (default: true)')
      .optional(),
    suppressOutput: z
      .boolean()
      .describe('Hide stdout from transcript (default: false)')
      .optional(),
    stopReason: z
      .string()
      .describe('Message shown when continue is false')
      .optional(),
    decision: z.enum(['approve', 'block']).optional(),
    reason: z.string().describe('Explanation for the decision').optional(),
    systemMessage: z
      .string()
      .describe('Warning message shown to the user')
      .optional(),
    hookSpecificOutput: z
      .union([
        z.object({
          hookEventName: z.literal('PreToolUse'),
          permissionDecision: permissionBehaviorSchema().optional(),
          permissionDecisionReason: z.string().optional(),
          updatedInput: z.record(z.string(), z.unknown()).optional(),
          additionalContext: z.string().optional(),
        }),
        z.object({
          hookEventName: z.literal('UserPromptSubmit'),
          additionalContext: z.string().optional(),
        }),
        z.object({
          hookEventName: z.literal('SessionStart'),
          additionalContext: z.string().optional(),
          initialUserMessage: z.string().optional(),
          watchPaths: z
            .array(z.string())
            .describe('Absolute paths to watch for FileChanged hooks')
            .optional(),
        }),
        z.object({
          hookEventName: z.literal('Setup'),
          additionalContext: z.string().optional(),
        }),
        z.object({
          hookEventName: z.literal('SubagentStart'),
          additionalContext: z.string().optional(),
        }),
        z.object({
          hookEventName: z.literal('PostToolUse'),
          additionalContext: z.string().optional(),
          updatedMCPToolOutput: z
            .unknown()
            .describe('Updates the output for MCP tools')
            .optional(),
        }),
        z.object({
          hookEventName: z.literal('PostToolUseFailure'),
          additionalContext: z.string().optional(),
        }),
        z.object({
          hookEventName: z.literal('PermissionDenied'),
          retry: z.boolean().optional(),
        }),
        z.object({
          hookEventName: z.literal('Notification'),
          additionalContext: z.string().optional(),
        }),
        z.object({
          hookEventName: z.literal('PermissionRequest'),
          decision: z.union([
            z.object({
              behavior: z.literal('allow'),
              updatedInput: z.record(z.string(), z.unknown()).optional(),
              updatedPermissions: z.array(permissionUpdateSchema()).optional(),
            }),
            z.object({
              behavior: z.literal('deny'),
              message: z.string().optional(),
              interrupt: z.boolean().optional(),
            }),
          ]),
        }),
        z.object({
          hookEventName: z.literal('Elicitation'),
          action: z.enum(['accept', 'decline', 'cancel']).optional(),
          content: z.record(z.string(), z.unknown()).optional(),
        }),
        z.object({
          hookEventName: z.literal('ElicitationResult'),
          action: z.enum(['accept', 'decline', 'cancel']).optional(),
          content: z.record(z.string(), z.unknown()).optional(),
        }),
        z.object({
          hookEventName: z.literal('CwdChanged'),
          watchPaths: z
            .array(z.string())
            .describe('Absolute paths to watch for FileChanged hooks')
            .optional(),
        }),
        z.object({
          hookEventName: z.literal('FileChanged'),
          watchPaths: z
            .array(z.string())
            .describe('Absolute paths to watch for FileChanged hooks')
            .optional(),
        }),
        z.object({
          hookEventName: z.literal('WorktreeCreate'),
          worktreePath: z.string(),
        }),
      ])
      .optional(),
  }),
)

// Zod schema for hook JSON output validation
export const hookJSONOutputSchema = lazySchema(() => {
  // Async hook response schema
  const asyncHookResponseSchema = z.object({
    async: z.literal(true),
    asyncTimeout: z.number().optional(),
  })
  return z.union([asyncHookResponseSchema, syncHookResponseSchema()])
})

// Infer the TypeScript type from the schema
type SchemaHookJSONOutput = z.infer<ReturnType<typeof hookJSONOutputSchema>>

// The hook JSON output types are derived from the zod schema above — it is
// the runtime authority for hook responses. agentSdkTypes.ts does not export
// these names (and the canonical SDK HookJSONOutput shape requires fields the
// schema never produces, so it cannot be used here).
export type HookJSONOutput = SchemaHookJSONOutput
export type SyncHookJSONOutput = Exclude<HookJSONOutput, { async: true }>
export type AsyncHookJSONOutput = Extract<HookJSONOutput, { async: true }>

// Type guard function to check if response is sync
export function isSyncHookJSONOutput(
  json: HookJSONOutput,
): json is SyncHookJSONOutput {
  return !('async' in json && json.async === true)
}

// Type guard function to check if response is async
export function isAsyncHookJSONOutput(
  json: HookJSONOutput,
): json is AsyncHookJSONOutput {
  return 'async' in json && json.async === true
}

// Compile-time assertion that SDK and Zod types match
// Local mirror of type-fest's IsEqual — the hoisted type-fest@2.19.0 that
// resolves here predates the IsEqual export (added in v4), and adding a
// dependency is not an option.
type IsEqual<T, U> = (<G>() => G extends T ? 1 : 2) extends <G>() => G extends U
  ? 1
  : 2
  ? true
  : false
type Assert<T extends true> = T
type _assertSDKTypesMatch = Assert<
  IsEqual<SchemaHookJSONOutput, HookJSONOutput>
>

/** Context passed to callback hooks for state access */
export type HookCallbackContext = {
  getAppState: () => AppState
  updateAttributionState: (
    updater: (prev: AttributionState) => AttributionState,
  ) => void
}

/** Hook that is a callback. */
export type HookCallback = {
  type: 'callback'
  callback: (
    input: HookInput,
    toolUseID: string | null,
    abort: AbortSignal | undefined,
    /** Hook index for SessionStart hooks to compute GIZZI_ENV_FILE path */
    hookIndex?: number,
    /** Optional context for accessing app state */
    context?: HookCallbackContext,
  ) => Promise<HookJSONOutput>
  /** Timeout in seconds for this hook */
  timeout?: number
  /** Internal hooks (e.g. session file access analytics) are excluded from tengu_run_hook metrics */
  internal?: boolean
}

export type HookCallbackMatcher = {
  matcher?: string
  hooks: HookCallback[]
  pluginName?: string
}

export type HookProgress = {
  type: 'hook_progress'
  hookEvent: HookEvent
  hookName: string
  command: string
  promptText?: string
  statusMessage?: string
}

export type HookBlockingError = {
  blockingError: string
  command: string
}

export type PermissionRequestResult =
  | {
      behavior: 'allow'
      updatedInput?: Record<string, unknown>
      updatedPermissions?: PermissionUpdate[]
    }
  | {
      behavior: 'deny'
      message?: string
      interrupt?: boolean
    }

export type HookResult = {
  message?: Message
  systemMessage?: Message
  blockingError?: HookBlockingError
  outcome: 'success' | 'blocking' | 'non_blocking_error' | 'cancelled'
  preventContinuation?: boolean
  stopReason?: string
  permissionBehavior?: 'ask' | 'deny' | 'allow' | 'passthrough'
  hookPermissionDecisionReason?: string
  additionalContext?: string
  initialUserMessage?: string
  updatedInput?: Record<string, unknown>
  updatedMCPToolOutput?: unknown
  permissionRequestResult?: PermissionRequestResult
  retry?: boolean
}

export type AggregatedHookResult = {
  message?: Message
  blockingErrors?: HookBlockingError[]
  preventContinuation?: boolean
  stopReason?: string
  hookPermissionDecisionReason?: string
  permissionBehavior?: PermissionResult['behavior']
  additionalContexts?: string[]
  initialUserMessage?: string
  updatedInput?: Record<string, unknown>
  updatedMCPToolOutput?: unknown
  permissionRequestResult?: PermissionRequestResult
  retry?: boolean
}
