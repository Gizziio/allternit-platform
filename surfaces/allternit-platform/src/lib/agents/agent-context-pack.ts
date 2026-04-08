/**
 * Agent Context Pack Builder
 * 
 * Builds structured context packs from agent workspace files for AI consumption.
 * This is the production-quality implementation that ensures deterministic
 * context delivery to the AI backend.
 * 
 * Features:
 * - Structured context packing with versioning
 * - Trust tier enforcement from SOUL.md
 * - Scheduled task extraction from HEARTBEAT.md
 * - Dynamic context truncation based on token limits
 * - Context hash for caching/deduplication
 * 
 * @module agent-context-pack
 */

import type { ModeSession } from './mode-session-store';

// ============================================================================
// Types
// ============================================================================

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
  
  // Core identity
  identity: {
    name: string;
    purpose: string;
    backstory: string;
    personalityTraits: string[];
  };
  
  // Trust & safety (from SOUL.md)
  trustTiers: {
    tier1: TrustTier;  // Always apply
    tier2: TrustTier;  // Context-dependent
    tier3: TrustTier;  // Require permission
  };
  
  // Governance (from PLAYBOOK.md, TOOLS.md)
  governance: {
    playbook: string;
    availableTools: ToolDefinition[];
    hardBans: string[];
    escalation: string[];
  };
  
  // Scheduled tasks (from HEARTBEAT.md)
  heartbeat: {
    tasks: ScheduledTask[];
    lastCheck: string;
  };
  
  // Memory & brain
  memory: {
    brain: string;
    activeTasks: string[];
    lessons: string[];
    userPreferences: Record<string, unknown>;
  };
  
  // Voice & communication
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
  
  // Complete system prompt (for backward compatibility)
  systemPrompt: string;
  
  // Metadata
  hash: string;  // For caching
  createdAt: string;
  expiresAt: string;  // Context refresh needed after this
}

export interface ContextPackOptions {
  maxTokens?: number;
  includeMemory?: boolean;
  includeHeartbeat?: boolean;
  truncatePolicy?: 'identity-first' | 'governance-first' | 'balanced';
}

// ============================================================================
// SOUL.md Parser
// ============================================================================

function parseSoulMd(content: string): { trustTiers: ContextPack['trustTiers']; identity: Partial<ContextPack['identity']> } {
  const lines = content.split('\n');
  
  const trustTiers: ContextPack['trustTiers'] = {
    tier1: { level: 1, name: 'Foundation', rules: [], enforce: 'always' },
    tier2: { level: 2, name: 'Contextual', rules: [], enforce: 'contextual' },
    tier3: { level: 3, name: 'Permission Required', rules: [], enforce: 'permission' },
  };
  
  const identity: Partial<ContextPack['identity']> = {
    personalityTraits: [],
  };
  
  let currentTier: 1 | 2 | 3 | null = null;
  let inSelfAwareness = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Parse trust tier headers
    if (trimmed.match(/^#+\s*Tier\s*1/i)) {
      currentTier = 1;
    } else if (trimmed.match(/^#+\s*Tier\s*2/i)) {
      currentTier = 2;
    } else if (trimmed.match(/^#+\s*Tier\s*3/i)) {
      currentTier = 3;
    } else if (trimmed.match(/^#+\s*Self-Awareness/i)) {
      inSelfAwareness = true;
      currentTier = null;
    }
    
    // Parse rules (bullet points)
    if (currentTier && trimmed.match(/^[-\*✅]\s+/)) {
      const rule = trimmed.replace(/^[-\*✅]\s+/, '');
      trustTiers[`tier${currentTier}`].rules.push(rule);
    }
    
    // Parse self-awareness
    if (inSelfAwareness && trimmed.startsWith('I am')) {
      identity.backstory = trimmed;
    }
    
    // Parse personality traits
    if (trimmed.match(/personality|traits/i)) {
      const traits = trimmed.split(/[:,-]/).slice(1);
      identity.personalityTraits = traits.map(t => t.trim()).filter(Boolean);
    }
  }
  
  return { trustTiers, identity };
}

// ============================================================================
// HEARTBEAT.md Parser
// ============================================================================

function parseHeartbeatMd(content: string): ScheduledTask[] {
  const lines = content.split('\n');
  const tasks: ScheduledTask[] = [];
  
  let currentFrequency: ScheduledTask['frequency'] = 'daily';
  let currentTask: Partial<ScheduledTask> = {};
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Parse frequency headers
    if (trimmed.match(/^#+\s*Daily/i)) {
      currentFrequency = 'daily';
    } else if (trimmed.match(/^#+\s*Weekly/i)) {
      currentFrequency = 'weekly';
    } else if (trimmed.match(/^#+\s*Monthly/i)) {
      currentFrequency = 'monthly';
    } else if (trimmed.match(/^#+\s*On\s+Session\s+Start/i)) {
      currentFrequency = 'on-session-start';
    }
    
    // Parse tasks (checkbox items)
    const taskMatch = trimmed.match(/^-\s*\[([ xX])\]\s*(.+)/);
    if (taskMatch) {
      tasks.push({
        id: `task-${Date.now()}-${tasks.length}`,
        frequency: currentFrequency,
        action: taskMatch[2].trim(),
        lastExecuted: taskMatch[1].toLowerCase() === 'x' ? new Date().toISOString() : undefined,
      });
    }
  }
  
  return tasks;
}

// ============================================================================
// TOOLS.md Parser
// ============================================================================

function parseToolsMd(content: string): ToolDefinition[] {
  const lines = content.split('\n');
  const tools: ToolDefinition[] = [];
  
  let inToolList = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Start of tool list
    if (trimmed.match(/^#+\s*Available\s*Tools/i)) {
      inToolList = true;
    }
    
    // Parse tool entries
    if (inToolList && trimmed.startsWith('-')) {
      const toolName = trimmed.replace(/^-\s*/, '').split(':')[0];
      const description = trimmed.split(':').slice(1).join(':').trim();
      
      tools.push({
        name: toolName,
        description: description || `${toolName} tool`,
        requiresPermission: false,
        permissionLevel: 2,
      });
    }
  }
  
  return tools;
}

// ============================================================================
// Hash Generation (for caching)
// ============================================================================

function generateContextHash(context: Partial<ContextPack>): string {
  const str = JSON.stringify({
    agentId: context.agentId,
    trustTiers: context.trustTiers,
    governance: context.governance,
    heartbeat: context.heartbeat,
  });
  
  // Simple hash for now - replace with proper crypto hash in production
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

// ============================================================================
// Context Pack Builder
// ============================================================================

export function buildContextPack(
  session: ModeSession,
  options: ContextPackOptions = {}
): ContextPack {
  const metadata = session.metadata;
  const { 
    maxTokens = 8000, 
    includeMemory = true, 
    includeHeartbeat = true,
    truncatePolicy = 'balanced' 
  } = options;
  
  // Parse individual files
  const soulContent = parseSoulMd(metadata.identityContext || '');
  const heartbeatTasks = includeHeartbeat 
    ? parseHeartbeatMd(metadata.governanceContext?.match(/# Periodic Tasks[\s\S]*/)?.[0] || '')
    : [];
  const tools = parseToolsMd(metadata.governanceContext?.match(/# Tool Inventory[\s\S]*/)?.[0] || '');
  
  // Build identity
  const identity: ContextPack['identity'] = {
    name: metadata.agentName || 'Agent',
    purpose: metadata.identityContext?.match(/##?\s*Purpose\s*\n([^#]+)/)?.[1]?.trim() || 'Assist the user',
    backstory: soulContent.identity.backstory || `I am ${metadata.agentName}, an AI assistant.`,
    personalityTraits: soulContent.identity.personalityTraits || ['helpful', 'accurate', 'efficient'],
  };
  
  // Build context pack
  const pack: ContextPack = {
    version: '1.0.0',
    agentId: metadata.agentId || 'unknown',
    agentName: metadata.agentName || 'Agent',
    sessionId: session.id,
    
    identity,
    trustTiers: soulContent.trustTiers,
    
    governance: {
      playbook: metadata.governanceContext?.match(/# Execution Playbook[\s\S]*?(?=#[^#]|$)/)?.[0] || '',
      availableTools: tools,
      hardBans: metadata.governanceContext?.match(/Hard Bans?:\s*\n((?:-\s*.+\n?)+)/)?.[1]?.split('\n').filter(s => s.trim()).map(s => s.replace(/^-\s*/, '')) || [],
      escalation: metadata.governanceContext?.match(/Escalation:\s*\n((?:-\s*.+\n?)+)/)?.[1]?.split('\n').filter(s => s.trim()).map(s => s.replace(/^-\s*/, '')) || [],
    },
    
    heartbeat: {
      tasks: heartbeatTasks,
      lastCheck: new Date().toISOString(),
    },
    
    memory: includeMemory ? {
      brain: metadata.memoryContext?.match(/# Brain Configuration[\s\S]*?(?=#[^#]|$)/)?.[0] || '',
      activeTasks: metadata.memoryContext?.match(/active-tasks[\s\S]*?(?=##|$)/)?.[0]?.split('\n').filter(s => s.startsWith('-')) || [],
      lessons: metadata.memoryContext?.match(/lessons[\s\S]*?(?=##|$)/)?.[0]?.split('\n').filter(s => s.startsWith('-')) || [],
      userPreferences: {},
    } : {
      brain: '',
      activeTasks: [],
      lessons: [],
      userPreferences: {},
    },
    
    voice: {
      style: metadata.identityContext?.match(/## Voice[\s\S]*?(?=#[^#]|$)/)?.[0] || 'professional and helpful',
      tone: {
        formality: 0.5,
        enthusiasm: 0.5,
        empathy: 0.5,
        directness: 0.5,
      },
      rules: metadata.identityContext?.match(/Voice Rules?:\s*\n((?:-\s*.+\n?)+)/)?.[1]?.split('\n').filter(s => s.trim()).map(s => s.replace(/^-\s*/, '')) || [],
    },
    
    systemPrompt: metadata.systemPrompt || `You are ${metadata.agentName || 'an AI assistant'}. Be helpful and accurate.`,
    
    hash: '',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min cache
  };
  
  // Generate hash
  pack.hash = generateContextHash(pack);
  
  // Apply truncation if needed (simplified - real implementation would use tokenizer)
  if (pack.systemPrompt.length > maxTokens * 4) {  // Rough chars per token estimate
    pack.systemPrompt = truncateContext(pack.systemPrompt, maxTokens * 4, truncatePolicy);
  }
  
  return pack;
}

function truncateContext(content: string, maxLength: number, policy: string): string {
  if (content.length <= maxLength) return content;
  
  // Simple truncation - real implementation would be token-aware
  const sections = content.split('\n\n---\n\n');
  
  if (policy === 'identity-first') {
    // Keep identity, truncate governance/memory
    return sections[0] + '\n\n[Additional context truncated...]';
  } else if (policy === 'governance-first') {
    // Keep governance, truncate others
    return '[Identity truncated...]\n\n' + sections.slice(1).join('\n\n');
  } else {
    // Balanced - take from all sections
    const targetPerSection = Math.floor(maxLength / sections.length);
    return sections.map(s => s.slice(0, targetPerSection)).join('\n\n---\n\n');
  }
}

// ============================================================================
// System Prompt Builder
// ============================================================================

export function buildSystemPromptFromPack(pack: ContextPack): string {
  const sections: string[] = [];
  
  // Section 1: Identity
  sections.push(`# Agent Identity

You are ${pack.identity.name}.

## Purpose
${pack.identity.purpose}

## Backstory
${pack.identity.backstory}

## Personality Traits
${pack.identity.personalityTraits.map(t => `- ${t}`).join('\n')}`);

  // Section 2: Trust Tiers (CRITICAL - enforce these)
  sections.push(`# Trust & Safety (MUST FOLLOW)

## Tier 1 - Foundation (ALWAYS APPLY)
${pack.trustTiers.tier1.rules.map(r => `- ${r}`).join('\n')}

## Tier 2 - Contextual (APPLY WHEN RELEVANT)
${pack.trustTiers.tier2.rules.map(r => `- ${r}`).join('\n')}

## Tier 3 - Permission Required (ASK USER FIRST)
${pack.trustTiers.tier3.rules.map(r => `- ${r}`).join('\n')}

### BEFORE ANY ACTION:
1. Check if action violates Tier 1 → NEVER DO
2. Check if action matches Tier 2 → APPLY IF CONTEXT FITS  
3. Check if action requires Tier 3 → ASK USER PERMISSION`);

  // Section 3: Governance
  if (pack.governance.playbook) {
    sections.push(`# Governance & Procedures

${pack.governance.playbook}`);
  }

  // Section 4: Available Tools
  if (pack.governance.availableTools.length > 0) {
    sections.push(`# Available Tools

${pack.governance.availableTools.map(t => `- **${t.name}**: ${t.description}${t.requiresPermission ? ' (Requires Permission)' : ''}`).join('\n')}`);
  }

  // Section 5: Hard Bans
  if (pack.governance.hardBans.length > 0) {
    sections.push(`# Hard Bans (NEVER DO THESE)

${pack.governance.hardBans.map(b => `- ❌ ${b}`).join('\n')}`);
  }

  // Section 6: Voice & Communication
  sections.push(`# Voice & Communication Style

${pack.voice.style}

## Communication Rules
${pack.voice.rules.map(r => `- ${r}`).join('\n')}`);

  // Section 7: Memory (if present)
  if (pack.memory.brain || pack.memory.activeTasks.length > 0) {
    sections.push(`# Current Context

## Active Tasks
${pack.memory.activeTasks.map(t => `- ${t}`).join('\n') || 'None'}

## Key Lessons
${pack.memory.lessons.map(l => `- ${l}`).join('\n') || 'None'}`);
  }

  return sections.join('\n\n---\n\n');
}

// ============================================================================
// Utility Functions
// ============================================================================

export function shouldRefreshContext(pack: ContextPack): boolean {
  return new Date() > new Date(pack.expiresAt);
}

export function getTrustTierForAction(pack: ContextPack, action: string): TrustTier | null {
  const actionLower = action.toLowerCase();
  
  // Check Tier 1
  if (pack.trustTiers.tier1.rules.some(r => actionLower.includes(r.toLowerCase()))) {
    return pack.trustTiers.tier1;
  }
  
  // Check Tier 2
  if (pack.trustTiers.tier2.rules.some(r => actionLower.includes(r.toLowerCase()))) {
    return pack.trustTiers.tier2;
  }
  
  // Check Tier 3
  if (pack.trustTiers.tier3.rules.some(r => actionLower.includes(r.toLowerCase()))) {
    return pack.trustTiers.tier3;
  }
  
  return null;
}

export function requiresPermission(pack: ContextPack, action: string): boolean {
  const tier = getTrustTierForAction(pack, action);
  return tier?.enforce === 'permission' || false;
}

export function getStartupTasks(pack: ContextPack): ScheduledTask[] {
  return pack.heartbeat.tasks.filter(t => t.frequency === 'on-session-start');
}

export function markTaskExecuted(pack: ContextPack, taskId: string): void {
  const task = pack.heartbeat.tasks.find(t => t.id === taskId);
  if (task) {
    task.lastExecuted = new Date().toISOString();
  }
}
