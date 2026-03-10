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

// Kernel bridge plugin interface
interface KernelBridge {
  plugins?: {
    getAllPlugins(): unknown;
  };
}

// Runtime plugin from kernel
interface RuntimePlugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  tools?: Array<{ name: string }>;
}

export async function scanPlugins(): Promise<PluginManifest[]> {
  const bridge = await getKernelBridge();
  const pluginsApi = (bridge as KernelBridge | undefined)?.plugins;
  const runtimePlugins = typeof pluginsApi?.getAllPlugins === 'function'
    ? pluginsApi.getAllPlugins()
    : [];

  if (Array.isArray(runtimePlugins) && runtimePlugins.length > 0) {
    return runtimePlugins.map((p: RuntimePlugin) => ({
      id: p.id,
      name: p.name,
      version: p.version,
      description: p.description || 'Loaded from Runtime',
      commands: p.tools ? p.tools.map((t) => t.name) : []
    }));
  }

  return [];
}
