/**
 * Advanced Memory Fabric Implementation
 * 
 * Implements advanced memory management, semantic indexing,
 * memory consolidation algorithms, and cross-session memory sharing.
 */


export interface MemoryChunk {
  id: string;
  content: string;
  embedding?: number[]; // Vector representation for semantic search
  metadata: {
    timestamp: number;
    source: string; // Agent ID, session ID, etc.
    tags: string[];
    importance: number; // 0-1 scale of importance
    context: string; // Associated context or session
    type: 'transient' | 'persistent' | 'working' | 'longterm';
  };
  relationships?: string[]; // IDs of related memory chunks
}

export interface MemoryQuery {
  text?: string;
  embedding?: number[];
  tags?: string[];
  context?: string;
  minImportance?: number;
  maxResults?: number;
}

export interface SemanticIndex {
  id: string;
  vector: number[]; // Embedding vector
  chunkId: string;
  tags: string[];
  context: string;
}

export interface MemoryConsolidationResult {
  consolidatedChunks: MemoryChunk[];
  removedChunks: string[];
  summary: string;
}

export interface CrossSessionLink {
  id: string;
  sourceSession: string;
  targetSession: string;
  linkType: 'continuation' | 'reference' | 'dependency';
  relevanceScore: number;
}

export class MemoryFabric {
  private memoryChunks: Map<string, MemoryChunk> = new Map();
  private semanticIndex: Map<string, SemanticIndex> = new Map();
  private crossSessionLinks: Map<string, CrossSessionLink> = new Map();
  private maxMemorySize: number = 10000; // Maximum number of chunks to retain
  private consolidationThreshold: number = 0.3; // Importance threshold for consolidation

  /**
   * Store a new memory chunk
   */
  async store(chunk: Omit<MemoryChunk, 'id'>): Promise<string> {
    const chunkId = `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newChunk: MemoryChunk = {
      ...chunk,
      id: chunkId
    };

    this.memoryChunks.set(chunkId, newChunk);
    
    // Add to semantic index if embedding is provided
    if (chunk.embedding) {
      const index: SemanticIndex = {
        id: `idx-${chunkId}`,
        vector: chunk.embedding,
        chunkId,
        tags: chunk.metadata.tags,
        context: chunk.metadata.context
      };
      this.semanticIndex.set(chunkId, index);
    }

    // Perform memory management if needed
    if (this.memoryChunks.size > this.maxMemorySize) {
      await this.consolidateMemory();
    }

    return chunkId;
  }

  /**
   * Retrieve memory chunks based on query
   */
  async retrieve(query: MemoryQuery): Promise<MemoryChunk[]> {
    let results: MemoryChunk[] = Array.from(this.memoryChunks.values());

    // Filter by tags if specified
    if (query.tags && query.tags.length > 0) {
      results = results.filter(chunk => 
        query.tags!.some(tag => chunk.metadata.tags.includes(tag))
      );
    }

    // Filter by context if specified
    if (query.context) {
      results = results.filter(chunk => 
        chunk.metadata.context === query.context
      );
    }

    // Filter by minimum importance if specified
    if (query.minImportance !== undefined) {
      results = results.filter(chunk => 
        chunk.metadata.importance >= query.minImportance!
      );
    }

    // If text is provided, perform semantic search
    if (query.text) {
      results = await this.semanticSearch(query.text, results, query.maxResults);
    }

    // Sort by importance (descending)
    results.sort((a, b) => b.metadata.importance - a.metadata.importance);

    // Limit results if specified
    if (query.maxResults) {
      results = results.slice(0, query.maxResults);
    }

    return results;
  }

  /**
   * Perform semantic search using embeddings
   */
  private async semanticSearch(queryText: string, candidates: MemoryChunk[], maxResults?: number): Promise<MemoryChunk[]> {
    // In a real implementation, this would use a vector similarity algorithm
    // For now, we'll simulate semantic matching based on tags and content
    
    // Generate a simple embedding for the query (in real implementation, use proper embedding model)
    const queryEmbedding = this.generateSimpleEmbedding(queryText);
    
    const scoredCandidates = candidates.map(chunk => {
      let score = 0;
      
      // Score based on embedding similarity (simulated)
      if (chunk.embedding) {
        score += this.calculateCosineSimilarity(queryEmbedding, chunk.embedding);
      }
      
      // Score based on content matching
      if (chunk.content.toLowerCase().includes(queryText.toLowerCase())) {
        score += 0.5;
      }
      
      // Score based on tag matching
      const queryWords = queryText.toLowerCase().split(/\s+/);
      const matchingTags = chunk.metadata.tags.filter(tag => 
        queryWords.some(word => tag.toLowerCase().includes(word))
      );
      score += matchingTags.length * 0.2;
      
      return { chunk, score };
    });
    
    // Sort by score (descending)
    scoredCandidates.sort((a, b) => b.score - a.score);
    
    // Return top results
    const topResults = scoredCandidates.map(item => item.chunk);
    return maxResults ? topResults.slice(0, maxResults) : topResults;
  }

  /**
   * Generate a simple embedding for text (for simulation purposes)
   */
  private generateSimpleEmbedding(text: string): number[] {
    // This is a very simplified embedding for demonstration
    // In a real implementation, use a proper embedding model
    const embedding: number[] = new Array(16).fill(0);
    const lowerText = text.toLowerCase();
    
    for (let i = 0; i < lowerText.length; i++) {
      const charCode = lowerText.charCodeAt(i);
      embedding[i % 16] += charCode / 1000;
    }
    
    // Normalize the embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude || 0);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;
    
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      magnitudeA += vecA[i] * vecA[i];
      magnitudeB += vecB[i] * vecB[i];
    }
    
    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);
    
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    
    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Consolidate memory by merging related chunks and removing low-importance ones
   */
  async consolidateMemory(): Promise<MemoryConsolidationResult> {
    const chunks = Array.from(this.memoryChunks.values());
    
    // Identify chunks with low importance for potential removal
    const lowImportanceChunks = chunks.filter(chunk => 
      chunk.metadata.importance < this.consolidationThreshold
    );
    
    // Identify related chunks that could be consolidated
    const consolidationGroups: MemoryChunk[][] = [];
    
    // Group chunks by context and semantic similarity
    const contextGroups = new Map<string, MemoryChunk[]>();
    for (const chunk of chunks) {
      if (!contextGroups.has(chunk.metadata.context)) {
        contextGroups.set(chunk.metadata.context, []);
      }
      contextGroups.get(chunk.metadata.context)!.push(chunk);
    }
    
    for (const [, group] of contextGroups) {
      if (group.length > 1) {
        consolidationGroups.push(group);
      }
    }
    
    const consolidatedChunks: MemoryChunk[] = [];
    const removedChunks: string[] = [];
    
    // Process each group for consolidation
    for (const group of consolidationGroups) {
      if (group.length <= 1) continue;
      
      // Find the most important chunk in the group to preserve
      const mostImportant = group.reduce((prev, current) => 
        prev.metadata.importance > current.metadata.importance ? prev : current
      );
      
      // Combine content of related chunks
      const combinedContent = group.map(c => c.content).join('\n\n');
      
      // Create a consolidated chunk
      const consolidatedChunk: MemoryChunk = {
        ...mostImportant,
        content: combinedContent,
        metadata: {
          ...mostImportant.metadata,
          importance: Math.min(1.0, mostImportant.metadata.importance + 0.1) // Boost importance slightly
        }
      };
      
      consolidatedChunks.push(consolidatedChunk);
      
      // Mark other chunks in the group for removal (except the most important one)
      for (const chunk of group) {
        if (chunk.id !== mostImportant.id) {
          removedChunks.push(chunk.id);
          this.memoryChunks.delete(chunk.id);
        }
      }
    }
    
    // Remove low importance chunks that weren't in consolidation groups
    for (const chunk of lowImportanceChunks) {
      if (!removedChunks.includes(chunk.id)) {
        removedChunks.push(chunk.id);
        this.memoryChunks.delete(chunk.id);
      }
    }
    
    const summary = `Consolidated ${removedChunks.length} low-importance chunks into ${consolidatedChunks.length} consolidated chunks`;
    
    return {
      consolidatedChunks,
      removedChunks,
      summary
    };
  }

  /**
   * Create a cross-session memory link
   */
  async createCrossSessionLink(sourceSession: string, targetSession: string, linkType: CrossSessionLink['linkType'], relevanceScore: number): Promise<string> {
    const linkId = `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const link: CrossSessionLink = {
      id: linkId,
      sourceSession,
      targetSession,
      linkType,
      relevanceScore
    };
    
    this.crossSessionLinks.set(linkId, link);
    return linkId;
  }

  /**
   * Get memories from related sessions
   */
  async getRelatedSessionMemories(sessionId: string, maxResults: number = 5): Promise<MemoryChunk[]> {
    // Find links where this session is the source or target
    const relatedLinks = Array.from(this.crossSessionLinks.values()).filter(
      link => link.sourceSession === sessionId || link.targetSession === sessionId
    );
    
    // Get the related session IDs
    const relatedSessionIds = Array.from(new Set(
      relatedLinks.map(link => 
        link.sourceSession === sessionId ? link.targetSession : link.sourceSession
      )
    ));
    
    // Retrieve memories from related sessions
    const relatedMemories: MemoryChunk[] = [];
    for (const relatedSessionId of relatedSessionIds) {
      const sessionMemories = Array.from(this.memoryChunks.values()).filter(
        chunk => chunk.metadata.context === relatedSessionId
      );
      
      // Sort by importance and take top results
      sessionMemories.sort((a, b) => b.metadata.importance - a.metadata.importance);
      relatedMemories.push(...sessionMemories.slice(0, Math.floor(maxResults / relatedSessionIds.length)));
    }
    
    // Sort by relevance score based on cross-session links
    relatedMemories.sort((a, b) => {
      const aLink = Array.from(this.crossSessionLinks.values()).find(
        link => (link.sourceSession === sessionId && link.targetSession === a.metadata.context) ||
                (link.targetSession === sessionId && link.sourceSession === a.metadata.context)
      );
      
      const bLink = Array.from(this.crossSessionLinks.values()).find(
        link => (link.sourceSession === sessionId && link.targetSession === b.metadata.context) ||
                (link.targetSession === sessionId && link.sourceSession === b.metadata.context)
      );
      
      return (bLink?.relevanceScore || 0) - (aLink?.relevanceScore || 0);
    });
    
    return relatedMemories.slice(0, maxResults);
  }

  /**
   * Update memory chunk importance based on usage
   */
  async updateImportance(chunkId: string, newImportance: number): Promise<void> {
    const chunk = this.memoryChunks.get(chunkId);
    if (chunk) {
      chunk.metadata.importance = Math.max(0, Math.min(1, newImportance)); // Clamp between 0 and 1
      this.memoryChunks.set(chunkId, chunk);
    }
  }

  /**
   * Get memory statistics
   */
  getMemoryStats(): {
    totalChunks: number;
    totalPersistent: number;
    totalWorking: number;
    totalLongTerm: number;
    totalTransient: number;
    averageImportance: number;
    oldestTimestamp: number;
    newestTimestamp: number;
  } {
    const chunks = Array.from(this.memoryChunks.values());
    
    if (chunks.length === 0) {
      return {
        totalChunks: 0,
        totalPersistent: 0,
        totalWorking: 0,
        totalLongTerm: 0,
        totalTransient: 0,
        averageImportance: 0,
        oldestTimestamp: 0,
        newestTimestamp: 0
      };
    }
    
    const persistent = chunks.filter(c => c.metadata.type === 'persistent').length;
    const working = chunks.filter(c => c.metadata.type === 'working').length;
    const longTerm = chunks.filter(c => c.metadata.type === 'longterm').length;
    const transient = chunks.filter(c => c.metadata.type === 'transient').length;
    
    const totalImportance = chunks.reduce((sum, chunk) => sum + chunk.metadata.importance, 0);
    const avgImportance = totalImportance / chunks.length;
    
    const timestamps = chunks.map(c => c.metadata.timestamp);
    const oldest = Math.min(...timestamps);
    const newest = Math.max(...timestamps);
    
    return {
      totalChunks: chunks.length,
      totalPersistent: persistent,
      totalWorking: working,
      totalLongTerm: longTerm,
      totalTransient: transient,
      averageImportance: avgImportance,
      oldestTimestamp: oldest,
      newestTimestamp: newest
    };
  }

  /**
   * Clear all memory (for testing purposes)
   */
  clear(): void {
    this.memoryChunks.clear();
    this.semanticIndex.clear();
    this.crossSessionLinks.clear();
  }
}

// Global memory fabric instance
const globalMemoryFabric = new MemoryFabric();

export { globalMemoryFabric };
