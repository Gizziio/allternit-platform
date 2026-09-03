/**
 * Packaged Team Import
 *
 * Parses OpenMausBot (OMB) / BotMRR team files and imports them as a set of
 * Allternit bots, connector bindings, and routines.
 *
 * Supported input formats:
 * - openmaus.team v1/v2 JSON
 * - openmaus.package v1 JSON
 * - BotMRR Markdown with YAML frontmatter (botmrr: 1)
 *
 * @module team-import
 */

import { parse as parseYaml } from 'yaml';
import { v4 as uuidv4 } from 'uuid';
import type { Agent, AgentConnectorBinding, CreateAgentInput } from '@/lib/agents/agent.types';
import { createAgent } from '@/lib/agents/agent.service';
import { createModuleLogger } from '@/lib/logger';
import { createBotRoutine, type CreateBotRoutineInput } from './bot-routine.service';

const logger = createModuleLogger('TeamImport');

export const TEAM_MANIFEST_FORMAT = 'openmaus.team' as const;
export const PACKAGE_MANIFEST_FORMAT = 'openmaus.package' as const;
export const BOTMRR_VERSION = 1 as const;
export const MAX_TEAM_MEMBERS = 200;

export type TeamImportSource = 'file' | 'github_url';

export interface TeamImportApp {
  label: string;
  optional: boolean;
}

export interface TeamImportMember {
  key: string;
  name: string;
  title: string;
  description?: string;
  color?: string;
  mascotExpression?: string;
}

export interface TeamImportPlaybook {
  name: string;
  description?: string;
}

export interface TeamImportRoutine {
  name: string;
  instruction: string;
  frequency?: 'startup' | 'daily' | 'weekly' | 'monthly';
}

export interface TeamImportRoom {
  name: string;
  description?: string;
}

export interface PendingTeamImport {
  /** The parsed manifest in its canonical package shape. */
  manifest: TeamManifestPackage;
  /** Display kind for the review screen. */
  kind: 'team' | 'package';
  /** Team/package name. */
  name: string;
  /** Short description. */
  description: string;
  /** Members/bots that will be created. */
  members: TeamImportMember[];
  /** Chief-of-staff member name, if declared. */
  chiefOfStaff?: string;
  /** Rooms that will be created. */
  rooms: TeamImportRoom[];
  /** Playbooks declared in the package. */
  playbooks: TeamImportPlaybook[];
  /** Routines that will be created. */
  routines: TeamImportRoutine[];
  /** Apps/connectors required by the package. */
  apps: TeamImportApp[];
}

export interface TeamManifestV2 {
  format: typeof TEAM_MANIFEST_FORMAT;
  version: 2;
  team: {
    name: string;
    description?: string;
    members: Array<{
      key: string;
      name: string;
      title?: string;
      description?: string;
      appearance?: {
        color?: string;
        mascotExpression?: string;
      };
    }>;
  };
}

export interface TeamManifestV1 {
  format: typeof TEAM_MANIFEST_FORMAT;
  version: 1;
  team: {
    name: string;
    description?: string;
    members: TeamManifestV2['team']['members'];
    room?: {
      name: string;
      bulletin?: string;
      defaultResponder?: { kind: 'member' | 'everyone' | 'mentions'; member?: string };
    };
  };
}

export interface TeamManifestPackage {
  format: typeof PACKAGE_MANIFEST_FORMAT;
  version: 1;
  package: {
    name: string;
    summary?: string;
    agents: Array<{
      key: string;
      name: string;
      title?: string;
      description?: string;
      appearance?: {
        color?: string;
        mascotExpression?: string;
      };
    }>;
    chiefOfStaff?: string;
    rooms?: Array<{ name?: string; description?: string }>;
    playbooks?: Array<{ name?: string; description?: string }>;
    routines?: Array<{ name?: string; instruction?: string; frequency?: string }>;
    requirements?: {
      apps?: Array<{ label?: string; optional?: boolean }>;
    };
  };
}

export type TeamManifestInput = TeamManifestV1 | TeamManifestV2 | TeamManifestPackage;

export interface TeamImportOptions {
  /** Optional rename for the imported team. */
  teamName?: string;
  /** Optional prompt appended to each bot's system prompt. */
  importPrompt?: string;
  /** User context for agent creation. */
  userContext?: { userId: string; userName?: string };
}

export interface CreatedBotResult {
  member: TeamImportMember;
  agent: Agent;
}

export interface TeamImportResult {
  success: boolean;
  teamName: string;
  bots: CreatedBotResult[];
  routines: { botId: string; title: string }[];
  connectorBindings: { botId: string; provider: string; label: string }[];
  channels?: SimpleTeamChannelDefinition[];
  warnings: string[];
  errors: string[];
  error?: string;
}

export interface TeamImportPreview {
  valid: boolean;
  name?: string;
  description?: string;
  kind?: 'team' | 'package';
  memberCount?: number;
  botCount?: number;
  chiefOfStaff?: string;
  roomCount?: number;
  playbookCount?: number;
  routineCount?: number;
  appCount?: number;
  connectorCount?: number;
  channelCount?: number;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// Simple YAML frontmatter (legacy bot-team-import format)
//
// The older bot-team-import module accepted Markdown files with a looser YAML
// frontmatter shape (bots/agents/team arrays, per-bot connectors, channels,
// and routines). The integration now canonicalises on the BotMRR package
// shape, but we keep a parser for these legacy files so existing team files
// still import without manual migration.
// ============================================================================

export interface SimpleTeamBotDefinition {
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
  identityChannels?: Record<string, unknown>;
  secretRefs?: Array<{
    name: string;
    key: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface SimpleTeamChannelDefinition {
  botName: string;
  type: 'email' | 'phone' | 'wallet';
  config: Record<string, unknown>;
}

export interface SimpleTeamRoutineDefinition {
  botName: string;
  title: string;
  instruction: string;
  frequency: CreateBotRoutineInput['frequency'];
}

export interface SimpleTeamManifest {
  name: string;
  description?: string;
  version?: string;
  source?: string;
  bots: SimpleTeamBotDefinition[];
  channels?: SimpleTeamChannelDefinition[];
  routines?: SimpleTeamRoutineDefinition[];
}

// ============================================================================
// Parsing helpers
// ============================================================================

function assertObject(value: unknown, message: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(message);
  }
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeAppearance(appearance?: unknown): Pick<TeamImportMember, 'color' | 'mascotExpression'> {
  assertObject(appearance ?? {}, 'member.appearance must be an object');
  const app = (appearance ?? {}) as Record<string, unknown>;
  return {
    color: optionalString(app.color),
    mascotExpression: optionalString(app.mascotExpression),
  };
}

function normalizeMember(value: unknown, index: number): TeamImportMember {
  assertObject(value, `Team member ${index + 1} is invalid`);
  const member = value as Record<string, unknown>;
  const appearance = normalizeAppearance(member.appearance);
  return {
    key: requiredString(member.key, `Member ${index + 1} key`),
    name: requiredString(member.name, `Member ${index + 1} name`),
    title: optionalString(member.title) ?? '',
    description: optionalString(member.description),
    ...appearance,
  };
}

function parseTeamV1(root: Record<string, unknown>): PendingTeamImport {
  assertObject(root.team, 'team field is missing');
  const team = root.team as Record<string, unknown>;
  const members = parseMembers(team.members);
  const rooms: TeamImportRoom[] = [];
  if (team.room && typeof team.room === 'object' && !Array.isArray(team.room)) {
    const room = team.room as Record<string, unknown>;
    rooms.push({ name: requiredString(room.name, 'room name'), description: optionalString(room.bulletin) });
  }
  return {
    manifest: root as unknown as TeamManifestPackage,
    kind: 'team',
    name: requiredString(team.name, 'team name'),
    description: optionalString(team.description) ?? '',
    members,
    rooms,
    playbooks: [],
    routines: [],
    apps: [],
  };
}

function parseTeamV2(root: Record<string, unknown>): PendingTeamImport {
  assertObject(root.team, 'team field is missing');
  const team = root.team as Record<string, unknown>;
  const members = parseMembers(team.members);
  return {
    manifest: root as unknown as TeamManifestPackage,
    kind: 'team',
    name: requiredString(team.name, 'team name'),
    description: optionalString(team.description) ?? '',
    members,
    rooms: [],
    playbooks: [],
    routines: [],
    apps: [],
  };
}

function parseMembers(value: unknown): TeamImportMember[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('A team needs at least one member');
  }
  if (value.length > MAX_TEAM_MEMBERS) {
    throw new Error(`A team can have at most ${MAX_TEAM_MEMBERS} members`);
  }
  return value.map(normalizeMember);
}

function parsePackage(root: Record<string, unknown>): PendingTeamImport {
  assertObject(root.package, 'package field is missing');
  const pkg = root.package as Record<string, unknown>;
  const agents = parsePackageAgents(pkg.agents);
  const members: TeamImportMember[] = agents.map((a) => ({
    key: a.key,
    name: a.name,
    title: a.title ?? '',
    description: a.description,
    color: a.color,
    mascotExpression: a.mascotExpression,
  }));

  const chiefKey = optionalString(pkg.chiefOfStaff);
  const chiefOfStaff = chiefKey ? members.find((m) => m.key === chiefKey)?.name : undefined;

  const rooms: TeamImportRoom[] = [];
  if (Array.isArray(pkg.rooms)) {
    for (const [index, room] of pkg.rooms.entries()) {
      if (!room || typeof room !== 'object' || Array.isArray(room)) continue;
      const r = room as Record<string, unknown>;
      const name = optionalString(r.name);
      if (name) {
        rooms.push({ name, description: optionalString(r.description) });
      } else {
        rooms.push({ name: `Room ${index + 1}`, description: optionalString(r.description) });
      }
    }
  }

  const playbooks: TeamImportPlaybook[] = [];
  if (Array.isArray(pkg.playbooks)) {
    for (const pb of pkg.playbooks) {
      if (!pb || typeof pb !== 'object' || Array.isArray(pb)) continue;
      const p = pb as Record<string, unknown>;
      const name = optionalString(p.name);
      if (name) playbooks.push({ name, description: optionalString(p.description) });
    }
  }

  const routines: TeamImportRoutine[] = [];
  if (Array.isArray(pkg.routines)) {
    for (const rt of pkg.routines) {
      if (!rt || typeof rt !== 'object' || Array.isArray(rt)) continue;
      const r = rt as Record<string, unknown>;
      const name = optionalString(r.name);
      const instruction = optionalString(r.instruction);
      if (name && instruction) {
        const frequency = normalizeRoutineFrequency(r.frequency);
        routines.push({ name, instruction, frequency });
      }
    }
  }

  const apps = parseApps(pkg.requirements);

  return {
    manifest: root as unknown as TeamManifestPackage,
    kind: 'package',
    name: requiredString(pkg.name, 'package name'),
    description: optionalString(pkg.summary) ?? '',
    members,
    ...(chiefOfStaff ? { chiefOfStaff } : {}),
    rooms,
    playbooks,
    routines,
    apps,
  };
}

function parsePackageAgents(value: unknown): Array<{
  key: string;
  name: string;
  title?: string;
  description?: string;
  color?: string;
  mascotExpression?: string;
}> {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('A package needs at least one agent');
  }
  if (value.length > MAX_TEAM_MEMBERS) {
    throw new Error(`A package can have at most ${MAX_TEAM_MEMBERS} agents`);
  }
  return value.map((agent, index) => {
    assertObject(agent, `Package agent ${index + 1} is invalid`);
    const a = agent as Record<string, unknown>;
    const appearance = normalizeAppearance(a.appearance);
    return {
      key: requiredString(a.key, `Agent ${index + 1} key`),
      name: requiredString(a.name, `Agent ${index + 1} name`),
      title: optionalString(a.title),
      description: optionalString(a.description),
      ...appearance,
    };
  });
}

function parseApps(value: unknown): TeamImportApp[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const requirements = value as Record<string, unknown>;
  if (!Array.isArray(requirements.apps)) return [];
  return requirements.apps.flatMap((app) => {
    if (!app || typeof app !== 'object' || Array.isArray(app)) return [];
    const a = app as Record<string, unknown>;
    const label = optionalString(a.label);
    return label ? [{ label, optional: a.optional === true }] : [];
  });
}

function normalizeRoutineFrequency(value: unknown): TeamImportRoutine['frequency'] {
  const str = typeof value === 'string' ? value.toLowerCase() : '';
  switch (str) {
    case 'startup':
      return 'startup';
    case 'weekly':
      return 'weekly';
    case 'monthly':
      return 'monthly';
    case 'daily':
    default:
      return 'daily';
  }
}

function markdownPackage(markdown: string): TeamManifestPackage {
  const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) throw new Error('This Markdown is missing its BotMRR frontmatter.');
  let metadata: unknown;
  try {
    metadata = parseYaml(frontmatter[1]);
  } catch {
    throw new Error('This Markdown has invalid YAML frontmatter.');
  }
  assertObject(metadata, 'frontmatter must be an object');
  const { botmrr, ...pkg } = metadata as Record<string, unknown>;
  if (botmrr !== BOTMRR_VERSION) {
    throw new Error(`This BotMRR Markdown version ${String(botmrr)} is not supported.`);
  }
  return {
    format: PACKAGE_MANIFEST_FORMAT,
    version: 1,
    package: pkg as TeamManifestPackage['package'],
  };
}

function normalizeManifestToPackage(manifest: TeamManifestInput): TeamManifestPackage {
  if (manifest.format === PACKAGE_MANIFEST_FORMAT) return manifest;
  // Convert a legacy team manifest into the package shape so downstream import
  // logic only has one canonical format to handle.
  return {
    format: PACKAGE_MANIFEST_FORMAT,
    version: 1,
    package: {
      name: manifest.team.name,
      summary: manifest.team.description,
      agents: manifest.team.members.map((m) => ({
        key: m.key,
        name: m.name,
        title: m.title,
        description: m.description,
        appearance: m.appearance,
      })),
      rooms:
        manifest.version === 1 && 'room' in manifest.team && manifest.team.room
          ? [{ name: manifest.team.room.name, description: manifest.team.room.bulletin }]
          : [],
      playbooks: [],
      routines: [],
      requirements: { apps: [] },
    },
  };
}

// ============================================================================
// Simple YAML frontmatter parser (legacy bot-team-import format)
// ============================================================================

const FRONTMATTER_DELIMITER = '---';

function parseSimpleYamlManifest(content: string): SimpleTeamManifest {
  const trimmed = content.replace(/^\uFEFF/, '').trimStart();

  let frontmatterText = '';
  let body = trimmed;

  if (trimmed.startsWith(FRONTMATTER_DELIMITER)) {
    const endIndex = trimmed.indexOf(FRONTMATTER_DELIMITER, FRONTMATTER_DELIMITER.length);
    if (endIndex !== -1) {
      frontmatterText = trimmed.slice(FRONTMATTER_DELIMITER.length, endIndex).trim();
      body = trimmed.slice(endIndex + FRONTMATTER_DELIMITER.length).trimStart();
    }
  }

  const parsed = frontmatterText
    ? (parseYaml(frontmatterText) as Record<string, unknown>)
    : (parseYaml(trimmed) as Record<string, unknown>);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Team file frontmatter is not an object');
  }

  return normalizeSimpleYamlManifest(parsed);
}

function normalizeSimpleYamlManifest(raw: Record<string, unknown>): SimpleTeamManifest {
  const bots: SimpleTeamBotDefinition[] = [];
  const rawBots = raw.bots ?? raw.agents ?? raw.team ?? [];
  if (!Array.isArray(rawBots)) {
    throw new Error('Team file must contain a bots/agents/team array');
  }

  for (const rawBot of rawBots) {
    if (typeof rawBot !== 'object' || rawBot === null) {
      throw new Error('Each bot entry must be an object');
    }
    bots.push(normalizeSimpleYamlBot(rawBot as Record<string, unknown>));
  }

  if (bots.length === 0) {
    throw new Error('Team file must contain at least one bot');
  }

  const channels = normalizeSimpleYamlChannels(raw.channels);
  const routines = normalizeSimpleYamlRoutines(raw.routines);

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

function normalizeSimpleYamlBot(raw: Record<string, unknown>): SimpleTeamBotDefinition {
  const bot: SimpleTeamBotDefinition = {
    name: String(raw.name ?? raw.display_name ?? 'Unnamed Bot'),
    displayName: String(raw.displayName ?? raw.display_name ?? raw.name ?? 'Unnamed Bot'),
    description: raw.description ? String(raw.description) : undefined,
    type: normalizeSimpleYamlAgentType(raw.type),
    model: raw.model ? String(raw.model) : undefined,
    provider: normalizeSimpleYamlProvider(raw.provider),
    systemPrompt: raw.systemPrompt ? String(raw.systemPrompt) : undefined,
    tagline: raw.tagline ? String(raw.tagline) : undefined,
    welcomeMessage: raw.welcomeMessage ? String(raw.welcomeMessage) : undefined,
    starterPrompts: normalizeSimpleYamlStringArray(raw.starterPrompts ?? raw.starter_prompts),
    accentColor: raw.accentColor ? String(raw.accentColor) : undefined,
    botCategory: normalizeSimpleYamlBotCategory(raw.botCategory ?? raw.category),
    capabilities: normalizeSimpleYamlStringArray(raw.capabilities),
    tools: normalizeSimpleYamlStringArray(raw.tools),
    maxIterations: raw.maxIterations ? Number(raw.maxIterations) : undefined,
    temperature: raw.temperature ? Number(raw.temperature) : undefined,
    connectorBindings: normalizeSimpleYamlConnectorBindings(raw.connectorBindings ?? raw.connectors),
    identityChannels: normalizeSimpleYamlIdentityChannels(raw.identityChannels ?? raw.channels),
    secretRefs: normalizeSimpleYamlSecretRefs(raw.secretRefs ?? raw.secrets),
  };

  if (!bot.displayName.trim()) {
    throw new Error('Every bot must have a displayName');
  }

  return bot;
}

function normalizeSimpleYamlAgentType(value: unknown): SimpleTeamBotDefinition['type'] {
  const valid: SimpleTeamBotDefinition['type'][] = [
    'orchestrator',
    'sub-agent',
    'worker',
    'specialist',
    'reviewer',
  ];
  if (typeof value === 'string' && valid.includes(value as SimpleTeamBotDefinition['type'])) {
    return value as SimpleTeamBotDefinition['type'];
  }
  return 'specialist';
}

function normalizeSimpleYamlProvider(value: unknown): SimpleTeamBotDefinition['provider'] {
  const valid: SimpleTeamBotDefinition['provider'][] = [
    'openai',
    'anthropic',
    'google',
    'local',
    'custom',
  ];
  if (typeof value === 'string' && valid.includes(value as SimpleTeamBotDefinition['provider'])) {
    return value as SimpleTeamBotDefinition['provider'];
  }
  return 'custom';
}

function normalizeSimpleYamlBotCategory(value: unknown): SimpleTeamBotDefinition['botCategory'] {
  const valid: SimpleTeamBotDefinition['botCategory'][] = [
    'research',
    'code',
    'writing',
    'data',
    'sales',
    'design',
    'ops',
    'custom',
  ];
  if (typeof value === 'string' && valid.includes(value as SimpleTeamBotDefinition['botCategory'])) {
    return value as SimpleTeamBotDefinition['botCategory'];
  }
  return 'custom';
}

function normalizeSimpleYamlStringArray(value: unknown): string[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return value.map((v) => String(v)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return undefined;
}

function normalizeSimpleYamlConnectorBindings(value: unknown): AgentConnectorBinding[] | undefined {
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
        capabilities: normalizeSimpleYamlStringArray(raw.capabilities) ?? [],
        autonomous: Boolean(raw.autonomous ?? false),
        allowedActions: normalizeSimpleYamlStringArray(raw.allowedActions),
      };
    })
    .filter((b): b is AgentConnectorBinding => b !== null);
}

function normalizeSimpleYamlIdentityChannels(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function normalizeSimpleYamlSecretRefs(
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

function normalizeSimpleYamlChannels(value: unknown): SimpleTeamChannelDefinition[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((item): SimpleTeamChannelDefinition | null => {
      if (typeof item !== 'object' || item === null) return null;
      const raw = item as Record<string, unknown>;
      if (!raw.botName || !raw.type) return null;
      return {
        botName: String(raw.botName),
        type: String(raw.type) as SimpleTeamChannelDefinition['type'],
        config: (raw.config ?? {}) as Record<string, unknown>,
      };
    })
    .filter((c): c is SimpleTeamChannelDefinition => c !== null);
}

function normalizeSimpleYamlRoutines(value: unknown): SimpleTeamRoutineDefinition[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((item): SimpleTeamRoutineDefinition | null => {
      if (typeof item !== 'object' || item === null) return null;
      const raw = item as Record<string, unknown>;
      if (!raw.botName || !raw.title || !raw.instruction) return null;
      return {
        botName: String(raw.botName),
        title: String(raw.title),
        instruction: String(raw.instruction),
        frequency: String(raw.frequency ?? 'daily') as CreateBotRoutineInput['frequency'],
      };
    })
    .filter((r): r is SimpleTeamRoutineDefinition => r !== null);
}

function isSimpleYamlFormat(content: string): boolean {
  const trimmed = content.replace(/^\uFEFF/, '').trimStart();
  let yamlText = trimmed;

  if (trimmed.startsWith(FRONTMATTER_DELIMITER)) {
    const endIndex = trimmed.indexOf(FRONTMATTER_DELIMITER, FRONTMATTER_DELIMITER.length);
    if (endIndex !== -1) {
      yamlText = trimmed.slice(FRONTMATTER_DELIMITER.length, endIndex).trim();
    }
  }

  try {
    const parsed = parseYaml(yamlText) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== 'object') return false;
    return (
      !('botmrr' in parsed) &&
      !('format' in parsed) &&
      (Array.isArray(parsed.bots) || Array.isArray(parsed.agents) || Array.isArray(parsed.team))
    );
  } catch {
    return false;
  }
}

function simpleYamlToPendingImport(manifest: SimpleTeamManifest): PendingTeamImport {
  return {
    manifest: normalizeManifestToPackage({
      format: TEAM_MANIFEST_FORMAT,
      version: 2,
      team: {
        name: manifest.name,
        description: manifest.description,
        members: manifest.bots.map((bot) => ({
          key: bot.id ?? bot.name,
          name: bot.displayName,
          title: bot.tagline,
          description: bot.description ?? bot.systemPrompt,
          appearance: {
            color: bot.accentColor,
          },
        })),
      },
    } as TeamManifestV2),
    kind: 'package',
    name: manifest.name,
    description: manifest.description ?? '',
    members: manifest.bots.map((bot) => ({
      key: bot.id ?? bot.name,
      name: bot.displayName,
      title: bot.tagline ?? '',
      description: bot.description ?? bot.systemPrompt,
      color: bot.accentColor,
    })),
    rooms: [],
    playbooks: [],
    routines:
      manifest.routines?.map((routine) => ({
        name: routine.title,
        instruction: routine.instruction,
        frequency: routine.frequency,
      })) ?? [],
    apps: [],
  };
}

function previewSimpleYamlManifest(manifest: SimpleTeamManifest): TeamImportPreview {
  const connectorCount = manifest.bots.reduce(
    (sum, bot) => sum + (bot.connectorBindings?.length ?? 0),
    0,
  );
  const warnings: string[] = [];

  if (manifest.bots.some((bot) => !bot.description && !bot.systemPrompt)) {
    warnings.push('Some bots have neither description nor systemPrompt');
  }

  if ((manifest.channels?.length ?? 0) > 0 && !manifest.bots.some((b) => b.identityChannels)) {
    warnings.push('Channels are defined but no bots declare identityChannels');
  }

  return {
    valid: true,
    name: manifest.name,
    description: manifest.description,
    kind: 'package',
    memberCount: manifest.bots.length,
    botCount: manifest.bots.length,
    roomCount: 0,
    playbookCount: 0,
    routineCount: manifest.routines?.length ?? 0,
    appCount: 0,
    connectorCount,
    channelCount: manifest.channels?.length ?? 0,
    errors: [],
    warnings,
  };
}

// ============================================================================
// Public parser
// ============================================================================

/**
 * Parse a raw team manifest (JSON object or Markdown string) into the canonical
 * preview shape. Throws human-readable errors for invalid input.
 */
export function teamImportPreview(manifest: unknown): PendingTeamImport {
  if (typeof manifest === 'string') {
    const trimmed = manifest.trim();
    if (trimmed.startsWith('{')) {
      try {
        manifest = JSON.parse(trimmed);
      } catch {
        throw new Error('Invalid JSON team file.');
      }
    } else if (isSimpleYamlFormat(trimmed)) {
      const simpleManifest = parseSimpleYamlManifest(trimmed);
      return simpleYamlToPendingImport(simpleManifest);
    } else {
      manifest = markdownPackage(manifest);
    }
  }
  assertObject(manifest, 'This file does not contain a team.');
  const root = manifest as Record<string, unknown>;

  if (root.format === PACKAGE_MANIFEST_FORMAT) {
    const preview = parsePackage(root);
    preview.manifest = normalizeManifestToPackage(preview.manifest);
    return preview;
  }

  if (root.format !== TEAM_MANIFEST_FORMAT) {
    throw new Error('This is not a BotMRR playbook or legacy OpenMaus team.');
  }

  const version = root.version;
  let preview: PendingTeamImport;
  if (version === 1) {
    preview = parseTeamV1(root);
  } else if (version === 2) {
    preview = parseTeamV2(root);
  } else {
    throw new Error(`Team file version ${String(version)} is not supported.`);
  }

  preview.manifest = normalizeManifestToPackage(preview.manifest);
  return preview;
}

/**
 * Validate a team file without importing it. Returns a small preview summary.
 */
export function previewTeamImport(file: File | string): Promise<TeamImportPreview> {
  return new Promise((resolve) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    const finish = (text: string) => {
      if (isSimpleYamlFormat(text)) {
        try {
          const manifest = parseSimpleYamlManifest(text);
          resolve(previewSimpleYamlManifest(manifest));
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err));
          resolve({ valid: false, errors, warnings });
        }
        return;
      }

      try {
        const preview = teamImportPreview(text);
        resolve({
          valid: true,
          name: preview.name,
          description: preview.description,
          kind: preview.kind,
          memberCount: preview.members.length,
          botCount: preview.members.length,
          chiefOfStaff: preview.chiefOfStaff,
          roomCount: preview.rooms.length,
          playbookCount: preview.playbooks.length,
          routineCount: preview.routines.length,
          appCount: preview.apps.length,
          connectorCount: preview.apps.length,
          channelCount: 0,
          errors,
          warnings,
        });
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
        resolve({
          valid: false,
          errors,
          warnings,
        });
      }
    };

    if (typeof file === 'string') {
      finish(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => finish(String(reader.result ?? ''));
    reader.onerror = () => {
      errors.push('Failed to read team file');
      resolve({ valid: false, errors, warnings });
    };
    reader.readAsText(file);
  });
}

// ============================================================================
// Import helpers
// ============================================================================

const APP_TO_PROVIDER: Record<string, string> = {
  gmail: 'gmail',
  'google sheets': 'google_sheets',
  'google drive': 'google_drive',
  reddit: 'reddit',
  slack: 'slack',
  github: 'github',
  twitter: 'twitter',
  linkedin: 'linkedin',
};

function providerSlugFromAppLabel(label: string): string {
  const normalized = label.trim().toLowerCase();
  return APP_TO_PROVIDER[normalized] ?? normalized.replace(/\s+/g, '_');
}

function mapColorToHex(color?: string): string | undefined {
  if (!color) return undefined;
  const palette: Record<string, string> = {
    green: '#22c55e',
    blue: '#3b82f6',
    red: '#ef4444',
    orange: '#f97316',
    purple: '#8b5cf6',
    cyan: '#06b6d4',
    pink: '#ec4899',
    yellow: '#eab308',
    teal: '#14b8a6',
    coral: '#f43f5e',
  };
  return palette[color.toLowerCase()] ?? color;
}

function memberToCreateInput(
  member: TeamImportMember,
  teamName: string,
  options: TeamImportOptions,
): CreateAgentInput {
  const now = new Date().toISOString();
  const importPrompt = options.importPrompt?.trim();
  const basePrompt = member.description
    ? `You are ${member.name}, ${member.title || 'a teammate'} on the ${teamName} team.\n\n${member.description}`
    : `You are ${member.name}, ${member.title || 'a teammate'} on the ${teamName} team.`;
  const systemPrompt = importPrompt ? `${basePrompt}\n\n## Import Adaptation Prompt\n${importPrompt}`.trim() : basePrompt;

  return {
    name: member.name,
    description: member.description ?? `Member of the ${teamName} team`,
    type: 'specialist',
    model: 'default',
    provider: 'custom',
    capabilities: [],
    systemPrompt,
    tools: [],
    maxIterations: 50,
    temperature: 0.7,
    isBot: true,
    botProfile: {
      displayName: member.name,
      tagline: member.title,
      welcomeMessage: `Hi, I'm ${member.name}. How can I help?`,
      starterPrompts: [],
      accentColor: mapColorToHex(member.color),
      groupChatEnabled: true,
      botCategory: 'custom',
      lifecycle: 'active',
    },
    source: 'organization',
    category: 'general',
    tags: ['imported', 'team', teamName.toLowerCase().replace(/\s+/g, '-')],
    config: {
      importedAt: now,
      importedFrom: 'team',
      teamName,
      memberKey: member.key,
    },
  };
}

function buildConnectorBindings(apps: TeamImportApp[]): AgentConnectorBinding[] {
  return apps
    .filter((app) => !app.optional)
    .map((app) => ({
      connectorId: `conn_${providerSlugFromAppLabel(app.label)}_${uuidv4().slice(0, 6)}`,
      provider: providerSlugFromAppLabel(app.label),
      label: app.label,
      capabilities: [providerSlugFromAppLabel(app.label)],
      autonomous: false,
    }));
}

// ============================================================================
// Simple YAML frontmatter import (legacy bot-team-import format)
// ============================================================================

function buildCreateAgentInputFromSimpleBot(
  bot: SimpleTeamBotDefinition,
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
      name: ref.name,
      key: ref.key,
      description: ref.description,
      required: ref.required ?? false,
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

async function importSimpleYamlManifest(
  manifest: SimpleTeamManifest,
  options: TeamImportOptions = {},
): Promise<TeamImportResult> {
  const result: TeamImportResult = {
    success: false,
    teamName: options.teamName ?? manifest.name,
    bots: [],
    routines: [],
    connectorBindings: [],
    warnings: [],
    errors: [],
  };

  const createdAgents = new Map<string, Agent>();

  try {
    for (const botDef of manifest.bots) {
      try {
        const input = buildCreateAgentInputFromSimpleBot(botDef, options);
        const agent = await createAgent(input);
        createdAgents.set(botDef.name, agent);
        result.bots.push({ member: simpleBotToMember(botDef), agent });
        for (const binding of input.connectorBindings ?? []) {
          result.connectorBindings.push({
            botId: agent.id,
            provider: binding.provider,
            label: binding.label ?? binding.provider,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(`Failed to create bot "${botDef.name}": ${message}`);
      }
    }

    if (result.bots.length === 0) {
      result.errors.push('No bots were created; aborting team import');
      return result;
    }

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
        result.routines.push({ botId: agent.id, title: routineDef.title });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.warnings.push(
          `Failed to create routine "${routineDef.title}" for "${routineDef.botName}": ${message}`,
        );
      }
    }

    result.channels = manifest.channels ?? [];
    result.success = result.errors.length === 0;

    logger.info(
      { teamName: result.teamName, bots: result.bots.length, routines: result.routines.length },
      'Imported simple YAML team',
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(`Unexpected team import error: ${message}`);
  }

  return result;
}

function simpleBotToMember(bot: SimpleTeamBotDefinition): TeamImportMember {
  return {
    key: bot.id ?? bot.name,
    name: bot.displayName,
    title: bot.tagline ?? '',
    description: bot.description ?? bot.systemPrompt,
    color: bot.accentColor,
  };
}

// ============================================================================
// Public import API
// ============================================================================

/**
 * Import a team/package from a File object.
 */
export async function importTeamFromFile(
  file: File,
  options: TeamImportOptions = {},
): Promise<TeamImportResult> {
  const text = await file.text();
  return importTeamFromText(text, options);
}

/**
 * Import a team/package from a GitHub raw URL.
 */
export async function importTeamFromGitHubUrl(
  url: string,
  options: TeamImportOptions = {},
): Promise<TeamImportResult> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch team file from GitHub: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  return importTeamFromText(text, options);
}

/**
 * Import a team/package from a raw Markdown/JSON string.
 *
 * This is the canonical entry point; `importTeamFromContent` is kept as a
 * compatibility alias for callers that came from the older bot-team-import
 * module.
 */
export async function importTeamFromText(
  text: string,
  options: TeamImportOptions = {},
): Promise<TeamImportResult> {
  if (isSimpleYamlFormat(text)) {
    const manifest = parseSimpleYamlManifest(text);
    return importSimpleYamlManifest(manifest, options);
  }

  const warnings: string[] = [];

  try {
    const preview = teamImportPreview(text);
    const teamName = options.teamName?.trim() || preview.name;

    const createdBots: CreatedBotResult[] = [];
    const connectorBindings: TeamImportResult['connectorBindings'] = [];

    for (const member of preview.members) {
      const input = memberToCreateInput(member, teamName, options);
      input.connectorBindings = buildConnectorBindings(preview.apps);
      const agent = await createAgent(input);
      createdBots.push({ member, agent });
      for (const binding of input.connectorBindings) {
        connectorBindings.push({
          botId: agent.id,
          provider: binding.provider,
          label: binding.label || binding.provider,
        });
      }
    }

    const routines: TeamImportResult['routines'] = [];
    for (const botResult of createdBots) {
      const { agent } = botResult;
      for (const routine of preview.routines) {
        try {
          createBotRoutine({
            botId: agent.id,
            botName: agent.botProfile?.displayName ?? agent.name,
            title: routine.name,
            instruction: routine.instruction,
            frequency: routine.frequency ?? 'daily',
          });
          routines.push({ botId: agent.id, title: routine.name });
        } catch (err) {
          warnings.push(`Failed to create routine ${routine.name} for ${agent.name}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    logger.info(
      { teamName, botCount: createdBots.length, routineCount: routines.length },
      'Imported team/package',
    );

    return {
      success: true,
      teamName,
      bots: createdBots,
      routines,
      connectorBindings,
      warnings,
      errors: [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, 'Team import failed');
    return {
      success: false,
      teamName: options.teamName || '',
      bots: [],
      routines: [],
      connectorBindings: [],
      warnings,
      errors: [message],
      error: message,
    };
  }
}

// ============================================================================
// Compatibility aliases for the previous bot-team-import module
// ============================================================================

/**
 * Fetch a team file from a public raw URL.
 *
 * @deprecated Use `importTeamFromText` with a pre-fetched string, or fetch
 * directly. Kept for callers that were importing from `bot-team-import`.
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
 *
 * @deprecated Use `importTeamFromFile`. Kept for callers that were importing
 * from `bot-team-import`.
 */
export async function readTeamFileFromDisk(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read team file'));
    reader.readAsText(file);
  });
}

/**
 * Parse and import from raw file content.
 *
 * @deprecated Use `importTeamFromText`. Kept for callers that were importing
 * from `bot-team-import`.
 */
export async function importTeamFromContent(
  content: string,
  options?: TeamImportOptions,
): Promise<TeamImportResult> {
  return importTeamFromText(content, options);
}
