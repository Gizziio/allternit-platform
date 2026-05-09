export type ComposioApp = 'github' | 'linear' | 'notion' | 'gmail' | 'slack';

export interface ComposioConnection {
  app: ComposioApp;
  connected: boolean;
  accountId?: string;
}

export async function getComposioConnections(): Promise<ComposioConnection[]> {
  const res = await fetch('/api/design/composio/connections');
  if (!res.ok) return [];
  return res.json();
}

export async function initiateComposioConnect(app: ComposioApp): Promise<{ authUrl: string }> {
  const res = await fetch('/api/design/composio/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app }),
  });
  return res.json();
}
