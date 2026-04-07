/**
 * Feature Flags
 * 
 * Centralized feature flag management for Gizzi Code.
 */

export const FEATURE_FLAGS = {
  /**
   * Enable the Allternit Harness for AI interactions.
   * When enabled, uses @allternit/sdk with system prompt injection.
   * When disabled, uses legacy direct SDK calls.
   */
  USE_HARNESS: process.env.GIZZI_USE_HARNESS === '1' || process.env.GIZZI_USE_HARNESS === 'true',
  
  /**
   * Harness operating mode.
   * - 'byok': Bring Your Own Key (direct to providers)
   * - 'cloud': Use Allternit cloud gateway
   * - 'local': Local Ollama server
   * - 'subprocess': CLI subprocess (e.g., kimi -p)
   */
  HARNESS_MODE: (process.env.GIZZI_HARNESS_MODE || 'byok') as 'byok' | 'cloud' | 'local' | 'subprocess',
  
  /**
   * Subprocess command for subprocess mode.
   * Example: "kimi -p", "claude -p", "llm -m gpt-4"
   */
  SUBPROCESS_CMD: process.env.GIZZI_SUBPROCESS_CMD || '',
  
  /**
   * Base URL for local mode.
   * Default: http://localhost:11434 (Ollama)
   */
  LOCAL_BASE_URL: process.env.GIZZI_LOCAL_BASE_URL || 'http://localhost:11434',
  
  /**
   * Cloud gateway URL.
   * Default: https://api.allternit.com
   */
  CLOUD_BASE_URL: process.env.GIZZI_CLOUD_BASE_URL || 'https://api.allternit.com',
};

/**
 * Check if harness mode is enabled.
 */
export function shouldUseHarness(): boolean {
  return FEATURE_FLAGS.USE_HARNESS;
}

/**
 * Get the configured harness mode.
 */
export function getHarnessMode(): 'byok' | 'cloud' | 'local' | 'subprocess' {
  return FEATURE_FLAGS.HARNESS_MODE;
}

/**
 * Check if a specific feature is enabled.
 */
export function isFeatureEnabled(feature: keyof typeof FEATURE_FLAGS): boolean {
  const value = FEATURE_FLAGS[feature];
  return typeof value === 'boolean' ? value : Boolean(value);
}

/**
 * Get the harness configuration based on environment.
 */
export async function getHarnessConfig() {
  const mode = FEATURE_FLAGS.HARNESS_MODE;
  
  switch (mode) {
    case 'byok':
      return {
        mode: 'byok' as const,
        byok: {
          keys: {
            anthropic: process.env.ANTHROPIC_API_KEY || '',
            openai: process.env.OPENAI_API_KEY || '',
            google: process.env.GOOGLE_API_KEY || '',
          },
        },
      };
      
    case 'cloud':
      return {
        mode: 'cloud' as const,
        cloud: {
          baseURL: FEATURE_FLAGS.CLOUD_BASE_URL,
          accessToken: process.env.ALLTERNIT_ACCESS_TOKEN || '',
        },
      };
      
    case 'local':
      return {
        mode: 'local' as const,
        local: {
          baseURL: FEATURE_FLAGS.LOCAL_BASE_URL,
        },
      };
      
    case 'subprocess':
      return {
        mode: 'subprocess' as const,
        subprocess: {
          command: FEATURE_FLAGS.SUBPROCESS_CMD || 'kimi -p',
        },
      };
      
    default:
      throw new Error(`Unknown harness mode: ${mode}`);
  }
}
