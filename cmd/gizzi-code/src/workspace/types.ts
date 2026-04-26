/**
 * Gizzi Workspace Types
 * 
 * Type definitions for agent workspace system
 * mirrors the Allternit platform implementation
 */

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface WorkspaceFile {
  path: string;
  name: string;
  content: string;
  type: 
    | 'manifest' 
    | 'brain' 
    | 'memory' 
    | 'identity' 
    | 'soul' 
    | 'user' 
    | 'voice' 
    | 'policy'
    | 'playbook' 
    | 'tools' 
    | 'heartbeat' 
    | 'system' 
    | 'channels'
    | 'skill' 
    | 'business' 
    | 'knowledge' 
    | 'config';
  size: number;
}

export interface TrustTier {
  level: 1 | 2 | 3;
  name: string;
  rules: string[];
  enforce: 'always' | 'contextual' | 'permission';
}

export interface ScheduledTask {
  id: string;
  frequency: 'on-session-start' | 'daily' | 'weekly' | 'monthly' | 'on-event';
  action: string;
  condition?: string;
  lastExecuted?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  requiresPermission: boolean;
  permissionLevel: 1 | 2 | 3;
}

export interface ContextPack {
  version: '1.0.0';
  agentId: string;
  agentName: string;
  sessionId: string;
  
  identity: {
    name: string;
    purpose: string;
    backstory: string;
    personalityTraits: string[];
  };
  
  trustTiers: {
    tier1: TrustTier;
    tier2: TrustTier;
    tier3: TrustTier;
  };
  
  governance: {
    playbook: string;
    availableTools: ToolDefinition[];
    hardBans: string[];
    escalation: string[];
  };
  
  heartbeat: {
    tasks: ScheduledTask[];
    lastCheck: string;
  };
  
  memory: {
    brain: string;
    activeTasks: string[];
    lessons: string[];
    userPreferences: Record<string, unknown>;
  };
  
  voice: {
    style: string;
    tone: {
      formality: number;
      enthusiasm: number;
      empathy: number;
      directness: number;
    };
    rules: string[];
  };
  
  systemPrompt: string;
  hash: string;
  createdAt: string;
  expiresAt: string;
}

export interface WorkspaceSession {
  id: string;
  name: string;
  mode: 'regular' | 'agent';
  agentId?: string;
  agentName?: string;
  contextPack?: ContextPack;
  contextHash?: string;
  contextRefreshedAt?: string;
  workspaceFiles?: string[];
}
