// @ts-nocheck
import type { Command } from '../../../commands'

const resume: Command = {
  type: 'local-jsx',
  name: 'resume',
  description: 'Resume a previous conversation',
  aliases: ['continue'],
  argumentHint: '[conversation id or search term]',
  load: () => import('../../../commands/resume/resume.js'),
}
export default resume
