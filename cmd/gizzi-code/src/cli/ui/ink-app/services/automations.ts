// @ts-nocheck
export interface AutomationGoal {
  id: string
  agent_id: string | null
  objective: string
  milestones: Array<{ name: string; status: string; completedAt?: string }>
  validations: Array<{ testName: string; status: string; output?: string }>
  state: string
  progress: number
  time_created: number
  time_updated: number
}

export interface AutomationRoutine {
  id: string
  agent_id: string | null
  name: string
  steps: Array<{ command: string; status: string }>
  trigger: string | null
  schedule: string | null
  state: string
  time_created: number
  time_updated: number
}

export interface AutomationLoop {
  id: string
  agent_id: string | null
  command: string
  exit_condition: string | null
  max_iterations: number
  iteration_log: Array<{ iteration: number; output: string; exitCode: number; timestamp: string }>
  state: string
  time_created: number
  time_updated: number
}

export interface AutomationsSnapshot {
  goals: AutomationGoal[]
  routines: AutomationRoutine[]
  loops: AutomationLoop[]
}

async function getJson<T>(baseUrl: string, path: string): Promise<T> {
  const url = new URL(path, baseUrl)
  const res = await fetch(url, { headers: { Accept: "application/json" } })
  if (!res.ok) {
    throw new Error(`Automations API error ${res.status}: ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export async function fetchAutomations(baseUrl: string): Promise<AutomationsSnapshot> {
  const [goals, routines, loops] = await Promise.all([
    getJson<AutomationGoal[]>(baseUrl, "/v1/automations/goals"),
    getJson<AutomationRoutine[]>(baseUrl, "/v1/automations/routines"),
    getJson<AutomationLoop[]>(baseUrl, "/v1/automations/loops"),
  ])
  return { goals, routines, loops }
}
