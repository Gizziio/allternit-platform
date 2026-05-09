export interface ComposioConnection {
  id: string;
  appName: string;
  status: string;
  createdAt: string;
}

let sdkModule: any = null;
let sdkChecked = false;

async function getComposioSDK() {
  if (sdkChecked) return sdkModule;
  sdkChecked = true;
  try {
    const mod = await import('@composio/core');
    sdkModule = mod;
    console.log('[Composio] SDK loaded');
  } catch {
    console.log('[Composio] SDK not installed, using fetch fallback');
    sdkModule = null;
  }
  return sdkModule;
}

export async function listConnections(apiKey: string): Promise<ComposioConnection[]> {
  const sdk = await getComposioSDK();
  if (sdk?.Composio) {
    const client = new sdk.Composio({ apiKey });
    return client.connectedAccounts.list();
  }

  // Fetch fallback
  const res = await fetch('https://backend.composio.dev/api/v1/connectedAccounts', {
    headers: { 'x-api-key': apiKey },
  });
  if (!res.ok) throw new Error(`Composio API error: ${res.status}`);
  const data = await res.json();
  return data.items ?? [];
}

export async function getAuthUrl(
  apiKey: string,
  appName: string,
  redirectUri: string,
  user?: string
): Promise<string> {
  const sdk = await getComposioSDK();
  if (sdk?.Composio) {
    const client = new sdk.Composio({ apiKey });
    const { data } = await client.apps.getAuthUrl(appName, {
      redirectUri,
      user,
    });
    return data.url;
  }

  // Fetch fallback
  const res = await fetch(
    `https://backend.composio.dev/api/v1/integrations/${appName}/auth-url`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ redirectUri, ...(user && { user }) }),
    }
  );
  if (!res.ok) throw new Error(`Composio auth URL error: ${res.status}`);
  const data = await res.json();
  return data.data?.url ?? data.url;
}
