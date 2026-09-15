// @ts-nocheck
import type { Command } from '../../commands.js'

const coworkProject = {
  type: 'local-jsx',
  name: 'cowork-project',
  aliases: ['cw-project', 'project'],
  description: 'View and manage Cowork projects and their tasks',
  load: () => import('./cowork-project.js'),
} satisfies Command

export default coworkProject
