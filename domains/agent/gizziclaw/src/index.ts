/**
 * GizziClaw - Agent Workspace System
 * 
 * A TypeScript implementation of the OpenCLAW agent workspace system,
 * integrated with Gizzi-Code and the A2R platform.
 */

export { Workspace, WorkspaceSchema } from './workspace/workspace.js';
export {
  getWorkspaceDirs,
  createWorkspaceDirs,
  getLayerDir,
  getSkillDir,
} from './workspace/workspace-dirs.js';
export {
  loadSkillManifest,
  loadSkills,
  installSkill,
  uninstallSkill,
} from './skills/skill-loader.js';

export type { WorkspaceConfig } from './workspace/workspace.js';
export type { SkillManifest } from './skills/skill-loader.js';
