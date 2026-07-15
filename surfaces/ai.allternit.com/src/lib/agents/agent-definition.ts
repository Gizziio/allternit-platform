/**
 * Agent Definition Factory
 *
 * The single canonical way to construct a `CreateAgentInput`. Callers provide
 * the industry-standard agent definition fields (name, description,
 * instructions, model, tools) plus any platform-specific overrides; the
 * factory fills in canonical defaults for everything else and validates the
 * result against both the zod schema and the agent creation checklist.
 *
 * Every programmatic agent creation path (seeding, imports, integrations)
 * must go through `defineAgent` so agents always satisfy
 * AGENT_CREATION_CHECKLIST. `CreateAgentForm` builds the same shape
 * interactively and is validated by the same checklist.
 */

import type {
  AgentType,
  AppMode,
  CharacterLayerConfig,
  CreateAgentInput,
  HarnessConfig,
  MascotTemplate,
} from './agent.types';
import { validateCreateAgentInput } from './agent.types';
import { validateAgentCreationChecklist } from './agent-creation-checklist';
import { getDefaultAgentModel } from './agent-models';

/**
 * Platform-default runtime, sourced from config.models via the registry-derived
 * catalog (never hardcode model ids here — they rot).
 */
const platformDefault = getDefaultAgentModel();
export const DEFAULT_AGENT_MODEL = platformDefault.id;
export const DEFAULT_AGENT_PROVIDER: CreateAgentInput['provider'] = platformDefault.provider;
export const DEFAULT_AGENT_HARNESS: HarnessConfig = { mode: 'cloud' };
export const DEFAULT_AGENT_SURFACES: AppMode[] = ['chat'];

export interface CharacterLayerSpec {
  className?: string;
  setup?: CharacterLayerConfig['identity']['setup'];
  temperament?: CharacterLayerConfig['identity']['temperament'];
  specialtySkills?: string[];
  personalityTraits?: string[];
  backstory?: string;
  domain?: string;
  inputs?: string[];
  outputs?: string[];
  voiceStyle?: string;
  mascot?: MascotTemplate;
  primaryColor?: string;
}

/**
 * Builds a checklist-complete character layer from a compact spec.
 * Mirrors the shape produced by CreateAgentForm.
 */
export function buildCharacterLayer(spec: CharacterLayerSpec = {}): CharacterLayerConfig {
  const className = spec.className ?? 'Specialist';
  const skills = spec.specialtySkills ?? [];
  return {
    identity: {
      setup: spec.setup ?? 'generalist',
      className,
      specialtySkills: skills,
      temperament: spec.temperament ?? 'balanced',
      personalityTraits: spec.personalityTraits ?? [],
      backstory: spec.backstory ?? '',
    },
    roleCard: {
      domain: spec.domain ?? (skills.length > 0 ? skills.join(', ') : 'general assistance'),
      inputs: spec.inputs ?? [],
      outputs: spec.outputs ?? [],
      definitionOfDone: [],
      hardBans: [],
      escalation: [],
      metrics: [],
    },
    voice: {
      style: spec.voiceStyle ?? '',
      rules: [],
      microBans: [],
      tone: { formality: 0.5, enthusiasm: 0.5, empathy: 0.5, directness: 0.5 },
    },
    progression: {
      class: className,
      relevantStats: [],
      level: { maxLevel: 99, xpFormula: 'linear' },
    },
    avatar: {
      type: 'mascot',
      mascot: { template: spec.mascot ?? 'bot' },
      style: { primaryColor: spec.primaryColor ?? '#6366f1', accentColor: '#1e1c1a' },
    },
  };
}

/**
 * Minimal declarative agent definition. `instructions` is the
 * industry-standard name for the system prompt; all other
 * `CreateAgentInput` fields can be passed as overrides.
 */
export interface AgentDefinition
  extends Omit<Partial<CreateAgentInput>, 'name' | 'description' | 'characterLayer'> {
  name: string;
  description: string;
  /** System prompt. Alias for `systemPrompt`; wins if both are set. */
  instructions?: string;
  /** Compact character spec, expanded via buildCharacterLayer. */
  character?: CharacterLayerSpec;
  /** Full character layer override; takes precedence over `character`. */
  characterLayer?: CharacterLayerConfig;
}

export interface DefineAgentOptions {
  /** Throw if the required checklist items are not satisfied (default true). */
  enforceChecklist?: boolean;
}

/**
 * Expands a declarative definition into a validated, checklist-complete
 * `CreateAgentInput`. Throws on schema violations and (by default) on
 * unsatisfied required checklist items.
 */
export function defineAgent(
  definition: AgentDefinition,
  options: DefineAgentOptions = {},
): CreateAgentInput {
  const {
    instructions,
    character,
    characterLayer,
    ...overrides
  } = definition;

  const type: AgentType = overrides.type ?? 'worker';
  const capabilities = overrides.capabilities ?? [];

  const input: CreateAgentInput = {
    model: DEFAULT_AGENT_MODEL,
    provider: DEFAULT_AGENT_PROVIDER,
    ...overrides,
    name: definition.name,
    description: definition.description,
    type,
    capabilities,
    systemPrompt: instructions ?? overrides.systemPrompt,
    tools: overrides.tools ?? [],
    maxIterations: overrides.maxIterations ?? 10,
    temperature: overrides.temperature ?? 0.7,
    harness: overrides.harness ?? DEFAULT_AGENT_HARNESS,
    allowedSurfaces: overrides.allowedSurfaces ?? DEFAULT_AGENT_SURFACES,
    trustTier: overrides.trustTier ?? 'standard',
    writeScope: overrides.writeScope ?? 'workspace',
    characterLayer:
      characterLayer ??
      buildCharacterLayer({
        specialtySkills: capabilities,
        ...character,
      }),
  };

  const validated = validateCreateAgentInput(input);

  if (options.enforceChecklist !== false) {
    const checklist = validateAgentCreationChecklist(validated);
    if (!checklist.isValid) {
      const missing = checklist.items
        .filter((item) => item.required && !item.satisfied)
        .map((item) => item.id)
        .join(', ');
      throw new Error(`Agent definition "${definition.name}" fails creation checklist: ${missing}`);
    }
  }

  return validated;
}
