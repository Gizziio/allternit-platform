/**
 * Knowledge Graph Layer
 * 
 * Extracts entities and relationships from memories
 * to build a queryable knowledge graph
 */

import { LocalModelManager } from '../models/local-model.js';
import type { Memory } from '../types/memory.types.js';

export interface Entity {
  id: string;
  name: string;
  type: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  description?: string;
  strength: number;
  metadata?: Record<string, unknown>;
}

export interface GraphQuery {
  sourceEntityId?: string;
  targetEntityId?: string;
  relationshipType?: string;
  maxDepth?: number;
}

export interface SubGraph {
  entities: Entity[];
  relationships: Relationship[];
}

/**
 * Knowledge Graph Manager
 */
export class KnowledgeGraph {
  private entities: Map<string, Entity> = new Map();
  private relationships: Map<string, Relationship> = new Map();
  private modelManager?: LocalModelManager;

  constructor(modelManager?: LocalModelManager) {
    this.modelManager = modelManager;
  }

  /**
   * Add entity to graph
   */
  addEntity(entity: Entity): void {
    this.entities.set(entity.id, entity);
  }

  /**
   * Add relationship to graph
   */
  addRelationship(relationship: Relationship): void {
    this.relationships.set(relationship.id, relationship);
  }

  /**
   * Extract entities and relationships from memory using LLM
   */
  async extractFromMemory(memory: Memory): Promise<{ entities: Entity[]; relationships: Relationship[] }> {
    if (!this.modelManager) {
      return { entities: [], relationships: [] };
    }

    const schema = `{
  "entities": [
    {
      "id": "unique_id",
      "name": "Entity name",
      "type": "person|organization|concept|tool|task|etc",
      "description": "Brief description"
    }
  ],
  "relationships": [
    {
      "sourceId": "entity_id",
      "targetId": "entity_id",
      "type": "uses|creates|depends_on|relates_to|etc",
      "description": "Relationship description",
      "strength": 0.0-1.0
    }
  ]
}`;

    const prompt = `Extract entities and relationships from this text:

${memory.content}

Return your analysis as JSON according to this schema:
${schema}`;

    try {
      const result = await this.modelManager.extractStructured<{
        entities: Array<{ id: string; name: string; type: string; description?: string }>;
        relationships: Array<{
          sourceId: string;
          targetId: string;
          type: string;
          description?: string;
          strength: number;
        }>;
      }>(prompt, schema);

      if (!result) {
        return { entities: [], relationships: [] };
      }

      // Add to graph
      for (const entity of result.entities) {
        this.addEntity({
          ...entity,
          metadata: { sourceMemoryId: memory.id },
        });
      }

      for (const rel of result.relationships) {
        this.addRelationship({
          ...rel,
          id: `${rel.sourceId}_${rel.type}_${rel.targetId}`,
          metadata: { sourceMemoryId: memory.id },
        });
      }

      return {
        entities: result.entities.map(e => ({
          ...e,
          metadata: { sourceMemoryId: memory.id },
        })),
        relationships: result.relationships.map(r => ({
          ...r,
          id: `${r.sourceId}_${r.type}_${r.targetId}`,
          metadata: { sourceMemoryId: memory.id },
        })),
      };
    } catch (error) {
      console.error('Error extracting graph:', error);
      return { entities: [], relationships: [] };
    }
  }

  /**
   * Query graph by entity
   */
  queryByEntity(entityId: string, maxDepth: number = 2): SubGraph {
    const resultEntities = new Map<string, Entity>();
    const resultRelationships = new Map<string, Relationship>();

    // BFS to find connected entities
    const queue: Array<{ entityId: string; depth: number }> = [{ entityId, depth: 0 }];
    const visited = new Set<string>();

    while (queue.length > 0 && queue[0].depth <= maxDepth) {
      const { entityId: currentId, depth } = queue.shift()!;
      
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const entity = this.entities.get(currentId);
      if (entity) {
        resultEntities.set(currentId, entity);
      }

      // Find relationships involving this entity
      for (const rel of this.relationships.values()) {
        if (rel.sourceId === currentId || rel.targetId === currentId) {
          resultRelationships.set(rel.id, rel);

          // Add connected entity to queue
          const otherId = rel.sourceId === currentId ? rel.targetId : rel.sourceId;
          if (!visited.has(otherId) && depth < maxDepth) {
            queue.push({ entityId: otherId, depth: depth + 1 });
          }
        }
      }
    }

    return {
      entities: Array.from(resultEntities.values()),
      relationships: Array.from(resultRelationships.values()),
    };
  }

  /**
   * Find paths between two entities
   */
  findPaths(sourceId: string, targetId: string, maxLength: number = 5): Array<Relationship[]> {
    const paths: Array<Relationship[]> = [];
    const queue: Array<{ currentId: string; path: Relationship[] }> = [
      { currentId: sourceId, path: [] }
    ];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { currentId, path } = queue.shift()!;

      if (currentId === targetId && path.length > 0) {
        paths.push(path);
        continue;
      }

      if (path.length >= maxLength) continue;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      // Find relationships from current entity
      for (const rel of this.relationships.values()) {
        if (rel.sourceId === currentId) {
          queue.push({
            currentId: rel.targetId,
            path: [...path, rel],
          });
        }
      }
    }

    return paths;
  }

  /**
   * Get graph statistics
   */
  getStats(): { entityCount: number; relationshipCount: number } {
    return {
      entityCount: this.entities.size,
      relationshipCount: this.relationships.size,
    };
  }

  /**
   * Clear the graph
   */
  clear(): void {
    this.entities.clear();
    this.relationships.clear();
  }

  /**
   * Export graph as JSON
   */
  toJSON(): { entities: Entity[]; relationships: Relationship[] } {
    return {
      entities: Array.from(this.entities.values()),
      relationships: Array.from(this.relationships.values()),
    };
  }
}
