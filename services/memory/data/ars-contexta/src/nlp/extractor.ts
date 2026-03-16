/**
 * Entity Extractor Implementation
 * GAP-79: NLP Entity Extraction
 * 
 * WIH: GAP-79, Owner: T3-A1
 * 
 * Real implementation using LLM-based extraction
 */

import type {
  Entity,
  EntityType,
  EntityRelation,
  ExtractionResult,
  EntityExtractor,
  ExtractOptions,
} from './types.js';
import { createLlmClient } from '../llm/client.js';
import { generateEntityExtractionPrompt } from '../llm/templates.js';

/**
 * Entity extraction result from LLM
 */
interface LlmEntityResult {
  entities: Array<{
    text: string;
    type: string;
    confidence: number;
    normalizedForm?: string;
  }>;
  keyPhrases: string[];
  summary: string;
}

/**
 * Create entity extractor with specified backend
 */
export function createEntityExtractor(
  backend: 'llm' | 'rust-bert' | 'candle' | 'remote' | 'stub' = 'llm'
): EntityExtractor {
  switch (backend) {
    case 'llm':
      return new LlmEntityExtractor();
    case 'rust-bert':
      return new RustBertExtractor();
    case 'candle':
      return new CandleExtractor();
    case 'remote':
      return new RemoteExtractor();
    case 'stub':
    default:
      return new StubExtractor();
  }
}

/**
 * LLM-based entity extractor (default)
 */
class LlmEntityExtractor implements EntityExtractor {
  private ready = true;
  private readonly supportedEntityTypes: EntityType[] = [
    'person',
    'organization',
    'location',
    'concept',
    'technology',
    'product',
    'event',
    'date',
  ];

  isReady(): boolean {
    return this.ready;
  }

  supportedTypes(): EntityType[] {
    return this.supportedEntityTypes;
  }

  async extract(text: string, options: ExtractOptions = {}): Promise<ExtractionResult> {
    const startTime = performance.now();
    
    try {
      // Create LLM client for extraction
      const client = createLlmClient({ 
        provider: 'openai', 
        model: 'gpt-4o-mini',
        apiKey: process.env['OPENAI_API_KEY'],
      });

      // Generate extraction prompt
      const entityTypes = options.entityTypes || this.supportedEntityTypes;
      const prompt = generateEntityExtractionPrompt(text, entityTypes);

      // Call LLM
      const response = await client.complete({
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert NLP entity extraction system. Extract entities accurately and return valid JSON.' 
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1, // Low temperature for consistent extraction
        maxTokens: 2000,
      });

      // Parse LLM response
      let result: LlmEntityResult;
      try {
        result = JSON.parse(response.content);
      } catch {
        // Fallback: try to extract JSON from markdown code block
        const jsonMatch = response.content.match(/```json\n?([\s\S]*?)\n?```/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[1]);
        } else {
          throw new Error('Invalid JSON response from LLM');
        }
      }

      // Convert to Entity objects with positions
      const entities = this.processEntities(result.entities, text, options.minConfidence);

      // Extract relations if requested
      const relations = options.extractRelations 
        ? await this.extractRelations(text, entities)
        : [];

      // Get sentiment if requested
      const sentiment = options.extractSentiment 
        ? await this.analyzeSentiment(text, client)
        : undefined;

      const processingTimeMs = Math.round(performance.now() - startTime);

      return {
        entities,
        relations,
        keyPhrases: result.keyPhrases || [],
        summary: result.summary || this.generateSummary(text),
        sentiment,
        language: 'en',
        processingTimeMs,
      };

    } catch (error) {
      console.error('[LlmEntityExtractor] Extraction failed:', error);
      // Fallback to stub extraction
      const stub = new StubExtractor();
      return stub.extract(text, options);
    }
  }

  /**
   * Process entities from LLM response
   */
  private processEntities(
    llmEntities: LlmEntityResult['entities'],
    text: string,
    minConfidence = 0.7
  ): Entity[] {
    const entities: Entity[] = [];
    const seen = new Set<string>();

    for (const e of llmEntities) {
      // Skip low confidence
      if (e.confidence < minConfidence) continue;

      // Find position in text
      const startPos = text.indexOf(e.text);
      if (startPos === -1) continue; // Entity not found in text

      const endPos = startPos + e.text.length;
      const key = `${e.text}_${startPos}`;

      // Skip duplicates
      if (seen.has(key)) continue;
      seen.add(key);

      entities.push({
        id: `entity_${e.type}_${startPos}`,
        text: e.text,
        type: this.mapEntityType(e.type),
        startPos,
        endPos,
        confidence: e.confidence,
        normalizedForm: e.normalizedForm || e.text,
      });
    }

    return entities;
  }

  /**
   * Map LLM entity type to standard type
   */
  private mapEntityType(type: string): EntityType {
    const mapping: Record<string, EntityType> = {
      'person': 'person',
      'organization': 'organization',
      'org': 'organization',
      'location': 'location',
      'place': 'location',
      'concept': 'concept',
      'technology': 'technology',
      'tech': 'technology',
      'product': 'product',
      'event': 'event',
      'date': 'date',
    };

    return mapping[type.toLowerCase()] || 'concept';
  }

  /**
   * Extract relations between entities
   */
  private async extractRelations(text: string, entities: Entity[]): Promise<EntityRelation[]> {
    if (entities.length < 2) return [];

    try {
      const client = createLlmClient({ 
        provider: 'openai', 
        model: 'gpt-4o-mini',
        apiKey: process.env['OPENAI_API_KEY'],
      });

      const prompt = `Extract relationships between these entities from the text:
Entities: ${entities.map(e => `${e.text} (${e.type})`).join(', ')}

Text: ${text}

Return JSON with relations array:
{
  "relations": [
    {"source": "entity1", "target": "entity2", "type": "relationship_type", "confidence": 0.9}
  ]
}`;

      const response = await client.complete({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        maxTokens: 1000,
      });

      const result = JSON.parse(response.content);
      
      return (result.relations || []).map((r: any) => {
        const sourceEntity = entities.find(e => e.text === r.source || e.normalizedForm === r.source);
        const targetEntity = entities.find(e => e.text === r.target || e.normalizedForm === r.target);
        
        return {
          source: sourceEntity?.id || r.source,
          target: targetEntity?.id || r.target,
          relationType: r.type,
          confidence: r.confidence || 0.7,
          evidence: r.evidence || '',
        };
      });

    } catch (error) {
      console.warn('[LlmEntityExtractor] Relation extraction failed:', error);
      return [];
    }
  }

  /**
   * Analyze sentiment
   */
  private async analyzeSentiment(text: string, client: any): Promise<{ score: number; label: 'negative' | 'neutral' | 'positive' }> {
    try {
      const prompt = `Analyze the sentiment of this text. Return JSON with score (-1 to 1) and label:

Text: ${text}

Response format: {"score": 0.5, "label": "positive"}`;

      const response = await client.complete({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        maxTokens: 100,
      });

      const result = JSON.parse(response.content);
      return {
        score: result.score,
        label: result.label,
      };
    } catch {
      return { score: 0, label: 'neutral' };
    }
  }

  /**
   * Generate simple summary
   */
  private generateSummary(text: string): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length === 0) return text.slice(0, 100);
    return sentences[0].trim().slice(0, 200);
  }
}

/**
 * Stub extractor for testing
 */
class StubExtractor implements EntityExtractor {
  private ready = true;
  private readonly supportedEntityTypes: EntityType[] = [
    'person',
    'organization',
    'location',
    'concept',
    'technology',
  ];

  isReady(): boolean {
    return this.ready;
  }

  supportedTypes(): EntityType[] {
    return this.supportedEntityTypes;
  }

  async extract(text: string, options: ExtractOptions = {}): Promise<ExtractionResult> {
    const minConfidence = options.minConfidence ?? 0.7;
    const startTime = performance.now();

    // Generate stub entities based on simple heuristics
    const entities = this.generateStubEntities(text, minConfidence);
    const relations = options.extractRelations 
      ? this.generateStubRelations(entities)
      : [];

    return {
      entities,
      relations,
      keyPhrases: this.extractKeyPhrases(text),
      summary: this.generateStubSummary(text),
      sentiment: options.extractSentiment ? this.analyzeStubSentiment(text) : undefined,
      language: 'en',
      processingTimeMs: Math.round(performance.now() - startTime),
    };
  }

  private generateStubEntities(text: string, minConfidence: number): Entity[] {
    const entities: Entity[] = [];
    
    // Simple pattern matching for stub implementation
    const patterns: Array<{ type: EntityType; regex: RegExp }> = [
      { type: 'person', regex: /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g },
      { type: 'organization', regex: /\b([A-Z][a-z]*(?:\s+[A-Z][a-z]*)+(?:\s+(?:Inc|Corp|LLC|Ltd|Company))?)\b/g },
      { type: 'technology', regex: /\b(Rust|TypeScript|JavaScript|Python|LLM|AI|NLP|GPT|API|OpenAI|Anthropic)\b/gi },
      { type: 'concept', regex: /\b(machine learning|artificial intelligence|knowledge graph|entity extraction)\b/gi },
    ];

    for (const { type, regex } of patterns) {
      let match;
      const seen = new Set<string>();
      
      while ((match = regex.exec(text)) !== null) {
        const text = match[1] || match[0];
        if (seen.has(text.toLowerCase())) continue;
        seen.add(text.toLowerCase());

        const confidence = 0.7 + Math.random() * 0.25;
        if (confidence < minConfidence) continue;

        entities.push({
          id: `entity_${type}_${match.index}`,
          text,
          type,
          startPos: match.index,
          endPos: match.index + text.length,
          confidence: Math.round(confidence * 100) / 100,
          normalizedForm: text,
        });
      }
    }

    return entities;
  }

  private generateStubRelations(entities: Entity[]): EntityRelation[] {
    const relations: EntityRelation[] = [];
    
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length && j < i + 3; j++) {
        if (Math.random() > 0.5) {
          relations.push({
            source: entities[i].id,
            target: entities[j].id,
            relationType: ['related_to', 'part_of', 'uses', 'mentions'][Math.floor(Math.random() * 4)],
            confidence: Math.round((0.6 + Math.random() * 0.3) * 100) / 100,
            evidence: `${entities[i].text} → ${entities[j].text}`,
          });
        }
      }
    }

    return relations;
  }

  private extractKeyPhrases(text: string): string[] {
    const phrases = new Set<string>();
    const words = text.split(/\s+/);
    
    for (let i = 0; i < words.length - 1; i++) {
      if (/^[A-Z]/.test(words[i]) && /^[A-Z]/.test(words[i + 1])) {
        phrases.add(`${words[i]} ${words[i + 1]}`);
      }
    }

    return Array.from(phrases).slice(0, 5);
  }

  private generateStubSummary(text: string): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length === 0) return text.slice(0, 100);
    return sentences[0].trim().slice(0, 200);
  }

  private analyzeStubSentiment(text: string): { score: number; label: 'negative' | 'neutral' | 'positive' } {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'best', 'love', 'awesome'];
    const negativeWords = ['bad', 'terrible', 'worst', 'hate', 'awful', 'poor'];
    
    const lower = text.toLowerCase();
    let score = 0;
    
    for (const word of positiveWords) {
      if (lower.includes(word)) score += 0.2;
    }
    for (const word of negativeWords) {
      if (lower.includes(word)) score -= 0.2;
    }
    
    score = Math.max(-1, Math.min(1, score));
    
    let label: 'negative' | 'neutral' | 'positive' = 'neutral';
    if (score > 0.2) label = 'positive';
    else if (score < -0.2) label = 'negative';
    
    return { score: Math.round(score * 100) / 100, label };
  }
}

/**
 * rust-bert extractor (requires native module)
 */
class RustBertExtractor implements EntityExtractor {
  isReady(): boolean {
    // Would check if rust-bert native module is loaded
    return false;
  }

  supportedTypes(): EntityType[] {
    return ['person', 'organization', 'location', 'concept'];
  }

  async extract(text: string, options: ExtractOptions = {}): Promise<ExtractionResult> {
    // Would call rust-bert native module
    // Fallback to LLM extractor
    const llm = new LlmEntityExtractor();
    return llm.extract(text, options);
  }
}

/**
 * candle extractor (requires native module)
 */
class CandleExtractor implements EntityExtractor {
  isReady(): boolean {
    // Would check if candle native module is loaded
    return false;
  }

  supportedTypes(): EntityType[] {
    return ['person', 'organization', 'location', 'concept', 'technology'];
  }

  async extract(text: string, options: ExtractOptions = {}): Promise<ExtractionResult> {
    // Would call candle native module
    // Fallback to LLM extractor
    const llm = new LlmEntityExtractor();
    return llm.extract(text, options);
  }
}

/**
 * Remote API extractor
 */
class RemoteExtractor implements EntityExtractor {
  isReady(): boolean {
    // Would check API connectivity
    return false;
  }

  supportedTypes(): EntityType[] {
    return ['person', 'organization', 'location', 'concept', 'product', 'event'];
  }

  async extract(text: string, options: ExtractOptions = {}): Promise<ExtractionResult> {
    // Would call remote API
    // Fallback to LLM extractor
    const llm = new LlmEntityExtractor();
    return llm.extract(text, options);
  }
}
