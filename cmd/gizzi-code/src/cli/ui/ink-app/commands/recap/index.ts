// @ts-nocheck
import type { ContentBlockParam } from '@allternit/gizzi-sdk/providers/allternit/resources/messages.js'
import type { Command } from '../../commands.js'

const recap = {
  type: 'prompt',
  name: 'recap',
  description:
    'Summarize this session so far: key decisions, files changed, current state, next steps',
  progressMessage: 'Summarizing the session',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(): Promise<ContentBlockParam[]> {
    return [
      {
        type: 'text',
        text: `Summarize this session so far as a concise recap the user can scan in under a minute. Cover:

1. Key decisions: the important choices made and why
2. Files changed: files created, edited, or deleted, and what changed in them
3. Current state: where things stand right now, including any errors or blockers
4. Next steps: what remains to be done, in priority order

Be factual and terse. Do not editorialize or restate the user's original request at length.`,
      },
    ]
  },
} satisfies Command

export default recap
