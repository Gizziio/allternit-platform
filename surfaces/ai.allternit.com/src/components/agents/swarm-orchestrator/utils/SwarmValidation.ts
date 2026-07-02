import type { Node, Edge } from 'reactflow';
import type { 
  SwarmConfig, 
  ValidationError, 
  AgentNodeData 
} from '../types/SwarmOrchestrator.types';

export const validateSwarmConfig = (
  config: SwarmConfig,
  nodes: Node<AgentNodeData>[],
  edges: Edge[]
): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Check for empty name
  if (!config.name.trim()) {
    errors.push({
      field: 'name',
      message: 'Swarm name is required',
      severity: 'error',
    });
  }

  // Check for minimum agents
  if (nodes.length < 2) {
    errors.push({
      field: 'agents',
      message: 'Swarm must have at least 2 agents',
      severity: 'error',
    });
  }

  // Check for coordinator
  const hasCoordinator = nodes.some((n) => n.data.role === 'coordinator');
  if (!hasCoordinator) {
    errors.push({
      field: 'agents',
      message: 'Swarm should have a coordinator agent for optimal orchestration',
      severity: 'warning',
    });
  }

  // Check for orphaned agents
  const connectedAgentIds = new Set<string>();
  edges.forEach((edge) => {
    connectedAgentIds.add(edge.source);
    connectedAgentIds.add(edge.target);
  });

  nodes.forEach((node) => {
    if (!connectedAgentIds.has(node.id) && node.data.role !== 'coordinator') {
      errors.push({
        field: `agent.${node.id}`,
        message: `Agent "${node.data.name}" is not connected to the swarm`,
        severity: 'warning',
      });
    }
  });

  // Check for cycles (simplified - would need full graph analysis)
  if (edges.length > nodes.length) {
    errors.push({
      field: 'connections',
      message: 'Complex connection patterns detected - verify no circular dependencies',
      severity: 'warning',
    });
  }

  return errors;
};
