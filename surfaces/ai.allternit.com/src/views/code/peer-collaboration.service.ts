export interface CodePeer {
  name: string;
  agentId: string;
  agentType?: string;
  model?: string;
  prompt?: string;
  status: 'running' | 'idle' | 'unknown';
  color?: string;
  cwd: string;
  worktreePath?: string;
  backendType?: string;
  mode?: string;
}

export interface PeerMessage {
  from: string;
  text: string;
  timestamp: string;
  read: boolean;
  color?: string;
  summary?: string;
}

export interface PeerContext {
  team: string | null;
  agent: string;
  source: 'runtime' | 'fallback';
}

async function peerRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string; error?: string } | null;
    throw new Error(body?.message ?? body?.error ?? `Peer API ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export async function listPeers(team: string): Promise<CodePeer[]> {
  const result = await peerRequest<{ peers: CodePeer[] }>(`/v1/peers?team=${encodeURIComponent(team)}`);
  return result.peers;
}

export async function getPeerContext(): Promise<PeerContext> {
  return peerRequest<PeerContext>('/v1/peers/context');
}

export async function readPeerInbox(team: string, agent: string): Promise<PeerMessage[]> {
  const result = await peerRequest<{ messages: PeerMessage[] }>(`/v1/peers/inbox?team=${encodeURIComponent(team)}&agent=${encodeURIComponent(agent)}`);
  return result.messages;
}

export async function sendPeerMessage(input: { team: string; from: string; recipients: string[]; text: string; summary?: string }): Promise<void> {
  await peerRequest('/v1/peers/messages', { method: 'POST', body: JSON.stringify(input) });
}

export async function markPeerInboxRead(team: string, agent: string): Promise<void> {
  await peerRequest('/v1/peers/inbox/read', { method: 'POST', body: JSON.stringify({ team, agent }) });
}
