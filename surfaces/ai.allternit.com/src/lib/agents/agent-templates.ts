/**
 * Agent Workspace Templates
 * 
 * Template definitions and variable substitution engine for creating
 * agent workspaces from templates.
 */

import type { CreateAgentInput } from './agent.types';

export interface TemplateVariable {
  name: string;
  defaultValue: string | (() => string);
  description: string;
}

export interface WorkspaceTemplate {
  id: string;
  name: string;
  description: string;
  layers: {
    cognitive: boolean;
    identity: boolean;
    governance: boolean;
    skills: boolean;
    business: boolean;
  };
  files: Record<string, string>;
}

// Template variables that get substituted when creating an agent
export const TEMPLATE_VARIABLES: Record<string, TemplateVariable> = {
  // Identity variables
  '{{agent_name}}': {
    name: 'agent_name',
    defaultValue: '',
    description: 'Name of the agent'
  },
  '{{agent_description}}': {
    name: 'agent_description',
    defaultValue: '',
    description: 'Description of the agent'
  },
  '{{agent_type}}': {
    name: 'agent_type',
    defaultValue: 'worker',
    description: 'Type of agent (worker, orchestrator)'
  },
  '{{nature}}': {
    name: 'nature',
    defaultValue: 'AI Assistant',
    description: 'Nature/personality of the agent'
  },
  '{{vibe}}': {
    name: 'vibe',
    defaultValue: 'Helpful and professional',
    description: 'Vibe/attitude of the agent'
  },
  '{{emoji}}': {
    name: 'emoji',
    defaultValue: '🤖',
    description: 'Emoji representing the agent'
  },
  
  // Model/Runtime variables
  '{{model}}': {
    name: 'model',
    defaultValue: 'gpt-4o',
    description: 'AI model to use'
  },
  '{{provider}}': {
    name: 'provider',
    defaultValue: 'openai',
    description: 'Model provider'
  },
  '{{temperature}}': {
    name: 'temperature',
    defaultValue: '0.7',
    description: 'Model temperature (creativity)'
  },
  '{{max_iterations}}': {
    name: 'max_iterations',
    defaultValue: '10',
    description: 'Maximum iterations per run'
  },
  
  // System variables
  '{{system_prompt}}': {
    name: 'system_prompt',
    defaultValue: '',
    description: 'System prompt defining agent behavior'
  },
  '{{capabilities}}': {
    name: 'capabilities',
    defaultValue: '[]',
    description: 'JSON array of capabilities'
  },
  '{{tools}}': {
    name: 'tools',
    defaultValue: '[]',
    description: 'JSON array of tools'
  },
  
  // User context
  '{{user_name}}': {
    name: 'user_name',
    defaultValue: 'there',
    description: 'Current user name'
  },
  '{{user_goals}}': {
    name: 'user_goals',
    defaultValue: 'exploring AI assistance',
    description: 'User goals/interests'
  },
  
  // Date/Timestamps
  '{{DATE}}': {
    name: 'DATE',
    defaultValue: () => new Date().toISOString().split('T')[0],
    description: 'Current date (YYYY-MM-DD)'
  },
  '{{DATETIME}}': {
    name: 'DATETIME',
    defaultValue: () => new Date().toISOString(),
    description: 'Current datetime (ISO format)'
  },
  '{{TIMESTAMP}}': {
    name: 'TIMESTAMP',
    defaultValue: () => Date.now().toString(),
    description: 'Unix timestamp'
  },
  
  // Platform variables (resolved at runtime)
  '{{PLATFORM_DEFAULT_MODEL}}': {
    name: 'PLATFORM_DEFAULT_MODEL',
    defaultValue: 'gpt-4o',
    description: 'Platform default AI model'
  },
  '{{PLATFORM_DEFAULT_PROVIDER}}': {
    name: 'PLATFORM_DEFAULT_PROVIDER',
    defaultValue: 'openai',
    description: 'Platform default provider'
  },
  '{{PLATFORM_VERSION}}': {
    name: 'PLATFORM_VERSION',
    defaultValue: '1.0.0',
    description: 'Platform version'
  },
  '{{PLATFORM_ENV}}': {
    name: 'PLATFORM_ENV',
    defaultValue: 'production',
    description: 'Platform environment'
  },
  
  // Voice variables
  '{{VOICE_ENGINE}}': {
    name: 'VOICE_ENGINE',
    defaultValue: 'default',
    description: 'Voice engine'
  },
  '{{VOICE_ID}}': {
    name: 'VOICE_ID',
    defaultValue: 'default',
    description: 'Voice ID'
  },
  '{{VOICE_ENABLED}}': {
    name: 'VOICE_ENABLED',
    defaultValue: 'false',
    description: 'Whether voice is enabled'
  },
  
  // User preference variables (templates)
  '{{USER_TECH_DEPTH}}': {
    name: 'USER_TECH_DEPTH',
    defaultValue: 'adaptive',
    description: 'User technical depth preference'
  },
  '{{USER_FORMALITY}}': {
    name: 'USER_FORMALITY',
    defaultValue: 'neutral',
    description: 'User formality preference'
  },
  '{{USER_DETAIL}}': {
    name: 'USER_DETAIL',
    defaultValue: 'balanced',
    description: 'User detail level preference'
  },
  '{{USER_PRIMARY_MODE}}': {
    name: 'USER_PRIMARY_MODE',
    defaultValue: 'unknown',
    description: 'User primary mode'
  },
  '{{USER_EXPERIENCE}}': {
    name: 'USER_EXPERIENCE',
    defaultValue: 'new',
    description: 'User experience level'
  },
  '{{USER_INTERESTS}}': {
    name: 'USER_INTERESTS',
    defaultValue: 'AI assistance',
    description: 'User interests'
  },
  
  // Feature flags
  '{{PLATFORM_VOICE_ENABLED}}': {
    name: 'PLATFORM_VOICE_ENABLED',
    defaultValue: 'false',
    description: 'Platform voice feature enabled'
  },
  '{{PLATFORM_ADVANCED_TOOLS}}': {
    name: 'PLATFORM_ADVANCED_TOOLS',
    defaultValue: 'false',
    description: 'Platform advanced tools enabled'
  },
  '{{PLATFORM_EXTERNAL_INTEGRATIONS}}': {
    name: 'PLATFORM_EXTERNAL_INTEGRATIONS',
    defaultValue: 'false',
    description: 'Platform external integrations enabled'
  }
};

// The Gizzi platform agent template
export const GIZZI_TEMPLATE: WorkspaceTemplate = {
  id: 'gizzi-platform',
  name: 'Gizzi Platform Assistant',
  description: 'Allternit Platform Assistant with full 5-layer workspace',
  layers: {
    cognitive: true,
    identity: true,
    governance: true,
    skills: true,
    business: true
  },
  files: {
    // Config files
    'gizzi.config.json': '/5-agents/examples/gizzi-platform/gizzi.config.json',
    '.allternit/manifest.json': '/5-agents/examples/gizzi-platform/.allternit/manifest.json',
    
    // Layer 1: Cognitive
    '.allternit/brain/BRAIN.md': '/5-agents/examples/gizzi-platform/.allternit/brain/BRAIN.md',
    '.allternit/memory/MEMORY.md': '/5-agents/examples/gizzi-platform/.allternit/memory/MEMORY.md',
    '.allternit/memory/active-tasks.md': '/5-agents/examples/gizzi-platform/.allternit/memory/active-tasks.md',
    '.allternit/memory/daily.md': '/5-agents/examples/gizzi-platform/.allternit/memory/daily.md',
    '.allternit/memory/lessons.md': '/5-agents/examples/gizzi-platform/.allternit/memory/lessons.md',
    '.allternit/memory/self-review.md': '/5-agents/examples/gizzi-platform/.allternit/memory/self-review.md',
    
    // Layer 2: Identity
    '.allternit/identity/IDENTITY.md': '/5-agents/examples/gizzi-platform/.allternit/identity/IDENTITY.md',
    '.allternit/identity/SOUL.md': '/5-agents/examples/gizzi-platform/.allternit/identity/SOUL.md',
    '.allternit/identity/USER.md': '/5-agents/examples/gizzi-platform/.allternit/identity/USER.md',
    '.allternit/identity/VOICE.md': '/5-agents/examples/gizzi-platform/.allternit/identity/VOICE.md',
    '.allternit/identity/POLICY.md': '/5-agents/examples/gizzi-platform/.allternit/identity/POLICY.md',
    
    // Layer 3: Governance
    '.allternit/governance/PLAYBOOK.md': '/5-agents/examples/gizzi-platform/.allternit/governance/PLAYBOOK.md',
    '.allternit/governance/TOOLS.md': '/5-agents/examples/gizzi-platform/.allternit/governance/TOOLS.md',
    '.allternit/governance/HEARTBEAT.md': '/5-agents/examples/gizzi-platform/.allternit/governance/HEARTBEAT.md',
    '.allternit/governance/SYSTEM.md': '/5-agents/examples/gizzi-platform/.allternit/governance/SYSTEM.md',
    '.allternit/governance/CHANNELS.md': '/5-agents/examples/gizzi-platform/.allternit/governance/CHANNELS.md',
    
    // Layer 4: Skills
    '.allternit/skills/_template/SKILL.md': '/5-agents/examples/gizzi-platform/.allternit/skills/_template/SKILL.md',
    '.allternit/skills/_template/contract.json': '/5-agents/examples/gizzi-platform/.allternit/skills/_template/contract.json',
    
    // Layer 5: Business
    '.allternit/business/CLIENTS.md': '/5-agents/examples/gizzi-platform/.allternit/business/CLIENTS.md'
  }
};

// Allternit Standard template (for user-created agents)
export const ALLTERNIT_STANDARD_TEMPLATE: WorkspaceTemplate = {
  id: 'allternit-standard',
  name: 'Allternit Standard Workspace',
  description: 'Standard 5-layer workspace for custom agents',
  layers: {
    cognitive: true,
    identity: true,
    governance: true,
    skills: true,
    business: false // User agents don't need business layer by default
  },
  files: {
    // Similar structure but with more placeholders
    'agent.config.json': 'template://agent.config.json',
    '.allternit/manifest.json': 'template://manifest.json',
    '.allternit/brain/BRAIN.md': 'template://brain/BRAIN.md',
    '.allternit/memory/MEMORY.md': 'template://memory/MEMORY.md',
    '.allternit/memory/active-tasks.md': 'template://memory/active-tasks.md',
    '.allternit/identity/IDENTITY.md': 'template://identity/IDENTITY.md',
    '.allternit/identity/SOUL.md': 'template://identity/SOUL.md',
    '.allternit/governance/PLAYBOOK.md': 'template://governance/PLAYBOOK.md',
    '.allternit/governance/TOOLS.md': 'template://governance/TOOLS.md',
    '.allternit/governance/HEARTBEAT.md': 'template://governance/HEARTBEAT.md'
  }
};

// Minimal template (lightweight agents)
export const ALLTERNIT_MINIMAL_TEMPLATE: WorkspaceTemplate = {
  id: 'allternit-minimal',
  name: 'Allternit Minimal Workspace',
  description: 'Lightweight workspace with essential files only',
  layers: {
    cognitive: false,
    identity: true,
    governance: false,
    skills: false,
    business: false
  },
  files: {
    'agent.config.json': 'template://minimal/agent.config.json',
    '.allternit/identity/IDENTITY.md': 'template://identity/IDENTITY.md'
  }
};

// All available templates
export const WORKSPACE_TEMPLATES: Record<string, WorkspaceTemplate> = {
  'gizzi-platform': GIZZI_TEMPLATE,
  'allternit-standard': ALLTERNIT_STANDARD_TEMPLATE,
  'allternit-minimal': ALLTERNIT_MINIMAL_TEMPLATE
};

/**
 * Substitute template variables in content
 */
export function substituteTemplateVariables(
  content: string,
  variables: Record<string, string>
): string {
  let result = content;
  
  for (const [key, variable] of Object.entries(TEMPLATE_VARIABLES)) {
    const value = variables[variable.name] ?? 
      (typeof variable.defaultValue === 'function' 
        ? variable.defaultValue() 
        : variable.defaultValue);
    
    // Replace all occurrences
    result = result.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  }
  
  return result;
}

/**
 * Build variables from CreateAgentInput
 */
export function buildVariablesFromInput(
  input: CreateAgentInput,
  userContext?: {
    userName?: string;
    userGoals?: string;
  }
): Record<string, string> {
  const now = new Date();
  
  return {
    agent_name: input.name,
    agent_description: input.description || '',
    agent_type: input.type || 'worker',
    nature: 'AI Assistant',
    vibe: 'Helpful and professional',
    emoji: '🤖',
    model: input.model || 'gpt-4o',
    provider: input.provider || 'openai',
    temperature: String(input.temperature ?? 0.7),
    max_iterations: String(input.maxIterations ?? 10),
    system_prompt: input.systemPrompt || '',
    capabilities: JSON.stringify(input.capabilities || []),
    tools: JSON.stringify(input.tools || []),
    user_name: userContext?.userName || 'there',
    user_goals: userContext?.userGoals || 'exploring AI assistance',
    DATE: now.toISOString().split('T')[0],
    DATETIME: now.toISOString(),
    TIMESTAMP: Date.now().toString()
  };
}

/**
 * Get template by ID
 */
export function getTemplate(templateId: string): WorkspaceTemplate | undefined {
  return WORKSPACE_TEMPLATES[templateId];
}

/**
 * List all available templates
 */
export function listTemplates(): WorkspaceTemplate[] {
  return Object.values(WORKSPACE_TEMPLATES);
}
