/**
 * HAR-derived API capture UI store.
 */

import { create } from 'zustand';
import {
  ingestHar,
  generateClient,
  loadPersistedContracts,
  persistContracts,
  createContractFromHar,
  replayEndpoint,
  loadPersistedApiSkills,
  persistApiSkills,
  notifyApiSkillsChanged,
  createApiSkillFromContract,
  type CaptureSession,
  type Endpoint,
  type ReplayInput,
  type ReplayResult,
  type SiteApiContract,
  type ApiSkill,
} from './api';

interface ApiCaptureState {
  sessions: CaptureSession[];
  contracts: SiteApiContract[];
  apiSkills: ApiSkill[];
  selectedContractId: string | null;
  selectedEndpointId: string | null;
  isLoadingSessions: boolean;
  isLoadingContracts: boolean;
  isReplaying: boolean;
  isGenerating: boolean;
  isPublishingSkill: boolean;
  replayResult: ReplayResult | null;
  generatedClient: { language: string; code: string; notes: string[] } | null;
  publishSkillSuccess: string | null;
  error: string | null;

  fetchSessions: () => Promise<void>;
  fetchContracts: () => Promise<void>;
  ingestHarFile: (harJson: string, source?: CaptureSession['source']) => Promise<void>;
  selectContract: (id: string | null) => void;
  selectEndpoint: (id: string | null) => void;
  replaySelectedEndpoint: (input: ReplayInput) => Promise<ReplayResult>;
  generateClientForSelected: (language: 'python' | 'typescript' | 'curl') => Promise<void>;
  publishAsSkill: (contractId: string, name: string, description: string) => Promise<ApiSkill | null>;
  deleteContract: (id: string) => void;
  clearError: () => void;
  clearGeneratedClient: () => void;
  clearPublishSkillSuccess: () => void;
}

export const useApiCaptureStore = create<ApiCaptureState>((set, get) => ({
  sessions: [],
  contracts: loadPersistedContracts(),
  apiSkills: loadPersistedApiSkills(),
  selectedContractId: null,
  selectedEndpointId: null,
  isLoadingSessions: false,
  isLoadingContracts: false,
  isReplaying: false,
  isGenerating: false,
  isPublishingSkill: false,
  replayResult: null,
  generatedClient: null,
  publishSkillSuccess: null,
  error: null,

  fetchSessions: async () => {
    set({ isLoadingSessions: true });
    try {
      // Sessions are local-only until backend persistence is added.
      set({ sessions: [], isLoadingSessions: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load sessions',
        isLoadingSessions: false,
      });
    }
  },

  fetchContracts: async () => {
    set({ contracts: loadPersistedContracts() });
  },

  ingestHarFile: async (harJson, source = 'upload') => {
    set({ isLoadingContracts: true, error: null });
    try {
      const result = await ingestHar(harJson);
      const contract = createContractFromHar(result.endpoints, source);
      const nextContracts = [contract, ...get().contracts];
      persistContracts(nextContracts);
      set({
        contracts: nextContracts,
        selectedContractId: contract.id,
        selectedEndpointId: null,
        isLoadingContracts: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to ingest HAR',
        isLoadingContracts: false,
      });
    }
  },

  selectContract: (id) => {
    set({ selectedContractId: id, selectedEndpointId: null, replayResult: null, generatedClient: null });
  },

  selectEndpoint: (id) => {
    set({ selectedEndpointId: id, replayResult: null, generatedClient: null });
  },

  replaySelectedEndpoint: async (input) => {
    const { contracts, selectedContractId, selectedEndpointId } = get();
    const contract = contracts.find((c) => c.id === selectedContractId);
    const endpoint = contract?.endpoints.find((e) => e.id === selectedEndpointId);
    if (!endpoint) {
      throw new Error('No endpoint selected');
    }

    set({ isReplaying: true, replayResult: null, error: null });
    try {
      const result = await replayEndpoint(endpoint, input);
      set({ replayResult: result, isReplaying: false });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Replay failed';
      set({ error: message, isReplaying: false });
      throw new Error(message);
    }
  },

  generateClientForSelected: async (language) => {
    const { contracts, selectedContractId } = get();
    const contract = contracts.find((c) => c.id === selectedContractId);
    if (!contract) return;

    set({ isGenerating: true, generatedClient: null, error: null });
    try {
      const result = await generateClient(
        contract.endpoints.map((e) => e.id),
        language,
      );
      set({ generatedClient: result, isGenerating: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Client generation failed',
        isGenerating: false,
      });
    }
  },

  publishAsSkill: async (contractId, name, description) => {
    const { contracts, apiSkills } = get();
    const contract = contracts.find((c) => c.id === contractId);
    if (!contract) {
      set({ error: 'Contract not found' });
      return null;
    }

    set({ isPublishingSkill: true, error: null, publishSkillSuccess: null });
    try {
      const skill = createApiSkillFromContract(contract, name, description);
      const nextSkills = [skill, ...apiSkills];
      persistApiSkills(nextSkills);
      notifyApiSkillsChanged();
      set({ apiSkills: nextSkills, isPublishingSkill: false, publishSkillSuccess: skill.name });
      return skill;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to publish skill';
      set({ error: message, isPublishingSkill: false });
      return null;
    }
  },

  deleteContract: (id) => {
    const next = get().contracts.filter((c) => c.id !== id);
    persistContracts(next);
    set({
      contracts: next,
      selectedContractId: get().selectedContractId === id ? null : get().selectedContractId,
      selectedEndpointId: null,
    });
  },

  clearError: () => set({ error: null }),
  clearGeneratedClient: () => set({ generatedClient: null }),
  clearPublishSkillSuccess: () => set({ publishSkillSuccess: null }),
}));
