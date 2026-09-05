// @ts-nocheck
import type { ContentBlockParam } from '@allternit/gizzi-sdk/providers/allternit/resources/messages.js'
import type { Command } from '../commands.js'
import { ALLTERNIT_GATEWAY_BASE } from '@/shared/constants/allternitGateway'

const LOOPS_PROMPT = (id: string, args: string) => `
You are in Loop Mode (Loop ID: ${id}). Your instruction is:
"${args}"

Follow this loop execution process:
1. Parse the command/script to run, and the completion or exit condition (if specified).
2. Execute the script or command.
3. Check the exit code or command output:
   - If the condition is met (e.g. exit code 0 or matches expected output), terminate the loop.
   - If the condition is NOT met, wait a moment, adjust the input parameters or codebase if necessary, and re-run.
4. Keep repeating up to a reasonable number of iterations (e.g. max 10 runs) until it succeeds.
5. Report the result of each iteration and the final outcome.

Begin the loop immediately by executing the first run.
`

const loops: Command = {
  type: 'prompt',
  name: 'loops',
  aliases: ['loop'],
  description: 'Execute a command or action in a loop until a condition is met',
  progressMessage: 'executing loop',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    const id = `loop-${Date.now()}`
    try {
      await fetch(`${ALLTERNIT_GATEWAY_BASE}/api/v1/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Loop: ' + args,
          workspace_id: 'default',
          status: 'in-progress',
          metadata: JSON.stringify({ type: 'loop', id, maxIterations: 10 })
        })
      })
    } catch (e) {
      // Proceed gracefully if API is offline
    }
    return [{ type: 'text', text: LOOPS_PROMPT(id, args) }]
  },
}

export default loops
