import { LOCAL_MODEL_CATALOG } from "./catalog";
import type {
  InstalledLocalModel,
  LocalModelManifest,
  LocalModelProvider,
  LocalModelSelection,
  LocalModelTask,
} from "./types";

export interface LocalModelRouteRequest {
  requires: LocalModelTask[];
  preferredProviderId?: string;
  preferredManifestId?: string;
  maximumMemoryBytes?: number;
}

function supports(model: InstalledLocalModel, tasks: LocalModelTask[]): boolean {
  return tasks.every((task) => model.capabilities.tasks.includes(task));
}

function compatibleManifest(
  model: InstalledLocalModel,
  provider: LocalModelProvider,
  request: LocalModelRouteRequest,
): LocalModelManifest | undefined {
  return LOCAL_MODEL_CATALOG.find((manifest) => {
    if (request.preferredManifestId && manifest.id !== request.preferredManifestId) return false;
    if (
      request.maximumMemoryBytes &&
      manifest.requirements?.minimumMemoryBytes &&
      manifest.requirements.minimumMemoryBytes > request.maximumMemoryBytes
    ) {
      return false;
    }
    return manifest.runtimes.some(
      (runtime) =>
        runtime.engine === provider.engine &&
        (runtime.model === model.runtimeModelId || manifest.id === model.runtimeModelId),
    );
  });
}

export async function routeLocalModel(
  providers: LocalModelProvider[],
  request: LocalModelRouteRequest,
): Promise<LocalModelSelection | undefined> {
  const orderedProviders = [...providers].sort((a, b) => {
    if (a.id === request.preferredProviderId) return -1;
    if (b.id === request.preferredProviderId) return 1;
    return a.id.localeCompare(b.id);
  });

  let unverifiedFallback: LocalModelSelection | undefined;
  for (const provider of orderedProviders) {
    const status = await provider.connect();
    if (!status.connected) continue;
    for (const model of await provider.listModels()) {
      if (!supports(model, request.requires)) continue;
      const manifest = compatibleManifest(model, provider, request);
      if (request.preferredManifestId && !manifest) continue;
      const selection = { provider, model, manifest };
      if (model.capabilities.verified) return selection;
      unverifiedFallback ??= selection;
    }
  }
  return unverifiedFallback;
}
