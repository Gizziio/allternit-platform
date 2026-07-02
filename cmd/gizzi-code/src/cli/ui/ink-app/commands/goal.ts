// @ts-nocheck
import type { ContentBlockParam } from '@allternit/sdk/providers/anthropic/resources/messages.js'
import type { Command } from '../commands.js'

const GOAL_PROMPT = (id: string, args: string) => `
You are in Goal Mode (Goal ID: ${id}). Your high-level objective is:
"${args}"

Follow this strict loop engineering process:
1. Define a clear plan with milestones. Write the plan to the console or file.
2. Break down the current milestone into concrete tasks.
3. Execute the tasks one by one.
4. After each milestone, run validations (e.g. tests, lint checks, compilation) to verify correctness.
5. If a test or validation fails, analyze the failure, modify the files to fix the issue, and rerun validation. Do not stop until all validations pass.
6. Refine and update the plan if you discover new constraints or bugs.
7. Once all milestones are complete, run a final validation suite and output a detailed execution summary.

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
    const id = `goal-${Date.now()}`
    try {
      await fetch('http://127.0.0.1:8013/api/v1/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: args,
          workspace_id: 'default',
          status: 'in-progress',
          description: 'Goal: ' + args,
          metadata: JSON.stringify({ type: 'goal', id })
        })
      })
    } catch (e) {
      // API might be offline, proceed gracefully
    }
    return [{ type: 'text', text: GOAL_PROMPT(id, args) }]
  },
}

export default goal
