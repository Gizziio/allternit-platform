/**
 * Skill Registry Bridge - OC-007
 * 
 * Bridge between OpenClaw's skill registry and Allternit's native skill registry.
 * Implements the adapter pattern to translate between OpenClaw skill format 
 * and Allternit skill format while maintaining Allternit interface.
 * Communicates with Rust binary for reliable parsing and availability checking.
 */

import { spawn, execFileSync, ExecFileSyncOptions } from 'child_process';
import { join } from 'path';

// Types for Allternit skill format
export interface AllternitSkill {
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
 * Bridge that adapts OpenClaw's skill registry to Allternit's interface
 */
export class SkillRegistryBridge {
  private openclawPath: string;
  private binaryPath: string;
  private timeoutMs: number;
  private cacheEnabled: boolean;
  private cache: Map<string, AllternitSkill> = new Map();
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
   * List all skills from OpenClaw, adapted to Allternit format
   */
  async listSkills(): Promise<AllternitSkill[]> {
    if (this.cacheEnabled && Date.now() - this.lastCacheUpdate < this.cacheTtl) {
      return Array.from(this.cache.values());
    }

    try {
      const requestPayload = JSON.stringify({
        include_unavailable: false
      });

      const response = this.executeBinary('list_skills', requestPayload);
      
      // Convert from Rust format to Allternit format
      const allternitSkills: AllternitSkill[] = response.skills.map((skill: any) => ({
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
        allternitSkills.forEach(skill => this.cache.set(skill.id, skill));
        this.lastCacheUpdate = Date.now();
      }
      
      return allternitSkills;
    } catch (error) {
      console.error('Error in SkillRegistryBridge.listSkills:', error);
      throw error;
    }
  }

  /**
   * Get a specific skill by ID
   */
  async getSkill(id: string): Promise<AllternitSkill | null> {
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
      const allternitSkill: AllternitSkill = {
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
        this.cache.set(allternitSkill.id, allternitSkill);
      }
      
      return allternitSkill;
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