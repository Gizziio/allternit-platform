// Allternit-owned connector client.
//
// Talks to the in-process connector standard at /api/v1/connectors — no Composio,
// no third-party key. Connect is one-click: local_cli connects instantly (e.g.
// `gh`), owned OAuth returns an authorize_url (loopback callback) or a one-time
// Allternit OAuth-app setup knob (ALLTERNIT_<ID>_CLIENT_ID).

export interface OwnedConnectorAuth {
  type: string; // local_cli | oauth2 | device_flow | api_key
  owned: boolean;
  synthesized?: boolean;
}

export interface OwnedConnector {
  id: string;
  name: string;
  category?: string;
  description?: string;
  provider: 'allternit';
  auth: OwnedConnectorAuth;
  auth_type: string;
  tier?: number;
  executable?: boolean;
  base_url?: string;
  availability?: { installed: boolean; authed: boolean; account: string; cmd: string };
  connection?: { status: string; account?: string };
  setup?: { kind: string; set_env: string; one_click: boolean; message: string };
}

export type OwnedConnectStatus =
  | { status: 'connected'; connector: string; auth_type: string; account?: string; owned: true }
  | { status: 'authorization_required'; authorize_url: string; connector: string; owned: true }
  | { status: 'oauth_app_registration_required'; connector: string; set_env: string; message: string; owned: true }
  | { status: 'device_provider_reached'; connector: string; message: string; owned: true }
  | { status: 'owned_oauth_endpoint_mapping_needed'; connector: string; message: string; owned: true }
  | { status: string; connector?: string; owned?: boolean; [k: string]: unknown };

const BASE = '/api/v1/connectors';

export async function listOwnedConnectors(): Promise<OwnedConnector[]> {
  const res = await fetch(BASE);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.connectors ?? []) as OwnedConnector[];
}

export async function connectOwned(
  id: string,
  opts?: { via?: string; api_key?: string; values?: Record<string, string>; agent_id?: string },
): Promise<OwnedConnectStatus> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts ?? {}),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    // OAuth sidecars without a configured Google/owned client return
    // oauth_app_not_configured + a human setup_hint — surface the hint, not the code.
    const message =
      data.error === 'oauth_app_not_configured' && typeof data.setup_hint === 'string'
        ? data.setup_hint
        : typeof data.message === 'string'
          ? data.message
          : typeof data.error === 'string'
            ? data.error
            : `Connect failed (${res.status})`;
    throw new Error(message);
  }
  return data as OwnedConnectStatus;
}

export async function refreshOwned(id: string): Promise<OwnedConnectStatus> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}/refresh`, { method: 'POST' });
  return res.json();
}

export async function disconnectOwned(id: string): Promise<{ status: string }> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}/disconnect`, { method: 'DELETE' });
  return res.json();
}
