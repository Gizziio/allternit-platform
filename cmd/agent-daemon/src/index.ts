import { discoverAgentClis } from './discovery';

const PLATFORM_URL = process.env.ALLTERNIT_PLATFORM_URL || 'http://localhost:3013';
const RUNTIME_NAME = process.env.ALLTERNIT_RUNTIME_NAME || 'local';
const HEARTBEAT_INTERVAL = 30000; // 30s

async function registerRuntime(clis: ReturnType<typeof discoverAgentClis>) {
  try {
    const res = await fetch(`${PLATFORM_URL}/api/v1/runtime/discover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: RUNTIME_NAME,
        host: 'localhost',
        agentClis: clis,
      }),
    });
    if (!res.ok) throw new Error(`Register failed: ${res.status}`);
    const data = await res.json();
    console.log('[AgentDaemon] Registered runtime:', data.runtime?.id);
    return data.runtime?.id as string;
  } catch (err) {
    console.error('[AgentDaemon] Failed to register:', err);
    return null;
  }
}

async function sendHeartbeat(runtimeId: string) {
  try {
    await fetch(`${PLATFORM_URL}/api/v1/runtime/discover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: RUNTIME_NAME,
        host: 'localhost',
        agentClis: discoverAgentClis(),
      }),
    });
  } catch (err) {
    console.error('[AgentDaemon] Heartbeat failed:', err);
  }
}

async function main() {
  console.log('[AgentDaemon] Starting Allternit Agent Daemon...');
  console.log('[AgentDaemon] Platform URL:', PLATFORM_URL);

  const clis = discoverAgentClis();
  console.log('[AgentDaemon] Discovered CLIs:', clis.map((c) => c.alias).join(', ') || 'none');

  const runtimeId = await registerRuntime(clis);
  if (!runtimeId) {
    console.error('[AgentDaemon] Could not register with platform. Retrying in 10s...');
    setTimeout(main, 10000);
    return;
  }

  setInterval(() => sendHeartbeat(runtimeId), HEARTBEAT_INTERVAL);
  console.log('[AgentDaemon] Running. Heartbeat every', HEARTBEAT_INTERVAL / 1000, 'seconds');
}

main().catch((err) => {
  console.error('[AgentDaemon] Fatal error:', err);
  process.exit(1);
});
