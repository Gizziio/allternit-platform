// @ts-nocheck
import type { Command } from '../../commands.js'

const ontology = {
  type: 'local-jsx',
  name: 'ontology',
  aliases: ['dag-ontology', 'ont'],
  description: 'View the DAG runtime ontology of plans, WIHs, context packs, and receipts',
  load: () => import('./ontology.js'),
} satisfies Command

export default ontology
