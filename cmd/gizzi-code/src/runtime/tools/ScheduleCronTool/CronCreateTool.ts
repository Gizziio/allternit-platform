// @ts-nocheck
import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '@/Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import {
  CRON_CREATE_TOOL_NAME,
  CRON_CREATE_DESCRIPTION,
  buildCronCreatePrompt,
  DEFAULT_MAX_AGE_DAYS,
} from './prompt.js'
import { ensureCronService } from './cronService.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    cron: z
      .string()
      .describe(
        'Standard 5-field cron expression in local time: "M H DoM Mon DoW" (e.g. "*/5 * * * *" = every 5 minutes, "30 14 28 2 *" = Feb 28 at 2:30pm local once).',
      ),
    prompt: z.string().describe('The prompt to enqueue at each fire time.'),
    recurring: z
      .boolean()
      .optional()
      .describe(
        `true (default) = fire on every cron match until deleted or auto-expired after ${DEFAULT_MAX_AGE_DAYS} days. false = fire once at the next match, then auto-delete.`,
      ),
    scope: z
      .enum(['persistent', 'session'])
      .optional()
      .describe(
        'persistent (default) stores the job in the local cron database; session scopes it to the current session only.',
      ),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    id: z.string(),
    schedule: z.string(),
    recurring: z.boolean(),
    scope: z.string(),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>
export type CreateOutput = z.infer<OutputSchema>

export const CronCreateTool = buildTool({
  name: CRON_CREATE_TOOL_NAME,
  searchHint: 'schedule a recurring or one-shot prompt',
  maxResultSizeChars: 100_000,
  shouldDefer: true,
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  isEnabled() {
    return true
  },
  toAutoClassifierInput(input) {
    return `${input.cron}: ${input.prompt}`
  },
  async description() {
    return CRON_CREATE_DESCRIPTION
  },
  async prompt() {
    return buildCronCreatePrompt()
  },
  async call({ cron, prompt, recurring = true, scope = 'persistent' }) {
    ensureCronService()

    const maxRuns = recurring ? undefined : 1
    const job = CronService.create({
      name: prompt.slice(0, 80),
      description: prompt,
      type: 'agent',
      schedule: cron,
      scope,
      maxRuns,
      config: {
        prompt,
      },
      tags: ['cron-tool'],
    })

    return {
      data: {
        id: job.id,
        schedule: cron,
        recurring,
        scope,
      },
    }
  },
  mapToolResultToToolResultBlockParam(output, toolUseID) {
    const scopeNote =
      output.scope === 'session'
        ? 'Session-only (cleaned up when this session ends)'
        : 'Persisted to local cron database'
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: output.recurring
        ? `Scheduled recurring job ${output.id} (${output.schedule}). ${scopeNote}. Auto-expires after ${DEFAULT_MAX_AGE_DAYS} days. Use CronDelete to cancel sooner.`
        : `Scheduled one-shot task ${output.id} (${output.schedule}). ${scopeNote}. It will fire once then auto-delete.`,
    }
  },
} satisfies ToolDef<InputSchema, CreateOutput>)
