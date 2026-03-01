/**
 * Workspace Component Types
 * 
 * Type definitions for workspace UI components
 */

import { ReactNode } from 'react';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'active' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignee?: string;
  dependencies: string[];
  createdAt: string;
  updatedAt: string;
  estimatedDuration?: number; // minutes
  actualDuration?: number;
  tags: string[];
}

export interface TaskGraph {
  tasks: Task[];
  edges: Array<{ from: string; to: string; type: 'depends' | 'blocks' | 'relates' }>;
}

export interface MemoryEntry {
  id: string;
  timestamp: string;
  type: 'session' | 'lesson' | 'decision' | 'checkpoint';
  title: string;
  content: string;
  tags: string[];
  relatedTasks: string[];
}

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  toolId?: string;
  filePattern?: string;
  operation?: 'read' | 'write' | 'execute' | 'delete';
  action: 'allow' | 'deny' | 'require_approval';
  enabled: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  installed: boolean;
  category: string;
  tags: string[];
  dependencies: string[];
  entryPoint: string;
  documentation?: string;
}

export interface IdentityConfig {
  name: string;
  nature: string;
  vibe: string;
  purpose: string;
  values: string[];
  boundaries: string[];
  preferences: Record<string, unknown>;
}

export interface SoulConfig {
  voice: string;
  tone: string;
  formality: 'casual' | 'neutral' | 'formal';
  emojiUsage: 'none' | 'minimal' | 'moderate' | 'frequent';
  signature?: string;
  greeting?: string;
}

export interface WorkspaceViewProps {
  className?: string;
}

export interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  readOnly?: boolean;
  language?: string;
}

export interface CardProps {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  children: ReactNode;
}

/** Workspace layers configuration */
export interface WorkspaceLayers {
  cognitive: boolean;
  identity: boolean;
  governance: boolean;
  skills: boolean;
  business: boolean;
}

/** Workspace metadata */
export interface WorkspaceMetadata {
  workspace_id: string;
  workspace_version: string;
  agent_name: string;
  created_at: string;
  layers: WorkspaceLayers;
}
