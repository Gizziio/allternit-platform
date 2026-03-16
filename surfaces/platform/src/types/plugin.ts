export type PluginZone = 'artifact' | 'inspector' | 'sidebar';

export interface MCPConfig {
  mcpServers: Record<string, {
    command: string;
    args?: string[];
    env?: Record<string, string>;
  }>;
}

export interface A2RPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  capabilities: {
    commands?: string[]; // paths to command definitions
    skills?: string[];   // paths to skill packs
    mcp?: string;        // path to mcp.json
  };
  ui?: {
    icon: string;
    preferredZone: PluginZone;
  };
}
