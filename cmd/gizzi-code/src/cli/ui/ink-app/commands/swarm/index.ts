// @ts-nocheck
import type { Command } from '../../commands.js'

const swarm = {
  type: 'local-jsx',
  name: 'swarm',
  aliases: ['swarms', 'agent-swarm'],
  description: 'Simulate Kimi-style real-time agent swarm execution with visual task tracker',
  load: () => import('./swarm.js'),
} satisfies Command

export default swarm
