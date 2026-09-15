// @ts-nocheck
import type { Command } from '../../commands'

const editPrompt = {
  type: 'local-jsx',
  name: 'edit-prompt',
  description:
    'Open $VISUAL/$EDITOR for a new prompt draft. Saving replaces the composer without sending.',
  immediate: true,
  load: () => import('./edit-prompt.js'),
} satisfies Command

export default editPrompt
