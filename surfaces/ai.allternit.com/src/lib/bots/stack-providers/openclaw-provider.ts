/**
 * OpenClaw Stack Provider
 *
 * Discovers OpenClaw agents from the local `openclaw` CLI and makes them
 * available as bots inside Allternit. OpenClaw shares a common ancestry with
 * Hermes, so the CLI shape is similar:
 *
 *   openclaw -p <profile> chat -c "<session>" -q <json-prompt>
 *
 * @module stack-providers/openclaw-provider
 */

import type {
  AgentStackProvider,
  ExternalAgentReference,
  BotMemoryBundle,
  ProviderUsage,
} from './types';
import type { StackRuntimeClient } from './runtime-client';
import { getDefaultRuntimeClient } from './runtime-client';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('OpenClawStackProvider');

export const OPENCLAW_PROVIDER_ID = 'openclaw';
export const OPENCLAW_PROVIDER_NAME = 'OpenClaw';

export interface OpenClawProviderOptions {
  runtimeClient?: StackRuntimeClient;
  cliPath?: string;
}

export function createOpenClawProvider(options: OpenClawProviderOptions = {}): AgentStackProvider {
  return new OpenClawProvider(options);
}

class OpenClawProvider implements AgentStackProvider {
  readonly id = OPENCLAW_PROVIDER_ID;
  readonly name = OPENCLAW_PROVIDER_NAME;

  private runtimeClient: StackRuntimeClient;
  private cliPath: string;

  constructor(options: OpenClawProviderOptions = {}) {
    this.runtimeClient = options.runtimeClient ?? getDefaultRuntimeClient();
    this.cliPath = options.cliPath ?? 'openclaw';
  }

  async isInstalled(): Promise<boolean> {
    if (!this.runtimeClient.isAvailable()) return false;
    try {
      const result = await this.runtimeClient.exec(this.cliPath, ['--version']);
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  async listAgents(): Promise<ExternalAgentReference[]> {
    const profiles = await this.listProfiles();
    return profiles.map((name) => ({
      providerId: this.id,
      externalId: name,
      displayName: toDisplayName(name),
      tagline: `OpenClaw agent: ${name}`,
      capabilities: ['chat'],
      metadata: { cliPath: this.cliPath },
    }));
  }

  async *sendMessage(externalId: string, session: string, message: string): AsyncIterable<string> {
    if (!this.runtimeClient.isAvailable()) {
      yield 'OpenClaw is not available in this environment. Run Allternit desktop to use OpenClaw bots.';
      return;
    }

    const args = ['-p', externalId, 'chat', '-c', session, '-q', JSON.stringify(message)];
    logger.info({ session }, `Sending message to OpenClaw profile '${externalId}'`);

    try {
      for await (const line of this.runtimeClient.spawn(this.cliPath, args)) {
        yield line;
      }
    } catch (err) {
      logger.error({ err }, `Failed to send message to OpenClaw profile '${externalId}'`);
      yield `Error contacting OpenClaw profile '${externalId}': ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  async getStatus(externalId: string): Promise<'idle' | 'working' | 'error'> {
    if (!this.runtimeClient.isAvailable()) return 'error';
    try {
      const result = await this.runtimeClient.exec(this.cliPath, ['-p', externalId, 'status']);
      return result.exitCode === 0 ? 'idle' : 'error';
    } catch {
      return 'error';
    }
  }

  async syncMemory(externalId: string): Promise<BotMemoryBundle> {
    const home = typeof process !== 'undefined' ? process.env.HOME : undefined;
    const profileDir = `${home ?? '~'}/.openclaw/profiles/${externalId}`;
    const entries: BotMemoryBundle['entries'] = [];
    const skills: BotMemoryBundle['skills'] = [];

    if (!this.runtimeClient.readFile) {
      return { entries, skills };
    }

    const files = ['SOUL.md', 'MEMORY.md', 'USER.md'];
    for (const file of files) {
      try {
        const content = await this.runtimeClient.readFile(`${profileDir}/${file}`);
        if (content.trim()) {
          entries.push({
            id: `openclaw:${externalId}:${file}`,
            content,
            source: `openclaw:${file}`,
          });
        }
      } catch {
        // File may not exist; ignore.
      }
    }

    if (this.runtimeClient.listDirectory) {
      try {
        const skillFiles = await this.runtimeClient.listDirectory(`${profileDir}/skills`);
        for (const skillFile of skillFiles.filter((f) => f.endsWith('.md') || f.endsWith('.yaml'))) {
          try {
            const content = await this.runtimeClient.readFile(`${profileDir}/skills/${skillFile}`);
            const skillName = skillFile
              .replace(/^.*[\\/]/, '')
              .replace(/\.(md|yaml)$/, '');
            skills.push({
              id: `openclaw:${externalId}:skill:${skillFile}`,
              name: skillName,
              description: `OpenClaw skill from ${skillFile}`,
              source: `openclaw:skills/${skillFile}`,
              content,
            });
          } catch {
            // Ignore unreadable skill files.
          }
        }
      } catch {
        // Skills directory may not exist; ignore.
      }
    }

    return { entries, skills };
  }

  async getUsage(externalId: string, since: Date): Promise<ProviderUsage> {
    return {
      messageCount: 0,
      tokenCount: 0,
      since: since.toISOString(),
    };
  }

  private async listProfiles(): Promise<string[]> {
    if (!this.runtimeClient.isAvailable()) return [];

    try {
      const result = await this.runtimeClient.exec(this.cliPath, ['profile', 'list', '--json']);
      if (result.exitCode === 0 && result.stdout.trim()) {
        const parsed = JSON.parse(result.stdout) as Array<{ name: string } | string>;
        return parsed.map((p) => (typeof p === 'string' ? p : p.name));
      }
    } catch {
      // Fall through to directory scan.
    }

    if (this.runtimeClient.listDirectory) {
      try {
        const home = typeof process !== 'undefined' ? process.env.HOME : undefined;
        const profilesDir = `${home ?? '~'}/.openclaw/profiles`;
        return await this.runtimeClient.listDirectory(profilesDir);
      } catch {
        return [];
      }
    }

    return [];
  }
}

function toDisplayName(slug: string): string {
  return slug
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
