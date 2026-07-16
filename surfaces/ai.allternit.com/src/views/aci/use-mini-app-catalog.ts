"use client";

import { useEffect, useMemo, useState } from 'react';
import type { InstalledMiniApp } from './mini-app.types';
import { validateMiniAppManifest, verifyMiniAppManifestSignature } from './mini-app-manifest';
import { manifestToMiniApp } from './mini-app-registry';
import { resolveRegistryBase } from './use-mini-app-review';

const MCP_REGISTRY_URL = 'https://registry.modelcontextprotocol.io/v0.1/servers?limit=24';

type RegistryRecord = {
  server?: {
    name?: string;
    title?: string;
    description?: string;
    version?: string;
    remotes?: Array<{ url?: string; type?: string }>;
    repository?: { url?: string };
    packages?: Array<{ registryType?: string; identifier?: string }>;
  };
  _meta?: Record<string, unknown>;
};

const COMMUNITY_CATALOG: InstalledMiniApp[] = [
  {
    id: 'github:activepieces/activepieces', name: 'Activepieces', description: 'Open-source automation platform with a visual workflow builder and a large connector ecosystem.',
    category: 'connector', source: 'github', catalogSource: 'github', url: 'https://github.com/activepieces/activepieces', sourceUrl: 'https://github.com/activepieces/activepieces',
    repo: 'activepieces/activepieces', githubUrl: 'https://github.com/activepieces/activepieces', publisher: 'Activepieces', status: 'available', installState: 'not-installed', runtimeState: 'unknown', catalogOnly: true, featured: true,
    presentation: { mode: 'hybrid', fallback: 'native-tools' }, capabilities: ['Workflow automation', 'Connectors', 'Self-hosted'],
  },
  {
    id: 'github:n8n-io/n8n', name: 'n8n', description: 'Community workflow automation platform for connecting APIs, services, data, and AI tools.',
    category: 'connector', source: 'github', catalogSource: 'github', url: 'https://github.com/n8n-io/n8n', sourceUrl: 'https://github.com/n8n-io/n8n',
    repo: 'n8n-io/n8n', githubUrl: 'https://github.com/n8n-io/n8n', publisher: 'n8n', status: 'available', installState: 'not-installed', runtimeState: 'unknown', catalogOnly: true, featured: true,
    presentation: { mode: 'hybrid', fallback: 'native-tools' }, capabilities: ['Workflow automation', 'Integrations', 'Self-hosted'],
  },
  {
    id: 'github:lobehub/lobe-chat', name: 'LobeChat', description: 'Open-source AI workspace with model providers, agents, knowledge bases, and plugins.',
    category: 'communication', source: 'github', catalogSource: 'github', url: 'https://github.com/lobehub/lobe-chat', sourceUrl: 'https://github.com/lobehub/lobe-chat',
    repo: 'lobehub/lobe-chat', githubUrl: 'https://github.com/lobehub/lobe-chat', publisher: 'LobeHub', status: 'available', installState: 'not-installed', runtimeState: 'unknown', catalogOnly: true,
    presentation: { mode: 'hybrid', fallback: 'native-tools' }, capabilities: ['AI workspace', 'Agents', 'Knowledge bases'],
  },
  {
    id: 'github:mintplex-labs/anything-llm', name: 'AnythingLLM', description: 'Open-source AI application for document chat, agents, models, and private workspaces.',
    category: 'data', source: 'github', catalogSource: 'github', url: 'https://github.com/Mintplex-Labs/anything-llm', sourceUrl: 'https://github.com/Mintplex-Labs/anything-llm',
    repo: 'Mintplex-Labs/anything-llm', githubUrl: 'https://github.com/Mintplex-Labs/anything-llm', publisher: 'Mintplex Labs', status: 'available', installState: 'not-installed', runtimeState: 'unknown', catalogOnly: true,
    presentation: { mode: 'hybrid', fallback: 'native-tools' }, capabilities: ['Document chat', 'Agents', 'Local models'],
  },
];

function registryEntryToMiniApp(record: RegistryRecord): InstalledMiniApp | null {
  const server = record.server;
  if (!server?.name) return null;
  const remote = server.remotes?.find((item) => item.url)?.url;
  const packageInfo = server.packages?.[0];
  const sourceUrl = remote || server.repository?.url || 'https://registry.modelcontextprotocol.io';
  return {
    id: `mcp:${server.name}`,
    registryName: server.name,
    name: server.title || server.name.split('/').pop() || server.name,
    description: server.description || 'MCP server from the official registry.',
    version: server.version,
    category: 'connector',
    source: 'connector',
    url: remote || sourceUrl,
    sourceUrl,
    status: 'available',
    installState: 'not-installed',
    runtimeState: 'unknown',
    githubUrl: server.repository?.url,
    publisher: server.name.split('/')[0],
    verified: true,
    catalogSource: 'mcp',
    capabilities: [remote ? 'Remote MCP' : packageInfo?.registryType || 'Package MCP'].filter(Boolean) as string[],
    presentation: { mode: 'native', fallback: 'native-tools' },
    harness: remote ? { transport: 'mcp', baseURL: remote } : packageInfo ? { transport: 'mcp', command: `${packageInfo.registryType}:${packageInfo.identifier}` } : { transport: 'mcp' },
  };
}

export function useMiniAppCatalog(localCatalog: InstalledMiniApp[]) {
  const [registryApps, setRegistryApps] = useState<InstalledMiniApp[]>([]);
  const [verifiedApps, setVerifiedApps] = useState<InstalledMiniApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(MCP_REGISTRY_URL, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Registry returned ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        const records = Array.isArray(payload?.servers) ? payload.servers : [];
        setRegistryApps(records.map(registryEntryToMiniApp).filter((app): app is InstalledMiniApp => app !== null));
        setError(null);
      })
      .catch((reason) => {
        if (reason?.name !== 'AbortError') setError(reason instanceof Error ? reason.message : 'Registry unavailable');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const baseURL = resolveRegistryBase();
    if (!baseURL) return;
    const controller = new AbortController();
    void fetch(`${baseURL}/v1/miniapps?status=verified&limit=100`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Allternit Registry returned ${response.status}`);
        return response.json();
      })
      .then(async (payload) => {
        const records: unknown[] = Array.isArray(payload?.items) ? payload.items : [];
        const apps: InstalledMiniApp[] = [];
        for (const record of records) {
          const result = validateMiniAppManifest(record);
          if (!result.valid || !(await verifyMiniAppManifestSignature(result.manifest))) continue;
          const app = manifestToMiniApp(result.manifest, baseURL, 'workspace');
          apps.push({ ...app, status: 'available', catalogSource: 'allternit', verified: true, publisher: (record as { publisher?: string }).publisher });
        }
        setVerifiedApps(apps);
      })
      .catch((reason) => {
        if (reason?.name !== 'AbortError') setError(reason instanceof Error ? reason.message : 'Allternit Registry unavailable');
      });
    return () => controller.abort();
  }, []);

  const apps = useMemo(() => {
    // Each source can independently contain the same id — the raw MCP
    // registry response has been observed to list the same server more than
    // once, and verifiedApps/COMMUNITY_CATALOG/registryApps can also overlap
    // with each other, not just with localCatalog. Dedupe across all of them
    // in one pass (first occurrence wins, in priority order) instead of only
    // checking each external candidate against localCatalog.
    const seen = new Set<string>();
    const deduped: InstalledMiniApp[] = [];
    for (const candidate of [...localCatalog, ...verifiedApps, ...COMMUNITY_CATALOG, ...registryApps]) {
      if (seen.has(candidate.id)) continue;
      seen.add(candidate.id);
      deduped.push(candidate);
    }
    return deduped;
  }, [localCatalog, registryApps, verifiedApps]);
  return { apps, loading, error };
}
