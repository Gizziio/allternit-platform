/**
 * Agent Stack Provider Registry
 *
 * Central registry for external agent providers. Providers register once at app
 * startup; consumers ask for a provider by id or list all installed providers.
 *
 * @module stack-providers/registry
 */

import type { AgentStackProvider, AgentStackProviderFactory } from './types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('StackProviderRegistry');

const registry = new Map<string, AgentStackProviderFactory>();
const instances = new Map<string, AgentStackProvider>();

/**
 * Register a provider factory. Idempotent.
 */
export function registerStackProvider(
  id: string,
  factory: AgentStackProviderFactory,
): void {
  if (registry.has(id)) {
    logger.warn(`Stack provider '${id}' already registered; replacing.`);
    instances.delete(id);
  }
  registry.set(id, factory);
  logger.info(`Registered stack provider: ${id}`);
}

/**
 * Unregister a provider. Mostly useful in tests.
 */
export function unregisterStackProvider(id: string): void {
  registry.delete(id);
  instances.delete(id);
  logger.info(`Unregistered stack provider: ${id}`);
}

/**
 * Clear the entire registry. Useful in tests.
 */
export function clearStackProviders(): void {
  registry.clear();
  instances.clear();
}

/**
 * Get a provider instance by id. Creates the instance on first access.
 */
export function getStackProvider(id: string): AgentStackProvider | undefined {
  const existing = instances.get(id);
  if (existing) return existing;

  const factory = registry.get(id);
  if (!factory) return undefined;

  const instance = factory();
  instances.set(id, instance);
  return instance;
}

/**
 * List all registered provider ids.
 */
export function listStackProviderIds(): string[] {
  return Array.from(registry.keys());
}

/**
 * Iterate all registered provider instances.
 */
export async function* forEachStackProvider(): AsyncGenerator<AgentStackProvider> {
  for (const id of registry.keys()) {
    const provider = getStackProvider(id);
    if (provider) yield provider;
  }
}

/**
 * Discover which registered providers are installed on this machine.
 */
export async function discoverInstalledProviders(): Promise<AgentStackProvider[]> {
  const installed: AgentStackProvider[] = [];
  for await (const provider of forEachStackProvider()) {
    try {
      if (await provider.isInstalled()) {
        installed.push(provider);
      }
    } catch (err) {
      logger.warn({ err }, `Provider '${provider.id}' installation check failed`);
    }
  }
  return installed;
}
