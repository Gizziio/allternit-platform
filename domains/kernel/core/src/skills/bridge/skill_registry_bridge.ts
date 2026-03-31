/**
 * Skill Registry Bridge - OC-007
 * 
 * Bridge between OpenClaw's skill registry and A2R's native skill registry.
 * Implements the adapter pattern to translate between OpenClaw skill format 
 * and A2R skill format while maintaining A2R interface.
 * Communicates with Rust binary for reliable parsing and availability checking.
 */

import { spawn, execFileSync, ExecFileSyncOptions } from 'child_process';
import { join } from 'path';

// Types for A2R skill format
export interface A2RSkill {
  id: string;
  name: string;
  description: string;
  available: boolean;
  requires?: {
    binaries?: string[];
  };
  documentation?: string;
}

export interface SkillRegistryBridgeOptions {
  openclawPath?: string;
  binaryPath?: string;
  timeoutMs?: number;
  cacheEnabled?: boolean;
}

/**
 * Bridge that adapts OpenClaw's skill registry to A2R's interface
 */
export class SkillRegistryBridge {
  private openclawPath: string;
  private binaryPath: string;
  private timeoutMs: number;
  private cacheEnabled: boolean;
  private cache: Map<string, A2RSkill> = new Map();
  private lastCacheUpdate: number = 0;
  private cacheTtl: number = 5 * 60 * 1000; // 5 minutes

  constructor(private options: SkillRegistryBridgeOptions = {}) {
    this.openclawPath = options.openclawPath || '3-adapters/vendor/openclaw';
    this.binaryPath = options.binaryPath || './target/debug/skill-registry-bridge';
    this.timeoutMs = options.timeoutMs || 10000;
    this.cacheEnabled = options.cacheEnabled ?? true;
  }

  /**
   * Execute the Rust binary with given parameters
   */
  private executeBinary(operation: string, payload?: string): any {
    const execOptions: ExecFileSyncOptions = {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024 * 10, // 10MB
      timeout: this.timeoutMs,
      env: { ...process.env }
    };

    const args = [operation, this.openclawPath];
    if (payload) {
      args.push(payload);
    }

    try {
      const result = execFileSync(this.binaryPath, args, execOptions);
      return JSON.parse(result.toString().trim());
    } catch (error) {
      console.error(`Error executing skill-registry-bridge:`, error);
      if (error instanceof Error && 'stdout' in error) {
        console.error('Stdout:', (error as any).stdout?.toString());
      }
      if (error instanceof Error && 'stderr' in error) {
        console.error('Stderr:', (error as any).stderr?.toString());
      }
      throw new Error(`Failed to execute skill registry bridge: ${(error as Error).message}`);
    }
  }

  /**
   * List all skills from OpenClaw, adapted to A2R format
   */
  async listSkills(): Promise<A2RSkill[]> {
    if (this.cacheEnabled && Date.now() - this.lastCacheUpdate < this.cacheTtl) {
      return Array.from(this.cache.values());
    }

    try {
      const requestPayload = JSON.stringify({
        include_unavailable: false
      });

      const response = this.executeBinary('list_skills', requestPayload);
      
      // Convert from Rust format to A2R format
      const a2rSkills: A2RSkill[] = response.skills.map((skill: any) => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        available: skill.available,
        requires: skill.requires ? {
          binaries: skill.requires.binaries
        } : undefined
      }));

      // Update cache
      if (this.cacheEnabled) {
        this.cache.clear();
        a2rSkills.forEach(skill => this.cache.set(skill.id, skill));
        this.lastCacheUpdate = Date.now();
      }
      
      return a2rSkills;
    } catch (error) {
      console.error('Error in SkillRegistryBridge.listSkills:', error);
      throw error;
    }
  }

  /**
   * Get a specific skill by ID
   */
  async getSkill(id: string): Promise<A2RSkill | null> {
    if (this.cacheEnabled && this.cache.has(id)) {
      return this.cache.get(id) || null;
    }

    try {
      const requestPayload = JSON.stringify({
        skill_id: id
      });

      const response = this.executeBinary('get_skill', requestPayload);
      
      if (!response.skill) {
        return null;
      }

      const skill = response.skill;
      const a2rSkill: A2RSkill = {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        available: skill.available,
        requires: skill.requires ? {
          binaries: skill.requires.binaries
        } : undefined
      };

      // Update cache
      if (this.cacheEnabled) {
        this.cache.set(a2rSkill.id, a2rSkill);
      }
      
      return a2rSkill;
    } catch (error) {
      console.error(`Error getting skill ${id}:`, error);
      throw error;
    }
  }

  /**
   * Check if a skill is available (meets requirements)
   */
  async isSkillAvailable(id: string): Promise<boolean> {
    try {
      const response = this.executeBinary('is_available', id);
      return response;
    } catch (error) {
      console.error(`Error checking availability for skill ${id}:`, error);
      return false;
    }
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
    this.lastCacheUpdate = 0;
  }

  /**
   * Refresh the cache
   */
  async refresh(): Promise<void> {
    this.clearCache();
    await this.listSkills(); // This will rebuild the cache
  }
}