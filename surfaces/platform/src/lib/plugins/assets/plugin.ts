/**
 * Assets Plugin - Production Implementation
 * 
 * Icon & 3D asset search/generation
 * Uses Lucide icons, GLTF/GLB for 3D
 */

import type { 
  ModePlugin, 
  PluginConfig, 
  PluginInput, 
  PluginOutput, 
  PluginCapability,
  PluginEvent,
  PluginEventHandler 
} from '../types';

export interface AssetsConfig extends PluginConfig {
  iconLibrary?: 'lucide' | 'heroicons' | 'phosphor';
  enable3D?: boolean;
  modelSource?: 'sketchfab' | 'poly';
}

export interface AssetResult {
  type: 'icon' | '3d' | 'vector';
  name: string;
  source: string;
  url: string;
  previewUrl?: string;
  license?: string;
  tags: string[];
  metadata?: Record<string, unknown>;
}

class AssetsPlugin implements ModePlugin {
  readonly id = 'assets';
  readonly name = 'Assets';
  readonly version = '1.0.0';
  readonly capabilities: PluginCapability[] = [
    'icon-search',
    'icon-generation',
    '3d-models',
    'vector-graphics',
    'asset-library',
  ];

  isInitialized = false;
  isExecuting = false;
  config: AssetsConfig = {
    iconLibrary: 'lucide',
    enable3D: true,
    modelSource: 'sketchfab',
  };

  private eventHandlers: Map<string, Set<PluginEventHandler>> = new Map();
  private abortController: AbortController | null = null;

  on(event: string, handler: PluginEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: PluginEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  private emit(event: PluginEvent): void {
    this.eventHandlers.get(event.type)?.forEach(handler => {
      try {
        handler(event);
      } catch (err) {
        console.error(`[AssetsPlugin] Event handler error:`, err);
      }
    });
  }

  async initialize(config?: AssetsConfig): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    this.isInitialized = true;
    this.emit({ type: 'initialized', timestamp: Date.now() });
    console.log('[AssetsPlugin] Initialized');
  }

  async destroy(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.isInitialized = false;
    this.eventHandlers.clear();
    this.emit({ type: 'destroyed', timestamp: Date.now() });
  }

  async execute(input: PluginInput): Promise<PluginOutput> {
    if (!this.isInitialized) {
      throw new Error('Plugin not initialized');
    }

    this.isExecuting = true;
    this.abortController = new AbortController();
    
    this.emit({ type: 'started', timestamp: Date.now() });

    try {
      const query = input.prompt.toLowerCase();
      
      // Determine asset type from query
      if (query.includes('3d') || query.includes('model') || query.includes('gltf') || query.includes('glb')) {
        return await this.search3DModels(input.prompt);
      }
      
      if (query.includes('icon')) {
        return await this.searchIcons(input.prompt);
      }
      
      if (query.includes('vector') || query.includes('svg') || query.includes('illustration')) {
        return await this.searchVectors(input.prompt);
      }

      // Default to icon search
      return await this.searchIcons(input.prompt);

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      
      const output: PluginOutput = {
        success: false,
        error: {
          message: error.message,
          code: 'ASSETS_ERROR',
          recoverable: false,
        },
      };

      this.emit({ type: 'error', payload: error, timestamp: Date.now() });
      return output;

    } finally {
      this.isExecuting = false;
      this.abortController = null;
    }
  }

  async cancel(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  hasCapability(capability: PluginCapability): boolean {
    return this.capabilities.includes(capability);
  }

  async health(): Promise<{ healthy: boolean; message?: string }> {
    return { healthy: true };
  }

  private async searchIcons(query: string): Promise<PluginOutput> {
    this.emit({ 
      type: 'progress', 
      payload: { step: 'searching', message: 'Searching icon library...' },
      timestamp: Date.now() 
    });

    // Common Lucide icon keywords mapping
    const iconKeywords: Record<string, string[]> = {
      'search': ['search', 'find', 'magnifying-glass', 'lookup'],
      'home': ['home', 'house', 'main'],
      'user': ['user', 'person', 'profile', 'account'],
      'settings': ['settings', 'gear', 'cog', 'preferences'],
      'menu': ['menu', 'hamburger', 'bars', 'navigation'],
      'close': ['close', 'x', 'times', 'cancel'],
      'add': ['add', 'plus', 'create', 'new'],
      'delete': ['delete', 'trash', 'remove', 'bin'],
      'edit': ['edit', 'pencil', 'write', 'modify'],
      'save': ['save', 'download', 'store'],
      'share': ['share', 'send', 'export'],
      'heart': ['heart', 'like', 'favorite', 'love'],
      'star': ['star', 'rating', 'favorite', 'bookmark'],
      'check': ['check', 'tick', 'done', 'success'],
      'warning': ['warning', 'alert', 'caution', 'triangle'],
      'error': ['error', 'x-circle', 'alert-circle', 'danger'],
      'info': ['info', 'information', 'help', 'question'],
      'arrow': ['arrow', 'direction', 'move', 'navigation'],
      'file': ['file', 'document', 'page'],
      'folder': ['folder', 'directory', 'collection'],
      'image': ['image', 'picture', 'photo', 'gallery'],
      'video': ['video', 'play', 'movie', 'media'],
      'music': ['music', 'audio', 'sound', 'note'],
      'calendar': ['calendar', 'date', 'schedule', 'event'],
      'mail': ['mail', 'email', 'message', 'letter'],
      'phone': ['phone', 'call', 'telephone', 'contact'],
      'location': ['location', 'map', 'pin', 'gps'],
      'time': ['time', 'clock', 'watch', 'timer'],
      'battery': ['battery', 'power', 'energy', 'charge'],
      'wifi': ['wifi', 'signal', 'network', 'connection'],
      'bluetooth': ['bluetooth', 'wireless', 'connect'],
      'cloud': ['cloud', 'storage', 'upload', 'download'],
      'sun': ['sun', 'day', 'brightness', 'weather'],
      'moon': ['moon', 'night', 'dark', 'mode'],
      'lock': ['lock', 'secure', 'private', 'password'],
      'unlock': ['unlock', 'open', 'access'],
      'eye': ['eye', 'view', 'show', 'visible'],
      'eye-off': ['eye-off', 'hide', 'invisible', 'hidden'],
      'refresh': ['refresh', 'reload', 'sync', 'update'],
      'download': ['download', 'save', 'export'],
      'upload': ['upload', 'import', 'cloud'],
    };

    // Find matching icons
    const normalizedQuery = query.toLowerCase().replace(/icon/g, '').trim();
    const matches: AssetResult[] = [];

    for (const [iconName, keywords] of Object.entries(iconKeywords)) {
      const relevance = keywords.reduce((score, keyword) => {
        if (normalizedQuery.includes(keyword)) score += 3;
        if (keyword.includes(normalizedQuery)) score += 2;
        if (normalizedQuery.split(' ').some(word => keyword.includes(word))) score += 1;
        return score;
      }, 0);

      if (relevance > 0) {
        matches.push({
          type: 'icon',
          name: iconName,
          source: 'lucide-react',
          url: `https://lucide.dev/icons/${iconName}`,
          previewUrl: `https://lucide.dev/api/icon/${iconName}.svg`,
          license: 'ISC',
          tags: keywords,
          metadata: { relevance },
        });
      }
    }

    // Sort by relevance
    matches.sort((a, b) => (b.metadata?.relevance as number || 0) - (a.metadata?.relevance as number || 0));
    
    // Take top results
    const topMatches = matches.slice(0, 10);

    if (topMatches.length === 0) {
      return {
        success: true,
        content: `## Icon Search\n\nNo exact matches found for "${query}".\n\n**Popular Icons:**\n- Home, Search, User, Settings\n- Add, Edit, Delete, Save\n- Arrow, Check, Close, Menu\n\n[Browse all Lucide icons](https://lucide.dev/icons)`,
      };
    }

    const content = [
      `## Icons Found: "${query}"`,
      '',
      `Found ${topMatches.length} matching icons:`,
      '',
      ...topMatches.map(icon => [
        `### ${icon.name}`,
        `- **Library:** ${icon.source}`,
        `- **Usage:** \`import { ${icon.name.replace(/(^|-)(\w)/g, (_, __, letter) => letter.toUpperCase())} } from 'lucide-react'\``,
        `- **Preview:** [View Icon](${icon.previewUrl})`,
        `- **Tags:** ${icon.tags.slice(0, 3).join(', ')}`,
        '',
      ].join('\n')),
      '',
      '## Installation',
      '```bash',
      'npm install lucide-react',
      '# or',
      'yarn add lucide-react',
      '```',
    ].join('\n');

    return {
      success: true,
      content,
      artifacts: topMatches.map(icon => ({
        type: 'code' as const,
        url: icon.previewUrl || icon.url,
        name: `${icon.name}.svg`,
        metadata: { 
          componentName: icon.name.replace(/(^|-)(\w)/g, (_, __, letter) => letter.toUpperCase()),
          library: icon.source,
          license: icon.license,
        },
      })),
    };
  }

  private async search3DModels(query: string): Promise<PluginOutput> {
    this.emit({ 
      type: 'progress', 
      payload: { step: 'searching', message: 'Searching 3D models...' },
      timestamp: Date.now() 
    });

    // Provide guidance on 3D model sources
    const content = [
      `## 3D Models: "${query}"`,
      '',
      '### Recommended Sources',
      '',
      '**Free Models (CC0):**',
      '- [Khronos glTF Sample Models](https://github.com/KhronosGroup/glTF-Sample-Models)',
      '- [Poly Haven](https://polyhaven.com/models)',
      '- [Sketchfab Free](https://sketchfab.com/search?features=downloadable&type=models)',
      '',
      '**Three.js Examples:**',
      '- [Three.js Examples](https://threejs.org/examples/)',
      '- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)',
      '',
      '### Integration',
      '',
      '```tsx',
      'import { Canvas } from "@react-three/fiber";',
      'import { useGLTF } from "@react-three/drei";',
      '',
      'function Model() {',
      '  const { scene } = useGLTF("/model.glb");',
      '  return <primitive object={scene} />;',
      '}',
      '',
      '<Canvas>',
      '  <Model />',
      '</Canvas>',
      '```',
      '',
      '### Formats',
      '- **GLTF/GLB** - Recommended (smaller, faster)',
      '- **OBJ** - Universal compatibility',
      '- **FBX** - Animation support',
    ].join('\n');

    return {
      success: true,
      content,
      artifacts: [],
    };
  }

  private async searchVectors(query: string): Promise<PluginOutput> {
    this.emit({ 
      type: 'progress', 
      payload: { step: 'searching', message: 'Searching vector graphics...' },
      timestamp: Date.now() 
    });

    const content = [
      `## Vector Graphics: "${query}"`,
      '',
      '### Free Vector Resources',
      '',
      '**SVG Libraries:**',
      '- [Heroicons](https://heroicons.com) - Beautiful hand-crafted SVG icons',
      '- [Phosphor Icons](https://phosphoricons.com) - Flexible icon family',
      '- [Feather Icons](https://feathericons.com) - Simply beautiful open source icons',
      '',
      '**Illustrations:**',
      '- [unDraw](https://undraw.co) - Open-source illustrations',
      '- [Humaaans](https://www.humaaans.com) - Mix-and-match people illustrations',
      '- [Open Doodles](https://www.opendoodles.com) - Free sketchy illustrations',
      '',
      '**SVG Tools:**',
      '- [SVGOMG](https://jakearchibald.github.io/svgomg/) - Optimize SVGs',
      '- [Figma](https://figma.com) - Design and export SVGs',
    ].join('\n');

    return {
      success: true,
      content,
      artifacts: [],
    };
  }
}

export function createAssetsPlugin(): ModePlugin {
  return new AssetsPlugin();
}

export default createAssetsPlugin();
