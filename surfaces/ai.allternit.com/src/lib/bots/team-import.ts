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
  warnings: string[];
  error?: string;
}

export interface TeamImportPreview {
  valid: boolean;
  name?: string;
  description?: string;
  kind?: 'team' | 'package';
  memberCount?: number;
  chiefOfStaff?: string;
  roomCount?: number;
  playbookCount?: number;
  routineCount?: number;
  appCount?: number;
  errors: string[];
  warnings: string[];
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
    manifest: root as TeamManifestPackage,
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
    manifest: root as TeamManifestPackage,
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
    manifest: root as TeamManifestPackage,
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
      rooms: manifest.team.room ? [{ name: manifest.team.room.name, description: manifest.team.room.bulletin }] : [],
      playbooks: [],
      routines: [],
      requirements: { apps: [] },
    },
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
      try {
        const preview = teamImportPreview(text);
        resolve({
          valid: true,
          name: preview.name,
          description: preview.description,
          kind: preview.kind,
          memberCount: preview.members.length,
          chiefOfStaff: preview.chiefOfStaff,
          roomCount: preview.rooms.length,
          playbookCount: preview.playbooks.length,
          routineCount: preview.routines.length,
          appCount: preview.apps.length,
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
 */
export async function importTeamFromText(
  text: string,
  options: TeamImportOptions = {},
): Promise<TeamImportResult> {
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
      error: message,
    };
  }
}
