// @ts-nocheck
import type { Command } from '../../commands'

const alwaysApprove = {
  type: 'local-jsx',
  name: 'always-approve',
  description:
    'Skip all permission prompts. Run again to return to ask-before-acting.',
  immediate: true,
  load: () => import('./always-approve.js'),
} satisfies Command

export default alwaysApprove
