import { execSync } from 'child_process';

export interface DiscoveredCli {
  name: string;
  alias: string;
  version: string;
  path: string;
}

const AGENT_CLI_COMMANDS = [
  { name: 'claude', flag: '--version', alias: 'Claude Code' },
  { name: 'codex', flag: '--version', alias: 'OpenAI Codex' },
  { name: 'openclaw', flag: '--version', alias: 'OpenClaw' },
  { name: 'opencode', flag: '--version', alias: 'OpenCode' },
  { name: 'hermes', flag: '--version', alias: 'Hermes' },
  { name: 'gemini', flag: '--version', alias: 'Gemini CLI' },
  { name: 'pi', flag: '--version', alias: 'Pi CLI' },
  { name: 'cursor-agent', flag: '--version', alias: 'Cursor Agent' },
];

export function discoverAgentClis(): DiscoveredCli[] {
  const found: DiscoveredCli[] = [];

  for (const cli of AGENT_CLI_COMMANDS) {
    try {
      const path = execSync(`which ${cli.name}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      if (path) {
        let version = 'unknown';
        try {
          version = execSync(`${cli.name} ${cli.flag}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim().split('\n')[0];
        } catch {
          // version check failed
        }
        found.push({ name: cli.name, alias: cli.alias, version, path });
      }
    } catch {
      // not found on PATH
    }
  }

  return found;
}
