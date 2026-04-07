import { Filesystem } from "@/shared/util/filesystem";
import { Global } from "@/runtime/context/global";
import path from "path";
import { Log } from "@/shared/util/log";

export interface DiscoveredModel {
  provider: string;
  providerModelId: string;
  name: string;
  capabilities?: any;
}

export type CacheScope = "global" | "project" | "session";

export interface CacheKey {
  provider: string;
  scope: CacheScope;
  credId: string;
  projectId?: string;
}

export interface ModelCacheFile {
  version: number;
  updatedAt: number;
  entries: Record<string, DiscoveredModel[]>; // serialized CacheKey -> models
}

export namespace ModelCache {
  const log = Log.create({ service: "models.cache" });

  function getCachePath() {
    return path.join(Global.Path.data, "models-cache.json");
  }

  function serializeKey(key: CacheKey): string {
    return `${key.provider}:${key.scope}:${key.credId}${key.projectId ? ":" + key.projectId : ""}`;
  }

  export async function get(key: CacheKey): Promise<DiscoveredModel[]> {
    const data = await load();
    return data.entries[serializeKey(key)] || [];
  }

  export async function save(key: CacheKey, models: DiscoveredModel[]): Promise<void> {
    const data = await load();
    data.entries[serializeKey(key)] = models;
    data.updatedAt = Date.now();
    
    try {
      await Filesystem.writeJson(getCachePath(), data);
    } catch (e) {
      log.error("Failed to save model cache", { error: e });
    }
  }

  async function load(): Promise<ModelCacheFile> {
    try {
      if (await Filesystem.exists(getCachePath())) {
        return await Filesystem.readJson<ModelCacheFile>(getCachePath());
      }
    } catch (e) {
      log.error("Failed to read model cache", { error: e });
    }
    return { version: 1, updatedAt: 0, entries: {} };
  }
}
