/**
 * Query Agent - Search and Synthesis
 * 
 * Handles queries against the memory store and synthesizes answers
 */

import { LocalModelManager } from './models/local-model.js';
import { MemoryStore } from './store/sqlite-store.js';
import type { Memory, Insight, QueryResult } from './types/memory.types.js';

/**
 * Query Agent configuration
 */
export interface QueryAgentConfig {
  maxResults: number;
  minConfidence: number;
  includeInsights: boolean;
}

/**
 * Query Agent class
 */
export class QueryAgent {
  private modelManager: LocalModelManager;
  private store: MemoryStore;
  private config: QueryAgentConfig;

  constructor(
    modelManager: LocalModelManager,
    store: MemoryStore,
    config: QueryAgentConfig = {
      maxResults: 10,
      minConfidence: 0.5,
      includeInsights: true,
    }
  ) {
    this.modelManager = modelManager;
    this.store = store;
    this.config = config;
  }

  /**
   * Query the memory store
   */
  async query(question: string): Promise<QueryResult> {
    const startTime = Date.now();

    console.log(`QueryAgent: Processing query: "${question}"`);

    // Step 1: Search for relevant memories
    const searchResults = this.store.searchMemories(question);
    
    // Step 2: Also search by keywords extracted from question
    const keywords = await this.extractKeywords(question);
    const keywordResults: Memory[] = [];
    
    for (const keyword of keywords) {
      const byTopic = this.store.getMemoriesByTopic(keyword);
      const byEntity = this.store.getMemoriesByEntity(keyword);
      keywordResults.push(...byTopic, ...byEntity);
    }

    // Combine and deduplicate results
    const allMemories = this.deduplicateMemories([
      ...searchResults,
      ...keywordResults,
    ]);

    // Limit results
    const relevantMemories = allMemories.slice(0, this.config.maxResults);

    console.log(`QueryAgent: Found ${relevantMemories.length} relevant memories`);

    // Step 3: Get relevant insights
    let relevantInsights: Insight[] = [];
    
    if (this.config.includeInsights) {
      const insightSearch = this.store.searchInsights(question);
      relevantInsights = insightSearch.slice(0, 5);
      console.log(`QueryAgent: Found ${relevantInsights.length} relevant insights`);
    }

    // Step 4: Synthesize answer
    const memoriesForSynthesis = relevantMemories.map(m => ({
      summary: m.summary,
      source: m.source,
    }));

    const { answer, confidence } = await this.modelManager.synthesizeAnswer(
      question,
      memoriesForSynthesis
    );

    const executionTimeMs = Date.now() - startTime;

    console.log(`QueryAgent: Generated answer with confidence ${confidence} in ${executionTimeMs}ms`);

    return {
      query: question,
      answer,
      memories: relevantMemories,
      insights: relevantInsights,
      sources: this.extractSources(relevantMemories),
      confidence,
      executionTimeMs,
    };
  }

  /**
   * Search memories without synthesis (raw results)
   */
  search(query: string): Memory[] {
    console.log(`QueryAgent: Searching for: "${query}"`);
    
    const results = this.store.searchMemories(query);
    return results.slice(0, this.config.maxResults);
  }

  /**
   * Search by topic
   */
  searchByTopic(topic: string): Memory[] {
    console.log(`QueryAgent: Searching by topic: "${topic}"`);
    return this.store.getMemoriesByTopic(topic);
  }

  /**
   * Search by entity
   */
  searchByEntity(entity: string): Memory[] {
    console.log(`QueryAgent: Searching by entity: "${entity}"`);
    return this.store.getMemoriesByEntity(entity);
  }

  /**
   * Get recent memories
   */
  getRecent(limit: number = 10): Memory[] {
    const allMemories = this.store.getAllMemories();
    return allMemories.slice(0, limit);
  }

  /**
   * Get memories by importance
   */
  getByImportance(importance: 'low' | 'medium' | 'high' | 'critical'): Memory[] {
    const allMemories = this.store.getAllMemories();
    return allMemories.filter((m: Memory) => m.importance === importance);
  }

  /**
   * Get all insights
   */
  getInsights(): Insight[] {
    return this.store.getAllInsights();
  }

  /**
   * Get connections for a specific memory
   */
  getConnectionsForMemory(memoryId: string) {
    return this.store.getConnectionsForMemory(memoryId);
  }

  /**
   * Ask a follow-up question (contextual query)
   */
  async askFollowUp(
    previousQuery: string,
    followUpQuestion: string,
    previousMemories?: Memory[]
  ): Promise<QueryResult> {
    const startTime = Date.now();

    // Combine previous context with new question
    const contextualQuestion = `${previousQuery} -> ${followUpQuestion}`;

    // Use previous memories if provided, otherwise search
    const memories = previousMemories || this.search(previousQuery);

    console.log(`QueryAgent: Processing follow-up: "${followUpQuestion}"`);

    const memoriesForSynthesis = memories.map(m => ({
      summary: m.summary,
      source: m.source,
    }));

    const { answer, confidence } = await this.modelManager.synthesizeAnswer(
      contextualQuestion,
      memoriesForSynthesis
    );

    const executionTimeMs = Date.now() - startTime;

    return {
      query: followUpQuestion,
      answer,
      memories,
      insights: [],
      sources: this.extractSources(memories),
      confidence,
      executionTimeMs,
    };
  }

  /**
   * Extract keywords from a question
   */
  private async extractKeywords(question: string): Promise<string[]> {
    try {
      // Use LLM to extract key terms
      const schema = `{
  "keywords": ["list of 3-5 key terms from the question"]
}`;

      const prompt = `Extract the most important keywords from this question: "${question}"`;

      const result = await this.modelManager.extractStructured<{ keywords: string[] }>(
        prompt,
        schema,
        { temperature: 0.1, numPredict: 200 }
      );

      return result?.keywords || [];
    } catch (error) {
      console.error('QueryAgent: Error extracting keywords:', error);
      // Fallback: simple word extraction
      return question
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3 && !['what', 'where', 'when', 'why', 'how', 'which', 'their', 'there', 'about', 'with'].includes(word));
    }
  }

  /**
   * Deduplicate memories by ID
   */
  private deduplicateMemories(memories: Memory[]): Memory[] {
    const seen = new Set<string>();
    return memories.filter(m => {
      if (seen.has(m.id)) {
        return false;
      }
      seen.add(m.id);
      return true;
    });
  }

  /**
   * Extract unique sources from memories
   */
  private extractSources(memories: Memory[]): string[] {
    const sourceSet = new Set<string>();
    
    for (const memory of memories) {
      sourceSet.add(memory.source);
    }
    
    return Array.from(sourceSet);
  }

  /**
   * Get query statistics
   */
  getStats(): {
    totalMemories: number;
    totalInsights: number;
    totalConnections: number;
  } {
    const stats = this.store.getStats();
    
    return {
      totalMemories: stats.memoryCount,
      totalInsights: stats.insightCount,
      totalConnections: stats.connectionCount,
    };
  }
}
