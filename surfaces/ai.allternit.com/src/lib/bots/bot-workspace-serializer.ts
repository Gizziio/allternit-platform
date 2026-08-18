/**
 * Bot Workspace Serializer
 *
 * One serializer/deserializer for packaged-bot workspace files. Converts a
 * canonical `Bot` into versioned workspace files (and back) so that create,
 * edit, import, export, and duplicate all use the same representation.
 *
 * The serializer preserves unsupported content in canonical files: direct file
 * edits outside the known structured fields are retained across round-trips.
 *
 * @module bot-workspace-serializer
 */

import { z } from 'zod';
import { createModuleLogger } from '@/lib/logger';
import { BotSchema, type Bot } from './orpc-contracts';
import {
  BOT_WORKSPACE_FILES,
  BOT_WORKSPACE_SCHEMA_VERSION,
  BOT_WORKSPACE_GENERATOR_VERSION,
  BotAgentsFrontmatterSchema,
  BotSoulFrontmatterSchema,
  BotWorkspaceManifestSchema,
  type BotWorkspaceFile,
} from './bot-workspace-contracts';

const logger = createModuleLogger('BotWorkspaceSerializer');

export type WorkspaceFileMap = Record<string, string>;

// ============================================================================
// Frontmatter helpers
// ============================================================================

const FRONTMATTER_DELIMITER = '---\n';

function buildFrontmatter<T extends Record<string, unknown>>(data: T): string {
  return `${FRONTMATTER_DELIMITER}${JSON.stringify(data, null, 2)}\n${FRONTMATTER_DELIMITER}`;
}

function parseFrontmatter<T>(content: string, schema: z.ZodType<T>): { frontmatter: T; body: string } {
  if (!content.startsWith(FRONTMATTER_DELIMITER)) {
    throw new Error('Workspace file is missing JSON frontmatter');
  }

  const end = content.indexOf(FRONTMATTER_DELIMITER, FRONTMATTER_DELIMITER.length);
  if (end === -1) {
    throw new Error('Workspace file has unterminated frontmatter');
  }

  const json = content.slice(FRONTMATTER_DELIMITER.length, end);
  const body = content.slice(end + FRONTMATTER_DELIMITER.length).trimStart();
  const frontmatter = schema.parse(JSON.parse(json));
  return { frontmatter, body };
}

function replaceFrontmatter(content: string, newFrontmatter: string): string {
  if (!content.startsWith(FRONTMATTER_DELIMITER)) {
    return `${newFrontmatter}${content}`;
  }

  const end = content.indexOf(FRONTMATTER_DELIMITER, FRONTMATTER_DELIMITER.length);
  if (end === -1) {
    return `${newFrontmatter}${content}`;
  }

  const body = content.slice(end + FRONTMATTER_DELIMITER.length);
  return `${newFrontmatter}${body}`;
}

// ============================================================================
// Markdown body builders / updaters
// ============================================================================

function buildSoulBody(bot: Bot): string {
  const profile = bot.botProfile;
  const lines: string[] = ['# SOUL', ''];

  if (profile.tagline) {
    lines.push(`**Tagline:** ${profile.tagline}`, '');
  }
  if (profile.welcomeMessage) {
    lines.push(`**Welcome message:** ${profile.welcomeMessage}`, '');
  }
  if (profile.starterPrompts && profile.starterPrompts.length > 0) {
    lines.push('## Starter prompts', '');
    for (const prompt of profile.starterPrompts) {
      lines.push(`- ${prompt}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

function updateMarker(body: string, marker: string, value: string | undefined): string {
  const pattern = new RegExp(`\\*\\*${marker}:\\*\\*\\s*.*`, 'g');
  const line = value === undefined ? '' : `**${marker}:** ${value}`;

  if (pattern.test(body)) {
    if (value === undefined) {
      return body.replace(pattern, '').replace(/\n{3,}/g, '\n\n');
    }
    return body.replace(pattern, line);
  }

  if (value === undefined) {
    return body;
  }

  // Append after the # SOUL heading if present, otherwise at the top.
  const headingMatch = body.match(/^# SOUL\s*\n/);
  if (headingMatch) {
    const insertAt = headingMatch.index! + headingMatch[0].length;
    return `${body.slice(0, insertAt)}\n${line}\n${body.slice(insertAt)}`;
  }

  return `${line}\n${body}`;
}

function updateStarterPrompts(body: string, prompts: string[] | undefined): string {
  const startPattern = /^## Starter prompts\s*\n/;
  const nextHeadingPattern = /\n(?=## )/;

  const newSection = prompts && prompts.length > 0
    ? `## Starter prompts\n\n${prompts.map((p) => `- ${p}`).join('\n')}\n`
    : '';

  if (startPattern.test(body)) {
    const sectionStart = body.search(startPattern);
    const before = body.slice(0, sectionStart);
    const afterMatch = body.slice(sectionStart).match(nextHeadingPattern);
    const after = afterMatch ? body.slice(sectionStart + afterMatch.index!) : '';

    if (newSection) {
      return `${before}${newSection}${after}`;
    }
    return `${before}${after}`.replace(/\n{3,}/g, '\n\n');
  }

  if (newSection) {
    return `${body.trimEnd()}\n\n${newSection}`;
  }

  return body;
}

/**
 * Update a SOUL.md body, preserving any unsupported content.
 */
function updateSoulBody(existingBody: string, bot: Bot): string {
  const profile = bot.botProfile;
  let body = existingBody.trimStart();

  if (!body.startsWith('# SOUL')) {
    body = `# SOUL\n\n${body}`;
  }

  body = updateMarker(body, 'Tagline', profile.tagline);
  body = updateMarker(body, 'Welcome message', profile.welcomeMessage);
  body = updateStarterPrompts(body, profile.starterPrompts);

  return body.replace(/\n{3,}/g, '\n\n') + '\n';
}

function parseSoulBody(body: string): Pick<Bot['botProfile'], 'tagline' | 'welcomeMessage' | 'starterPrompts'> {
  const result: Pick<Bot['botProfile'], 'tagline' | 'welcomeMessage' | 'starterPrompts'> = {};

  const taglineMatch = body.match(/\*\*Tagline:\*\*\s*(.+)/);
  if (taglineMatch) {
    result.tagline = taglineMatch[1].trim();
  }

  const welcomeMatch = body.match(/\*\*Welcome message:\*\*\s*(.+)/);
  if (welcomeMatch) {
    result.welcomeMessage = welcomeMatch[1].trim();
  }

  const starterPrompts: string[] = [];
  const promptSection = body.match(/## Starter prompts\n([\s\S]*?)(?=\n## |\n*$)/);
  if (promptSection) {
    const lines = promptSection[1].split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ')) {
        starterPrompts.push(trimmed.slice(2));
      }
    }
  }
  if (starterPrompts.length > 0) {
    result.starterPrompts = starterPrompts;
  }

  return result;
}

// ============================================================================
// Serialization
// ============================================================================

/**
 * Serialize a bot into its canonical workspace file map.
 *
 * If `existingFiles` is provided, unsupported content in canonical files is
 * preserved. Unknown files are kept as-is.
 *
 * The returned map keys are workspace-relative paths (e.g.
 * `.allternit/bot/SOUL.md`) and values are UTF-8 content.
 */
export function serializeBotWorkspace(
  bot: Bot,
  existingFiles: WorkspaceFileMap = {},
): WorkspaceFileMap {
  const parsedBot = BotSchema.parse(bot);

  const agentsFrontmatter = BotAgentsFrontmatterSchema.parse({
    name: parsedBot.name,
    description: parsedBot.description,
    type: parsedBot.type,
    model: parsedBot.model,
    provider: parsedBot.provider,
  });

  const soulFrontmatter = BotSoulFrontmatterSchema.parse({
    displayName: parsedBot.botProfile.displayName,
    handle: parsedBot.botProfile.handle,
    version: parsedBot.botProfile.version,
    botCategory: parsedBot.botProfile.botCategory,
    lifecycle: parsedBot.botProfile.lifecycle,
    accentColor: parsedBot.botProfile.accentColor,
    groupChatEnabled: parsedBot.botProfile.groupChatEnabled,
    defaultPresetId: parsedBot.botProfile.defaultPresetId,
  });

  // AGENTS.md: keep existing body, replace frontmatter.
  const existingAgents = existingFiles[BOT_WORKSPACE_FILES.agents];
  const agentsContent = existingAgents
    ? replaceFrontmatter(existingAgents, buildFrontmatter(agentsFrontmatter))
    : `${buildFrontmatter(agentsFrontmatter)}# Agent\n\n${parsedBot.description}\n`;

  // SOUL.md: update structured markers in existing body, or build default.
  const existingSoul = existingFiles[BOT_WORKSPACE_FILES.soul];
  let soulContent: string;
  if (existingSoul) {
    const { body: existingSoulBody } = parseFrontmatter(existingSoul, BotSoulFrontmatterSchema);
    const updatedSoulBody = updateSoulBody(existingSoulBody, parsedBot);
    soulContent = `${buildFrontmatter(soulFrontmatter)}${updatedSoulBody}`;
  } else {
    soulContent = `${buildFrontmatter(soulFrontmatter)}${buildSoulBody(parsedBot)}`;
  }

  // Placeholder files: preserve any direct edits by keeping existing content.
  const userContent =
    existingFiles[BOT_WORKSPACE_FILES.user] ??
    `# USER\n\nHuman relationship and preferences for ${parsedBot.botProfile.displayName}.\n`;
  const governanceContent =
    existingFiles[BOT_WORKSPACE_FILES.governance] ??
    `# GOVERNANCE\n\nHard bans, trust tier, and escalation policy for ${parsedBot.botProfile.displayName}.\n`;
  const toolsContent =
    existingFiles[BOT_WORKSPACE_FILES.tools] ??
    `# TOOLS\n\nTool guidance and allowed-surface notes for ${parsedBot.botProfile.displayName}.\n`;
  const heartbeatContent =
    existingFiles[BOT_WORKSPACE_FILES.heartbeat] ??
    `# HEARTBEAT\n\nScheduled behavior intent for ${parsedBot.botProfile.displayName}.\n`;
  const memoryContent =
    existingFiles[BOT_WORKSPACE_FILES.memory] ??
    `# MEMORY\n\nLong-term learned facts for ${parsedBot.botProfile.displayName}.\n`;

  const skillsContent =
    existingFiles[BOT_WORKSPACE_FILES.skills] ??
    JSON.stringify(
      {
        version: BOT_WORKSPACE_GENERATOR_VERSION,
        skills: [],
      },
      null,
      2,
    );

  const files: WorkspaceFileMap = {
    ...existingFiles,
    [BOT_WORKSPACE_FILES.agents]: agentsContent,
    [BOT_WORKSPACE_FILES.soul]: soulContent,
    [BOT_WORKSPACE_FILES.user]: userContent,
    [BOT_WORKSPACE_FILES.governance]: governanceContent,
    [BOT_WORKSPACE_FILES.tools]: toolsContent,
    [BOT_WORKSPACE_FILES.skills]: skillsContent,
    [BOT_WORKSPACE_FILES.heartbeat]: heartbeatContent,
    [BOT_WORKSPACE_FILES.memory]: memoryContent,
  };

  return files;
}

// ============================================================================
// Deserialization
// ============================================================================

/**
 * Deserialize a canonical workspace file map back into a `Bot`.
 *
 * The bot receives a new id and refreshed timestamps; the caller is responsible
 * for preserving the original identity if desired.
 */
export function deserializeBotWorkspace(files: WorkspaceFileMap): Bot {
  const agentsContent = files[BOT_WORKSPACE_FILES.agents];
  const soulContent = files[BOT_WORKSPACE_FILES.soul];

  if (!agentsContent || !soulContent) {
    throw new Error('Workspace is missing required AGENTS.md or SOUL.md');
  }

  const { frontmatter: agents } = parseFrontmatter(agentsContent, BotAgentsFrontmatterSchema);
  const { frontmatter: soul, body: soulBody } = parseFrontmatter(soulContent, BotSoulFrontmatterSchema);
  const soulBodyFields = parseSoulBody(soulBody);

  const now = new Date().toISOString();

  return BotSchema.parse({
    id: `bot_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    name: agents.name,
    description: agents.description,
    type: agents.type,
    model: agents.model,
    provider: agents.provider,
    isBot: true,
    botProfile: {
      displayName: soul.displayName,
      handle: soul.handle,
      version: soul.version,
      botCategory: soul.botCategory,
      lifecycle: soul.lifecycle,
      accentColor: soul.accentColor,
      groupChatEnabled: soul.groupChatEnabled,
      defaultPresetId: soul.defaultPresetId,
      ...soulBodyFields,
    },
    createdAt: now,
    updatedAt: now,
  });
}

// ============================================================================
// Revision hashing
// ============================================================================

/**
 * Compute a deterministic revision hash for a workspace file map.
 *
 * Files are hashed in sorted path order so the hash is stable regardless of
 * insertion order.
 */
export async function computeWorkspaceRevision(files: WorkspaceFileMap): Promise<string> {
  const encoder = new TextEncoder();
  const paths = Object.keys(files).sort();

  let combined = '';
  for (const path of paths) {
    combined += `${path}:${files[path]}\n`;
  }

  const buffer = encoder.encode(combined);
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Build a manifest object from a workspace file map.
 */
export async function buildWorkspaceManifest(
  botId: string,
  files: WorkspaceFileMap,
): Promise<{ manifest: string; revision: string }> {
  const revision = await computeWorkspaceRevision(files);
  const now = new Date().toISOString();

  const manifest = BotWorkspaceManifestSchema.parse({
    schemaVersion: BOT_WORKSPACE_SCHEMA_VERSION,
    generatorVersion: BOT_WORKSPACE_GENERATOR_VERSION,
    revision,
    botId,
    createdAt: now,
    updatedAt: now,
    files: Object.keys(files).sort(),
  });

  return { manifest: JSON.stringify(manifest, null, 2), revision };
}

// ============================================================================
// Cache invalidation hook
// ============================================================================

/**
 * Invalidate any runtime context caches for a bot after its workspace is
 * accepted.
 *
 * This is a client-side placeholder; the real implementation should notify the
 * operational-projection store and any active session that the identity
 * revision has changed.
 */
export function invalidateBotWorkspaceCache(botId: string): void {
  logger.info({ botId }, 'Bot workspace cache invalidated');
}
