/**
 * Gizzi Context Pack Builder
 * 
 * Builds structured context packs from workspace files
 * Production-quality implementation matching Allternit platform
 */

import type { 
  ContextPack, 
  TrustTier, 
  ScheduledTask, 
  ToolDefinition,
  WorkspaceFile 
} from '../workspace/types';

// ============================================================================
// File Classification
// ============================================================================

export function classifyFile(filePath: string): WorkspaceFile['type'] {
  const lower = filePath.toLowerCase();
  
  if (lower.endsWith('manifest.json')) return 'manifest';
  if (lower.includes('/brain/')) return 'brain';
  if (lower.includes('/memory/')) return 'memory';
  if (lower.endsWith('soul.md')) return 'soul';
  if (lower.includes('/identity/identity.md')) return 'identity';
  if (lower.includes('/identity/user.md')) return 'user';
  if (lower.includes('/identity/voice.md')) return 'voice';
  if (lower.includes('/identity/policy.md')) return 'policy';
  if (lower.includes('/governance/playbook.md')) return 'playbook';
  if (lower.includes('/governance/tools.md')) return 'tools';
  if (lower.includes('/governance/heartbeat.md')) return 'heartbeat';
  if (lower.includes('/governance/system.md')) return 'system';
  if (lower.includes('/governance/channels.md')) return 'channels';
  if (lower.includes('/skills/')) return 'skill';
  if (lower.includes('/business/')) return 'business';
  if (lower.endsWith('.json') || lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'config';
  
  return 'knowledge';
}

// ============================================================================
// SOUL.md Parser
// ============================================================================

export function parseSoulMd(content: string): { 
  trustTiers: ContextPack['trustTiers']; 
  identity: Partial<ContextPack['identity']> 
} {
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
    
    if (currentTier && trimmed.match(/^[-\*✅]\s+/)) {
      const rule = trimmed.replace(/^[-\*✅]\s+/, '');
      trustTiers[`tier${currentTier}`].rules.push(rule);
    }
    
    if (inSelfAwareness && trimmed.startsWith('I am')) {
      identity.backstory = trimmed;
    }
  }
  
  return { trustTiers, identity };
}

// ============================================================================
// HEARTBEAT.md Parser
// ============================================================================

export function parseHeartbeatMd(content: string): ScheduledTask[] {
  const lines = content.split('\n');
  const tasks: ScheduledTask[] = [];
  
  let currentFrequency: ScheduledTask['frequency'] = 'daily';
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.match(/^#+\s*Daily/i)) {
      currentFrequency = 'daily';
    } else if (trimmed.match(/^#+\s*Weekly/i)) {
      currentFrequency = 'weekly';
    } else if (trimmed.match(/^#+\s*Monthly/i)) {
      currentFrequency = 'monthly';
    } else if (trimmed.match(/^#+\s*On\s+Session\s+Start/i)) {
      currentFrequency = 'on-session-start';
    }
    
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
// System Prompt Builder
// ============================================================================

export function buildSystemPrompt(pack: ContextPack): string {
  const sections: string[] = [];
  
  // Identity
  sections.push(`# Agent Identity

You are ${pack.identity.name}.

## Purpose
${pack.identity.purpose}

## Backstory
${pack.identity.backstory}

## Personality Traits
${pack.identity.personalityTraits.map(t => `- ${t}`).join('\n')}`);

  // Trust Tiers (CRITICAL)
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

  // Governance
  if (pack.governance.playbook) {
    sections.push(`# Governance & Procedures

${pack.governance.playbook}`);
  }

  // Tools
  if (pack.governance.availableTools.length > 0) {
    sections.push(`# Available Tools

${pack.governance.availableTools.map(t => `- **${t.name}**: ${t.description}${t.requiresPermission ? ' (Requires Permission)' : ''}`).join('\n')}`);
  }

  // Hard Bans
  if (pack.governance.hardBans.length > 0) {
    sections.push(`# Hard Bans (NEVER DO THESE)

${pack.governance.hardBans.map(b => `- ❌ ${b}`).join('\n')}`);
  }

  // Voice
  sections.push(`# Voice & Communication Style

${pack.voice.style}

## Communication Rules
${pack.voice.rules.map(r => `- ${r}`).join('\n')}`);

  // Memory
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
// Context Pack Builder
// ============================================================================

export interface BuildContextPackOptions {
  sessionId: string;
  agentId: string;
  agentName: string;
  files: Map<string, string>; // path -> content
}

export function buildContextPack(options: BuildContextPackOptions): ContextPack {
  const { sessionId, agentId, agentName, files } = options;
  
  // Parse files
  const soulContent = files.has('.allternit/identity/SOUL.md') 
    ? parseSoulMd(files.get('.allternit/identity/SOUL.md')!)
    : { 
        trustTiers: {
          tier1: { level: 1, name: 'Foundation', rules: ['Be helpful and accurate'], enforce: 'always' },
          tier2: { level: 2, name: 'Contextual', rules: ['Adapt to context'], enforce: 'contextual' },
          tier3: { level: 3, name: 'Permission Required', rules: ['Execute code'], enforce: 'permission' },
        } as ContextPack['trustTiers'],
        identity: { personalityTraits: ['helpful', 'accurate'] }
      };
  
  const heartbeatContent = files.has('.allternit/governance/HEARTBEAT.md')
    ? parseHeartbeatMd(files.get('.allternit/governance/HEARTBEAT.md')!)
    : [];
  
  // Build pack
  const pack: ContextPack = {
    version: '1.0.0',
    agentId,
    agentName,
    sessionId,
    
    identity: {
      name: agentName,
      purpose: files.get('.allternit/identity/IDENTITY.md')?.match(/##?\s*Purpose\s*\n([^#]+)/)?.[1]?.trim() || 'Assist the user',
      backstory: soulContent.identity.backstory || `I am ${agentName}, an AI assistant.`,
      personalityTraits: soulContent.identity.personalityTraits || ['helpful', 'accurate'],
    },
    
    trustTiers: soulContent.trustTiers,
    
    governance: {
      playbook: files.get('.allternit/governance/PLAYBOOK.md') || '',
      availableTools: [], // Would parse from TOOLS.md
      hardBans: [],
      escalation: [],
    },
    
    heartbeat: {
      tasks: heartbeatContent,
      lastCheck: new Date().toISOString(),
    },
    
    memory: {
      brain: files.get('.allternit/brain/BRAIN.md') || '',
      activeTasks: [],
      lessons: [],
      userPreferences: {},
    },
    
    voice: {
      style: files.get('.allternit/identity/VOICE.md') || 'professional and helpful',
      tone: { formality: 0.5, enthusiasm: 0.5, empathy: 0.5, directness: 0.5 },
      rules: [],
    },
    
    systemPrompt: '',
    hash: '',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  };
  
  // Build system prompt
  pack.systemPrompt = buildSystemPrompt(pack);
  
  // Generate hash
  pack.hash = generateHash(pack);
  
  return pack;
}

function generateHash(pack: Partial<ContextPack>): string {
  const str = JSON.stringify({
    agentId: pack.agentId,
    trustTiers: pack.trustTiers,
    systemPrompt: pack.systemPrompt?.slice(0, 100),
  });
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getStartupTasks(pack: ContextPack): ScheduledTask[] {
  return pack.heartbeat.tasks.filter(t => t.frequency === 'on-session-start');
}

export function requiresPermission(pack: ContextPack, action: string): boolean {
  const actionLower = action.toLowerCase();
  
  // Check Tier 3
  if (pack.trustTiers.tier3.rules.some(r => actionLower.includes(r.toLowerCase()))) {
    return true;
  }
  
  return false;
}

export function shouldRefreshContext(pack: ContextPack): boolean {
  return new Date() > new Date(pack.expiresAt);
}
