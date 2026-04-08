/**
 * Agent Workspace Service
 * 
 * Manages the creation, loading, updating, and packaging of agent workspaces.
 * This is the core service for the agent lifecycle.
 */

import { getAgent, createAgent } from './agent.service';
import { filesApi } from './files-api';
import type { 
  CreateAgentInput, 
  Agent, 
  AgentWorkspace,
  AgentStatus,
  AgentWorkspaceLayers
} from './agent.types';

// File types (mirroring files-api types for convenience)
interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
  children?: FileNode[];
}

interface FileSystemSnapshot {
  timestamp: number;
  entries: FileNode[];
}

import {
  type WorkspaceTemplate,
  getTemplate,
  listTemplates,
  substituteTemplateVariables,
  buildVariablesFromInput
} from './agent-templates';
import JSZip from 'jszip';

// Helper to safely parse JSON
function safeJSONParse<T>(text: string, defaultValue: T): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    console.error('[AgentWorkspaceService] JSON parse error:', error);
    return defaultValue;
  }
}

// Workspace paths
const WORKSPACE_ROOT = 'agents';

// In-memory cache
const workspaceCache = new Map<string, AgentWorkspace>();

/**
 * Generate workspace ID from agent name
 */
function generateWorkspaceId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug}-${Date.now()}`;
}

/**
 * Get workspace path for an agent
 */
function getWorkspacePath(agentId: string): string {
  return `${WORKSPACE_ROOT}/${agentId}`;
}

/**
 * Check if a workspace exists for an agent
 */
async function workspaceExists(agentId: string): Promise<boolean> {
  try {
    const path = getWorkspacePath(agentId);
    await filesApi.readFile({ path: `${path}/.allternit/manifest.json` });
    return true;
  } catch {
    return false;
  }
}

/**
 * Load agent workspace from disk
 */
async function loadWorkspace(agentId: string): Promise<AgentWorkspace> {
  // Check cache
  const cached = workspaceCache.get(agentId);
  if (cached) {
    return cached;
  }

  const path = getWorkspacePath(agentId);
  const agent = await getAgent(agentId);
  
  if (!agent) {
    throw new Error(`Agent ${agentId} not found`);
  }

  // Try to load manifest
  let manifest: any = {};
  try {
    const response = await filesApi.readFile({ path: `${path}/.allternit/manifest.json` });
    manifest = JSON.parse(response.content);
  } catch {
    // No manifest, create minimal workspace
  }

  // Load or build file tree
  let fileTree: FileNode[];
  try {
    const response = await filesApi.listDirectory({ path });
    fileTree = response.entries.map(e => ({
      name: e.name,
      path: e.path,
      type: e.type,
      size: e.size,
      modifiedAt: e.modifiedAt,
    }));
  } catch {
    // Directory doesn't exist yet
    fileTree = [];
  }

  const workspace: AgentWorkspace = {
    id: agent.workspaceId || generateWorkspaceId(agent.name),
    agentId: agent.id,
    agentName: agent.name,
    manifest,
    fileTree,
    lastModified: manifest.lastModified || Date.now(),
    status: agent.status,
    version: manifest.version || '1.0.0',
    layers: manifest.layers || {
      cognitive: false,
      identity: false,
      governance: false,
      skills: false,
      business: false
    }
  };

  // Cache it
  workspaceCache.set(agentId, workspace);
  
  return workspace;
}

/**
 * Create a new agent workspace from template
 */
async function createWorkspace(
  input: CreateAgentInput,
  templateId: string = 'allternit-standard',
  userContext?: { userName?: string; userGoals?: string; userId: string },
  layerConfig?: AgentWorkspaceLayers
): Promise<AgentWorkspace> {
  const template = getTemplate(templateId);
  if (!template) {
    throw new Error(`Template ${templateId} not found`);
  }

  // Merge template layers with custom layer config
  const finalLayers = layerConfig ? {
    ...template.layers,
    ...layerConfig
  } : template.layers;

  // First, create the agent record
  const agent = await createAgent({
    ...input,
    ownerId: userContext?.userId || 'system',
    workspaceId: generateWorkspaceId(input.name)
  });

  const workspacePath = getWorkspacePath(agent.id);
  const workspaceId = agent.workspaceId!;

  // Build variables for substitution
  const variables = buildVariablesFromInput(input, {
    userName: userContext?.userName,
    userGoals: userContext?.userGoals
  });

  // Filter files based on enabled layers
  const filesToCreate = Object.entries(template.files).filter(([filePath]) => {
    // Always include root files and manifest
    if (!filePath.includes('/')) return true;
    
    // Check which layer this file belongs to
    if (filePath.startsWith('.allternit/brain/') || filePath.startsWith('.allternit/memory/')) {
      return finalLayers.cognitive;
    }
    if (filePath.startsWith('.allternit/identity/')) {
      return finalLayers.identity;
    }
    if (filePath.startsWith('.allternit/governance/')) {
      return finalLayers.governance;
    }
    if (filePath.startsWith('.allternit/skills/')) {
      return finalLayers.skills;
    }
    if (filePath.startsWith('.allternit/business/')) {
      return finalLayers.business;
    }
    return true;
  });

  // Create files from template
  for (const [filePath, templatePath] of filesToCreate) {
    const fullPath = `${workspacePath}/${filePath}`;
    
    // Skip if already exists (for non-Gizzi templates)
    try {
      await filesApi.readFile({ path: fullPath });
      continue;
    } catch {
      // File doesn't exist, create it
    }

    let content = '';
    
    if (templatePath.startsWith('template://')) {
      // Generate from inline template
      content = generateFromInlineTemplate(templatePath, variables);
    } else {
      // Load from file system
      try {
        const response = await filesApi.readFile({ path: templatePath });
        content = substituteTemplateVariables(response.content, variables);
      } catch (e) {
        console.warn(`Template file not found: ${templatePath}`);
        content = generateFromInlineTemplate(filePath, variables);
      }
    }

    // Create the file
    await filesApi.writeFile({ path: fullPath, content });
  }

  // Create manifest
  const manifest = {
    id: workspaceId,
    agentId: agent.id,
    agentName: agent.name,
    template: templateId,
    version: '1.0.0',
    createdAt: Date.now(),
    lastModified: Date.now(),
    layers: finalLayers,
    files: filesToCreate.map(([path]) => path)
  };

  await filesApi.writeFile({
    path: `${workspacePath}/.allternit/manifest.json`,
    content: JSON.stringify(manifest, null, 2)
  });

  // Load and return workspace
  return loadWorkspace(agent.id);
}

/**
 * Generate file content from inline template
 */
function generateFromInlineTemplate(
  templatePath: string,
  variables: Record<string, string>
): string {
  const templates: Record<string, string> = {
    'agent.config.json': JSON.stringify({
      name: variables.agent_name,
      description: variables.agent_description,
      version: '1.0.0',
      model: {
        provider: variables.provider,
        model: variables.model,
        temperature: parseFloat(variables.temperature),
        maxTokens: 4000
      },
      runtime: {
        type: 'reactive',
        triggers: ['chat', 'schedule'],
        capabilities: safeJSONParse<string[]>(variables.capabilities || '[]', []),
        tools: safeJSONParse<string[]>(variables.tools || '[]', [])
      },
      memory: {
        enabled: true,
        persistence: 'session',
        contextWindow: 100
      }
    }, null, 2),

    'manifest.json': JSON.stringify({
      id: '{{AGENT_ID}}',
      agentId: '{{AGENT_ID}}',
      agentName: variables.agent_name,
      template: 'allternit-standard',
      version: '1.0.0',
      createdAt: Date.now(),
      lastModified: Date.now(),
      layers: {
        cognitive: true,
        identity: true,
        governance: true,
        skills: true,
        business: false
      }
    }, null, 2),

    'brain/BRAIN.md': `# BRAIN.md — {{agent_name}}'s Cognitive Core

## Current Focus
${variables.agent_description || 'Ready to assist with tasks'}

## Active Tasks
- [ ] Initialize and learn about the workspace
- [ ] Ready for first interaction

## Task Graph
*To be populated based on interactions*

## Review Criteria
*To be defined based on agent purpose*`,

    'memory/MEMORY.md': `# MEMORY.md — {{agent_name}}'s Episodic Memory

## Working Memory
*Active context during current session*

## Long-term Memory
- **Created**: {{DATETIME}}
- **Version**: 1.0.0

## Conversation History
*To be populated*

## Known Facts
- Agent name: {{agent_name}}
- Agent type: {{agent_type}}`,

    'memory/active-tasks.md': `# Active Tasks

*No active tasks*

> Tasks will be automatically added when {{agent_name}} receives work.`,

    'identity/IDENTITY.md': `# IDENTITY.md — Who Is {{agent_name}}?

| Field | Value |
|-------|-------|
| **Name** | {{agent_name}} |
| **Nature** | {{nature}} |
| **Vibe** | {{vibe}} |
| **Emoji** | {{emoji}} |
| **Version** | 1.0.0 |

## Purpose
{{agent_description || 'To assist the user effectively'}}

## Origin Story
Created on {{DATE}} to serve the Allternit platform.

## Core Values
- Helpfulness
- Accuracy
- Efficiency`,

    'identity/SOUL.md': `# SOUL.md — {{agent_name}}'s Soul Configuration

## Trust Tiers

### Tier 1 — Foundation
✅ Always apply:
- {{vibe}}
- Respect user preferences
- Maintain {{emoji}} energy

## Self-Awareness
I am {{agent_name}}, an AI assistant. I aim to be helpful while being honest about my nature.

## Allternit Alignment
This agent follows Allternit Platform principles:
- Agent-first architecture
- Transparent operations
- User-centric design`,

    'governance/PLAYBOOK.md': `# PLAYBOOK.md — {{agent_name}}'s Execution Rules

## Standard Operating Procedures

### Communication
- Be {{vibe}}
- Use {{emoji}} where appropriate
- Adapt tone to context

### Error Handling
- Acknowledge limitations honestly
- Offer alternatives when stuck
- Log errors for improvement

### Tool Usage
- Only use tools the user has granted access to
- Confirm before destructive operations
- Report tool results clearly`,

    'governance/TOOLS.md': `# TOOLS.md — {{agent_name}}'s Tool Inventory

## Available Tools
${safeJSONParse<string[]>(variables.tools || '[]', []).map((t: string) => `- ${t}`).join('\n') || '*No tools configured*'}

## Tool Usage Guidelines
- Verify permissions before use
- Explain what tools will do
- Report results clearly`,

    'governance/HEARTBEAT.md': `# HEARTBEAT.md — {{agent_name}}'s Periodic Tasks

## Scheduled Tasks
*Configure in CronJob wizard*

### Daily
- [ ] Self-check
- [ ] Memory review

### Weekly
- [ ] Performance review
- [ ] Archive old data`
  };

  const key = templatePath.replace('template://', '');
  const template = templates[key] || '';
  
  return substituteTemplateVariables(template, variables);
}

/**
 * Update agent workspace
 */
async function updateWorkspace(
  agentId: string,
  updates: Partial<AgentWorkspace>
): Promise<AgentWorkspace> {
  const workspace = await loadWorkspace(agentId);
  const path = getWorkspacePath(agentId);

  // Update manifest if layers changed
  if (updates.layers) {
    const manifestPath = `${path}/.allternit/manifest.json`;
    const manifest = {
      ...workspace.manifest,
      layers: { ...workspace.layers, ...updates.layers },
      lastModified: Date.now()
    };
    await filesApi.writeFile({ 
      path: manifestPath, 
      content: JSON.stringify(manifest, null, 2) 
    });
  }

  // Invalidate cache
  workspaceCache.delete(agentId);

  // Reload and return
  return loadWorkspace(agentId);
}

/**
 * Delete agent workspace
 */
async function deleteWorkspace(agentId: string): Promise<void> {
  const path = getWorkspacePath(agentId);
  
  try {
    // Delete all files in the workspace recursively
    // Note: filesApi doesn't have deleteDirectory, so we list and delete individually
    const deleteRecursive = async (dirPath: string) => {
      try {
        const { entries } = await filesApi.listDirectory({ path: dirPath, recursive: false });
        for (const entry of entries) {
          const entryPath = `${dirPath}/${entry.name}`;
          if (entry.type === 'directory') {
            await deleteRecursive(entryPath);
          } else {
            await filesApi.deleteFile(entryPath);
          }
        }
      } catch {
        // Directory might not exist
      }
    };
    await deleteRecursive(path);
  } catch (e) {
    console.warn(`Failed to delete workspace at ${path}:`, e);
  }

  // Clear cache
  workspaceCache.delete(agentId);
}

/**
 * Export workspace as .allternit package (ZIP)
 */
async function exportWorkspace(
  agentId: string,
  options?: {
    includeMemory?: boolean;
    includeHistory?: boolean;
    compress?: boolean;
  }
): Promise<Blob> {
  const workspace = await loadWorkspace(agentId);
  const path = getWorkspacePath(agentId);
  const zip = new JSZip();

  // Add manifest at root
  zip.file('manifest.json', JSON.stringify(workspace.manifest, null, 2));

  // Recursive function to add files to ZIP
  async function addToZip(dirPath: string, zipFolder: JSZip) {
    const { entries } = await filesApi.listDirectory({ path: dirPath });
    
    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry.name}`;
      
      // Skip based on options
      if (!options?.includeMemory && entry.name === 'memory') continue;
      if (!options?.includeHistory && entry.name === 'history') continue;
      
      if (entry.type === 'directory') {
        const newFolder = zipFolder.folder(entry.name);
        if (newFolder) {
          await addToZip(fullPath, newFolder);
        }
      } else {
        try {
          const response = await filesApi.readFile({ path: fullPath });
          zipFolder.file(entry.name, response.content);
        } catch (e) {
          console.warn(`Failed to read ${fullPath}:`, e);
        }
      }
    }
  }

  await addToZip(path, zip);

  // Generate ZIP
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: options?.compress !== false ? 'DEFLATE' : 'STORE',
    compressionOptions: { level: 6 }
  });

  return zipBlob;
}

/**
 * Import workspace from .allternit package
 */
async function importWorkspace(
  file: File,
  userContext?: { userId: string; userName?: string }
): Promise<AgentWorkspace> {
  const zip = await JSZip.loadAsync(file);
  
  // Read manifest
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    throw new Error('Invalid .allternit package: missing manifest.json');
  }

  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(await manifestFile.async('text')) as Record<string, unknown>;
  } catch (error) {
    throw new Error('Invalid manifest.json: ' + (error instanceof Error ? error.message : String(error)));
  }

  // Create agent from manifest
  const input: CreateAgentInput = {
    name: (manifest.agentName as string) || `Imported-${Date.now()}`,
    description: (manifest.description as string) || `Imported from ${file.name}`,
    type: 'worker',
    model: (manifest.model as string) || 'gpt-4o',
    provider: (manifest.provider as 'openai' | 'anthropic' | 'local' | 'custom') || 'openai'
  };

  const workspace = await createWorkspace(input, 'allternit-standard', userContext);

  // Extract files
  const workspacePath = getWorkspacePath(workspace.agentId);
  
  for (const [path, zipEntry] of Object.entries(zip.files)) {
    const entry = zipEntry as JSZip.JSZipObject;
    if (entry.dir) continue;
    if (path === 'manifest.json') continue;

    const content = await entry.async('text');
    const fullPath = `${workspacePath}/${path}`;

    await filesApi.writeFile({ path: fullPath, content });
  }

  // Reload workspace
  workspaceCache.delete(workspace.agentId);
  return loadWorkspace(workspace.agentId);
}

/**
 * Read file from workspace
 */
async function readWorkspaceFile(agentId: string, filePath: string): Promise<string> {
  const path = getWorkspacePath(agentId);
  const fullPath = filePath.startsWith('/') 
    ? filePath 
    : `${path}/${filePath}`;
  
  const response = await filesApi.readFile({ path: fullPath });
  return response.content;
}

/**
 * Write file to workspace
 */
async function writeWorkspaceFile(
  agentId: string,
  filePath: string,
  content: string
): Promise<void> {
  const path = getWorkspacePath(agentId);
  const fullPath = filePath.startsWith('/') 
    ? filePath 
    : `${path}/${filePath}`;

  await filesApi.writeFile({ path: fullPath, content });

  // Update manifest lastModified
  const manifestPath = `${path}/.allternit/manifest.json`;
  try {
    const response = await filesApi.readFile({ path: manifestPath });
    const manifest = JSON.parse(response.content);
    manifest.lastModified = Date.now();
    await filesApi.writeFile({ 
      path: manifestPath, 
      content: JSON.stringify(manifest, null, 2) 
    });
  } catch (e) {
    console.warn('Failed to update manifest lastModified:', e);
  }

  // Invalidate cache
  workspaceCache.delete(agentId);
}

/**
 * List workspace files
 */
async function listWorkspaceFiles(agentId: string): Promise<FileNode[]> {
  const path = getWorkspacePath(agentId);
  const response = await filesApi.listDirectory({ path });
  return response.entries.map(e => ({
    name: e.name,
    path: e.path,
    type: e.type,
    size: e.size,
    modifiedAt: e.modifiedAt,
  }));
}

/**
 * Create workspace snapshot
 */
async function createSnapshot(agentId: string): Promise<FileSystemSnapshot> {
  const path = getWorkspacePath(agentId);
  const response = await filesApi.listDirectory({ path, recursive: true });
  
  return {
    timestamp: Date.now(),
    entries: response.entries.map(e => ({
      name: e.name,
      path: e.path,
      type: e.type,
      size: e.size,
      modifiedAt: e.modifiedAt,
    })),
  };
}

/**
 * Restore workspace from snapshot
 * Note: This is a placeholder - full restore would need to recreate all files
 */
async function restoreSnapshot(agentId: string, snapshot: FileSystemSnapshot): Promise<void> {
  // In a full implementation, this would restore all files from the snapshot
  // For now, we just invalidate the cache
  console.log('[WorkspaceService] Restore snapshot for agent:', agentId);
  workspaceCache.delete(agentId);
}

/**
 * Get workspace manifest
 */
async function getManifest(agentId: string): Promise<{ layers: import('./agent.types').AgentWorkspaceLayers; [key: string]: unknown } | null> {
  try {
    const path = getWorkspacePath(agentId);
    const response = await filesApi.readFile({ path: `${path}/.allternit/manifest.json` });
    return JSON.parse(response.content);
  } catch (e) {
    console.warn('[WorkspaceService] Failed to load manifest:', e);
    return null;
  }
}

/**
 * Update workspace manifest
 */
async function updateManifest(
  agentId: string,
  updates: Partial<{ layers: import('./agent.types').AgentWorkspaceLayers; [key: string]: unknown }>
): Promise<void> {
  const path = getWorkspacePath(agentId);
  const manifestPath = `${path}/.allternit/manifest.json`;
  
  try {
    // Read existing manifest
    let manifest: Record<string, unknown> = {};
    try {
      const response = await filesApi.readFile({ path: manifestPath });
      manifest = JSON.parse(response.content);
    } catch (e) {
      // Manifest doesn't exist, create new one
      manifest = {
        id: agentId,
        createdAt: Date.now(),
      };
    }
    
    // Apply updates
    Object.assign(manifest, updates, { lastModified: Date.now() });
    
    // Write back
    await filesApi.writeFile({
      path: manifestPath,
      content: JSON.stringify(manifest, null, 2),
    });
    
    // Invalidate cache
    workspaceCache.delete(agentId);
  } catch (e) {
    console.error('[WorkspaceService] Failed to update manifest:', e);
    throw e;
  }
}

// Export the workspace service
export const agentWorkspaceService = {
  create: createWorkspace,
  load: loadWorkspace,
  update: updateWorkspace,
  delete: deleteWorkspace,
  exists: workspaceExists,
  export: exportWorkspace,
  import: importWorkspace,
  readFile: readWorkspaceFile,
  writeFile: writeWorkspaceFile,
  listFiles: listWorkspaceFiles,
  createSnapshot,
  restoreSnapshot,
  getTemplates: listTemplates,
  getTemplate,
  substituteVariables: substituteTemplateVariables,
  buildVariables: buildVariablesFromInput,
  getManifest,
  updateManifest,
};

export default agentWorkspaceService;
