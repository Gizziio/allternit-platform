/**
 * Provider Auth & Model Discovery Service
 * 
 * Handles authentication status checking and runtime model discovery
 * from kernel brain providers (ACP/JSONL runtimes like OpenCode, Gemini, etc.)
 */

import axios, { AxiosInstance } from 'axios';

export interface AuthStatus {
  provider_id: string;
  status: 'ok' | 'missing' | 'expired' | 'unknown';
  auth_required: boolean;
  auth_profile_id?: string;
  chat_profile_ids: string[];
}

export interface ModelInfo {
  id: string;
  label: string;
  meta?: {
    ctx?: number;
    vision?: boolean;
    tools?: boolean;
    [key: string]: any;
  };
}

export interface ModelsResponse {
  provider: string;
  profile_id: string;
  fetched_at: string;
  models: ModelInfo[];
}

export interface ValidationResponse {
  valid: boolean;
  status: 'valid' | 'invalid' | 'unknown';
  suggested?: string[];
  message?: string;
}

/**
 * API service for provider authentication and model discovery
 */
export class ProviderAuthService {
  private client: AxiosInstance;

  constructor(baseURL: string = '/api/v1') {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token interceptor
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('A2R_KERNEL_AUTH_TOKEN') || 
                     localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  /**
   * Get auth status for all providers
   */
  async getAllAuthStatus(): Promise<AuthStatus[]> {
    const response = await this.client.get('/providers/auth/status');
    return response.data.providers || [];
  }

  /**
   * Get auth status for a specific provider
   */
  async getAuthStatus(providerId: string): Promise<AuthStatus> {
    const response = await this.client.get(`/providers/${providerId}/auth/status`);
    return response.data;
  }

  /**
   * Discover models from a runtime
   */
  async discoverModels(providerId: string, profileId: string): Promise<ModelsResponse> {
    const response = await this.client.get(`/providers/${providerId}/models`, {
      params: { profile_id: profileId }
    });
    return response.data;
  }

  /**
   * Validate a model ID
   */
  async validateModelId(
    providerId: string, 
    profileId: string, 
    modelId: string
  ): Promise<ValidationResponse> {
    const response = await this.client.post(`/providers/${providerId}/models/validate`, {
      profile_id: profileId,
      model_id: modelId
    });
    return response.data;
  }

  /**
   * Create terminal session for auth wizard
   */
  async createAuthSession(authProfileId: string): Promise<{ session_id: string }> {
    // This calls the kernel directly via API proxy
    const response = await this.client.post('/sessions', {
      brain_profile_id: authProfileId,
      source: 'terminal'
    });
    return { session_id: response.data.id };
  }
}

// Singleton instance
export const providerAuthService = new ProviderAuthService();
