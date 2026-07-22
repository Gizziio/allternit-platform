/**
 * Agent adapter pool for Allternit Design mode.
 *
 * Detects popular agent CLI tools on the user's PATH and provides a uniform
 * interface for spawning them with a skill context + DESIGN.md + workspace CWD.
 *
 * This is the client-side / stub implementation. A production backend can
 * replace the detection logic with its own process manager while keeping the
 * same AdapterInfo / AgentAdapterEvent contract.
 */

export interface AdapterInfo {
  id: string;
  name: string;
  command: string;
  version?: string;
  surfaces: string[];
}

export interface AgentAdapterEvent {
  type: 'stdout' | 'stderr' | 'error' | 'exit';
  data: string;
  timestamp: number;
}

export interface SpawnAdapterOptions {
  skillBody: string;
  designMd?: string;
  cwd: string;
  inputs?: Record<string, unknown>;
}

const KNOWN_ADAPTERS: Array<Omit<AdapterInfo, 'command' | 'version'> & { commands: string[] }> = [
  { id: 'claude', name: 'Claude Code', commands: ['claude'], surfaces: ['code', 'chat'] },
  { id: 'codex', name: 'OpenAI Codex CLI', commands: ['codex'], surfaces: ['code', 'chat'] },
  { id: 'cursor-agent', name: 'Cursor Agent', commands: ['cursor', 'cursor-agent'], surfaces: ['code'] },
  { id: 'kimi', name: 'Kimi Code', commands: ['kimi', 'kimi-code'], surfaces: ['code', 'chat'] },
  { id: 'claude-desktop', name: 'Claude Desktop (MCP)', commands: ['claude-desktop'], surfaces: ['chat'] },
];

let nodeModules: { fs: typeof import('fs/promises'); path: typeof import('path') } | null = null;

async function loadNodeModules() {
  if (!nodeModules) {
    const [fs, path] = await Promise.all([
      import('fs/promises'),
      import('path'),
    ]);
    nodeModules = { fs, path };
  }
  return nodeModules;
}

function getPathDirs(path: typeof import('path')): string[] {
  const pathEnv = typeof process !== 'undefined' ? process.env.PATH : '';
  if (!pathEnv) return [];
  return pathEnv.split(path.delimiter).filter(Boolean);
}

async function fileExists(fs: typeof import('fs/promises'), filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function detectCommand(
  fs: typeof import('fs/promises'),
  path: typeof import('path'),
  command: string,
): Promise<string | undefined> {
  for (const dir of getPathDirs(path)) {
    const candidate = path.join(dir, command);
    if (await fileExists(fs, candidate)) return candidate;
    if (process.platform === 'win32') {
      const withExe = `${candidate}.exe`;
      if (await fileExists(fs, withExe)) return withExe;
    }
  }
  return undefined;
}

/**
 * Detect available agent adapters on PATH.
 */
export async function detectAdapters(): Promise<AdapterInfo[]> {
  const { fs, path } = await loadNodeModules();
  const adapters: AdapterInfo[] = [];
  for (const adapter of KNOWN_ADAPTERS) {
    for (const command of adapter.commands) {
      const resolved = await detectCommand(fs, path, command);
      if (resolved) {
        adapters.push({
          id: adapter.id,
          name: adapter.name,
          command: resolved,
          surfaces: adapter.surfaces,
        });
        break;
      }
    }
  }
  return adapters;
}

/**
 * Stub spawn for an agent adapter.
 *
 * Returns an async iterator of structured events. A real implementation would
 * spawn `command` as a child process, inject `skillBody` + `designMd` into the
 * context, and stream stdout/stderr as `AgentAdapterEvent`s.
 */
export async function* spawnAdapter(
  adapter: AdapterInfo,
  options: SpawnAdapterOptions,
): AsyncGenerator<AgentAdapterEvent> {
  yield {
    type: 'stdout',
    data: `Detected adapter ${adapter.name} (${adapter.command}) for workspace ${options.cwd}`,
    timestamp: Date.now(),
  };
  yield {
    type: 'stdout',
    data: `Spawning with ${options.skillBody.length} bytes of skill context${options.designMd ? ' and a DESIGN.md brief' : ''}.`,
    timestamp: Date.now(),
  };
  yield {
    type: 'exit',
    data: '0',
    timestamp: Date.now(),
  };
}
