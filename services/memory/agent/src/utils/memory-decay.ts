/**
 * Memory Decay & Archival System
 * 
 * Automatically decays memory relevance over time
 * and archives/deletes low-relevance memories
 */

import type { Memory } from '../types/memory.types.js';

export interface DecayConfig {
  halfLifeDays: number;        // Memory relevance half-life
  archiveThreshold: number;    // Archive when relevance < this
  deleteThreshold: number;     // Delete when relevance < this
  accessBoost: number;         // Boost per access (logarithmic)
}

export const DEFAULT_DECAY_CONFIG: DecayConfig = {
  halfLifeDays: 30,
  archiveThreshold: 0.3,
  deleteThreshold: 0.1,
  accessBoost: 0.1,
};

export interface DecayResult {
  memoryId: string;
  oldRelevance: number;
  newRelevance: number;
  action: 'keep' | 'archive' | 'delete';
}

/**
 * Calculate memory relevance based on age and access count
 */
export function calculateRelevance(
  createdAt: Date,
  accessCount: number = 0,
  config: DecayConfig = DEFAULT_DECAY_CONFIG
): number {
  const now = new Date();
  const ageDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  
  // Exponential decay based on half-life
  const decayFactor = Math.pow(0.5, ageDays / config.halfLifeDays);
  
  // Logarithmic boost for frequent access
  const accessBonus = accessCount > 0 
    ? Math.log(accessCount + 1) * config.accessBoost 
    : 0;
  
  // Combined relevance (capped at 1.0)
  const relevance = Math.min(1.0, decayFactor + accessBonus);
  
  return relevance;
}

/**
 * Determine action based on relevance
 */
export function determineAction(relevance: number, config: DecayConfig = DEFAULT_DECAY_CONFIG): 'keep' | 'archive' | 'delete' {
  if (relevance < config.deleteThreshold) {
    return 'delete';
  } else if (relevance < config.archiveThreshold) {
    return 'archive';
  } else {
    return 'keep';
  }
}

/**
 * Memory Decay Manager
 */
export class DecayManager {
  private config: DecayConfig;
  private accessCounts: Map<string, number> = new Map();

  constructor(config: DecayConfig = DEFAULT_DECAY_CONFIG) {
    this.config = config;
  }

  /**
   * Process all memories and apply decay
   */
  processMemories(memories: Memory[]): DecayResult[] {
    const results: DecayResult[] = [];

    for (const memory of memories) {
      const createdAt = new Date(memory.createdAt);
      const accessCount = this.accessCounts.get(memory.id) || 0;
      
      const oldRelevance = this.calculateMemoryRelevance(memory, accessCount);
      const newRelevance = calculateRelevance(createdAt, accessCount, this.config);
      const action = determineAction(newRelevance, this.config);

      results.push({
        memoryId: memory.id,
        oldRelevance,
        newRelevance,
        action,
      });
    }

    return results;
  }

  /**
   * Record memory access
   */
  recordAccess(memoryId: string): void {
    const current = this.accessCounts.get(memoryId) || 0;
    this.accessCounts.set(memoryId, current + 1);
  }

  /**
   * Get memories to archive
   */
  getMemoriesToArchive(memories: Memory[]): Memory[] {
    const results = this.processMemories(memories);
    const archiveIds = new Set(
      results.filter(r => r.action === 'archive').map(r => r.memoryId)
    );
    
    return memories.filter(m => archiveIds.has(m.id));
  }

  /**
   * Get memories to delete
   */
  getMemoriesToDelete(memories: Memory[]): Memory[] {
    const results = this.processMemories(memories);
    const deleteIds = new Set(
      results.filter(r => r.action === 'delete').map(r => r.memoryId)
    );
    
    return memories.filter(m => deleteIds.has(m.id));
  }

  /**
   * Calculate relevance for a specific memory
   */
  private calculateMemoryRelevance(memory: Memory, accessCount: number): number {
    // If memory has metadata with relevance, use that
    const metadata = memory.metadata as any;
    if (metadata && typeof metadata.relevance === 'number') {
      return metadata.relevance;
    }
    
    // Otherwise calculate from scratch
    return calculateRelevance(new Date(memory.createdAt), accessCount, this.config);
  }
}
