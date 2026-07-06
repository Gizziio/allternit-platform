/**
 * Allternit Webhook Ingestion Service
 * 
 * Main entry point for the webhook ingestion service.
 * Receives, validates, normalizes, and processes webhooks from multiple sources.
 */

// Types
export * from './types/index.js';

// Normalizers — export only the registry and source-specific normalize functions
// to avoid duplicate helper names (requiresAgentAction, inferAgentRole, etc.).
export {
  normalizeGitHubWebhook,
  normalizeDiscordWebhook,
  normalizeAntFarmWebhook,
  normalizeMoltbookWebhook,
  normalizerRegistry,
  normalizeWebhook,
  isSourceSupported,
  getSupportedSources,
} from './normalizer/index.js';

// Security — export non-conflicting names (RateLimiter types live in ./types).
export { verifyHmacSignature, AllowlistValidator } from './security/index.js';

// Idempotency
export * from './idempotency/index.js';

// Rails Integration
export * from './rails/index.js';

// Server
export { WebhookServer, createWebhookServer } from './server/webhook-server.js';

// Config
export * from './config/index.js';
