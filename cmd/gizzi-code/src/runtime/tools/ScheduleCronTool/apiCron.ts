import {
  createApiLoop,
  createApiRoutine,
  deleteApiLoop,
  deleteApiRoutine,
  getAllternitApiConfig,
  listApiLoops,
  listApiRoutines,
  type AllternitApiConfig,
  type ApiLoop,
  type ApiRoutine,
} from '../../services/api/allternitApi.js'

export function getApiConfig(): AllternitApiConfig {
  return getAllternitApiConfig()
}

export type ApiCronJob = {
  id: string
  schedule: string
  prompt: string
  status: string
  scope: 'persistent' | 'session'
}

export function apiRoutineToCronJob(routine: ApiRoutine): ApiCronJob {
  return {
    id: routine.id,
    schedule: routine.schedule_expression,
    prompt:
      (routine.config.prompt as string) ||
      routine.description ||
      routine.name,
    status: routine.status,
    scope: 'persistent',
  }
}

export function apiLoopToCronJob(loop: ApiLoop): ApiCronJob {
  return {
    id: loop.id,
    schedule: loop.schedule_expression,
    prompt:
      (loop.config.prompt as string) || loop.description || loop.name,
    status: loop.status,
    scope: 'session',
  }
}

export async function createApiCronJob(
  config: AllternitApiConfig,
  input: {
    schedule: string
    prompt: string
    scope: 'persistent' | 'session'
  },
): Promise<ApiCronJob> {
  if (input.scope === 'session') {
    const loop = await createApiLoop(config, {
      name: input.prompt.slice(0, 80),
      description: input.prompt,
      schedule_expression: input.schedule,
      config: { prompt: input.prompt, jobType: 'agent' },
    })
    return apiLoopToCronJob(loop)
  }

  const routine = await createApiRoutine(config, {
    name: input.prompt.slice(0, 80),
    description: input.prompt,
    schedule_expression: input.schedule,
    config: { prompt: input.prompt, jobType: 'agent' },
  })
  return apiRoutineToCronJob(routine)
}

export async function listApiCronJobs(
  config: AllternitApiConfig,
): Promise<ApiCronJob[]> {
  const [routines, loops] = await Promise.all([
    listApiRoutines(config),
    listApiLoops(config),
  ])
  return [
    ...routines.map(apiRoutineToCronJob),
    ...loops.map(apiLoopToCronJob),
  ]
}

export async function deleteApiCronJob(
  config: AllternitApiConfig,
  id: string,
): Promise<void> {
  // Try routine first, then loop. 404 on either is fine.
  try {
    await deleteApiRoutine(config, id)
    return
  } catch {
    // ignore
  }
  await deleteApiLoop(config, id)
}

export {
  createApiLoop,
  createApiRoutine,
  deleteApiLoop,
  deleteApiRoutine,
  listApiLoops,
  listApiRoutines,
}
