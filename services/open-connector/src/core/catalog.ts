import type { ActionDefinition, ProviderDefinition } from "./types.ts";

/**
 * Return providers in stable catalog order and sort each provider's actions.
 */
export function sortProviders(providers: ProviderDefinition[]): ProviderDefinition[] {
  return [...providers]
    .sort((a, b) => a.service.localeCompare(b.service))
    .map((provider) => ({
      ...provider,
      actions: [...provider.actions].sort((a, b) => a.id.localeCompare(b.id)),
    }));
}

/**
 * Flatten provider definitions into a single action list.
 */
export function allActions(providers: ProviderDefinition[]): ActionDefinition[] {
  return providers.flatMap((provider) => provider.actions);
}

/**
 * Find one provider by service id.
 */
export function findProvider(providers: ProviderDefinition[], service: string): ProviderDefinition | undefined {
  return providers.find((provider) => provider.service === service);
}

/**
 * Find one action by globally unique action id.
 */
export function findAction(providers: ProviderDefinition[], actionId: string): ActionDefinition | undefined {
  return allActions(providers).find((action) => action.id === actionId);
}
