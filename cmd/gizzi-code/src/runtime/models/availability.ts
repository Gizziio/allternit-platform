import { ModelCatalog, ModelDefinition } from "./catalog";
import { ModelCache, DiscoveredModel, CacheKey } from "./cache";

export namespace ModelAvailability {
  export async function getAvailableModels(key: CacheKey): Promise<(ModelDefinition & { available: boolean })[]> {
    const discovered = await ModelCache.get(key);
    
    return ModelCatalog.map(canonical => {
      // Check if any of the provider aliases for this canonical model are in the discovered list
      const isDiscovered = discovered.some(d => 
        d.provider === canonical.provider && 
        canonical.providerModelIds.includes(d.providerModelId)
      );
      return { ...canonical, available: isDiscovered };
    });
  }

  export async function getExtraModels(key: CacheKey): Promise<DiscoveredModel[]> {
    const discovered = await ModelCache.get(key);
    
    // Filter out models that are already mapped in the canonical catalog
    return discovered.filter(d => 
      !ModelCatalog.some(c => 
        c.provider === d.provider && 
        c.providerModelIds.includes(d.providerModelId)
      )
    );
  }

  export async function isAvailable(id: string, key: CacheKey): Promise<boolean> {
    const available = await getAvailableModels(key);
    const model = available.find(m => m.id === id);
    return !!model?.available;
  }
}
