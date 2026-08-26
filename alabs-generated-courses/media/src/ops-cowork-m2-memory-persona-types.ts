// Sourced from packages/@allternit/cowork-engine/src/memory/types.ts
// and packages/@allternit/cowork-engine/src/personas/types.ts

export type CoworkMemoryEntryType = 'fact' | 'preference' | 'skill' | 'context';

export interface CoworkMemoryEntry {
  id: string;
  userId: string;
  projectId: string | null;
  sessionId: string | null;
  content: string;
  type: CoworkMemoryEntryType;
  tags: string[];
  source: string | null;
  createdAt: Date;
}

export interface CoworkMemoryCreateInput {
  userId: string;
  projectId?: string | null;
  sessionId?: string | null;
  content: string;
  type?: CoworkMemoryEntryType;
  tags?: string[];
  source?: string | null;
}

export interface CoworkPersona {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  tools: string[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CoworkPersonaCreateInput {
  userId: string;
  name: string;
  description?: string;
  systemPrompt: string;
  tools?: string[];
  isDefault?: boolean;
}

export const BUILT_IN_PERSONAS: Omit<CoworkPersonaCreateInput, 'userId'>[] = [
  {
    name: 'Researcher',
    description: 'Deep research, synthesis, and summarisation across multiple sources.',
    systemPrompt: 'You are a thorough research assistant...',
    tools: ['web_search', 'read_file', 'write_file'],
    isDefault: false,
  },
  {
    name: 'Engineer',
    description: 'Writes, reviews, debugs, and refactors code across any language.',
    systemPrompt: 'You are a senior software engineer...',
    tools: ['read_file', 'write_file', 'run_command', 'web_search'],
    isDefault: true,
  },
  {
    name: 'Analyst',
    description: 'Data analysis, visualisation, and reporting from structured data.',
    systemPrompt: 'You are a data analyst...',
    tools: ['read_file', 'write_file', 'run_command'],
    isDefault: false,
  },
];
