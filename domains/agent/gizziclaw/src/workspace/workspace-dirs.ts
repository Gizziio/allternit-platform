/**
 * GizziClaw Workspace Directories
 * Ported from OpenCLAW src/agents/workspace-dirs.ts
 * 
 * Manages workspace directory structure and paths.
 */

import * as path from 'node:path';
import * as fs from 'node:fs/promises';

/**
 * Workspace directory structure
 */
export interface WorkspaceDirs {
  root: string;
  layers: {
    cognitive: string;
    identity: string;
    governance: string;
    skills: string;
    business: string;
  };
  skills: string;
  config: string;
}

/**
 * Get workspace directories
 */
export function getWorkspaceDirs(root: string): WorkspaceDirs {
  return {
    root,
    layers: {
      cognitive: path.join(root, 'layer1-cognitive'),
      identity: path.join(root, 'layer2-identity'),
      governance: path.join(root, 'layer3-governance'),
      skills: path.join(root, 'layer4-skills'),
      business: path.join(root, 'layer5-business'),
    },
    skills: path.join(root, 'skills'),
    config: path.join(root, '.gizziclaw'),
  };
}

/**
 * Create workspace directories
 */
export async function createWorkspaceDirs(root: string): Promise<WorkspaceDirs> {
  const dirs = getWorkspaceDirs(root);
  
  // Create all directories
  await fs.mkdir(dirs.layers.cognitive, { recursive: true });
  await fs.mkdir(dirs.layers.identity, { recursive: true });
  await fs.mkdir(dirs.layers.governance, { recursive: true });
  await fs.mkdir(dirs.layers.skills, { recursive: true });
  await fs.mkdir(dirs.layers.business, { recursive: true });
  await fs.mkdir(dirs.skills, { recursive: true });
  await fs.mkdir(dirs.config, { recursive: true });

  return dirs;
}

/**
 * Get layer directory by name
 */
export function getLayerDir(root: string, layerName: string): string {
  const dirs = getWorkspaceDirs(root);
  const layerMap: Record<string, string> = {
    cognitive: dirs.layers.cognitive,
    identity: dirs.layers.identity,
    governance: dirs.layers.governance,
    skills: dirs.layers.skills,
    business: dirs.layers.business,
  };
  
  const layerDir = layerMap[layerName];
  if (!layerDir) {
    throw new Error(`Unknown layer: ${layerName}`);
  }
  
  return layerDir;
}

/**
 * Get skill directory
 */
export function getSkillDir(root: string, skillName: string): string {
  return path.join(getWorkspaceDirs(root).skills, skillName);
}

export default {
  getWorkspaceDirs,
  createWorkspaceDirs,
  getLayerDir,
  getSkillDir,
};
