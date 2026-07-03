// @ts-nocheck
import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '@/Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import {
  CRON_LIST_TOOL_NAME,
  CRON_LIST_DESCRIPTION,
  buildCronListPrompt,
} from './prompt.js'
import { ensureCronService } from './cronService.js'

const inputSchema = lazySchema(() => z.strictObject({}))
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    jobs: z.array(
      z.object({
        id: z.string(),
        schedule: z.string(),
        prompt: z.string(),
        status: z.string(),
        scope: z.string().optional(),
      }),
    ),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>
export type ListOutput = z.infer<OutputSchema>

export const CronListTool = buildTool({
  name: CRON_LIST_TOOL_NAME,
  searchHint: 'list active cron jobs',
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
  isConcurrencySafe() {
    return true
  },
  isReadOnly() {
    return true
  },
  async description() {
    return CRON_LIST_DESCRIPTION
  },
  async prompt() {
    return buildCronListPrompt()
  },
  async call() {
    ensureCronService()
    const jobs = CronService.list().map(job => ({
      id: job.id,
      schedule:
        job.schedule.type === 'cron'
          ? job.schedule.expression
          : `interval:${job.schedule.seconds}s`,
      prompt: (job.config as { prompt?: string }).prompt ?? job.name,
      status: job.status,
      scope: (job as { scope?: string }).scope,
    }))
    return { data: { jobs } }
  },
  mapToolResultToToolResultBlockParam(output, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content:
        output.jobs.length > 0
          ? output.jobs
              .map(
                j =>
                  `${j.id} — ${j.schedule} [${j.status}]${j.scope ? ` (${j.scope})` : ''}: ${j.prompt.slice(0, 80)}`,
              )
              .join('\n')
          : 'No scheduled jobs.',
    }
  },
} satisfies ToolDef<InputSchema, ListOutput>)
