/**
 * 6Rs Processing Pipeline
 * GAP-78/GAP-79: Knowledge Processing Pipeline
 * 
 * The 6Rs: Record, Reduce, Reflect, Reweave, Verify, Rethink
 * 
 * WIH: GAP-78/GAP-79, Agent: T3-A2
 * Coordinates with: T3-A1 (LLM/NLP), T3-A3 (Claims Graph)
 */

import type { 
  Insight, 
  Entity, 
  EntityRelation, 
  ExtractionResult,
  PipelineInput, 
  PipelineOutput,
  Note,
  NoteLink 
} from '../types.js';
import { createLlmClient } from '../llm/client.js';
import { generateInsightPrompt, generateSummarizationPrompt } from '../llm/templates.js';
import { createEntityExtractor } from '../nlp/extractor.js';

/**
 * 6Rs Pipeline Configuration
 */
export interface PipelineConfig {
  llmProvider?: 'openai' | 'anthropic' | 'local' | 'terminal';
  llmModel?: string;
  nlpBackend?: 'llm' | 'rust-bert' | 'candle' | 'stub';
  enableVerification?: boolean;
  minConfidence?: number;
  maxInsights?: number;
  extractEntities?: boolean;
  generateLinks?: boolean;
}

/**
 * Pipeline phase result
 */
export interface PhaseResult<T> {
  phase: string;
  data: T;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

/**
 * 6Rs Pipeline Implementation
 */
export class SixRsPipeline {
  private config: PipelineConfig;
  private phaseHistory: PhaseResult<unknown>[] = [];

  constructor(config: PipelineConfig = {}) {
    this.config = {
      llmProvider: 'openai',
      llmModel: 'gpt-4o-mini',
      nlpBackend: 'llm',
      enableVerification: true,
      minConfidence: 0.7,
      maxInsights: 5,
      extractEntities: true,
      generateLinks: true,
      ...config,
    };
  }

  /**
   * Execute full 6Rs pipeline
   */
  async process(input: PipelineInput): Promise<PipelineOutput> {
    const startTime = Date.now();
    this.phaseHistory = [];

    // Phase 1: Record - Capture raw input
    const recorded = await this.record(input);

    // Phase 2: Reduce - Summarize and distill
    const reduced = await this.reduce(recorded);

    // Phase 3: Reflect - Generate insights (uses T3-A1 LLM)
    const reflected = await this.reflect(reduced, input);

    // Phase 4: Reweave - Link to existing knowledge
    const reweaved = await this.reweave(reflected);

    // Phase 5: Verify - Validate against research claims (uses T3-A3)
    const verified = await this.verify(reweaved);

    // Phase 6: Rethink - Create notes and final output
    const output = await this.rethink(verified, input);

    console.log(`[6RsPipeline] Completed in ${Date.now() - startTime}ms`);
    
    return output;
  }

  /**
   * Phase 1: Record
   * Capture and validate raw input
   */
  private async record(input: PipelineInput): Promise<PhaseResult<string>> {
    const start = Date.now();
    
    // Validate and clean input
    const content = input.rawContent.trim();
    
    if (content.length === 0) {
      throw new Error('Pipeline input cannot be empty');
    }

    const result: PhaseResult<string> = {
      phase: 'record',
      data: content,
      durationMs: Date.now() - start,
      metadata: {
        source: input.source,
        timestamp: input.timestamp,
        contentLength: content.length,
      },
    };

    this.phaseHistory.push(result);
    return result;
  }

  /**
   * Phase 2: Reduce
   * Summarize and distill key points
   */
  private async reduce(recorded: PhaseResult<string>): Promise<PhaseResult<string>> {
    const start = Date.now();
    
    const content = recorded.data;
    
    // If content is short, no need to reduce
    if (content.length < 500) {
      const result: PhaseResult<string> = {
        phase: 'reduce',
        data: content,
        durationMs: Date.now() - start,
        metadata: { skipped: true, reason: 'content too short' },
      };
      this.phaseHistory.push(result);
      return result;
    }

    try {
      // Use LLM for summarization
      const client = createLlmClient({
        provider: this.config.llmProvider!,
        model: this.config.llmModel,
        apiKey: process.env['OPENAI_API_KEY'] || process.env['ANTHROPIC_API_KEY'],
      });

      const prompt = generateSummarizationPrompt(content, 'brief');
      
      const response = await client.complete({
        messages: [
          { role: 'system', content: 'Summarize content concisely.' },
          { role: 'user', content: prompt },
        ],
        maxTokens: 500,
        temperature: 0.3,
      });

      const summary = response.content.trim();

      const result: PhaseResult<string> = {
        phase: 'reduce',
        data: summary,
        durationMs: Date.now() - start,
        metadata: {
          originalLength: content.length,
          summaryLength: summary.length,
          compressionRatio: (summary.length / content.length).toFixed(2),
        },
      };

      this.phaseHistory.push(result);
      return result;

    } catch (error) {
      console.warn('[6RsPipeline] Reduce failed, using original:', error);
      
      const result: PhaseResult<string> = {
        phase: 'reduce',
        data: content,
        durationMs: Date.now() - start,
        metadata: { error: true, fallback: 'original' },
      };

      this.phaseHistory.push(result);
      return result;
    }
  }

  /**
   * Phase 3: Reflect
   * Generate insights using LLM and extract entities using NLP
   */
  private async reflect(
    reduced: PhaseResult<string>,
    input: PipelineInput
  ): Promise<PhaseResult<{ content: string; insights: Insight[]; entities: Entity[]; relations: EntityRelation[] }>> {
    const start = Date.now();
    
    const content = reduced.data;
    let insights: Insight[] = [];
    let entities: Entity[] = [];
    let relations: EntityRelation[] = [];

    // Generate insights using LLM
    try {
      const client = createLlmClient({
        provider: this.config.llmProvider!,
        model: this.config.llmModel,
        apiKey: process.env['OPENAI_API_KEY'] || process.env['ANTHROPIC_API_KEY'],
      });

      const prompt = generateInsightPrompt({
        content,
        context: input.metadata?.context as string[],
        maxInsights: this.config.maxInsights,
        minConfidence: this.config.minConfidence,
      });

      const response = await client.complete({
        messages: [
          { role: 'system', content: 'You are an expert knowledge analyst.' },
          { role: 'user', content: prompt },
        ],
        maxTokens: 1500,
        temperature: 0.5,
      });

      // Parse insights from LLM response
      try {
        const parsed = JSON.parse(response.content);
        insights = (parsed.insights || []).map((i: any, idx: number) => ({
          id: `insight_${Date.now()}_${idx}`,
          type: i.type || 'pattern',
          description: i.description,
          confidence: i.confidence || 0.7,
          relatedNotes: i.relatedNotes || [],
          source: 'llm',
          timestamp: new Date().toISOString(),
          metadata: { phase: 'reflect' },
        }));
      } catch {
        // If parsing fails, create a single insight from the response
        insights = [{
          id: `insight_${Date.now()}`,
          type: 'pattern',
          description: response.content.slice(0, 200),
          confidence: 0.7,
          relatedNotes: [],
          source: 'llm',
          timestamp: new Date().toISOString(),
        }];
      }
    } catch (error) {
      console.warn('[6RsPipeline] Insight generation failed:', error);
    }

    // Extract entities using NLP
    if (this.config.extractEntities) {
      try {
        const extractor = createEntityExtractor(this.config.nlpBackend);
        const extractionResult = await extractor.extract(content, {
          extractRelations: true,
          extractSentiment: false,
          minConfidence: this.config.minConfidence,
        });

        entities = extractionResult.entities;
        relations = extractionResult.relations;
      } catch (error) {
        console.warn('[6RsPipeline] Entity extraction failed:', error);
      }
    }

    const result: PhaseResult<{ content: string; insights: Insight[]; entities: Entity[]; relations: EntityRelation[] }> = {
      phase: 'reflect',
      data: { content, insights, entities, relations },
      durationMs: Date.now() - start,
      metadata: {
        insightCount: insights.length,
        entityCount: entities.length,
        relationCount: relations.length,
      },
    };

    this.phaseHistory.push(result);
    return result;
  }

  /**
   * Phase 4: Reweave
   * Link to existing knowledge
   */
  private async reflect(
    reflected: PhaseResult<{ content: string; insights: Insight[]; entities: Entity[]; relations: EntityRelation[] }>
  ): Promise<PhaseResult<{ content: string; insights: Insight[]; entities: Entity[]; relations: EntityRelation[]; links: NoteLink[] }>> {
    const start = Date.now();
    
    const { content, insights, entities, relations } = reflected.data;
    let links: NoteLink[] = [];

    if (this.config.generateLinks) {
      // Generate links based on entity mentions and insights
      // This would integrate with existing knowledge graph
      // For now, generate placeholder links
      
      for (const entity of entities) {
        links.push({
          source: 'new',
          target: `entity:${entity.normalizedForm || entity.text}`,
          type: 'reference',
          strength: entity.confidence,
        });
      }

      // Link insights to content themes
      for (const insight of insights) {
        if (insight.confidence > 0.8) {
          links.push({
            source: 'new',
            target: `insight:${insight.type}`,
            type: 'extends',
            strength: insight.confidence,
          });
        }
      }
    }

    const result: PhaseResult<{ content: string; insights: Insight[]; entities: Entity[]; relations: EntityRelation[]; links: NoteLink[] }> = {
      phase: 'reweave',
      data: { content, insights, entities, relations, links },
      durationMs: Date.now() - start,
      metadata: { linkCount: links.length },
    };

    this.phaseHistory.push(result);
    return result;
  }

  /**
   * Phase 5: Verify
   * Validate against research claims (T3-A3 integration)
   */
  private async verify(
    reweaved: PhaseResult<{ content: string; insights: Insight[]; entities: Entity[]; relations: EntityRelation[]; links: NoteLink[] }>
  ): Promise<PhaseResult<{ content: string; insights: Insight[]; entities: Entity[]; relations: EntityRelation[]; links: NoteLink[]; verified: boolean }>> {
    const start = Date.now();
    
    const data = reweaved.data;
    let verified = true;

    if (this.config.enableVerification) {
      // TODO: Integrate with T3-A3 Claims Graph
      // For now, basic validation
      
      // Check for contradictions in insights
      const contradictions = data.insights.filter(i => i.type === 'contradiction');
      if (contradictions.length > 0) {
        verified = false;
        console.warn('[6RsPipeline] Verification found contradictions:', contradictions);
      }

      // Check entity confidence
      const lowConfidenceEntities = data.entities.filter(e => e.confidence < 0.5);
      if (lowConfidenceEntities.length > 0) {
        console.warn('[6RsPipeline] Low confidence entities:', lowConfidenceEntities);
      }
    }

    const result: PhaseResult<{ content: string; insights: Insight[]; entities: Entity[]; relations: EntityRelation[]; links: NoteLink[]; verified: boolean }> = {
      phase: 'verify',
      data: { ...data, verified },
      durationMs: Date.now() - start,
      metadata: { verified, issues: verified ? 0 : 'found' },
    };

    this.phaseHistory.push(result);
    return result;
  }

  /**
   * Phase 6: Rethink
   * Create final notes and output
   */
  private async rethink(
    verified: PhaseResult<{ content: string; insights: Insight[]; entities: Entity[]; relations: EntityRelation[]; links: NoteLink[]; verified: boolean }>,
    input: PipelineInput
  ): Promise<PipelineOutput> {
    const start = Date.now();
    
    const data = verified.data;
    const timestamp = new Date().toISOString();

    // Create main note
    const mainNote: Note = {
      id: `note_${Date.now()}`,
      title: this.generateTitle(data.content),
      content: data.content,
      tags: this.generateTags(data.entities, data.insights),
      links: data.links.map(l => l.target),
      createdAt: timestamp,
      updatedAt: timestamp,
      accessCount: 0,
      confidence: data.verified ? 0.9 : 0.7,
    };

    // Create entity notes
    const entityNotes: Note[] = data.entities.map((entity, idx) => ({
      id: `entity_note_${Date.now()}_${idx}`,
      title: entity.normalizedForm || entity.text,
      content: `Entity of type ${entity.type}: ${entity.text}`,
      tags: [entity.type, 'entity'],
      links: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      accessCount: 0,
      confidence: entity.confidence,
    }));

    const result: PhaseResult<PipelineOutput> = {
      phase: 'rethink',
      data: {
        notes: [mainNote, ...entityNotes],
        links: data.links,
        summary: data.content.slice(0, 200),
        insights: data.insights,
      },
      durationMs: Date.now() - start,
      metadata: {
        noteCount: 1 + entityNotes.length,
        linkCount: data.links.length,
      },
    };

    this.phaseHistory.push(result);
    return result.data;
  }

  /**
   * Generate title from content
   */
  private generateTitle(content: string): string {
    // Use first sentence or first 50 chars
    const firstSentence = content.split(/[.!?]+/)[0];
    return firstSentence.slice(0, 50).trim() + (firstSentence.length > 50 ? '...' : '');
  }

  /**
   * Generate tags from entities and insights
   */
  private generateTags(entities: Entity[], insights: Insight[]): string[] {
    const tags = new Set<string>();
    
    // Add entity types
    entities.forEach(e => tags.add(e.type));
    
    // Add insight types
    insights.forEach(i => tags.add(i.type));
    
    // Add high-confidence entities
    entities
      .filter(e => e.confidence > 0.8)
      .forEach(e => tags.add(e.normalizedForm || e.text));
    
    return Array.from(tags).slice(0, 10);
  }

  /**
   * Get pipeline execution history
   */
  getPhaseHistory(): PhaseResult<unknown>[] {
    return [...this.phaseHistory];
  }

  /**
   * Get pipeline statistics
   */
  getStats(): { totalDurationMs: number; phaseCount: number } {
    const totalDurationMs = this.phaseHistory.reduce((sum, p) => sum + p.durationMs, 0);
    return {
      totalDurationMs,
      phaseCount: this.phaseHistory.length,
    };
  }
}

/**
 * Create pipeline with default config
 */
export function createSixRsPipeline(config?: PipelineConfig): SixRsPipeline {
  return new SixRsPipeline(config);
}

/**
 * Quick process function
 */
export async function processWith6Rs(
  input: PipelineInput,
  config?: PipelineConfig
): Promise<PipelineOutput> {
  const pipeline = createSixRsPipeline(config);
  return pipeline.process(input);
}

// Export types
export type { PipelineConfig, PhaseResult };
