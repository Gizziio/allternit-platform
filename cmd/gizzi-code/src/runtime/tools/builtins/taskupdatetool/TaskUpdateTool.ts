// @ts-nocheck
import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '@/Tool.js'
import { lazySchema } from '../../../utils/lazySchema.js'
import { isTodoV2Enabled, TaskStatusSchema } from '../../../utils/tasks.js'
import {
  apiTaskToLocalTask,
  deleteApiTask,
  getApiConfig,
  getApiTask,
  localMetadataToApiMetadata,
  localStatusToApiStatus,
  updateApiTask,
} from '../taskstool/apiTasks.js'
import { TASK_UPDATE_TOOL_NAME } from './constants.js'
import { DESCRIPTION, PROMPT } from './prompt.js'

const inputSchema = lazySchema(() => {
  // Extended status schema that includes 'deleted' as a special action
  const TaskUpdateStatusSchema = TaskStatusSchema().or(z.literal('deleted'))

  return z.strictObject({
    taskId: z.string().describe('The ID of the task to update'),
    subject: z.string().optional().describe('New subject for the task'),
    description: z.string().optional().describe('New description for the task'),
    activeForm: z
      .string()
      .optional()
      .describe(
        'Present continuous form shown in spinner when in_progress (e.g., "Running tests")',
      ),
    status: TaskUpdateStatusSchema.optional().describe(
      'New status for the task',
    ),
    addBlocks: z
      .array(z.string())
      .optional()
      .describe('Task IDs that this task blocks'),
    addBlockedBy: z
      .array(z.string())
      .optional()
      .describe('Task IDs that block this task'),
    owner: z.string().optional().describe('New owner for the task'),
    metadata: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        'Metadata keys to merge into the task. Set a key to null to delete it.',
      ),
  })
})
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    success: z.boolean(),
    taskId: z.string(),
    updatedFields: z.array(z.string()),
    error: z.string().optional(),
    statusChange: z
      .object({
        from: z.string(),
        to: z.string(),
      })
      .optional(),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>

export type Output = z.infer<OutputSchema>

export const TaskUpdateTool = buildTool({
  name: TASK_UPDATE_TOOL_NAME,
  searchHint: 'update a task',
  maxResultSizeChars: 100_000,
  async description() {
    return DESCRIPTION
  },
  async prompt() {
    return PROMPT
  },
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  userFacingName() {
    return 'TaskUpdate'
  },
  shouldDefer: true,
  isEnabled() {
    return isTodoV2Enabled()
  },
  isConcurrencySafe() {
    return true
  },
  toAutoClassifierInput(input) {
    const parts = [input.taskId]
    if (input.status) parts.push(input.status)
    if (input.subject) parts.push(input.subject)
    return parts.join(' ')
  },
  renderToolUseMessage() {
    return null
  },
  async call(
    {
      taskId,
      subject,
      description,
      status,
      owner,
      addBlocks,
      addBlockedBy,
      metadata,
    },
    context,
  ) {
    const apiConfig = getApiConfig()

    // Auto-expand task list when updating tasks
    context.setAppState(prev => {
      if (prev.expandedView === 'tasks') return prev
      return { ...prev, expandedView: 'tasks' as const }
    })

    let existingApiTask: Awaited<ReturnType<typeof getApiTask>>
    try {
      existingApiTask = await getApiTask(apiConfig, taskId)
    } catch {
      return {
        data: {
          success: false,
          taskId,
          updatedFields: [],
          error: 'Task not found',
        },
      }
    }
    const existingTask = apiTaskToLocalTask(existingApiTask)

    if (status === 'deleted') {
      await deleteApiTask(apiConfig, taskId)
      return {
        data: {
          success: true,
          taskId,
          updatedFields: ['deleted'],
          statusChange: { from: existingTask.status, to: 'deleted' },
        },
      }
    }

    const apiUpdates: {
      title?: string
      description?: string
      status?: string
      assignee_id?: string
      assignee_name?: string
      metadata?: string
    } = {}
    const updatedFields: string[] = []

    if (subject !== undefined && subject !== existingTask.subject) {
      apiUpdates.title = subject
      updatedFields.push('subject')
    }
    if (
      description !== undefined &&
      description !== existingTask.description
    ) {
      apiUpdates.description = description
      updatedFields.push('description')
    }
    if (owner !== undefined && owner !== existingTask.owner) {
      apiUpdates.assignee_id = owner
      updatedFields.push('owner')
    }
    if (status !== undefined && status !== existingTask.status) {
      apiUpdates.status = localStatusToApiStatus(status)
      updatedFields.push('status')
    }

    const mergedMetadata: Record<string, unknown> = {
      ...(existingTask.metadata ?? {}),
    }
    if (metadata !== undefined) {
      for (const [key, value] of Object.entries(metadata)) {
        if (value === null) {
          delete mergedMetadata[key]
        } else {
          mergedMetadata[key] = value
        }
      }
    }

    let newBlocks = existingTask.blocks
    if (addBlocks && addBlocks.length > 0) {
      newBlocks = [...new Set([...existingTask.blocks, ...addBlocks])]
      updatedFields.push('blocks')
    }
    let newBlockedBy = existingTask.blockedBy
    if (addBlockedBy && addBlockedBy.length > 0) {
      newBlockedBy = [...new Set([...existingTask.blockedBy, ...addBlockedBy])]
      updatedFields.push('blockedBy')
    }

    if (
      Object.keys(apiUpdates).length > 0 ||
      addBlocks?.length ||
      addBlockedBy?.length ||
      metadata !== undefined
    ) {
      apiUpdates.metadata = localMetadataToApiMetadata(
        mergedMetadata,
        newBlocks,
        newBlockedBy,
      )
      await updateApiTask(apiConfig, taskId, apiUpdates)
    }

    return {
      data: {
        success: true,
        taskId,
        updatedFields,
        statusChange:
          status !== undefined && status !== existingTask.status
            ? { from: existingTask.status, to: status }
            : undefined,
      },
    }
  },
  mapToolResultToToolResultBlockParam(content, toolUseID) {
    const {
      success,
      taskId,
      updatedFields,
      error,
      statusChange,
    } = content as Output
    if (!success) {
      // Return as non-error so it doesn't trigger sibling tool cancellation
      // in StreamingToolExecutor. "Task not found" is a benign condition
      // (e.g., task list already cleaned up) that the model can handle.
      return {
        tool_use_id: toolUseID,
        type: 'tool_result',
        content: error || `Task #${taskId} not found`,
      }
    }

    const resultContent = `Updated task #${taskId} ${updatedFields.join(', ')}`

    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: resultContent,
    }
  },
} satisfies ToolDef<InputSchema, Output>)
