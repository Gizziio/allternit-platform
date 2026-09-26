// §A7 — adapter registry: load adapters/<id>/manifest.yaml at boot, validate
// against the contracts manifest schema (invalid manifest = loud boot
// failure), expose the live view to /v1/capabilities and the worker factory
// (worker activation lands in Phase 3). Provider-agnostic: no branching on
// names, ever.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load as yamlLoad } from "js-yaml";
import {
  adapterManifestSchema,
  type AdapterManifest,
} from "@allternit/subscription-fabric-contracts";

export interface LoadedAdapter {
  dir: string;
  manifest: AdapterManifest;
}

export interface CapabilityViewEntry {
  capability: string;
  adapter_id: string;
  adapter_version: string;
  provider: string;
  pool_id: string;
  plans: string[];
  detachable: boolean;
  export_formats: string[];
  status: "stable" | "beta" | "disabled";
}

export interface AdapterRegistry {
  adapters: LoadedAdapter[];
  byId(adapterId: string): LoadedAdapter | undefined;
  capabilities(): CapabilityViewEntry[];
}

export function loadAdapterRegistry(adaptersDir: string): AdapterRegistry {
  const adapters: LoadedAdapter[] = [];
  if (existsSync(adaptersDir)) {
    for (const entry of readdirSync(adaptersDir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    )) {
      if (!entry.isDirectory()) continue;
      const manifestPath = join(adaptersDir, entry.name, "manifest.yaml");
      if (!existsSync(manifestPath)) continue;
      const parsed = adapterManifestSchema.safeParse(yamlLoad(readFileSync(manifestPath, "utf8")));
      if (!parsed.success) {
        throw new Error(
          `invalid adapter manifest ${manifestPath}: ${parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")}`
        );
      }
      adapters.push({ dir: dirname(manifestPath), manifest: parsed.data });
    }
  }
  return {
    adapters,
    byId(adapterId) {
      return adapters.find((a) => a.manifest.adapter_id === adapterId);
    },
    capabilities() {
      return adapters.flatMap((a) =>
        a.manifest.capabilities.map((c) => ({
          capability: c.id,
          adapter_id: a.manifest.adapter_id,
          adapter_version: a.manifest.adapter_version,
          provider: a.manifest.provider,
          pool_id: c.pool_id,
          plans: c.plans,
          detachable: c.detachable,
          export_formats: c.export_formats,
          status: c.status,
        }))
      );
    },
  };
}

// Default adapters dir: <package root>/adapters, found by walking up from
// this module (works from src/ under tsx/vitest and dist/ under node).
export function defaultAdaptersDir(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, "package.json"))) return join(dir, "adapters");
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "adapters");
}
