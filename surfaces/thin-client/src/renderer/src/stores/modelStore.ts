/**
 * Model Store - Thin Client
 *
 * Fetches providers and models from the gizzi-code server via @a2r/sdk.
 */

import { create } from 'zustand';
import { sdk } from '../lib/sdk';

// ============================================================================
// Types
// ============================================================================

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  context_window?: number;
  provider?: string;
  color?: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  models: ModelInfo[];
}

interface ModelState {
  providers: ProviderInfo[];
  selectedModel: ModelInfo | null;
  isLoading: boolean;
  error: string | null;
}

interface ModelActions {
  fetchModels: () => Promise<void>;
  selectModel: (model: ModelInfo | null) => void;
  clearError: () => void;
  getAllModels: () => ModelInfo[];
}

export type ModelStore = ModelState & ModelActions;

// ============================================================================
// Provider color mapping
// ============================================================================

const PROVIDER_COLORS: Record<string, string> = {
  openai: '#10a37f',
  anthropic: '#d4a574',
  google: '#4285f4',
  moonshot: '#6b4c9a',
  kimi: '#6b4c9a',
  ollama: '#ffffff',
  local: '#ffffff',
  default: '#D4956A',
};

function getProviderColor(id: string): string {
  return PROVIDER_COLORS[id.toLowerCase()] ?? PROVIDER_COLORS['default'];
}

// ============================================================================
// Store
// ============================================================================

export const useModelStore = create<ModelStore>((set, get) => ({
  providers: [],
  selectedModel: null,
  isLoading: false,
  error: null,

  fetchModels: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await sdk.config.providers();
      if (error || !data) throw new Error((error as any)?.message ?? 'No data');

      // ProviderListResponse shape: { all: Provider[], connected: string[] }
      const rawAll: any[] = (data as any).all ?? (Array.isArray(data) ? data : []);

      const providers: ProviderInfo[] = rawAll
        .filter(p => Array.isArray(p.models) && p.models.length > 0)
        .map(p => ({
          id: p.id ?? 'unknown',
          name: p.name ?? p.id ?? 'Unknown Provider',
          models: (p.models as any[]).map(m => ({
            id: m.id ?? 'unknown-model',
            name: m.name ?? m.id ?? 'Unknown Model',
            description: m.description,
            context_window: m.context ?? m.context_window,
            provider: p.id,
            color: getProviderColor(p.id ?? ''),
          })),
        }));

      const allModels = providers.flatMap(p => p.models);
      const current = get().selectedModel;
      set({
        providers,
        selectedModel: !current && allModels.length > 0 ? allModels[0] : current,
        isLoading: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch models';
      set({
        providers: [],
        error: /fetch|network|abort/i.test(msg) ? 'API_OFFLINE' : msg,
        isLoading: false,
      });
    }
  },

  selectModel: model => set({ selectedModel: model }),
  clearError: () => set({ error: null }),
  getAllModels: () => get().providers.flatMap(p => p.models),
}));

export default useModelStore;
