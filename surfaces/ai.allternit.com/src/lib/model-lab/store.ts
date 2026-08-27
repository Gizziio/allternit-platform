/**
 * Model Lab UI state store.
 *
 * Owns tab navigation, Unsloth job polling, Local Engine state, and the
 * Playground chat surface. Server state is refreshed on an interval while the
 * Model Lab view is mounted.
 */

import { create } from 'zustand';
import type {
  CachedModel,
  ChatMessage,
  CreateModelLabJobRequest,
  EngineHealth,
  EngineStatus,
  ModelJob,
  RuntimeInstance,
  RuntimeRecipe,
} from './api';
import {
  listModelLabJobs,
  createModelLabJob,
  getLocalEngineHealth,
  getLocalEngineStatus,
  listLocalEngineModels,
  listLocalEngineRuntimes,
  importLocalEngineModel,
  downloadLocalEngineModel,
  launchLocalEngineRuntime,
  stopLocalEngineRuntime,
  chatWithLocalEngine,
  searchHuggingFaceModels,
  type HuggingFaceModel,
  type HfSortOption,
  getLocalStudioHealth,
  getLocalStudioStatus,
  getLocalStudioGpus,
  listLocalStudioModels,
  getLocalStudioUsage,
  getLocalStudioLogs,
  type LocalStudioHealth,
  type LocalStudioStatus,
  type LocalStudioGpuInfo,
  type LocalStudioModelsResponse,
  type LocalStudioUsage,
  type LocalStudioLogs,
  registerLocalEngineProvider,
  registerSidecarProvider,
  type RegisterLocalProviderResult,
} from './api';

export type ModelLabTab = 'engine' | 'catalog' | 'train' | 'studio' | 'cloud' | 'playground';

interface ModelLabState {
  // ── Tabs ──
  activeTab: ModelLabTab;
  setActiveTab: (tab: ModelLabTab) => void;

  // ── Jobs ──
  jobs: ModelJob[];
  jobsLoading: boolean;
  jobsError: string | null;
  fetchJobs: () => Promise<void>;
  createJob: (request: CreateModelLabJobRequest) => Promise<ModelJob>;

  // ── Local Engine ──
  engineHealth: EngineHealth | null;
  engineStatus: EngineStatus | null;
  engineModels: CachedModel[];
  engineRuntimes: RuntimeInstance[];
  engineLoading: boolean;
  engineError: string | null;
  fetchEngineHealth: () => Promise<void>;
  fetchEngineStatus: () => Promise<void>;
  fetchEngineModels: () => Promise<void>;
  fetchEngineRuntimes: () => Promise<void>;
  refreshEngineState: () => Promise<void>;
  importModel: (path: string, name?: string) => Promise<void>;
  downloadModel: (repoId: string) => Promise<void>;
  launchRuntime: (modelId: string, recipe: RuntimeRecipe) => Promise<void>;
  stopRuntime: (runtimeId: string) => Promise<void>;

  // ── Brain integration ──
  registerEngineAsBrain: () => Promise<RegisterLocalProviderResult>;
  registerSidecarAsBrain: (models?: Array<{ tag: string; sizeBytes?: number }>) => Promise<RegisterLocalProviderResult>;
  brainRegisterLoading: boolean;
  brainRegisterError: string | null;
  brainRegisterLastProvider: string | null;

  // ── Local Studio ──
  localStudioHealth: LocalStudioHealth | null;
  localStudioStatus: LocalStudioStatus | null;
  localStudioGpus: LocalStudioGpuInfo | null;
  localStudioModels: LocalStudioModelsResponse | null;
  localStudioUsage: LocalStudioUsage | null;
  localStudioLogs: LocalStudioLogs | null;
  localStudioLoading: boolean;
  localStudioError: string | null;
  fetchLocalStudioHealth: () => Promise<void>;
  fetchLocalStudioStatus: () => Promise<void>;
  fetchLocalStudioGpus: () => Promise<void>;
  fetchLocalStudioModels: () => Promise<void>;
  fetchLocalStudioUsage: (window?: string) => Promise<void>;
  fetchLocalStudioLogs: (options?: { limit?: number; level?: string }) => Promise<void>;
  refreshLocalStudioState: () => Promise<void>;

  // ── Playground ──
  playgroundMessages: ChatMessage[];
  playgroundModelId: string | null;
  playgroundStreaming: boolean;
  playgroundError: string | null;
  setPlaygroundModelId: (id: string | null) => void;
  sendPlaygroundMessage: (content: string) => Promise<void>;
  clearPlaygroundMessages: () => void;

  // ── Polling ──
  startPolling: () => void;
  stopPolling: () => void;
}

const POLL_INTERVAL_MS = 5000;

// Module-level polling handle so the store interface stays clean.
let pollIntervalId: number | null = null;

export const useModelLabStore = create<ModelLabState>((set, get) => ({
  // ── Tabs ──
  activeTab: 'engine',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // ── Jobs ──
  jobs: [],
  jobsLoading: false,
  jobsError: null,
  fetchJobs: async () => {
    set({ jobsLoading: true, jobsError: null });
    try {
      const jobs = await listModelLabJobs();
      set({ jobs, jobsLoading: false });
    } catch (error) {
      set({
        jobsError: error instanceof Error ? error.message : 'Failed to load jobs',
        jobsLoading: false,
      });
    }
  },

  createJob: async (request) => {
    try {
      const job = await createModelLabJob(request);
      await get().fetchJobs();
      return job;
    } catch (error) {
      set({
        jobsError: error instanceof Error ? error.message : 'Failed to create job',
      });
      throw error;
    }
  },

  // ── Local Engine ──
  engineHealth: null,
  engineStatus: null,
  engineModels: [],
  engineRuntimes: [],
  engineLoading: false,
  engineError: null,

  fetchEngineHealth: async () => {
    try {
      const engineHealth = await getLocalEngineHealth();
      set({ engineHealth, engineError: null });
    } catch (error) {
      set({
        engineError: error instanceof Error ? error.message : 'Engine health check failed',
        engineHealth: null,
      });
    }
  },

  fetchEngineStatus: async () => {
    try {
      const engineStatus = await getLocalEngineStatus();
      set({ engineStatus, engineError: null });
    } catch (error) {
      set({
        engineError: error instanceof Error ? error.message : 'Engine status check failed',
        engineStatus: null,
      });
    }
  },

  fetchEngineModels: async () => {
    try {
      const engineModels = await listLocalEngineModels();
      set({ engineModels, engineError: null });
    } catch (error) {
      set({
        engineError: error instanceof Error ? error.message : 'Failed to load engine models',
      });
    }
  },

  fetchEngineRuntimes: async () => {
    try {
      const engineRuntimes = await listLocalEngineRuntimes();
      set({ engineRuntimes, engineError: null });
    } catch (error) {
      set({
        engineError: error instanceof Error ? error.message : 'Failed to load runtimes',
      });
    }
  },

  refreshEngineState: async () => {
    set({ engineLoading: true, engineError: null });
    try {
      await Promise.all([
        get().fetchEngineHealth(),
        get().fetchEngineStatus(),
        get().fetchEngineModels(),
        get().fetchEngineRuntimes(),
      ]);
    } finally {
      set({ engineLoading: false });
    }
  },

  importModel: async (path, name) => {
    try {
      await importLocalEngineModel({ path, name, source: 'unsloth_output' });
      await get().fetchEngineModels();
      await get().fetchEngineStatus();
    } catch (error) {
      set({
        engineError: error instanceof Error ? error.message : 'Failed to import model',
      });
      throw error;
    }
  },

  downloadModel: async (repoId) => {
    try {
      await downloadLocalEngineModel({ repo_id: repoId });
      await get().fetchEngineModels();
    } catch (error) {
      set({
        engineError: error instanceof Error ? error.message : 'Failed to download model',
      });
      throw error;
    }
  },

  launchRuntime: async (modelId, recipe) => {
    try {
      await launchLocalEngineRuntime({ model_id: modelId, recipe });
      await get().fetchEngineRuntimes();
      await get().fetchEngineStatus();
    } catch (error) {
      set({
        engineError: error instanceof Error ? error.message : 'Failed to launch runtime',
      });
      throw error;
    }
  },

  stopRuntime: async (runtimeId) => {
    try {
      await stopLocalEngineRuntime(runtimeId);
      await get().fetchEngineRuntimes();
      await get().fetchEngineStatus();
    } catch (error) {
      set({
        engineError: error instanceof Error ? error.message : 'Failed to stop runtime',
      });
      throw error;
    }
  },

  // ── Brain integration ──
  brainRegisterLoading: false,
  brainRegisterError: null,
  brainRegisterLastProvider: null,

  registerEngineAsBrain: async () => {
    set({ brainRegisterLoading: true, brainRegisterError: null });
    try {
      const result = await registerLocalEngineProvider(get().engineModels);
      set({ brainRegisterLastProvider: result.provider, brainRegisterLoading: false });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to register Local Engine';
      set({ brainRegisterError: message, brainRegisterLoading: false });
      throw error;
    }
  },

  registerSidecarAsBrain: async (models) => {
    set({ brainRegisterLoading: true, brainRegisterError: null });
    try {
      const result = await registerSidecarProvider(models ?? []);
      set({ brainRegisterLastProvider: result.provider, brainRegisterLoading: false });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to register sidecar';
      set({ brainRegisterError: message, brainRegisterLoading: false });
      throw error;
    }
  },

  // ── Local Studio ──
  localStudioHealth: null,
  localStudioStatus: null,
  localStudioGpus: null,
  localStudioModels: null,
  localStudioUsage: null,
  localStudioLogs: null,
  localStudioLoading: false,
  localStudioError: null,

  fetchLocalStudioHealth: async () => {
    try {
      const health = await getLocalStudioHealth();
      set({ localStudioHealth: health, localStudioError: null });
    } catch (error) {
      set({
        localStudioError: error instanceof Error ? error.message : 'Local Studio health check failed',
        localStudioHealth: null,
      });
    }
  },

  fetchLocalStudioStatus: async () => {
    try {
      const status = await getLocalStudioStatus();
      set({ localStudioStatus: status, localStudioError: null });
    } catch (error) {
      set({
        localStudioError: error instanceof Error ? error.message : 'Local Studio status check failed',
        localStudioStatus: null,
      });
    }
  },

  fetchLocalStudioGpus: async () => {
    try {
      const gpus = await getLocalStudioGpus();
      set({ localStudioGpus: gpus, localStudioError: null });
    } catch (error) {
      set({
        localStudioError: error instanceof Error ? error.message : 'Failed to load Local Studio GPU info',
        localStudioGpus: null,
      });
    }
  },

  fetchLocalStudioModels: async () => {
    try {
      const models = await listLocalStudioModels();
      set({ localStudioModels: models, localStudioError: null });
    } catch (error) {
      set({
        localStudioError: error instanceof Error ? error.message : 'Failed to load Local Studio models',
        localStudioModels: null,
      });
    }
  },

  fetchLocalStudioUsage: async (window = '1h') => {
    try {
      const usage = await getLocalStudioUsage(window);
      set({ localStudioUsage: usage, localStudioError: null });
    } catch (error) {
      set({
        localStudioError: error instanceof Error ? error.message : 'Failed to load Local Studio usage',
        localStudioUsage: null,
      });
    }
  },

  fetchLocalStudioLogs: async (options = {}) => {
    try {
      const logs = await getLocalStudioLogs(options);
      set({ localStudioLogs: logs, localStudioError: null });
    } catch (error) {
      set({
        localStudioError: error instanceof Error ? error.message : 'Failed to load Local Studio logs',
        localStudioLogs: null,
      });
    }
  },

  refreshLocalStudioState: async () => {
    set({ localStudioLoading: true, localStudioError: null });
    try {
      await Promise.all([
        get().fetchLocalStudioHealth(),
        get().fetchLocalStudioStatus(),
        get().fetchLocalStudioGpus(),
        get().fetchLocalStudioModels(),
        get().fetchLocalStudioUsage(),
        get().fetchLocalStudioLogs({ limit: 100 }),
      ]);
    } finally {
      set({ localStudioLoading: false });
    }
  },

  // ── Playground ──
  playgroundMessages: [],
  playgroundModelId: null,
  playgroundStreaming: false,
  playgroundError: null,

  setPlaygroundModelId: (id) => set({ playgroundModelId: id }),

  sendPlaygroundMessage: async (content) => {
    const { playgroundModelId, playgroundMessages } = get();
    if (!playgroundModelId) {
      set({ playgroundError: 'Select a running model first' });
      return;
    }

    const userMessage: ChatMessage = { role: 'user', content };
    set({
      playgroundMessages: [...playgroundMessages, userMessage],
      playgroundStreaming: true,
      playgroundError: null,
    });

    let assistantContent = '';
    try {
      await chatWithLocalEngine(
        {
          model: playgroundModelId,
          messages: [...playgroundMessages, userMessage],
          stream: true,
          temperature: 0.7,
        },
        (chunk) => {
          const delta = chunk.choices[0]?.delta?.content ?? '';
          if (delta) {
            assistantContent += delta;
            set((state) => {
              const messages = [...state.playgroundMessages];
              const last = messages[messages.length - 1];
              if (last && last.role === 'assistant') {
                messages[messages.length - 1] = { ...last, content: assistantContent };
              } else {
                messages.push({ role: 'assistant', content: assistantContent });
              }
              return { playgroundMessages: messages };
            });
          }
        },
        (error) => {
          set({ playgroundError: error.message });
        }
      );
    } catch (error) {
      set({
        playgroundError: error instanceof Error ? error.message : 'Chat request failed',
      });
    } finally {
      set({ playgroundStreaming: false });
    }
  },

  clearPlaygroundMessages: () =>
    set({ playgroundMessages: [], playgroundError: null }),

  // ── Polling ──
  startPolling: () => {
    if (pollIntervalId !== null || typeof window === 'undefined') return;

    // Immediate first fetch.
    void get().fetchJobs();
    void get().refreshEngineState();

    pollIntervalId = window.setInterval(() => {
      void get().fetchJobs();
      void get().refreshEngineState();
    }, POLL_INTERVAL_MS);
  },

  stopPolling: () => {
    if (pollIntervalId !== null) {
      if (typeof window !== 'undefined') {
        window.clearInterval(pollIntervalId);
      }
      pollIntervalId = null;
    }
  }
}));

// ── Catalog store (Hugging Face search + install queue) ─────────────────────

interface ModelLabCatalogState {
  query: string;
  setQuery: (q: string) => void;

  sort: HfSortOption;
  setSort: (s: HfSortOption) => void;

  results: HuggingFaceModel[];
  loading: boolean;
  error: string | null;
  searched: boolean;

  search: () => Promise<void>;

  installQueue: Set<string>;
  markInstalling: (repoId: string) => void;
  markInstallDone: (repoId: string) => void;
}

export const useModelLabCatalogStore = create<ModelLabCatalogState>((set, get) => ({
  query: '',
  setQuery: (q) => set({ query: q }),

  sort: 'downloads',
  setSort: (s) => set({ sort: s }),

  results: [],
  loading: false,
  error: null,
  searched: false,

  search: async () => {
    const { query } = get();
    if (!query.trim()) {
      set({ results: [], searched: false, error: null });
      return;
    }
    set({ loading: true, error: null });
    try {
      const { models } = await searchHuggingFaceModels(query, 30);
      set({ results: models, loading: false, searched: true });
    } catch (e) {
      set({
        results: [],
        loading: false,
        searched: true,
        error: e instanceof Error ? e.message : 'Search failed',
      });
    }
  },

  installQueue: new Set(),
  markInstalling: (repoId) =>
    set((s) => ({ installQueue: new Set(s.installQueue).add(repoId) })),
  markInstallDone: (repoId) =>
    set((s) => {
      const next = new Set(s.installQueue);
      next.delete(repoId);
      return { installQueue: next };
    }),
}));
