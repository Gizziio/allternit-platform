/**
 * Migration Utilities
 * 
 * Handles migration from legacy SDK to Allternit Harness.
 */

import { Config } from '@/config';
import { HarnessConfig } from '@allternit/sdk';
import { getHarnessMode, FEATURE_FLAGS } from './feature-flags';

/**
 * Migrate existing configuration to harness format.
 */
export async function migrateToHarness(): Promise<void> {
  const mode = getHarnessMode();
  
  // Check if already migrated
  const existingMode = await Config.get('harness.mode');
  if (existingMode) {
    return; // Already migrated
  }
  
  // Migrate based on mode
  switch (mode) {
    case 'byok':
      await migrateBYOK();
      break;
    case 'cloud':
      await migrateCloud();
      break;
    case 'local':
      await migrateLocal();
      break;
    case 'subprocess':
      await migrateSubprocess();
      break;
  }
  
  // Set mode
  await Config.set('harness.mode', mode);
}

/**
 * Migrate BYOK configuration.
 */
async function migrateBYOK(): Promise<void> {
  // Check for existing API keys
  const anthropicKey = process.env.ANTHROPIC_API_KEY || await Config.get('anthropic.apiKey');
  const openaiKey = process.env.OPENAI_API_KEY || await Config.get('openai.apiKey');
  const googleKey = process.env.GOOGLE_API_KEY || await Config.get('google.apiKey');
  
  if (anthropicKey) {
    await Config.set('harness.byok.anthropic.apiKey', anthropicKey);
  }
  if (openaiKey) {
    await Config.set('harness.byok.openai.apiKey', openaiKey);
  }
  if (googleKey) {
    await Config.set('harness.byok.google.apiKey', googleKey);
  }
}

/**
 * Migrate cloud configuration.
 */
async function migrateCloud(): Promise<void> {
  const accessToken = await Config.get('oauth.accessToken') || process.env.ALLTERNIT_ACCESS_TOKEN;
  
  if (accessToken) {
    await Config.set('harness.cloud.accessToken', accessToken);
    await Config.set('harness.cloud.baseURL', FEATURE_FLAGS.CLOUD_BASE_URL);
  }
}

/**
 * Migrate local configuration.
 */
async function migrateLocal(): Promise<void> {
  await Config.set('harness.local.baseURL', FEATURE_FLAGS.LOCAL_BASE_URL);
}

/**
 * Migrate subprocess configuration.
 */
async function migrateSubprocess(): Promise<void> {
  if (FEATURE_FLAGS.SUBPROCESS_CMD) {
    await Config.set('harness.subprocess.command', FEATURE_FLAGS.SUBPROCESS_CMD);
  }
}

/**
 * Get harness configuration for initialization.
 */
export async function getHarnessConfig(): Promise<HarnessConfig> {
  const mode = getHarnessMode();
  
  switch (mode) {
    case 'byok':
      return {
        mode: 'byok',
        byok: {
          anthropic: { apiKey: await Config.get('harness.byok.anthropic.apiKey') },
          openai: { apiKey: await Config.get('harness.byok.openai.apiKey') },
          google: { apiKey: await Config.get('harness.byok.google.apiKey') },
        },
      };
      
    case 'cloud':
      return {
        mode: 'cloud',
        cloud: {
          baseURL: await Config.get('harness.cloud.baseURL') || FEATURE_FLAGS.CLOUD_BASE_URL,
          accessToken: await Config.get('harness.cloud.accessToken'),
          refreshToken: await Config.get('harness.cloud.refreshToken'),
        },
      };
      
    case 'local':
      return {
        mode: 'local',
        local: {
          baseURL: await Config.get('harness.local.baseURL') || FEATURE_FLAGS.LOCAL_BASE_URL,
        },
      };
      
    case 'subprocess':
      return {
        mode: 'subprocess',
        subprocess: {
          command: await Config.get('harness.subprocess.command') || FEATURE_FLAGS.SUBPROCESS_CMD || 'kimi -p',
        },
      };
      
    default:
      throw new Error(`Unknown harness mode: ${mode}`);
  }
}
