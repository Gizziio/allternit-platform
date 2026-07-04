/**
 * Agent Creation Checklist
 *
 * Every agent type created in the Allternit platform must satisfy this checklist.
 * The checklist is enforced by Agent Studio and used by the registry validator.
 */

import type { Agent, CreateAgentInput } from './agent.types';

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  required: boolean;
  validate: (input: Partial<CreateAgentInput>) => boolean;
}

export const AGENT_CREATION_CHECKLIST: ChecklistItem[] = [
  {
    id: 'identity',
    label: 'Identity',
    description: 'Name, description, type, and category are defined.',
    required: true,
    validate: (input) =>
      Boolean(input.name && input.name.length >= 3) &&
      Boolean(input.description && input.description.length >= 10) &&
      Boolean(input.type),
  },
  {
    id: 'subAgentParent',
    label: 'Sub-agent Parent',
    description: 'Sub-agents must be assigned to an orchestrator parent.',
    required: true,
    validate: (input) => input.type !== 'sub-agent' || Boolean(input.parentAgentId),
  },
  {
    id: 'character',
    label: 'Character',
    description: 'Character layer includes setup, temperament, and role card.',
    required: true,
    validate: (input) =>
      Boolean(input.characterLayer?.identity?.setup) &&
      Boolean(input.characterLayer?.identity?.temperament) &&
      Boolean(input.characterLayer?.roleCard?.domain),
  },
  {
    id: 'runtime',
    label: 'Runtime',
    description: 'Model, provider, temperature, and max iterations are configured.',
    required: true,
    validate: (input) =>
      Boolean(input.model) &&
      Boolean(input.provider) &&
      typeof input.temperature === 'number' &&
      typeof input.maxIterations === 'number',
  },
  {
    id: 'harness',
    label: 'Harness',
    description: 'Per-agent AI routing mode is selected (cloud, BYOK, local, or subprocess).',
    required: true,
    validate: (input) =>
      Boolean(input.harness?.mode) &&
      ['byok', 'cloud', 'local', 'subprocess'].includes(input.harness!.mode),
  },
  {
    id: 'surfaces',
    label: 'Surfaces',
    description: 'At least one mode surface is enabled for the agent.',
    required: true,
    validate: (input) =>
      Array.isArray(input.allowedSurfaces) && input.allowedSurfaces.length > 0,
  },
  {
    id: 'trust',
    label: 'Trust & Policy',
    description: 'Trust tier and write scope are set.',
    required: true,
    validate: (input) => Boolean(input.trustTier) && Boolean(input.writeScope),
  },
  {
    id: 'tools',
    label: 'Tools & Skills',
    description: 'Allowed tools and skills are declared.',
    required: false,
    validate: (input) =>
      Array.isArray(input.tools) || Array.isArray(input.allowedSkills),
  },
  {
    id: 'avatar',
    label: 'Avatar',
    description: 'Visual representation is configured.',
    required: false,
    validate: (input) => Boolean(input.avatar),
  },
];

export interface ChecklistResult {
  items: Array<ChecklistItem & { satisfied: boolean }>;
  requiredSatisfied: number;
  requiredTotal: number;
  optionalSatisfied: number;
  optionalTotal: number;
  isValid: boolean;
}

export function validateAgentCreationChecklist(
  input: Partial<CreateAgentInput>
): ChecklistResult {
  const items = AGENT_CREATION_CHECKLIST.map((item) => ({
    ...item,
    satisfied: item.validate(input),
  }));

  const required = items.filter((i) => i.required);
  const optional = items.filter((i) => !i.required);

  return {
    items,
    requiredSatisfied: required.filter((i) => i.satisfied).length,
    requiredTotal: required.length,
    optionalSatisfied: optional.filter((i) => i.satisfied).length,
    optionalTotal: optional.length,
    isValid: required.every((i) => i.satisfied),
  };
}

export function validateAgent(agent: Partial<Agent>): ChecklistResult {
  const input: Partial<CreateAgentInput> = {
    name: agent.name,
    description: agent.description,
    type: agent.type,
    model: agent.model,
    provider: agent.provider,
    temperature: agent.temperature,
    maxIterations: agent.maxIterations,
    characterLayer: agent.characterLayer,
    harness: agent.harness,
    allowedSurfaces: agent.allowedSurfaces,
    trustTier: agent.trustTier,
    writeScope: agent.writeScope,
    tools: agent.tools,
    allowedSkills: agent.allowedSkills,
    avatar: agent.avatar as CreateAgentInput['avatar'],
  };
  return validateAgentCreationChecklist(input);
}
