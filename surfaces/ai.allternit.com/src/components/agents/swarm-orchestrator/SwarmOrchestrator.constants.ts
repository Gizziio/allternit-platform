import { 
  Network, 
  Cpu, 
  Target, 
  Eye, 
  Lock 
} from '@phosphor-icons/react';
import type { 
  AgentRole, 
  RoleConfig, 
  ExecutionMode, 
  ExecutionModeConfig 
} from './types/SwarmOrchestrator.types';

export const ROLE_CONFIG: Record<AgentRole, RoleConfig> = {
  coordinator: {
    color: 'var(--accent-primary)',
    bgColor: 'rgba(212, 149, 106, 0.15)',
    borderColor: 'rgba(212, 149, 106, 0.5)',
    icon: Network,
    description: 'Orchestrates the swarm and distributes tasks',
    maxInputs: 0,
    maxOutputs: -1,
  },
  worker: {
    color: '#79C47C',
    bgColor: 'rgba(121, 196, 124, 0.15)',
    borderColor: 'rgba(121, 196, 124, 0.5)',
    icon: Cpu,
    description: 'Performs general tasks and processes data',
    maxInputs: -1,
    maxOutputs: -1,
  },
  specialist: {
    color: '#69A8C8',
    bgColor: 'rgba(105, 168, 200, 0.15)',
    borderColor: 'rgba(105, 168, 200, 0.5)',
    icon: Target,
    description: 'Handles specific domain expertise tasks',
    maxInputs: -1,
    maxOutputs: 1,
  },
  reviewer: {
    color: '#A78BFA',
    bgColor: 'rgba(167, 139, 250, 0.15)',
    borderColor: 'rgba(167, 139, 250, 0.5)',
    icon: Eye,
    description: 'Reviews and validates outputs from other agents',
    maxInputs: -1,
    maxOutputs: 1,
  },
  gatekeeper: {
    color: '#F472B6',
    bgColor: 'rgba(244, 114, 182, 0.15)',
    borderColor: 'rgba(244, 114, 182, 0.5)',
    icon: Lock,
    description: 'Controls flow and applies conditional logic',
    maxInputs: -1,
    maxOutputs: 2,
  },
};

export const EXECUTION_MODE_CONFIG: Record<ExecutionMode, ExecutionModeConfig> = {
  parallel: {
    label: 'Parallel',
    description: 'All agents work simultaneously on tasks',
  },
  sequential: {
    label: 'Sequential',
    description: 'Tasks pass from one agent to the next in order',
  },
  adaptive: {
    label: 'Adaptive',
    description: 'Swarm dynamicly routes based on agent availability',
  },
  pipeline: {
    label: 'Pipeline',
    description: 'Streamed processing through multiple specialized stages',
  },
};
