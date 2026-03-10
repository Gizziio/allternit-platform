import { ModelCatalog, ModelDefinition, getCanonicalModel } from "./catalog";
import { ModelAvailability } from "./availability";
import { Config } from "@/runtime/context/config/config";
import { CacheKey } from "./cache";
import { AuthStore } from "@/runtime/auth/store";

export namespace ModelResolver {
  export async function resolve(
    requestedId?: string, 
    context?: { sessionId?: string, projectId?: string }
  ): Promise<ModelDefinition> {
    
    // 1. Get all connected credentials to check availability broadly
    const credentials = await AuthStore.listCredentials();
    const scopes: CacheKey[] = credentials.map(c => ({
      provider: c.provider,
      scope: "global",
      credId: c.id,
      projectId: context?.projectId
    }));

    const checkAvailability = async (id: string) => {
      for (const key of scopes) {
        if (await ModelAvailability.isAvailable(id, key)) return true;
      }
      return false;
    };

    // 2. Use requested ID if valid and available
    if (requestedId) {
      const model = getCanonicalModel(requestedId);
      if (model && await checkAvailability(model.id)) return model;
    }

    // 3. Check project default
    const config = await Config.get();
    if (config.default_model) {
      const model = getCanonicalModel(config.default_model);
      if (model && await checkAvailability(model.id)) return model;
    }

    // 4. Fallback: pick highest ranked available model
    let bestModel: ModelDefinition | undefined;
    for (const model of ModelCatalog.sort((a, b) => b.rank - a.rank)) {
      if (await checkAvailability(model.id)) {
        bestModel = model;
        break;
      }
    }

    if (bestModel) return bestModel;

    // Absolute last resort
    return ModelCatalog[0];
  }
}
