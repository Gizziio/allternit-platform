/**
 * Normalizer exports
 */

export { normalizeGitHubWebhook } from './github-normalizer.js';
export { normalizeDiscordWebhook } from './discord-normalizer.js';
export { normalizeAntFarmWebhook } from './antfarm-normalizer.js';
export { normalizeMoltbookWebhook } from './moltbook-normalizer.js';
export {
  normalizerRegistry,
  normalizeWebhook,
  isSourceSupported,
  getSupportedSources,
} from './normalizer-registry.js';
