/**
 * Bot Team Import
 *
 * Parses Markdown/YAML frontmatter team files compatible with OMB/BotMRR
 * shape and creates bots, channels, connectors, and routines from the manifest.
 *
 * Supports:
 * - Local file (File / text)
 * - Raw GitHub URL (https://raw.githubusercontent.com/...)
 *
 * @module bot-team-import
 */

import YAML from 'yaml';
import { v4 as uuidv4 } from 'uuid';
import type {
  Agent,
  AgentConnectorBinding,
  AgentIdentityChannels,
  CreateAgentInput,
} from '@/lib/agents/agent.types';
import { createAgent } from '@/lib/agents/agent.service';
import { createModuleLogger } from '@/lib/logger';
import { createBotRoutine, type BotRoutineFrequency } from './bot-routine.service';
import { isBot } from './bot-profile';

const logger = createModuleLogger('BotTeamImport');

export interface TeamManifest {
  name: string;
  description?: string;
  version?: string;
  source?: string;
  bots: TeamBotDefinition[];
  channels?: TeamChannelDefinition[];
  routines?: TeamRoutineDefinition[];
}

export interface TeamBotDefinition {
  id?: string;
  name: string;
  description?: string;
  type?: CreateAgentInput['type'];
  model?: string;
  provider?: CreateAgentInput['provider'];
  systemPrompt?: string;
  displayName: string;
  tagline?: string;
  welcomeMessage?: string;
  starterPrompts?: string[];
  accentColor?: string;
  botCategory?:
    | 'research'
    | 'code'
    | 'writing'
    | 'data'
    | 'sales'
    | 'design'
    | 'ops'
    | 'custom';
  capabilities?: string[];
  tools?: string[];
  maxIterations?: number;
  temperature?: number;
  connectorBindings?: AgentConnectorBinding[];
  identityChannels?: AgentIdentityChannels;
  secretRefs?: Array<{
    name: string;
    key: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface TeamChannelDefinition {
  botName: string;
  type: 'email' | 'phone' | 'wallet';
  config: Record<string, unknown>;
}

export interface TeamRoutineDefinition {
  botName: string;
  title: string;
  instruction: string;
  frequency: BotRoutineFrequency;
}

export interface TeamImportOptions {
  /** Rename the team on import. */
  teamName?: string;
  /** Optional adaptation prompt appended to each bot system prompt. */
  importPrompt?: string;
  /** User context passed to agent creation. */
  userId?: string;
}

export interface TeamImportResult {
  success: boolean;
  teamName?: string;
  bots: Array<{ definition: TeamBotDefinition; agent: Agent }>;
  routines: Array<{ definition: TeamRoutineDefinition; id: string }>;
  channels: TeamChannelDefinition[];
  warnings: string[];
  errors: string[];
}

export interface TeamImportPreview {
  valid: boolean;
  teamName?: string;
  botCount: number;
  channelCount: number;
  routineCount: number;
  connectorCount: number;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// Parser
// ============================================================================

const FRONTMATTER_DELIMITER = '---';

/**
 * Parse a Markdown/YAML frontmatter team file.
 *
 * The file may start with YAML frontmatter delimited by `---`. The body after
 * the frontmatter is ignored unless it contains additional YAML documents.
 */
export function parseTeamFile(content: string): TeamManifest {
  content = content.replace(/^\uFEFF/, '').trimStart();

  let frontmatterText = '';
  let body = content;

  if (content.startsWith(FRONTMATTER_DELIMITER)) {
    const endIndex = content.indexOf(FRONTMATTER_DELIMITER, FRONTMATTER_DELIMITER.length);
    if (endIndex !== -1) {
      frontmatterText = content.slice(FRONTMATTER_DELIMITER.length, endIndex).trim();
      body = content.slice(endIndex + FRONTMATTER_DELIMITER.length).trimStart();
    }
  }

  const parsed = frontmatterText
    ? (YAML.parse(frontmatterText) as Record<string, unknown>)
    : (YAML.parse(content) as Record<string, unknown>);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Team file frontmatter is not an object');
  }

  return normalizeTeamManifest(parsed);
}

function normalizeTeamManifest(raw: Record<string, unknown>): TeamManifest {
  const bots: TeamBotDefinition[] = [];
  const rawBots = raw.bots ?? raw.agents ?? raw.team ?? [];
  if (!Array.isArray(rawBots)) {
    throw new Error('Team file must contain a bots/agents/team array');
  }

  for (const rawBot of rawBots) {
    if (typeof rawBot !== 'object' || rawBot === null) {
      throw new Error('Each bot entry must be an object');
    }
    bots.push(normalizeTeamBot(rawBot as Record<string, unknown>));
  }

  if (bots.length === 0) {
    throw new Error('Team file must contain at least one bot');
  }

  const channels = normalizeChannels(raw.channels);
  const routines = normalizeRoutines(raw.routines);

  return {
    name: String(raw.name ?? 'Imported Team'),
    description: raw.description ? String(raw.description) : undefined,
    version: raw.version ? String(raw.version) : undefined,
    source: raw.source ? String(raw.source) : undefined,
    bots,
    channels,
    routines,
  };
}

function normalizeTeamBot(raw: Record<string, unknown>): TeamBotDefinition {
  const bot: TeamBotDefinition = {
    name: String(raw.name ?? raw.display_name ?? 'Unnamed Bot'),
    displayName: String(raw.displayName ?? raw.display_name ?? raw.name ?? 'Unnamed Bot'),
    description: raw.description ? String(raw.description) : undefined,
    type: normalizeAgentType(raw.type),
    model: raw.model ? String(raw.model) : undefined,
    provider: normalizeProvider(raw.provider),
    systemPrompt: raw.systemPrompt ? String(raw.systemPrompt) : undefined,
    tagline: raw.tagline ? String(raw.tagline) : undefined,
    welcomeMessage: raw.welcomeMessage ? String(raw.welcomeMessage) : undefined,
    starterPrompts: normalizeStringArray(raw.starterPrompts ?? raw.starter_prompts),
    accentColor: raw.accentColor ? String(raw.accentColor) : undefined,
    botCategory: normalizeBotCategory(raw.botCategory ?? raw.category),
    capabilities: normalizeStringArray(raw.capabilities),
    tools: normalizeStringArray(raw.tools),
    maxIterations: raw.maxIterations ? Number(raw.maxIterations) : undefined,
    temperature: raw.temperature ? Number(raw.temperature) : undefined,
    connectorBindings: normalizeConnectorBindings(raw.connectorBindings ?? raw.connectors),
    identityChannels: normalizeIdentityChannels(raw.identityChannels ?? raw.channels),
    secretRefs: normalizeSecretRefs(raw.secretRefs ?? raw.secrets),
  };

  if (!bot.displayName.trim()) {
    throw new Error('Every bot must have a displayName');
  }

  return bot;
}

function normalizeAgentType(value: unknown): TeamBotDefinition['type'] {
  const valid: TeamBotDefinition['type'][] = [
    'orchestrator',
    'sub-agent',
    'worker',
    'specialist',
    'reviewer',
  ];
  if (typeof value === 'string' && valid.includes(value as TeamBotDefinition['type'])) {
    return value as TeamBotDefinition['type'];
  }
  return 'specialist';
}

function normalizeProvider(value: unknown): TeamBotDefinition['provider'] {
  const valid: TeamBotDefinition['provider'][] = [
    'openai',
    'anthropic',
    'google',
    'local',
    'custom',
  ];
  if (typeof value === 'string' && valid.includes(value as TeamBotDefinition['provider'])) {
    return value as TeamBotDefinition['provider'];
  }
  return 'custom';
}

function normalizeBotCategory(value: unknown): TeamBotDefinition['botCategory'] {
  const valid: TeamBotDefinition['botCategory'][] = [
    'research',
    'code',
    'writing',
    'data',
    'sales',
    'design',
    'ops',
    'custom',
  ];
  if (typeof value === 'string' && valid.includes(value as TeamBotDefinition['botCategory'])) {
    return value as TeamBotDefinition['botCategory'];
  }
  return 'custom';
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return value.map((v) => String(v)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return undefined;
}

function normalizeConnectorBindings(value: unknown): AgentConnectorBinding[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((item): AgentConnectorBinding | null => {
      if (typeof item !== 'object' || item === null) return null;
      const raw = item as Record<string, unknown>;
      if (!raw.provider && !raw.connectorId) return null;
      return {
        connectorId: String(raw.connectorId ?? `${raw.provider}-${uuidv4().slice(0, 6)}`),
        provider: String(raw.provider ?? 'unknown'),
        label: raw.label ? String(raw.label) : undefined,
        capabilities: normalizeStringArray(raw.capabilities) ?? [],
        autonomous: Boolean(raw.autonomous ?? false),
        allowedActions: normalizeStringArray(raw.allowedActions),
      };
    })
    .filter((b): b is AgentConnectorBinding => b !== null);
}

function normalizeIdentityChannels(value: unknown): AgentIdentityChannels | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  return value as AgentIdentityChannels;
}

function normalizeSecretRefs(
  value: unknown,
): Array<{ name: string; key: string; description?: string; required?: boolean }> | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((item) => {
      if (typeof item !== 'object' || item === null) return null;
      const raw = item as Record<string, unknown>;
      if (!raw.name || !raw.key) return null;
      return {
        name: String(raw.name),
        key: String(raw.key),
        description: raw.description ? String(raw.description) : undefined,
        required: Boolean(raw.required ?? false),
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);
}

function normalizeChannels(value: unknown): TeamChannelDefinition[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((item): TeamChannelDefinition | null => {
      if (typeof item !== 'object' || item === null) return null;
      const raw = item as Record<string, unknown>;
      if (!raw.botName || !raw.type) return null;
      return {
        botName: String(raw.botName),
        type: String(raw.type) as TeamChannelDefinition['type'],
        config: (raw.config ?? {}) as Record<string, unknown>,
      };
    })
    .filter((c): c is TeamChannelDefinition => c !== null);
}

function normalizeRoutines(value: unknown): TeamRoutineDefinition[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((item): TeamRoutineDefinition | null => {
      if (typeof item !== 'object' || item === null) return null;
      const raw = item as Record<string, unknown>;
      if (!raw.botName || !raw.title || !raw.instruction) return null;
      return {
        botName: String(raw.botName),
        title: String(raw.title),
        instruction: String(raw.instruction),
        frequency: String(raw.frequency ?? 'daily') as BotRoutineFrequency,
      };
    })
    .filter((r): r is TeamRoutineDefinition => r !== null);
}

// ============================================================================
// Source loading
// ============================================================================

/**
 * Fetch a team file from a public raw GitHub URL.
 */
export async function fetchTeamFileFromUrl(url: string): Promise<string> {
  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Failed to fetch team file: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

/**
 * Read a team file from a browser File object.
 */
export async function readTeamFileFromDisk(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read team file'));
    reader.readAsText(file);
  });
}

// ============================================================================
// Preview
// ============================================================================

/**
 * Validate and preview a team import without creating anything.
 */
export async function previewTeamImport(content: string): Promise<TeamImportPreview> {
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    const manifest = parseTeamFile(content);

    const connectorCount = manifest.bots.reduce(
      (sum, bot) => sum + (bot.connectorBindings?.length ?? 0),
      0,
    );

    if (manifest.bots.some((bot) => !bot.description && !bot.systemPrompt)) {
      warnings.push('Some bots have neither description nor systemPrompt');
    }

    if ((manifest.channels?.length ?? 0) > 0 && !manifest.bots.some((b) => b.identityChannels)) {
      warnings.push('Channels are defined but no bots declare identityChannels');
    }

    return {
      valid: true,
      teamName: manifest.name,
      botCount: manifest.bots.length,
      channelCount: manifest.channels?.length ?? 0,
      routineCount: manifest.routines?.length ?? 0,
      connectorCount,
      errors,
      warnings,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return {
      valid: false,
      botCount: 0,
      channelCount: 0,
      routineCount: 0,
      connectorCount: 0,
      errors,
      warnings,
    };
  }
}

// ============================================================================
// Import
// ============================================================================

function buildCreateAgentInput(
  bot: TeamBotDefinition,
  options: TeamImportOptions,
): CreateAgentInput {
  const now = new Date().toISOString();
  const importPrompt = options.importPrompt?.trim();

  let systemPrompt = bot.systemPrompt ?? '';
  if (importPrompt) {
    systemPrompt = `${systemPrompt}\n\n## Import Adaptation Prompt\n${importPrompt}`.trim();
  }

  return {
    name: bot.name,
    description: bot.description ?? `Imported bot: ${bot.displayName}`,
    type: bot.type,
    model: bot.model ?? 'default',
    provider: bot.provider ?? 'custom',
    capabilities: bot.capabilities ?? [],
    systemPrompt,
    tools: bot.tools ?? [],
    maxIterations: bot.maxIterations ?? 50,
    temperature: bot.temperature ?? 0.7,
    isBot: true,
    botProfile: {
      displayName: bot.displayName,
      tagline: bot.tagline,
      welcomeMessage: bot.welcomeMessage,
      starterPrompts: bot.starterPrompts,
      accentColor: bot.accentColor,
      botCategory: bot.botCategory,
    },
    connectorBindings: bot.connectorBindings,
    identityChannels: bot.identityChannels,
    secretRefs: bot.secretRefs?.map((ref) => ({
      ...ref,
      vaultRef: undefined,
      value: undefined,
    })),
    allowedSurfaces: ['chat', 'cowork', 'code', 'design', 'browser'],
    trustTier: 'standard',
    source: 'organization',
    category: bot.botCategory === 'code' ? 'engineering' : 'general',
    tags: ['imported', 'team', bot.botCategory ?? 'custom'],
    config: {
      importedAt: now,
      importedFrom: 'team-file',
    },
  };
}

/**
 * Import a team manifest: create bots, attach channels, connector bindings, and
 * register routines.
 */
export async function importTeamFromManifest(
  manifest: TeamManifest,
  options: TeamImportOptions = {},
): Promise<TeamImportResult> {
  const result: TeamImportResult = {
    success: false,
    bots: [],
    routines: [],
    channels: [],
    warnings: [],
    errors: [],
  };

  const createdAgents = new Map<string, Agent>();

  try {
    // Create bots first so channels/routines can reference them by name.
    for (const botDef of manifest.bots) {
      try {
        const input = buildCreateAgentInput(botDef, options);
        const agent = await createAgent(input);
        createdAgents.set(botDef.name, agent);
        result.bots.push({ definition: botDef, agent });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(`Failed to create bot "${botDef.name}": ${message}`);
      }
    }

    if (result.bots.length === 0) {
      result.errors.push('No bots were created; aborting team import');
      return result;
    }

    // Create routines referencing created bots.
    for (const routineDef of manifest.routines ?? []) {
      const agent = createdAgents.get(routineDef.botName);
      if (!agent) {
        result.warnings.push(
          `Skipping routine "${routineDef.title}": bot "${routineDef.botName}" not found`,
        );
        continue;
      }
      try {
        const routine = createBotRoutine({
          botId: agent.id,
          botName: agent.botProfile?.displayName ?? agent.name,
          title: routineDef.title,
          instruction: routineDef.instruction,
          frequency: routineDef.frequency,
        });
        result.routines.push({ definition: routineDef, id: routine.id });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.warnings.push(
          `Failed to create routine "${routineDef.title}" for "${routineDef.botName}": ${message}`,
        );
      }
    }

    // Channels are declarative in the manifest; we surface them in the result.
    // The actual identity channels are part of the bot definition and were
    // passed to createAgent above.
    result.channels = manifest.channels ?? [];

    result.success = result.errors.length === 0;
    result.teamName = options.teamName ?? manifest.name;

    logger.info(
      { teamName: result.teamName, bots: result.bots.length, routines: result.routines.length },
      'Team import completed',
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(`Unexpected team import error: ${message}`);
  }

  return result;
}

/**
 * Convenience: parse and import from raw file content.
 */
export async function importTeamFromContent(
  content: string,
  options?: TeamImportOptions,
): Promise<TeamImportResult> {
  const manifest = parseTeamFile(content);
  return importTeamFromManifest(manifest, options);
}
