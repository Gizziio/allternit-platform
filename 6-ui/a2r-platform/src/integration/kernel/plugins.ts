import { getKernelBridge } from './index.js';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  commands?: string[];
  skills?: string[];
  mcp?: string[];
}

export async function scanPlugins(): Promise<PluginManifest[]> {
  // In a real implementation with a node/electron backend, 
  // this would use fs.readdir or a kernel API.
  // For the UI adapter, we simulate the discovery logic.
  
  const bridge = await getKernelBridge();
  const realPlugins = (bridge as any).plugins.getAllPlugins();
  if (realPlugins && realPlugins.length > 0) {
    return realPlugins.map((p: any) => ({
      id: p.id,
      name: p.name,
      version: p.version,
      description: p.description || "Loaded from Runtime",
      commands: p.tools ? p.tools.map((t: any) => t.name) : []
    }));
  }
  
  // We mock the scanning of 'plugins/' directory
  return [
    {
      id: 'core-utils',
      name: 'Core Utilities',
      version: '1.0.0',
      description: 'Standard tools for file management and analysis.',
      commands: ['/plan', '/report'],
      skills: ['Code Analysis']
    },
    {
      id: 'mcp-filesystem',
      name: 'Filesystem MCP',
      version: '0.5.0',
      description: 'MCP server for secure filesystem access.',
      mcp: ['filesystem']
    }
  ];
}
