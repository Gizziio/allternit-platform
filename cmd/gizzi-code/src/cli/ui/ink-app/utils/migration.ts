/**
 * Production Migration Utilities
 * 
 * Handles migration from legacy configurations to current format.
 * Supports harness-based migration for Allternit SDK integration.
 */

import { homedir } from 'os';
import { join } from 'path';
import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { constants } from 'fs';

// ============================================================================
// Type Definitions
// ============================================================================

export type HarnessMode = 'byok' | 'cloud' | 'local' | 'subprocess' | 'legacy';

export interface BYOKConfig {
  anthropic?: { apiKey?: string };
  openai?: { apiKey?: string };
  google?: { apiKey?: string };
}

export interface CloudConfig {
  baseURL: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface LocalConfig {
  baseURL: string;
}

export interface SubprocessConfig {
  command: string;
}

export interface HarnessConfig {
  mode: HarnessMode;
  byok?: BYOKConfig;
  cloud?: CloudConfig;
  local?: LocalConfig;
  subprocess?: SubprocessConfig;
}

export interface LegacyConfig {
  apiKey?: string;
  model?: string;
  provider?: string;
  baseURL?: string;
}

export interface MigrationState {
  version: number;
  lastMigration: string;
  harnessMode?: HarnessMode;
  migratedFrom?: string;
}

export interface ConfigStore {
  get: (key: string) => Promise<any>;
  set: (key: string, value: any) => Promise<void>;
  delete: (key: string) => Promise<void>;
  has: (key: string) => Promise<boolean>;
  clear: () => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

const CURRENT_MIGRATION_VERSION = 2;
const MIGRATION_STATE_KEY = 'migration.state';
const HARNESS_CONFIG_KEY = 'harness.config';

// Default configuration values
const DEFAULTS = {
  CLOUD_BASE_URL: 'https://api.allternit.cloud',
  LOCAL_BASE_URL: 'http://localhost:8080',
  SUBPROCESS_CMD: 'kimi -p',
};

// ============================================================================
// Config Store Implementation
// ============================================================================

class FileConfigStore implements ConfigStore {
  private configDir: string;
  private configFile: string;
  private cache: Map<string, any> = new Map();
  private lastRead: number = 0;
  private readonly CACHE_TTL = 5000;

  constructor() {
    this.configDir = join(homedir(), '.claude');
    this.configFile = join(this.configDir, 'config.json');
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
      throw new Error(`Failed to initialize config: ${error}`);
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
    return config[key];
  }

  async set(key: string, value: any): Promise<void> {
    const config = await this.readConfig();
    config[key] = value;
    await this.writeConfig(config);
  }

  async delete(key: string): Promise<void> {
    const config = await this.readConfig();
    delete config[key];
    await this.writeConfig(config);
  }

  async has(key: string): Promise<boolean> {
    const config = await this.readConfig();
    return key in config;
  }

  async clear(): Promise<void> {
    await this.writeConfig({});
  }
}

// Singleton instance
const configStore: ConfigStore = new FileConfigStore();

// ============================================================================
// Environment Detection
// ============================================================================

function detectHarnessMode(): HarnessMode {
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
  
  // Check for BYOK mode (API keys)
  if (process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY) {
    return 'byok';
  }
  
  return 'legacy';
}

// ============================================================================
// Migration Functions
// ============================================================================

async function getMigrationState(): Promise<MigrationState> {
  const state = await configStore.get(MIGRATION_STATE_KEY);
  if (!state) {
    return {
      version: 0,
      lastMigration: new Date(0).toISOString(),
    };
  }
  return state as MigrationState;
}

async function setMigrationState(state: MigrationState): Promise<void> {
  await configStore.set(MIGRATION_STATE_KEY, state);
}

async function shouldRunMigration(): Promise<boolean> {
  const state = await getMigrationState();
  return state.version < CURRENT_MIGRATION_VERSION;
}

// ============================================================================
// Legacy Migration (v0 -> v1)
// ============================================================================

async function migrateFromLegacy(): Promise<void> {
  const mode = detectHarnessMode();
  const harnessConfig: HarnessConfig = { mode };
  
  switch (mode) {
    case 'byok':
      harnessConfig.byok = {
        anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
        openai: { apiKey: process.env.OPENAI_API_KEY },
        google: { apiKey: process.env.GOOGLE_API_KEY },
      };
      break;
      
    case 'cloud':
      harnessConfig.cloud = {
        baseURL: process.env.ALLTERNIT_CLOUD_URL || DEFAULTS.CLOUD_BASE_URL,
        accessToken: process.env.ALLTERNIT_CLOUD_TOKEN,
      };
      break;
      
    case 'local':
      harnessConfig.local = {
        baseURL: process.env.ALLTERNIT_LOCAL_URL || DEFAULTS.LOCAL_BASE_URL,
      };
      break;
      
    case 'subprocess':
      harnessConfig.subprocess = {
        command: process.env.ALLTERNIT_SUBPROCESS_CMD || DEFAULTS.SUBPROCESS_CMD,
      };
      break;
      
    case 'legacy':
    default:
      // Keep as legacy, no harness config needed
      break;
  }
  
  await configStore.set(HARNESS_CONFIG_KEY, harnessConfig);
}

// ============================================================================
// BYOK Migration (v1 -> v2)
// ============================================================================

async function migrateBYOKProviders(): Promise<void> {
  const existingConfig = await configStore.get(HARNESS_CONFIG_KEY);
  if (!existingConfig || existingConfig.mode !== 'byok') {
    return;
  }
  
  const byokConfig: BYOKConfig = existingConfig.byok || {};
  
  // Ensure all expected providers exist
  const providers = ['anthropic', 'openai', 'google'] as const;
  for (const provider of providers) {
    if (!byokConfig[provider]) {
      byokConfig[provider] = {};
    }
  }
  
  // Update config
  existingConfig.byok = byokConfig;
  await configStore.set(HARNESS_CONFIG_KEY, existingConfig);
}

// ============================================================================
// Main Migration Runner
// ============================================================================

export async function runMigration(): Promise<void> {
  const state = await getMigrationState();
  
  if (state.version >= CURRENT_MIGRATION_VERSION) {
    return; // Already up to date
  }
  
  // Run migrations sequentially
  if (state.version < 1) {
    await migrateFromLegacy();
  }
  
  if (state.version < 2) {
    await migrateBYOKProviders();
  }
  
  // Update migration state
  await setMigrationState({
    version: CURRENT_MIGRATION_VERSION,
    lastMigration: new Date().toISOString(),
    harnessMode: detectHarnessMode(),
    migratedFrom: `v${state.version}`,
  });
}

export function checkMigrationNeeded(): boolean {
  // This is sync for quick checks
  // In practice, the async version should be used
  const mode = detectHarnessMode();
  return mode !== 'legacy';
}

export async function getMigrationStatus(): Promise<string> {
  const state = await getMigrationState();
  const needed = await shouldRunMigration();
  
  if (needed) {
    return `migration needed: v${state.version} -> v${CURRENT_MIGRATION_VERSION}`;
  }
  
  return `up to date: v${state.version}`;
}

export async function migrateIfNeeded(): Promise<void> {
  if (await shouldRunMigration()) {
    await runMigration();
  }
}

// ============================================================================
// Harness Configuration
// ============================================================================

export async function getHarnessConfig(): Promise<HarnessConfig> {
  // Ensure migrations are run
  await migrateIfNeeded();
  
  const config = await configStore.get(HARNESS_CONFIG_KEY);
  if (config) {
    return config as HarnessConfig;
  }
  
  // Return default config
  const mode = detectHarnessMode();
  const defaultConfig: HarnessConfig = { mode };
  
  await configStore.set(HARNESS_CONFIG_KEY, defaultConfig);
  return defaultConfig;
}

export async function setHarnessConfig(config: HarnessConfig): Promise<void> {
  await configStore.set(HARNESS_CONFIG_KEY, config);
}

export async function updateHarnessConfig(
  updates: Partial<HarnessConfig>
): Promise<void> {
  const existing = await getHarnessConfig();
  const updated = { ...existing, ...updates };
  await setHarnessConfig(updated);
}

// ============================================================================
// BYOK Helpers
// ============================================================================

export async function getBYOKConfig(): Promise<BYOKConfig | undefined> {
  const config = await getHarnessConfig();
  return config.byok;
}

export async function setBYOKApiKey(
  provider: keyof BYOKConfig,
  apiKey: string
): Promise<void> {
  const config = await getHarnessConfig();
  if (!config.byok) {
    config.byok = {};
  }
  config.byok[provider] = { apiKey };
  await setHarnessConfig(config);
}

// ============================================================================
// Cloud Helpers
// ============================================================================

export async function getCloudConfig(): Promise<CloudConfig | undefined> {
  const config = await getHarnessConfig();
  return config.cloud;
}

export async function setCloudToken(accessToken: string, refreshToken?: string): Promise<void> {
  const config = await getHarnessConfig();
  config.cloud = {
    ...config.cloud,
    baseURL: config.cloud?.baseURL || DEFAULTS.CLOUD_BASE_URL,
    accessToken,
    ...(refreshToken && { refreshToken }),
  };
  config.mode = 'cloud';
  await setHarnessConfig(config);
}

// ============================================================================
// Local Helpers
// ============================================================================

export async function getLocalConfig(): Promise<LocalConfig | undefined> {
  const config = await getHarnessConfig();
  return config.local;
}

export async function setLocalURL(baseURL: string): Promise<void> {
  const config = await getHarnessConfig();
  config.local = { baseURL };
  config.mode = 'local';
  await setHarnessConfig(config);
}

// ============================================================================
// Subprocess Helpers
// ============================================================================

export async function getSubprocessConfig(): Promise<SubprocessConfig | undefined> {
  const config = await getHarnessConfig();
  return config.subprocess;
}

export async function setSubprocessCommand(command: string): Promise<void> {
  const config = await getHarnessConfig();
  config.subprocess = { command };
  config.mode = 'subprocess';
  await setHarnessConfig(config);
}

// ============================================================================
// Reset
// ============================================================================

export async function resetMigration(): Promise<void> {
  await configStore.delete(MIGRATION_STATE_KEY);
  await configStore.delete(HARNESS_CONFIG_KEY);
}

// ============================================================================
// Export Default
// ============================================================================

export default {
  runMigration,
  checkMigrationNeeded,
  getMigrationStatus,
  migrateIfNeeded,
  getHarnessConfig,
  setHarnessConfig,
  updateHarnessConfig,
  getBYOKConfig,
  setBYOKApiKey,
  getCloudConfig,
  setCloudToken,
  getLocalConfig,
  setLocalURL,
  getSubprocessConfig,
  setSubprocessCommand,
  resetMigration,
};
