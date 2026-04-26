import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);

// Agent CLIs that gizzi can discover (from Multica daemon discovery pattern)
const KNOWN_AGENT_CLIS = [
  'claude',
  'codex',
  'openclaw',
  'aider',
  'cursor',
  'continue',
  'codewhisperer',
  'copilot',
  'gizzi',
] as const;

export type AgentCliName = (typeof KNOWN_AGENT_CLIS)[number];

export interface DiscoveredCli {
  name: AgentCliName;
  path: string;
  version: string;
}

export interface DiscoveredRuntime {
  host: string;
  agentClis: DiscoveredCli[];
  discoveredAt: number;
}

async function resolveCliPath(name: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('which', [name], { timeout: 3000 });
    const p = stdout.trim();
    return p.length > 0 && existsSync(p) ? p : null;
  } catch {
    return null;
  }
}

async function getCliVersion(path: string): Promise<string> {
  for (const flag of ['--version', 'version', '-v']) {
    try {
      const { stdout, stderr } = await execFileAsync(path, [flag], { timeout: 3000 });
      const raw = (stdout + stderr).trim().split('\n')[0];
      if (raw) return raw.slice(0, 80);
    } catch {
      // try next flag
    }
  }
  return 'unknown';
}

export async function discoverLocalAgentClis(): Promise<DiscoveredCli[]> {
  const results: DiscoveredCli[] = [];

  await Promise.all(
    KNOWN_AGENT_CLIS.map(async (name) => {
      const path = await resolveCliPath(name);
      if (!path) return;
      const version = await getCliVersion(path);
      results.push({ name, path, version });
    })
  );

  return results;
}

export async function discoverLocalRuntime(host = 'localhost'): Promise<DiscoveredRuntime> {
  const agentClis = await discoverLocalAgentClis();
  return {
    host,
    agentClis,
    discoveredAt: Date.now(),
  };
}

export function formatDiscoveryReport(runtime: DiscoveredRuntime): string {
  const lines: string[] = [
    `Runtime host: ${runtime.host}`,
    `Discovered at: ${new Date(runtime.discoveredAt).toLocaleString()}`,
    `Agent CLIs found: ${runtime.agentClis.length}`,
    '',
  ];
  if (runtime.agentClis.length === 0) {
    lines.push('  (none found)');
  } else {
    for (const cli of runtime.agentClis) {
      lines.push(`  ✓ ${cli.name.padEnd(18)} ${cli.version}  (${cli.path})`);
    }
  }
  return lines.join('\n');
}
