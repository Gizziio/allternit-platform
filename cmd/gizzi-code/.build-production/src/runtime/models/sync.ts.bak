import { AuthStore } from "@/runtime/auth/store";
import { ModelCache, type CacheScope } from "./cache";
import { Log } from "@/shared/util/log";
import { AnthropicAdapter } from "@/runtime/providers/adapters/anthropic";
import type { ProviderAdapter } from "@/runtime/providers/types";

export namespace ModelSync {
  const log = Log.create({ service: "models.sync" });

  // Registry of available adapters
  const ADAPTERS: Record<string, ProviderAdapter> = {
    anthropic: new AnthropicAdapter(),
    // Add others as implemented
  };

  export async function syncConnected(scope: CacheScope, projectId?: string): Promise<void> {
    log.info("Starting model synchronization for connected providers", { scope });
    
    const credentials = await AuthStore.listCredentials();
    
    for (const cred of credentials) {
      const adapter = ADAPTERS[cred.provider];
      if (!adapter) {
        log.warn("No adapter found for provider", { provider: cred.provider });
        continue;
      }

      try {
        log.debug("Syncing models for credential", { provider: cred.provider, credId: cred.id });
        const discovered = await adapter.models.list(cred);
        
        await ModelCache.save({
          provider: cred.provider,
          scope,
          credId: cred.id,
          projectId
        }, discovered);
        
      } catch (e) {
        log.error("Failed to sync models for credential", { provider: cred.provider, credId: cred.id, error: e });
      }
    }

    log.info("Model synchronization complete");
  }
}
