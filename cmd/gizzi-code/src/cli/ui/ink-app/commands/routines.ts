// @ts-nocheck
import type { ContentBlockParam } from '@allternit/sdk/providers/anthropic/resources/messages.js'
import type { Command } from '../commands.js'
import { ALLTERNIT_GATEWAY_BASE } from '@/shared/constants/allternitGateway'

const ROUTINES_PROMPT = (id: string, args: string) => `
You are in Routine Mode (Routine ID: ${id}). Your instruction is:
"${args}"

Follow this routine execution process:
1. If the user asked to define or save a routine:
   - Save the routine description, trigger conditions, and list of sequential commands/actions.
2. If the user asked to list routines:
   - Scan the codebase, configuration, or environment for existing routines and list them.
3. If the user asked to run a routine:
   - Execute the steps defined in the routine sequentially.
   - For each step: run the command, verify results, print the status, and feed the output of the step into the next step.
   - Stop execution immediately if any step fails.

Begin executing the requested routine action now.
`

const routines: Command = {
  type: 'prompt',
  name: 'routines',
  aliases: ['routine'],
  description: 'Manage and execute multi-step routines and workflows',
  progressMessage: 'executing routine workflow',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    const id = `routine-${Date.now()}`
    try {
      await fetch(`${ALLTERNIT_GATEWAY_BASE}/api/v1/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Routine: ' + args,
          workspace_id: 'default',
          status: 'backlog',
          metadata: JSON.stringify({ type: 'routine', id })
        })
      })
    } catch (e) {
      // Proceed gracefully if API is offline
    }
    return [{ type: 'text', text: ROUTINES_PROMPT(id, args) }]
  },
}

export default routines
