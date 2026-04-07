/**
 * Production Feature Flags
 * 
 * Centralized feature flag management for gizzi-code.
 * Supports environment variables, config files, and runtime overrides.
 */

import { homedir } from 'os';
import { join } from 'path';
import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { constants } from 'fs';

// ============================================================================
// Type Definitions
// ============================================================================

export type FeatureFlagType = 'boolean' | 'string' | 'number' | 'json';

export interface FeatureFlag<T = any> {
  name: string;
  description: string;
  type: FeatureFlagType;
  defaultValue: T;
  envVar?: string;
  configKey?: string;
}

export interface FeatureFlagValue<T = any> {
  flag: FeatureFlag<T>;
  value: T;
  source: 'default' | 'env' | 'config' | 'override';
}

export type HarnessMode = 'byok' | 'cloud' | 'local' | 'subprocess' | 'legacy';

// ============================================================================
// Feature Flag Registry
// ============================================================================

const FEATURE_FLAG_REGISTRY: FeatureFlag<any>[] = [
  // Core Features
  {
    name: 'harness.enabled',
    description: 'Enable Allternit SDK harness integration',
    type: 'boolean',
    defaultValue: true,
    envVar: 'GIZZI_HARNESS_ENABLED',
    configKey: 'features.harness.enabled',
  },
  {
    name: 'harness.mode',
    description: 'Default harness mode (byok, cloud, local, subprocess)',
    type: 'string',
    defaultValue: 'legacy',
    envVar: 'GIZZI_HARNESS_MODE',
    configKey: 'features.harness.mode',
  },
  {
    name: 'streaming.enabled',
    description: 'Enable streaming responses',
    type: 'boolean',
    defaultValue: true,
    envVar: 'GIZZI_STREAMING_ENABLED',
    configKey: 'features.streaming.enabled',
  },
  {
    name: 'sandbox.enabled',
    description: 'Enable sandbox for command execution',
    type: 'boolean',
    defaultValue: false,
    envVar: 'GIZZI_SANDBOX_ENABLED',
    configKey: 'sandbox.enabled',
  },
  
  // UI Features
  {
    name: 'ui.animations',
    description: 'Enable UI animations',
    type: 'boolean',
    defaultValue: true,
    envVar: 'GIZZI_UI_ANIMATIONS',
    configKey: 'features.ui.animations',
  },
  {
    name: 'ui.syntaxHighlight',
    description: 'Enable syntax highlighting',
    type: 'boolean',
    defaultValue: true,
    envVar: 'CLAUDE_CODE_SYNTAX_HIGHLIGHT',
    configKey: 'features.ui.syntaxHighlight',
  },
  {
    name: 'ui.markdownRendering',
    description: 'Enable markdown rendering',
    type: 'boolean',
    defaultValue: true,
    envVar: 'GIZZI_UI_MARKDOWN',
    configKey: 'features.ui.markdownRendering',
  },
  
  // Browser Integration
  {
    name: 'browser.enabled',
    description: 'Enable browser integration (Claude in Chrome)',
    type: 'boolean',
    defaultValue: true,
    envVar: 'GIZZI_BROWSER_ENABLED',
    configKey: 'features.browser.enabled',
  },
  {
    name: 'browser.autoEnable',
    description: 'Auto-enable browser when extension detected',
    type: 'boolean',
    defaultValue: true,
    envVar: 'GIZZI_BROWSER_AUTO_ENABLE',
    configKey: 'features.browser.autoEnable',
  },
  
  // MCP Features
  {
    name: 'mcp.enabled',
    description: 'Enable MCP server support',
    type: 'boolean',
    defaultValue: true,
    envVar: 'GIZZI_MCP_ENABLED',
    configKey: 'features.mcp.enabled',
  },
  {
    name: 'mcp.autoDiscover',
    description: 'Auto-discover MCP servers',
    type: 'boolean',
    defaultValue: true,
    envVar: 'GIZZI_MCP_AUTO_DISCOVER',
    configKey: 'features.mcp.autoDiscover',
  },
  
  // Tool Features
  {
    name: 'tools.bash.enabled',
    description: 'Enable Bash tool',
    type: 'boolean',
    defaultValue: true,
    envVar: 'GIZZI_TOOL_BASH',
    configKey: 'features.tools.bash',
  },
  {
    name: 'tools.fileEdit.enabled',
    description: 'Enable FileEdit tool',
    type: 'boolean',
    defaultValue: true,
    envVar: 'GIZZI_TOOL_FILE_EDIT',
    configKey: 'features.tools.fileEdit',
  },
  {
    name: 'tools.fileRead.enabled',
    description: 'Enable FileRead tool',
    type: 'boolean',
    defaultValue: true,
    envVar: 'GIZZI_TOOL_FILE_READ',
    configKey: 'features.tools.fileRead',
  },
  {
    name: 'tools.webFetch.enabled',
    description: 'Enable WebFetch tool',
    type: 'boolean',
    defaultValue: true,
    envVar: 'GIZZI_TOOL_WEB_FETCH',
    configKey: 'features.tools.webFetch',
  },
  
  // Debug Features
  {
    name: 'debug.logging',
    description: 'Enable debug logging',
    type: 'boolean',
    defaultValue: false,
    envVar: 'DEBUG',
    configKey: 'features.debug.logging',
  },
  {
    name: 'debug.verbose',
    description: 'Enable verbose debug output',
    type: 'boolean',
    defaultValue: false,
    envVar: 'GIZZI_DEBUG_VERBOSE',
    configKey: 'features.debug.verbose',
  },
  
  // Cloud URLs
  {
    name: 'cloud.baseURL',
    description: 'Allternit Cloud base URL',
    type: 'string',
    defaultValue: 'https://api.allternit.cloud',
    envVar: 'ALLTERNIT_CLOUD_URL',
    configKey: 'cloud.baseURL',
  },
  {
    name: 'local.baseURL',
    description: 'Local server base URL',
    type: 'string',
    defaultValue: 'http://localhost:8080',
    envVar: 'ALLTERNIT_LOCAL_URL',
    configKey: 'local.baseURL',
  },
  
  // Subprocess
  {
    name: 'subprocess.command',
    description: 'Subprocess command for subprocess mode',
    type: 'string',
    defaultValue: 'kimi -p',
    envVar: 'ALLTERNIT_SUBPROCESS_CMD',
    configKey: 'subprocess.command',
  },
];

// ============================================================================
// Constants
// ============================================================================

export const FEATURE_FLAGS = {
  HARNESS_ENABLED: true,
  CLOUD_BASE_URL: 'https://api.allternit.cloud',
  LOCAL_BASE_URL: 'http://localhost:8080',
  SUBPROCESS_CMD: 'kimi -p',
} as const;

// ============================================================================
// Config Store
// ============================================================================

class FeatureFlagStore {
  private configDir: string;
  private configFile: string;
  private cache: Map<string, any> = new Map();
  private lastRead: number = 0;
  private readonly CACHE_TTL = 5000;

  constructor() {
    this.configDir = join(homedir(), '.claude');
    this.configFile = join(this.configDir, 'features.json');
  }

  private async ensureConfig(): Promise<void> {
    try {
      await mkdir(this.configDir, { recursive: true });
      try {
        await access(this.configFile, constants.F_OK);
      } catch {
        await writeFile(this.configFile, JSON.stringify({}, null, 2));
      }
    } catch (error) {
      throw new Error(`Failed to initialize feature flags: ${error}`);
    }
  }

  private async readConfig(): Promise<Record<string, any>> {
    const now = Date.now();
    if (now - this.lastRead < this.CACHE_TTL && this.cache.size > 0) {
      return Object.fromEntries(this.cache);
    }

    await this.ensureConfig();
    try {
      const content = await readFile(this.configFile, 'utf8');
      const config = JSON.parse(content);
      this.cache = new Map(Object.entries(config));
      this.lastRead = now;
      return config;
    } catch (error) {
      return {};
    }
  }

  private async writeConfig(config: Record<string, any>): Promise<void> {
    await this.ensureConfig();
    await writeFile(this.configFile, JSON.stringify(config, null, 2));
    this.cache = new Map(Object.entries(config));
    this.lastRead = Date.now();
  }

  async get(key: string): Promise<any> {
    const config = await this.readConfig();
    return this.getNestedValue(config, key);
  }

  async set(key: string, value: any): Promise<void> {
    const config = await this.readConfig();
    this.setNestedValue(config, key, value);
    await this.writeConfig(config);
  }

  private getNestedValue(obj: any, key: string): any {
    const parts = key.split('.');
    let current = obj;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') {
        return undefined;
      }
      current = current[part];
    }
    return current;
  }

  private setNestedValue(obj: any, key: string, value: any): void {
    const parts = key.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    current[parts[parts.length - 1]] = value;
  }
}

const featureStore = new FeatureFlagStore();

// ============================================================================
// Flag Resolution
// ============================================================================

function parseEnvValue(value: string, type: FeatureFlagType): any {
  switch (type) {
    case 'boolean':
      return value.toLowerCase() === 'true' || value === '1';
    case 'number':
      return parseFloat(value);
    case 'json':
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    case 'string':
    default:
      return value;
  }
}

function isEnvTruthy(name: string): boolean {
  const value = process.env[name];
  if (!value) return false;
  return value.toLowerCase() !== 'false' && value !== '0';
}

function isEnvDefinedFalsy(name: string): boolean {
  const value = process.env[name];
  if (value === undefined) return false;
  return value.toLowerCase() === 'false' || value === '0';
}

export async function getFlag<T>(name: string): Promise<FeatureFlagValue<T>> {
  const flag = FEATURE_FLAG_REGISTRY.find(f => f.name === name);
  if (!flag) {
    throw new Error(`Unknown feature flag: ${name}`);
  }

  // Check environment variable first
  if (flag.envVar) {
    const envValue = process.env[flag.envVar];
    if (envValue !== undefined) {
      return {
        flag,
        value: parseEnvValue(envValue, flag.type),
        source: 'env',
      };
    }
  }

  // Check config file
  if (flag.configKey) {
    const configValue = await featureStore.get(flag.configKey);
    if (configValue !== undefined) {
      return {
        flag,
        value: configValue,
        source: 'config',
      };
    }
  }

  // Return default
  return {
    flag,
    value: flag.defaultValue,
    source: 'default',
  };
}

export async function getFlagValue<T>(name: string): Promise<T> {
  const flagValue = await getFlag<T>(name);
  return flagValue.value;
}

export async function setFlag<T>(name: string, value: T): Promise<void> {
  const flag = FEATURE_FLAG_REGISTRY.find(f => f.name === name);
  if (!flag) {
    throw new Error(`Unknown feature flag: ${name}`);
  }

  if (!flag.configKey) {
    throw new Error(`Flag ${name} cannot be persisted`);
  }

  await featureStore.set(flag.configKey, value);
}

export function getFlagSync<T>(name: string): T {
  const flag = FEATURE_FLAG_REGISTRY.find(f => f.name === name);
  if (!flag) {
    throw new Error(`Unknown feature flag: ${name}`);
  }

  // Check environment variable
  if (flag.envVar) {
    const envValue = process.env[flag.envVar];
    if (envValue !== undefined) {
      return parseEnvValue(envValue, flag.type);
    }
  }

  // Return default (sync, can't check config file)
  return flag.defaultValue;
}

// ============================================================================
// Harness Mode
// ============================================================================

export function getHarnessMode(): HarnessMode {
  // Check environment variables
  if (process.env.ALLTERNIT_CLOUD_TOKEN) {
    return 'cloud';
  }
  
  if (process.env.ALLTERNIT_LOCAL_URL) {
    return 'local';
  }
  
  if (process.env.ALLTERNIT_SUBPROCESS_CMD) {
    return 'subprocess';
  }
  
  if (process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY) {
    return 'byok';
  }
  
  return 'legacy';
}

export function shouldUseHarness(): boolean {
  return getFlagSync('harness.enabled') && getHarnessMode() !== 'legacy';
}

// ============================================================================
// Feature Checks
// ============================================================================

export async function isFeatureEnabled(name: string): Promise<boolean> {
  return await getFlagValue<boolean>(name);
}

export function isFeatureEnabledSync(name: string): boolean {
  return getFlagSync<boolean>(name);
}

export async function listFlags(): Promise<FeatureFlagValue[]> {
  const results: FeatureFlagValue[] = [];
  for (const flag of FEATURE_FLAG_REGISTRY) {
    results.push(await getFlag(flag.name));
  }
  return results;
}

// ============================================================================
// Environment Checks
// ============================================================================

export function getIsInteractive(): boolean {
  return process.stdin.isTTY === true;
}

export function getIsNonInteractiveSession(): boolean {
  return !getIsInteractive() || process.env.CI === 'true';
}

export function getSessionBypassPermissionsMode(): boolean {
  return isEnvTruthy('GIZZI_BYPASS_PERMISSIONS');
}

// ============================================================================
// Debug
// ============================================================================

export function isDebugEnabled(): boolean {
  const debug = process.env.DEBUG || '';
  return debug.includes('gizzi') || debug.includes('*');
}

export function logForDebugging(message: string, meta?: Record<string, any>): void {
  if (isDebugEnabled()) {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    console.error(`[${timestamp}] [debug] ${message}${metaStr}`);
  }
}

// ============================================================================
// Export
// ============================================================================

export default {
  getFlag,
  getFlagValue,
  setFlag,
  getFlagSync,
  getHarnessMode,
  shouldUseHarness,
  isFeatureEnabled,
  isFeatureEnabledSync,
  listFlags,
  getIsInteractive,
  getIsNonInteractiveSession,
  getSessionBypassPermissionsMode,
  isDebugEnabled,
  logForDebugging,
  FEATURE_FLAG_REGISTRY,
};
