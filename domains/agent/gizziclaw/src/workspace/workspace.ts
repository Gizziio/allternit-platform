/**
 * GizziClaw Workspace Manager
 * Ported from OpenCLAW src/agents/workspace.ts
 * 
 * Manages agent workspace lifecycle, layer bootstrapping, and skill loading.
 */

import { z } from 'zod';
import { glob } from 'fast-glob';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

// Workspace schema
export const WorkspaceSchema = z.object({
  name: z.string(),
  version: z.string(),
  layers: z.object({
    cognitive: z.string().optional(),
    identity: z.string().optional(),
    governance: z.string().optional(),
    skills: z.string().optional(),
    business: z.string().optional(),
  }),
  skills: z.array(z.string()).optional(),
});

export type WorkspaceConfig = z.infer<typeof WorkspaceSchema>;

/**
 * Workspace class - manages agent workspace lifecycle
 */
export class Workspace {
  public readonly root: string;
  public readonly config: WorkspaceConfig;
  public readonly layers: Map<string, string>;
  public readonly skills: string[];

  constructor(root: string, config: WorkspaceConfig) {
    this.root = root;
    this.config = config;
    this.layers = new Map(Object.entries(config.layers).filter(([_, v]) => v !== undefined));
    this.skills = config.skills || [];
  }

  /**
   * Load workspace from directory
   */
  static async load(root: string): Promise<Workspace> {
    const configPath = path.join(root, 'workspace.json');
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = WorkspaceSchema.parse(JSON.parse(configContent));
    return new Workspace(root, config);
  }

  /**
   * Create new workspace
   */
  static async create(root: string, name: string): Promise<Workspace> {
    const config: WorkspaceConfig = {
      name,
      version: '1.0.0',
      layers: {
        cognitive: 'layer1-cognitive',
        identity: 'layer2-identity',
        governance: 'layer3-governance',
        skills: 'layer4-skills',
        business: 'layer5-business',
      },
      skills: [],
    };

    const workspace = new Workspace(root, config);
    await workspace.save();
    return workspace;
  }

  /**
   * Save workspace config
   */
  async save(): Promise<void> {
    const configPath = path.join(this.root, 'workspace.json');
    await fs.mkdir(this.root, { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(this.config, null, 2));
  }

  /**
   * Get layer directory
   */
  getLayerDir(layerName: string): string {
    const layerPath = this.layers.get(layerName);
    if (!layerPath) {
      throw new Error(`Layer ${layerName} not found`);
    }
    return path.join(this.root, layerPath);
  }

  /**
   * Load skills from workspace
   */
  async loadSkills(): Promise<void> {
    for (const skillName of this.skills) {
      const skillDir = path.join(this.root, 'skills', skillName);
      const skillManifest = path.join(skillDir, 'SKILL.md');
      
      try {
        await fs.access(skillManifest);
        console.log(`Loaded skill: ${skillName}`);
      } catch {
        console.warn(`Skill manifest not found: ${skillManifest}`);
      }
    }
  }

  /**
   * Add skill to workspace
   */
  async addSkill(skillName: string): Promise<void> {
    if (!this.skills.includes(skillName)) {
      this.skills.push(skillName);
      await this.save();
    }
  }

  /**
   * Remove skill from workspace
   */
  async removeSkill(skillName: string): Promise<void> {
    const index = this.skills.indexOf(skillName);
    if (index !== -1) {
      this.skills.splice(index, 1);
      await this.save();
    }
  }

  /**
   * Bootstrap workspace layers
   */
  async bootstrap(): Promise<void> {
    for (const [layerName, layerPath] of this.layers.entries()) {
      const layerDir = path.join(this.root, layerPath);
      await fs.mkdir(layerDir, { recursive: true });
      console.log(`Bootstrapped layer: ${layerName} -> ${layerDir}`);
    }
  }

  /**
   * Run workspace
   */
  async run(): Promise<void> {
    console.log(`Running workspace: ${this.config.name}`);
    await this.bootstrap();
    await this.loadSkills();
  }
}

export default Workspace;
