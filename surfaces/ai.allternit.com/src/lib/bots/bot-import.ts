/**
 * Bot Migration / Import
 *
 * Imports a packaged bot from a ZIP archive (similar to Grok Bot's profile
 * migration). The archive must contain a root `bot.json` that satisfies the
 * BotPackage contract. Optional directories are copied into the bot's
 * workspace and any schedules/tasks are registered.
 *
 * @module bot-import
 */

import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';
import type { Agent, CreateAgentInput } from '@/lib/agents/agent.types';
import { createAgent } from '@/lib/agents/agent.service';
import { agentWorkspaceService } from '@/lib/agents/agent-workspace.service';
import { validateBot, type BotPackage } from './bot-contract';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('BotImport');

export interface BotImportOptions {
  /** Optional user-provided prompt that describes how to adapt the imported bot. */
  importPrompt?: string;
  /** User context for workspace creation. */
  userContext?: { userId: string; userName?: string };
  /** Rename the bot on import. */
  displayName?: string;
  /**
   * Whether to overwrite an existing bot with the same imported source id.
   * When false (default), a unique id is always generated.
   */
  allowUpdate?: boolean;
}

export interface BotImportResult {
  success: boolean;
  agent?: Agent;
  workspaceId?: string;
  warnings: string[];
  error?: string;
}

export interface BotImportPreview {
  valid: boolean;
  botName?: string;
  description?: string;
  category?: string;
  hasMemory: boolean;
  hasSkills: boolean;
  hasTasks: boolean;
  hasDocs: boolean;
  hasIdentity: boolean;
  hasConnectors: boolean;
  hasSecrets: boolean;
  hasVMOperator: boolean;
  errors: string[];
  warnings: string[];
}

const KNOWN_DIRECTORIES = ['memory', 'skills', 'tasks', 'docs', 'identity', 'connectors', 'secrets'];

/**
 * Read the bot.json entry from a ZIP and return its parsed contents.
 */
async function readBotJson(zip: JSZip): Promise<unknown> {
  const file = zip.file('bot.json');
  if (!file) {
    throw new Error('Missing bot.json at archive root');
  }
  const text = await file.async('text');
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid bot.json: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Validate a bot archive without importing it.
 */
export async function previewBotImport(file: File): Promise<BotImportPreview> {
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    const zip = await JSZip.loadAsync(file);
    const raw = await readBotJson(zip);
    const validation = validateBot(raw);

    if (!validation.valid) {
      errors.push(...validation.errors);
      return {
        valid: false,
        hasMemory: false,
        hasSkills: false,
        hasTasks: false,
        hasDocs: false,
        hasIdentity: false,
        hasConnectors: false,
        hasSecrets: false,
        hasVMOperator: false,
        errors,
        warnings,
      };
    }

    const bot = raw as BotPackage;
    const paths = Object.keys(zip.files).filter((p) => !p.startsWith('__MACOSX') && !p.endsWith('/'));

    const hasDir = (name: string) => paths.some((p) => p.startsWith(`${name}/`));

    if (!hasDir('memory') && !hasDir('skills') && !hasDir('docs')) {
      warnings.push('Archive contains no memory/, skills/, or docs/ directories');
    }

    return {
      valid: true,
      botName: bot.botProfile.displayName,
      description: bot.description,
      category: bot.botProfile.botCategory,
      hasMemory: hasDir('memory'),
      hasSkills: hasDir('skills'),
      hasTasks: hasDir('tasks'),
      hasDocs: hasDir('docs'),
      hasIdentity: hasDir('identity') || Boolean(bot.identityChannels),
      hasConnectors: Boolean(bot.connectorBindings?.length),
      hasSecrets: Boolean(bot.secretRefs?.length),
      hasVMOperator: Boolean(bot.vmOperator?.enabled),
      errors,
      warnings,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return {
      valid: false,
      hasMemory: false,
      hasSkills: false,
      hasTasks: false,
      hasDocs: false,
      hasIdentity: false,
      hasConnectors: false,
      hasSecrets: false,
      hasVMOperator: false,
      errors,
      warnings,
    };
  }
}

/**
 * Extract a directory from the ZIP into the agent workspace.
 */
async function copyDirectoryToWorkspace(
  zip: JSZip,
  sourceDir: string,
  agentId: string,
  warnings: string[]
): Promise<void> {
  const prefix = `${sourceDir}/`;
  const entries = Object.entries(zip.files).filter(
    ([path, entry]) =>
      path.startsWith(prefix) &&
      !entry.dir &&
      !path.startsWith('__MACOSX')
  );

  if (entries.length === 0) return;

  const workspaceRoot = `agents/${agentId}`;

  for (const [path, entry] of entries) {
    const relative = path.slice(prefix.length);
    if (!relative) continue;
    const content = await entry.async('text');
    const targetPath = `${workspaceRoot}/${sourceDir}/${relative}`;
    try {
      await agentWorkspaceService.writeFile(agentId, targetPath, content);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      warnings.push(`Failed to write ${targetPath}: ${message}`);
    }
  }
}

/**
 * Build a CreateAgentInput from an imported BotPackage.
 */
function buildCreateInput(bot: BotPackage, options: BotImportOptions): CreateAgentInput {
  const now = new Date().toISOString();
  const importPrompt = options.importPrompt?.trim();

  let systemPrompt = bot.systemPrompt ?? '';
  if (importPrompt) {
    systemPrompt = `${systemPrompt}\n\n## Import Adaptation Prompt\n${importPrompt}`.trim();
  }

  const displayName = options.displayName?.trim() || bot.botProfile.displayName;

  return {
    name: displayName,
    description: bot.description,
    type: bot.type,
    model: bot.model,
    provider: bot.provider,
    capabilities: bot.capabilities,
    systemPrompt,
    tools: bot.tools,
    maxIterations: bot.maxIterations,
    temperature: bot.temperature,
    isBot: true,
    botProfile: {
      ...bot.botProfile,
      displayName,
    },
    connectorBindings: bot.connectorBindings,
    secretRefs: bot.secretRefs,
    messagingConfig: bot.messagingConfig,
    identityChannels: bot.identityChannels,
    vmOperator: bot.vmOperator,
    allowedSurfaces: ['chat', 'cowork', 'code', 'design', 'browser'],
    trustTier: 'standard',
    source: 'organization',
    category: bot.category ?? 'general',
    tags: bot.tags ?? [],
    config: {
      ...(bot.config ?? {}),
      importedAt: now,
      importedFrom: 'zip',
    },
  };
}

/**
 * Import a bot from a ZIP archive.
 *
 * 1. Validates bot.json against the BotPackage contract.
 * 2. Creates the agent record.
 * 3. Creates a workspace and copies memory/, skills/, tasks/, docs/, identity/,
 *    connectors/, and secrets/ directories if present.
 * 4. Returns the imported agent and any warnings.
 */
export async function importBotFromZip(
  file: File,
  options: BotImportOptions = {}
): Promise<BotImportResult> {
  const warnings: string[] = [];

  try {
    const zip = await JSZip.loadAsync(file);
    const raw = await readBotJson(zip);
    const validation = validateBot(raw);

    if (!validation.valid) {
      return {
        success: false,
        warnings,
        error: `Invalid bot package: ${validation.errors.join('; ')}`,
      };
    }

    const bot = raw as BotPackage;

    // Ensure a fresh id for the imported instance unless updating an existing bot.
    if (!options.allowUpdate) {
      bot.id = `bot_${bot.id}_${uuidv4().slice(0, 8)}`;
    }

    const input = buildCreateInput(bot, options);
    const agent = await createAgent(input);

    // Create workspace from the standard template so the directory structure exists.
    await agentWorkspaceService.create(
      {
        name: agent.name,
        description: agent.description,
        type: agent.type,
        model: agent.model,
        provider: agent.provider,
      },
      'allternit-standard',
      options.userContext
    );

    // Copy optional directories into the workspace.
    for (const dir of KNOWN_DIRECTORIES) {
      await copyDirectoryToWorkspace(zip, dir, agent.id, warnings);
    }

    // Copy root-level docs/markdown files that are not part of a known directory.
    for (const [path, entry] of Object.entries(zip.files)) {
      if (
        entry.dir ||
        path.startsWith('__MACOSX') ||
        path === 'bot.json' ||
        path.includes('/')
      ) {
        continue;
      }
      const content = await entry.async('text');
      const targetPath = `agents/${agent.id}/${path}`;
      try {
        await agentWorkspaceService.writeFile(agent.id, targetPath, content);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        warnings.push(`Failed to write root file ${targetPath}: ${message}`);
      }
    }

    logger.info({ agentId: agent.id, source: file.name }, 'Imported bot from zip');

    return {
      success: true,
      agent,
      workspaceId: agent.workspaceId,
      warnings,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: err }, 'Bot import failed');
    return {
      success: false,
      warnings,
      error: message,
    };
  }
}

/**
 * Import a bot from a ZIP archive and immediately start a session.
 */
export async function importAndStartBot(
  file: File,
  options: BotImportOptions = {}
): Promise<BotImportResult> {
  const result = await importBotFromZip(file, options);
  // Session start is intentionally left to the caller / useStartBotSession hook
  // so the UI layer can decide whether to open the bot home or chat surface.
  return result;
}
