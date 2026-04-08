/**
 * Skill Installer API Service - OC-015
 * 
 * Service layer for interacting with the skill installation backend.
 * Provides methods to list, install, and manage skills via the native Rust implementation.
 */

import axios, { AxiosInstance } from 'axios';

// Types for skill data
export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  status: 'installed' | 'available' | 'installing' | 'error';
  installedVersion?: string;
  category: string;
  tags: string[];
  requires: string[];
  source: 'allternit-registry' | 'openclaw-registry' | 'local' | 'remote';
  downloadUrl?: string;
  license: string;
  lastUpdated: string;
}

export interface InstallRequest {
  skillId: string;
  version?: string;
  options?: Record<string, any>;
}

export interface InstallResponse {
  success: boolean;
  skillId: string;
  message: string;
  error?: string;
}

export interface UninstallRequest {
  skillId: string;
}

export interface UninstallResponse {
  success: boolean;
  skillId: string;
  message: string;
  error?: string;
}

export interface ListSkillsRequest {
  category?: string;
  search?: string;
  includeInstalled?: boolean;
  includeAvailable?: boolean;
}

export interface ListSkillsResponse {
  skills: Skill[];
  totalCount: number;
}

/**
 * API service for skill installation and management
 */
export class SkillInstallerApiService {
  private client: AxiosInstance;

  constructor(baseURL: string = '/api') {
    this.client = axios.create({
      baseURL,
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token if available
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('Skill API error:', error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * List available skills
   */
  async listSkills(request: ListSkillsRequest = {}): Promise<ListSkillsResponse> {
    try {
      const response = await this.client.get<ListSkillsResponse>('/skills', {
        params: request,
      });
      return response.data;
    } catch (error) {
      console.error('Error listing skills:', error);
      throw error;
    }
  }

  /**
   * Get a specific skill by ID
   */
  async getSkill(skillId: string): Promise<Skill> {
    try {
      const response = await this.client.get<Skill>(`/skills/${skillId}`);
      return response.data;
    } catch (error) {
      console.error(`Error getting skill ${skillId}:`, error);
      throw error;
    }
  }

  /**
   * Install a skill
   */
  async installSkill(request: InstallRequest): Promise<InstallResponse> {
    try {
      const response = await this.client.post<InstallResponse>('/skills/install', request);
      return response.data;
    } catch (error) {
      console.error(`Error installing skill ${request.skillId}:`, error);
      throw error;
    }
  }

  /**
   * Uninstall a skill
   */
  async uninstallSkill(request: UninstallRequest): Promise<UninstallResponse> {
    try {
      const response = await this.client.post<UninstallResponse>('/skills/uninstall', request);
      return response.data;
    } catch (error) {
      console.error(`Error uninstalling skill ${request.skillId}:`, error);
      throw error;
    }
  }

  /**
   * Update a skill to a new version
   */
  async updateSkill(skillId: string, version?: string): Promise<InstallResponse> {
    try {
      const response = await this.client.post<InstallResponse>(`/skills/${skillId}/update`, {
        version,
      });
      return response.data;
    } catch (error) {
      console.error(`Error updating skill ${skillId}:`, error);
      throw error;
    }
  }

  /**
   * Get installation status for a skill
   */
  async getInstallationStatus(skillId: string): Promise<{ status: string; progress: number; message: string }> {
    try {
      const response = await this.client.get<{ status: string; progress: number; message: string }>(
        `/skills/${skillId}/status`
      );
      return response.data;
    } catch (error) {
      console.error(`Error getting installation status for skill ${skillId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel an ongoing installation
   */
  async cancelInstallation(skillId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.client.post<{ success: boolean; message: string }>(
        `/skills/${skillId}/cancel`
      );
      return response.data;
    } catch (error) {
      console.error(`Error canceling installation for skill ${skillId}:`, error);
      throw error;
    }
  }

  /**
   * Get skill compatibility information
   */
  async getCompatibility(skillId: string): Promise<{ compatible: boolean; issues: string[]; suggestions: string[] }> {
    try {
      const response = await this.client.get<{ compatible: boolean; issues: string[]; suggestions: string[] }>(
        `/skills/${skillId}/compatibility`
      );
      return response.data;
    } catch (error) {
      console.error(`Error getting compatibility for skill ${skillId}:`, error);
      throw error;
    }
  }

  /**
   * Validate skill installation requirements
   */
  async validateRequirements(skillId: string): Promise<{ valid: boolean; missing: string[]; warnings: string[] }> {
    try {
      const response = await this.client.post<{ valid: boolean; missing: string[]; warnings: string[] }>(
        `/skills/${skillId}/validate`,
        {}
      );
      return response.data;
    } catch (error) {
      console.error(`Error validating requirements for skill ${skillId}:`, error);
      throw error;
    }
  }
}

// Export a default instance for convenience
export const skillInstallerApi = new SkillInstallerApiService();