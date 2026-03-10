/**
 * useSwarmTrigger Hook
 * 
 * Detects natural language patterns indicating swarm execution intent
 * and triggers the Meta-Swarm system automatically.
 * 
 * Patterns detected:
 * - "do X with swarm of agents"
 * - "use swarm to X"
 * - "deploy swarm for X"
 * - "parallel agents to X"
 * - "swarm mode: X"
 * - "@swarm X" or "/swarm X"
 */

import { useCallback, useRef } from 'react';

export interface SwarmTriggerResult {
  isSwarmTrigger: boolean;
  task: string;
  suggestedMode?: 'swarm_agentic' | 'claude_swarm' | 'closed_loop' | 'hybrid' | 'auto';
  confidence: number;
}

// Natural language patterns that indicate swarm intent
const SWARM_PATTERNS = [
  // Direct mentions
  { pattern: /(?:do|handle|process|solve|implement|fix|build|create)\s+(.+?)\s+with\s+(?:a\s+)?swarm\s+(?:of\s+)?agents/i, mode: 'auto' as const },
  { pattern: /use\s+(?:a\s+)?swarm\s+(?:of\s+agents?\s+)?to\s+(.+)/i, mode: 'auto' as const },
  { pattern: /deploy\s+(?:a\s+)?swarm\s+(?:of\s+agents?\s+)?(?:to\s+)?(.+)/i, mode: 'auto' as const },
  
  // Parallel execution mentions
  { pattern: /(?:run|execute)\s+(.+?)\s+in\s+parallel\s+(?:with\s+agents?|using\s+swarm)/i, mode: 'claude_swarm' as const },
  { pattern: /parallel\s+agents?\s+(?:to\s+)?(.+)/i, mode: 'claude_swarm' as const },
  { pattern: /(?:use\s+)?(\d+)\s+agents?\s+(?:to\s+)?(.+)/i, mode: 'auto' as const },
  
  // Mode-specific triggers
  { pattern: /swarm\s*mode\s*(?::|->)\s*(.+)/i, mode: 'auto' as const },
  { pattern: /(?:auto[\s-]?architect|discover\s+optimal)\s+(?:agents?\s+)?(?:for\s+)?(.+)/i, mode: 'swarm_agentic' as const },
  { pattern: /closed[\s-]?loop\s+(?:for\s+)?(.+)/i, mode: 'closed_loop' as const },
  { pattern: /production\s+swarm\s+(?:for\s+)?(.+)/i, mode: 'closed_loop' as const },
  
  // Command-style triggers
  { pattern: /[@/]swarm\s+(.+)/i, mode: 'auto' as const },
  { pattern: /[@/]swarm_(\w+)\s+(.+)/i, mode: 'auto' as const },
  
  // Intent-based triggers
  { pattern: /optimize\s+(?:agent\s+)?architecture\s+(?:for\s+)?(.+)/i, mode: 'swarm_agentic' as const },
  { pattern: /review\s+and\s+compound\s+(?:knowledge\s+)?(?:for\s+)?(.+)/i, mode: 'closed_loop' as const },
];

// Task complexity indicators that suggest swarm mode
const COMPLEXITY_INDICATORS = [
  { pattern: /\b(refactor|restructure|redesign|rewrite)\b/i, weight: 0.3 },
  { pattern: /\b(analyze|analyze|investigate|audit|review)\s+(?:code|files?|project|system)\b/i, weight: 0.2 },
  { pattern: /\b(multiple|many|several|various)\s+files?\b/i, weight: 0.15 },
  { pattern: /\b(large|complex|complicated|sophisticated)\b/i, weight: 0.2 },
  { pattern: /\b(parallel|concurrent|simultaneous)\b/i, weight: 0.25 },
  { pattern: /\b(architecture|structure|design)\b/i, weight: 0.2 },
  { pattern: /\b(tests?|testing|coverage)\b/i, weight: 0.15 },
  { pattern: /\b(documentation|docs?)\b/i, weight: 0.1 },
];

/**
 * Analyzes text for swarm trigger patterns
 */
export function detectSwarmTrigger(text: string): SwarmTriggerResult {
  if (!text || text.trim().length < 5) {
    return { isSwarmTrigger: false, task: '', confidence: 0 };
  }

  // Check against all patterns
  for (const { pattern, mode } of SWARM_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      // Extract task - could be group 1 or group 2 depending on pattern
      const task = match[2] || match[1] || text;
      
      // Calculate confidence based on pattern match and task complexity
      const complexity = calculateComplexity(task);
      const confidence = Math.min(0.95, 0.7 + complexity * 0.25);
      
      return {
        isSwarmTrigger: true,
        task: task.trim(),
        suggestedMode: mode === 'auto' ? inferModeFromTask(task) : mode,
        confidence,
      };
    }
  }

  // No direct pattern match - check if task complexity warrants swarm
  const complexity = calculateComplexity(text);
  if (complexity > 0.6) {
    return {
      isSwarmTrigger: true,
      task: text.trim(),
      suggestedMode: 'auto',
      confidence: complexity * 0.7, // Lower confidence for implicit triggers
    };
  }

  return { isSwarmTrigger: false, task: text, confidence: 0 };
}

/**
 * Calculate complexity score for a task
 */
function calculateComplexity(task: string): number {
  let score = 0;
  
  for (const { pattern, weight } of COMPLEXITY_INDICATORS) {
    if (pattern.test(task)) {
      score += weight;
    }
  }
  
  // Bonus for task length (longer tasks tend to be more complex)
  const wordCount = task.split(/\s+/).length;
  if (wordCount > 20) score += 0.1;
  if (wordCount > 50) score += 0.1;
  
  return Math.min(1.0, score);
}

/**
 * Infer optimal swarm mode from task characteristics
 */
function inferModeFromTask(task: string): 'swarm_agentic' | 'claude_swarm' | 'closed_loop' | 'auto' {
  const taskLower = task.toLowerCase();
  
  // Architecture/discovery tasks -> SwarmAgentic
  if (/\b(architect|discover|optimize|structure|design|pattern)\b/i.test(taskLower)) {
    return 'swarm_agentic';
  }
  
  // Production/review/compound tasks -> ClosedLoop
  if (/\b(production|review|compound|knowledge|methodology|5-step)\b/i.test(taskLower)) {
    return 'closed_loop';
  }
  
  // Fast/parallel execution tasks -> ClaudeSwarm
  if (/\b(fast|quick|speed|parallel|batch|many|multiple)\b/i.test(taskLower)) {
    return 'claude_swarm';
  }
  
  return 'auto';
}

/**
 * React hook for swarm trigger detection
 */
export function useSwarmTrigger() {
  const lastTriggerRef = useRef<SwarmTriggerResult | null>(null);

  const analyze = useCallback((text: string): SwarmTriggerResult => {
    const result = detectSwarmTrigger(text);
    lastTriggerRef.current = result;
    return result;
  }, []);

  const shouldTriggerSwarm = useCallback((text: string, threshold = 0.6): boolean => {
    const result = analyze(text);
    return result.isSwarmTrigger && result.confidence >= threshold;
  }, [analyze]);

  return {
    analyze,
    shouldTriggerSwarm,
    lastTrigger: lastTriggerRef.current,
  };
}

/**
 * Format a task for swarm submission
 */
export function formatSwarmTask(task: string, mode?: string): string {
  const cleanTask = task.trim();
  
  if (mode && mode !== 'auto') {
    return `[${mode}] ${cleanTask}`;
  }
  
  return cleanTask;
}

/**
 * Extract suggested agent count from task
 */
export function extractAgentCount(task: string): number | undefined {
  const match = task.match(/(\d+)\s+agents?/i);
  if (match) {
    const count = parseInt(match[1], 10);
    if (count > 0 && count <= 100) {
      return count;
    }
  }
  return undefined;
}
