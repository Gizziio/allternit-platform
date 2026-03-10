/**
 * Consolidate Agent - Pattern Finding and Memory Merging
 * 
 * Runs periodically to find connections between memories and generate insights
 */

import { LocalModelManager } from '../models/local-model.js';
import { MemoryStore } from '../store/sqlite-store.js';
import type { Memory, MemoryConnection, Insight } from '../types/memory.types.js';

/**
 * Consolidate Agent configuration
 */
export interface ConsolidateAgentConfig {
  intervalMinutes: number;
  minMemoriesForConsolidation: number;
  maxMemoriesPerBatch: number;
}

/**
 * Consolidation result
 */
export interface ConsolidationResult {
  memoriesProcessed: number;
  connectionsFound: number;
  insightsGenerated: number;
  memoriesConsolidated: number;
  durationMs: number;
}

/**
 * Consolidate Agent class
 */
export class ConsolidateAgent {
  private modelManager: LocalModelManager;
  private store: MemoryStore;
  private config: ConsolidateAgentConfig;
  private timer?: NodeJS.Timeout;
  private isRunning: boolean = false;

  constructor(
    modelManager: LocalModelManager,
    store: MemoryStore,
    config: ConsolidateAgentConfig
  ) {
    this.modelManager = modelManager;
    this.store = store;
    this.config = {
      intervalMinutes: config.intervalMinutes || 30,
      minMemoriesForConsolidation: config.minMemoriesForConsolidation || 3,
      maxMemoriesPerBatch: config.maxMemoriesPerBatch || 20,
    };
  }

  /**
   * Start periodic consolidation
   */
  start(): void {
    const intervalMs = this.config.intervalMinutes * 60 * 1000;
    
    console.log(`ConsolidateAgent: Starting periodic consolidation every ${this.config.intervalMinutes} minutes`);
    
    // Run immediately
    this.runConsolidation();
    
    // Then run on interval
    this.timer = setInterval(() => {
      this.runConsolidation();
    }, intervalMs);
  }

  /**
   * Stop periodic consolidation
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
      console.log('ConsolidateAgent: Stopped periodic consolidation');
    }
  }

  /**
   * Trigger manual consolidation
   */
  async consolidateNow(): Promise<ConsolidationResult> {
    return await this.runConsolidation();
  }

  /**
   * Run consolidation process
   */
  private async runConsolidation(): Promise<ConsolidationResult> {
    if (this.isRunning) {
      console.log('ConsolidateAgent: Consolidation already running, skipping');
      return {
        memoriesProcessed: 0,
        connectionsFound: 0,
        insightsGenerated: 0,
        memoriesConsolidated: 0,
        durationMs: 0,
      };
    }

    const startTime = Date.now();
    this.isRunning = true;

    try {
      console.log('ConsolidateAgent: Starting consolidation cycle...');

      // Get unconsolidated memories
      const unconsolidatedMemories = this.store.getUnconsolidatedMemories();
      
      if (unconsolidatedMemories.length < this.config.minMemoriesForConsolidation) {
        console.log(`ConsolidateAgent: Only ${unconsolidatedMemories.length} memories, below threshold (${this.config.minMemoriesForConsolidation})`);
        this.isRunning = false;
        return {
          memoriesProcessed: unconsolidatedMemories.length,
          connectionsFound: 0,
          insightsGenerated: 0,
          memoriesConsolidated: 0,
          durationMs: Date.now() - startTime,
        };
      }

      // Limit batch size
      const batchMemories = unconsolidatedMemories.slice(0, this.config.maxMemoriesPerBatch);
      console.log(`ConsolidateAgent: Processing ${batchMemories.length} memories`);

      // Step 1: Find connections between memories
      const connectionsFound = await this.findConnections(batchMemories);
      console.log(`ConsolidateAgent: Found ${connectionsFound.length} connections`);

      // Step 2: Generate insights from connected memories
      const insightsGenerated = await this.generateInsights(batchMemories);
      console.log(`ConsolidateAgent: Generated ${insightsGenerated.length} insights`);

      // Step 3: Mark memories as processed
      const memoriesConsolidated = await this.markMemoriesConsolidated(batchMemories);
      console.log(`ConsolidateAgent: Marked ${memoriesConsolidated} memories as consolidated`);

      const durationMs = Date.now() - startTime;
      console.log(`ConsolidateAgent: Consolidation complete in ${durationMs}ms`);

      this.isRunning = false;

      return {
        memoriesProcessed: batchMemories.length,
        connectionsFound: connectionsFound.length,
        insightsGenerated: insightsGenerated.length,
        memoriesConsolidated: memoriesConsolidated,
        durationMs,
      };
    } catch (error) {
      console.error('ConsolidateAgent: Error during consolidation:', error);
      this.isRunning = false;
      
      return {
        memoriesProcessed: 0,
        connectionsFound: 0,
        insightsGenerated: 0,
        memoriesConsolidated: 0,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Find connections between memories
   */
  private async findConnections(memories: Memory[]): Promise<MemoryConnection[]> {
    if (memories.length < 2) {
      return [];
    }

    // Prepare memories for analysis
    const memoriesForAnalysis = memories.map(m => ({
      id: m.id,
      summary: m.summary,
      topics: m.topics,
    }));

    // Use LLM to find connections
    const connections = await this.modelManager.findConnections(memoriesForAnalysis);

    // Store connections in database
    const storedConnections: MemoryConnection[] = [];
    
    for (const conn of connections) {
      try {
        const connection: Omit<MemoryConnection, 'id' | 'createdAt'> = {
          memoryIds: [conn.memoryId1, conn.memoryId2],
          relationship: conn.relationship,
          strength: conn.strength,
        };
        
        const stored = this.store.createConnection(connection);
        storedConnections.push(stored);
      } catch (error) {
        console.error('ConsolidateAgent: Error storing connection:', error);
      }
    }

    return storedConnections;
  }

  /**
   * Generate insights from memories
   */
  private async generateInsights(memories: Memory[]): Promise<Insight[]> {
    if (memories.length < 2) {
      return [];
    }

    // Prepare memories for analysis
    const memoriesForAnalysis = memories.map(m => ({
      id: m.id,
      summary: m.summary,
      content: m.content,
    }));

    // Use LLM to generate insights
    const insights = await this.modelManager.generateInsights(memoriesForAnalysis);

    // Store insights in database
    const storedInsights: Insight[] = [];
    
    for (const insight of insights) {
      try {
        const newInsight: Omit<Insight, 'id' | 'createdAt' | 'updatedAt'> = {
          title: insight.title,
          content: insight.content,
          memoryIds: memories.map(m => m.id), // Associate with all processed memories
          topics: this.extractTopicsFromMemories(memories),
          confidence: insight.confidence,
        };
        
        const stored = this.store.createInsight(newInsight);
        storedInsights.push(stored);
      } catch (error) {
        console.error('ConsolidateAgent: Error storing insight:', error);
      }
    }

    return storedInsights;
  }

  /**
   * Mark memories as consolidated
   */
  private async markMemoriesConsolidated(memories: Memory[]): Promise<number> {
    let count = 0;
    const now = new Date().toISOString();

    for (const memory of memories) {
      try {
        this.store.updateMemory(memory.id, {
          status: 'consolidated',
          consolidatedAt: now,
        });
        count++;
      } catch (error) {
        console.error('ConsolidateAgent: Error updating memory status:', error);
      }
    }

    return count;
  }

  /**
   * Extract unique topics from memories
   */
  private extractTopicsFromMemories(memories: Memory[]): string[] {
    const topicSet = new Set<string>();
    
    for (const memory of memories) {
      for (const topic of memory.topics) {
        topicSet.add(topic.toLowerCase().trim());
      }
    }
    
    return Array.from(topicSet);
  }

  /**
   * Get consolidation statistics
   */
  getStats(): {
    isRunning: boolean;
    intervalMinutes: number;
    nextRunIn?: number; // minutes
  } {
    let nextRunIn: number | undefined;
    
    if (this.timer && this.config.intervalMinutes > 0) {
      nextRunIn = this.config.intervalMinutes;
    }

    return {
      isRunning: this.isRunning,
      intervalMinutes: this.config.intervalMinutes,
      nextRunIn,
    };
  }

  /**
   * Check if agent is healthy
   */
  isHealthy(): boolean {
    return !this.isRunning; // Healthy if not stuck in running state
  }
}
