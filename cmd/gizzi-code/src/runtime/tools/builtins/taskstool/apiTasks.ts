import {
  createApiTask,
  deleteApiTask,
  getAllternitApiConfig,
  getApiTask,
  listApiTasks,
  updateApiTask,
  type AllternitApiConfig,
  type ApiTask,
} from '../../../services/api/allternitApi.js'

export function isApiTasksEnabled(): boolean {
  return getAllternitApiConfig() !== null
}

export function getApiConfig(): AllternitApiConfig | null {
  return getAllternitApiConfig()
}

export function apiTaskToLocalTask(apiTask: ApiTask): {
  id: string
  subject: string
  description: string
  status: 'pending' | 'in_progress' | 'completed'
  owner?: string
  blocks: string[]
  blockedBy: string[]
  metadata?: Record<string, unknown>
} {
  let status: 'pending' | 'in_progress' | 'completed' = 'pending'
  if (apiTask.status === 'in_progress') status = 'in_progress'
  if (apiTask.status === 'completed' || apiTask.status === 'done')
    status = 'completed'

  let metadata: Record<string, unknown> | undefined
  if (apiTask.metadata) {
    try {
      metadata = JSON.parse(apiTask.metadata) as Record<string, unknown>
    } catch {
      metadata = undefined
    }
  }

  return {
    id: apiTask.id,
    subject: apiTask.title,
    description: apiTask.description ?? '',
    status,
    owner: apiTask.assignee_id ?? apiTask.assignee_name,
    blocks: (metadata?.blocks as string[]) ?? [],
    blockedBy: (metadata?.blockedBy as string[]) ?? [],
    metadata,
  }
}

export function localStatusToApiStatus(
  status: 'pending' | 'in_progress' | 'completed' | 'deleted',
): string {
  if (status === 'deleted') return 'deleted'
  return status
}

export function localMetadataToApiMetadata(
  metadata: Record<string, unknown> | undefined,
  blocks: string[],
  blockedBy: string[],
): string | undefined {
  const merged = { ...(metadata ?? {}), blocks, blockedBy }
  if (Object.keys(merged).length === 0) return undefined
  return JSON.stringify(merged)
}

export {
  createApiTask,
  deleteApiTask,
  getApiTask,
  listApiTasks,
  updateApiTask,
}
