/**
 * useProviderAuth Hook
 * 
 * Manages provider authentication state, model discovery with caching,
 * and auth wizard flow.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  providerAuthService, 
  AuthStatus, 
  ModelsResponse, 
  ModelInfo,
  ValidationResponse 
} from '@/services/ProviderAuthService';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedModels {
  data: ModelsResponse;
  timestamp: number;
}

interface ProviderState {
  auth: AuthStatus | null;
  models: ModelInfo[];
  isLoadingAuth: boolean;
  isLoadingModels: boolean;
  error: string | null;
  lastFetched: Date | null;
}

interface UseProviderAuthReturn {
  // Auth state
  providers: Map<string, AuthStatus>;
  isLoading: boolean;
  
  // Actions
  refreshAuthStatus: () => Promise<void>;
  refreshModels: (providerId: string, profileId: string) => Promise<void>;
  validateModelId: (providerId: string, profileId: string, modelId: string) => Promise<ValidationResponse>;
  createAuthSession: (authProfileId: string) => Promise<string>;
  
  // Helpers
  getProviderState: (providerId: string) => ProviderState;
  isProviderLocked: (providerId: string) => boolean;
  isCacheStale: (providerId: string) => boolean;
}

// Global cache for models (per provider+profile)
const modelCache = new Map<string, CachedModels>();

export function useProviderAuth(): UseProviderAuthReturn {
  const [providers, setProviders] = useState<Map<string, AuthStatus>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [modelStates, setModelStates] = useState<Map<string, ModelInfo[]>>(new Map());
  const [loadingModels, setLoadingModels] = useState<Set<string>>(new Set());
  const [lastFetched, setLastFetched] = useState<Map<string, Date>>(new Map());
  
  // Load auth status on mount
  useEffect(() => {
    refreshAuthStatus();
  }, []);

  const refreshAuthStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const statuses = await providerAuthService.getAllAuthStatus();
      const map = new Map<string, AuthStatus>();
      statuses.forEach(status => {
        map.set(status.provider_id, status);
      });
      setProviders(map);
    } catch (err) {
      console.error('Failed to fetch auth status:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshModels = useCallback(async (providerId: string, profileId: string) => {
    const cacheKey = `${providerId}:${profileId}`;
    
    setLoadingModels(prev => new Set(prev).add(cacheKey));
    
    try {
      const response = await providerAuthService.discoverModels(providerId, profileId);
      
      // Update cache
      modelCache.set(cacheKey, {
        data: response,
        timestamp: Date.now()
      });
      
      // Update state
      setModelStates(prev => new Map(prev).set(cacheKey, response.models));
      setLastFetched(prev => new Map(prev).set(cacheKey, new Date()));
      
      // Clear error if any
      setErrors(prev => {
        const next = new Map(prev);
        next.delete(cacheKey);
        return next;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch models';
      setErrors(prev => new Map(prev).set(cacheKey, message));
      console.error('Failed to fetch models:', err);
    } finally {
      setLoadingModels(prev => {
        const next = new Set(prev);
        next.delete(cacheKey);
        return next;
      });
    }
  }, []);

  const validateModelId = useCallback(async (
    providerId: string, 
    profileId: string, 
    modelId: string
  ): Promise<ValidationResponse> => {
    return providerAuthService.validateModelId(providerId, profileId, modelId);
  }, []);

  const createAuthSession = useCallback(async (authProfileId: string): Promise<string> => {
    const result = await providerAuthService.createAuthSession(authProfileId);
    return result.session_id;
  }, []);

  const getProviderState = useCallback((providerId: string): ProviderState => {
    const auth = providers.get(providerId) || null;
    const cacheKey = `${providerId}:${auth?.chat_profile_ids?.[0] || ''}`;
    const models = modelStates.get(cacheKey) || [];
    const isLoadingModels = loadingModels.has(cacheKey);
    const error = errors.get(cacheKey) || null;
    const fetched = lastFetched.get(cacheKey) || null;
    
    return {
      auth,
      models,
      isLoadingAuth: isLoading,
      isLoadingModels,
      error,
      lastFetched: fetched
    };
  }, [providers, modelStates, loadingModels, errors, lastFetched, isLoading]);

  const isProviderLocked = useCallback((providerId: string): boolean => {
    const auth = providers.get(providerId);
    if (!auth) return true;
    return auth.status !== 'ok' && auth.auth_required;
  }, [providers]);

  const isCacheStale = useCallback((providerId: string): boolean => {
    const auth = providers.get(providerId);
    if (!auth?.chat_profile_ids?.[0]) return true;
    
    const cacheKey = `${providerId}:${auth.chat_profile_ids[0]}`;
    const cached = modelCache.get(cacheKey);
    if (!cached) return true;
    
    return Date.now() - cached.timestamp > CACHE_TTL_MS;
  }, [providers]);

  return {
    providers,
    isLoading,
    refreshAuthStatus,
    refreshModels,
    validateModelId,
    createAuthSession,
    getProviderState,
    isProviderLocked,
    isCacheStale
  };
}
