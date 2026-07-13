// @ts-nocheck
import type { ContentBlockParam } from '@allternit/sdk/providers/anthropic/resources/messages.js'
import type { Command } from '../commands.js'
import { getDirectConnectServerUrl } from '../bootstrap/state.js'

type GoalAction = 'pause' | 'resume' | 'complete' | 'block' | 'status'
let activeGoalId: string | undefined

interface GoalRecord {
  id: string
  objective: string
  state: string
  progress: number
  time_updated: number
}

function goalBaseUrl(): string {
  return getDirectConnectServerUrl() ?? 'http://localhost:4096'
}

async function resolveActiveGoal(): Promise<GoalRecord | undefined> {
  const response = await fetch(new URL('/v1/automations/goals', goalBaseUrl()), { headers: { Accept: 'application/json' } })
  if (!response.ok) return undefined
  const goals = await response.json() as GoalRecord[]
  return goals
    .filter((goal) => goal.id === activeGoalId || !['completed'].includes(goal.state))
    .sort((a, b) => b.time_updated - a.time_updated)[0]
}

async function handleGoalAction(action: GoalAction): Promise<string> {
  const goal = await resolveActiveGoal()
  if (!goal) return 'No active persistent goal was found.'
  activeGoalId = goal.id
  if (action === 'status') return `Goal ${goal.id}: ${goal.state}, ${goal.progress}% — ${goal.objective}`
  const endpoint = action === 'resume' ? 'run' : action
  const response = await fetch(new URL(`/v1/automations/goals/${encodeURIComponent(goal.id)}/${endpoint}`, goalBaseUrl()), { method: 'POST', headers: { Accept: 'application/json' } })
  if (!response.ok) return `Goal ${action} failed (${response.status} ${response.statusText}).`
  const nextState = action === 'resume' ? 'in progress' : action === 'complete' ? 'completed' : action === 'pause' ? 'paused' : 'blocked'
  return `Goal ${goal.id} is now ${nextState}. Do not continue autonomous work unless the goal is in progress.`
}

const GOAL_PROMPT = (id: string, args: string, persisted: boolean) => `
You are in Goal Mode (Goal ID: ${id}). Your high-level objective is:
"${args}"

Durable goal record: ${persisted ? 'connected' : 'unavailable; continue in this session and report that persistence is degraded'}.

Follow this strict loop engineering process:
1. Define a clear plan with milestones. Write the plan to the console or file.
2. Break down the current milestone into concrete tasks.
3. Execute the tasks one by one.
4. After each milestone, run only the validations authorized for this workspace and record their real output.
5. If a test or validation fails, analyze the failure, modify the files to fix the issue, and rerun validation. Do not stop until all validations pass.
6. Refine and update the plan if you discover new constraints or bugs.
7. Complete the goal only when the requested outcome is achieved and the available evidence supports completion. Otherwise report it blocked or incomplete.

Begin working on the goal immediately by creating a plan and starting the first task.
`

const goal: Command = {
  type: 'prompt',
  name: 'goal',
  description: 'Run a task continuously in an autonomous goal-directed loop until complete',
  progressMessage: 'executing goal loop',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    if (!args.trim()) return [{ type: 'text', text: 'Provide an objective: /goal <objective>' }]
    const normalized = args.trim().toLowerCase()
    if (['pause', 'resume', 'complete', 'block', 'status'].includes(normalized)) {
      try {
        return [{ type: 'text', text: await handleGoalAction(normalized as GoalAction) }]
      } catch {
        return [{ type: 'text', text: `Unable to ${normalized} the persistent goal because the goal service is unavailable.` }]
      }
    }
    let id = `goal-${Date.now()}`
    let persisted = false
    try {
      const response = await fetch(new URL('/v1/automations/goals', goalBaseUrl()), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, objective: args.trim() }),
      })
      if (response.ok) {
        const goal = await response.json() as { id?: string }
        id = goal.id ?? id
        activeGoalId = id
        persisted = true
      }
    } catch {
      // The prompt explicitly reports degraded persistence.
    }
    return [{ type: 'text', text: GOAL_PROMPT(id, args.trim(), persisted) }]
  },
}

export default goal
