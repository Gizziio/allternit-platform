import type { ProviderDefinition } from "../src/core/types.ts";

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { assertProviderId } from "../src/core/provider-id.ts";

export interface ProviderSource {
  definition: ProviderDefinition;
  service: string;
}

export async function loadProviderSources(): Promise<ProviderSource[]> {
  const providersDir = join(process.cwd(), "src/providers");
  const entries = await readdir(providersDir, { withFileTypes: true });
  const services = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => readProviderDirectoryName(entry.name))
    .sort((a, b) => a.localeCompare(b));

  return Promise.all(
    services.map(async (service): Promise<ProviderSource> => {
      const module = (await import(`../src/providers/${service}/definition.ts`)) as ProviderDefinitionModule;
      assertProviderDefinitionService(service, module.provider.service);
      return {
        definition: module.provider,
        service,
      };
    }),
  );
}

interface ProviderDefinitionModule {
  provider: ProviderDefinition;
}

function readProviderDirectoryName(name: string): string {
  assertProviderId(name, "provider directory name");
  return name;
}

function assertProviderDefinitionService(directoryName: string, service: string): void {
  assertProviderId(service, "provider service");
  if (service !== directoryName) {
    throw new Error(`provider service must match directory name: ${directoryName} !== ${service}`);
  }
}
