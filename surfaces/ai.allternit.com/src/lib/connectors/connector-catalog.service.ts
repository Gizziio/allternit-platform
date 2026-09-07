/**
 * Open-Connector Catalog Service
 *
 * Surface client that reads the open-connector provider catalog through the
 * Allternit API proxy and maps provider actions to bot tool references.
 *
 * Credentials stay server-side in the connector sidecar / vault; this module
 * only deals with public catalog metadata.
 *
 * @module connector-catalog.service
 */

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('ConnectorCatalogService');

const BASE = '/api/v1/connectors';

export interface ConnectorCatalogAction {
  /** Globally unique action id, usually `<service>.<name>`. */
  id: string;
  /** Provider service id. */
  service: string;
  /** Provider-scoped action name. */
  name: string;
  /** Human-readable action summary. */
  description: string;
  /** OAuth scopes or permissions required. */
  requiredScopes: string[];
  providerPermissions: string[];
}

export interface ConnectorCatalogProvider {
  /** Stable lowercase service id. */
  service: string;
  /** Human-readable provider name. */
  displayName: string;
  description?: string;
  categories: string[];
  /** Auth types advertised by the provider. */
  authTypes: Array<'no_auth' | 'api_key' | 'custom_credential' | 'oauth2'>;
  /** Public homepage, if known. */
  homepageUrl?: string;
  /** Icon URL, if known. */
  iconUrl?: string;
  /** Number of actions in the catalog for this provider. */
  actionCount: number;
  /** Number of actions this runtime can execute locally. */
  executableActionCount: number;
  /** Full actions, populated when a single provider is fetched. */
  actions?: ConnectorCatalogAction[];
}

export interface ConnectorCatalog {
  providers: ConnectorCatalogProvider[];
  totalProviders: number;
  totalActions: number;
}

/**
 * List all providers in the open-connector catalog.
 *
 * The Allternit API merges the in-process design catalog with the vendored
 * open-connector sidecar catalog, so this returns the unified marketplace view.
 */
export async function listConnectorCatalogProviders(): Promise<ConnectorCatalogProvider[]> {
  try {
    const res = await fetch(BASE);
    if (!res.ok) {
      throw new Error(`Catalog request failed: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as {
      connectors?: Array<{
        id: string;
        name: string;
        category?: string;
        description?: string;
        provider?: string;
        auth_type?: string;
        base_url?: string;
        connection?: { status?: string; account?: string };
        executable_actions?: number;
        total_actions?: number;
      }>;
    };

    const connectors = data.connectors ?? [];
    return connectors.map((c): ConnectorCatalogProvider => ({
      service: c.id,
      displayName: c.name,
      description: c.description,
      categories: c.category ? [c.category] : ['Other'],
      authTypes: normalizeAuthTypes(c.auth_type),
      homepageUrl: c.base_url,
      actionCount: c.total_actions ?? 0,
      executableActionCount: c.executable_actions ?? 0,
    }));
  } catch (err) {
    logger.warn({ err }, 'Failed to load connector catalog');
    return [];
  }
}

/**
 * Fetch a single provider's full action catalog.
 */
export async function getConnectorCatalogProvider(
  service: string,
): Promise<ConnectorCatalogProvider | null> {
  try {
    const res = await fetch(`${BASE}/${encodeURIComponent(service)}`);
    if (!res.ok) {
      throw new Error(`Provider request failed: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as {
      id: string;
      name?: string;
      displayName?: string;
      description?: string;
      categories?: string[];
      category?: string;
      authTypes?: string[];
      auth_type?: string;
      homepageUrl?: string;
      iconUrl?: string;
      actions?: Array<{
        id: string;
        service: string;
        name: string;
        description: string;
        requiredScopes?: string[];
        providerPermissions?: string[];
      }>;
      execution?: { actionCount?: number; locallyExecutableActionCount?: number };
    };

    return {
      service: data.id,
      displayName: data.displayName ?? data.name ?? data.id,
      description: data.description,
      categories: data.categories ?? (data.category ? [data.category] : ['Other']),
      authTypes: normalizeAuthTypes(data.authTypes ?? data.auth_type),
      homepageUrl: data.homepageUrl,
      iconUrl: data.iconUrl,
      actionCount: data.execution?.actionCount ?? data.actions?.length ?? 0,
      executableActionCount: data.execution?.locallyExecutableActionCount ?? 0,
      actions: (data.actions ?? []).map((a): ConnectorCatalogAction => ({
        id: a.id,
        service: a.service,
        name: a.name,
        description: a.description,
        requiredScopes: a.requiredScopes ?? [],
        providerPermissions: a.providerPermissions ?? [],
      })),
    };
  } catch (err) {
    logger.warn({ err, service }, 'Failed to load connector provider');
    return null;
  }
}

/**
 * Return the stable tool reference string for a connector action.
 *
 * Bot runtimes can use this string to invoke the action through the connector
 * MCP or execute endpoint.
 */
export function getConnectorToolRef(action: ConnectorCatalogAction): string {
  return `${action.service}.${action.name}`;
}

function normalizeAuthTypes(
  value: string | string[] | undefined,
): ConnectorCatalogProvider['authTypes'] {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  return raw
    .map((t) => String(t).toLowerCase())
    .filter((t): t is ConnectorCatalogProvider['authTypes'][number] =>
      ['no_auth', 'api_key', 'custom_credential', 'oauth2'].includes(t),
    );
}
