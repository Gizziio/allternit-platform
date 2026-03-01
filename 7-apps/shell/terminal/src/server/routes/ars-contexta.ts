/**
 * Ars Contexta Routes
 * Server API for knowledge graph and insight generation
 * 
 * Provides endpoints for:
 * - LLM insight generation
 * - NLP entity extraction
 * - Content enrichment (combined LLM + NLP)
 * 
 * WIH: GAP-78/GAP-79 Integration, Owner: T3-A1
 */

import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod/v4"
import { streamSSE } from "hono/streaming"
import { lazy } from "../../util/lazy"
import { errors } from "../error"
import { Log } from "../../util/log"

// Stub types and implementations for @a2r/ars-contexta
// TODO: Replace with actual implementation when package is ready

export interface Insight {
  id: string;
  type: 'pattern' | 'contradiction' | 'gap' | 'opportunity' | 'claim' | 'entity_relation';
  description: string;
  confidence: number;
  relatedNotes: string[];
  source: 'llm' | 'nlp' | 'pattern' | 'claim';
  timestamp: string;
}

export interface Entity {
  id: string;
  text: string;
  type: 'person' | 'organization' | 'location' | 'concept' | 'product' | 'event' | 'date' | 'technology' | 'domain';
  startPos: number;
  endPos: number;
  confidence: number;
  normalizedForm?: string;
  metadata?: Record<string, any>;
}

export interface Relation {
  source: string;
  target: string;
  relationType: string;
  confidence: number;
  evidence?: string;
}

export interface ExtractionResult {
  entities: Entity[];
  relations: Relation[];
  keyPhrases: string[];
  summary: string;
  sentiment?: {
    score: number;
    label: 'negative' | 'neutral' | 'positive';
  };
  language: string;
  processingTimeMs: number;
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {
  messages: LlmMessage[];
  maxTokens?: number;
}

export interface LlmResponse {
  content: string;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface LlmStreamChunk {
  delta: string;
  finishReason?: string;
}

export interface LlmClient {
  complete(request: LlmRequest): Promise<LlmResponse>;
  stream(request: LlmRequest): AsyncIterable<LlmStreamChunk>;
  health(): Promise<boolean>;
}

export function createLlmClientWithFallback(_model?: string): Promise<LlmClient> {
  // Stub implementation
  const client: LlmClient = {
    async complete(request: LlmRequest): Promise<LlmResponse> {
      return {
        content: JSON.stringify({
          insights: [],
          summary: 'Stub response',
          keyThemes: [],
          suggestedLinks: [],
        }),
        finishReason: 'stop',
      };
    },
    async *stream(request: LlmRequest): AsyncIterable<LlmStreamChunk> {
      yield { delta: 'Stub response', finishReason: 'stop' };
    },
    async health(): Promise<boolean> {
      return true;
    },
  };
  return Promise.resolve(client);
}

export function generateInsightPrompt(_options: {
  content: string;
  context?: string[];
  focusAreas?: string[];
  maxInsights?: number;
  minConfidence?: number;
}): string {
  return 'Generate insights from the following content.';
}

export interface EntityExtractor {
  isReady(): boolean;
  extract(text: string, options?: {
    entityTypes?: string[];
    extractRelations?: boolean;
    extractSentiment?: boolean;
    minConfidence?: number;
  }): Promise<ExtractionResult>;
}

export function createEntityExtractor(_backend: string): EntityExtractor {
  return {
    isReady(): boolean {
      return true;
    },
    async extract(text: string): Promise<ExtractionResult> {
      return {
        entities: [],
        relations: [],
        keyPhrases: [],
        summary: text.slice(0, 100),
        language: 'en',
        processingTimeMs: 0,
      };
    },
  };
}

export const TerminalProviderAdapter = {
  async listAvailableProviders(): Promise<Array<{ id: string; name: string; models: string[] }>> {
    return [
      { id: 'terminal', name: 'Terminal Provider', models: ['openai/gpt-4o-mini'] },
      { id: 'stub', name: 'Stub Provider (Testing)', models: ['stub-model'] },
    ];
  },
};

// Import TUI bridge for progress tracking
import {
  trackEntityExtraction,
  trackInsightGeneration,
  trackContentEnrichment,
} from "./ars-contexta-tui-bridge"

const log = Log.create({ service: "ars-contexta" })

// Schema definitions
const InsightRequestSchema = z.object({
  content: z.string().min(1).max(100000).describe("Content to analyze for insights"),
  context: z.array(z.string()).optional().describe("Additional context notes"),
  focusAreas: z.array(z.string()).optional().describe("Topics to focus on"),
  maxInsights: z.number().min(1).max(20).default(5).describe("Maximum insights to generate"),
  minConfidence: z.number().min(0).max(1).default(0.7).describe("Minimum confidence threshold"),
  model: z.string().optional().describe("Model to use (e.g., openai/gpt-4o-mini)"),
  stream: z.boolean().default(false).describe("Stream response"),
})

const InsightResponseSchema = z.object({
  insights: z.array(z.object({
    id: z.string(),
    type: z.enum(['pattern', 'contradiction', 'gap', 'opportunity', 'claim', 'entity_relation']),
    description: z.string(),
    confidence: z.number(),
    relatedNotes: z.array(z.string()),
    source: z.enum(['llm', 'nlp', 'pattern', 'claim']),
    timestamp: z.string(),
  })),
  summary: z.string(),
  keyThemes: z.array(z.string()),
  suggestedLinks: z.array(z.string()),
})

const EntityExtractionRequestSchema = z.object({
  text: z.string().min(1).max(100000).describe("Text to extract entities from"),
  entityTypes: z.array(z.enum([
    'person', 'organization', 'location', 'concept',
    'product', 'event', 'date', 'technology', 'domain'
  ])).optional().describe("Entity types to extract"),
  extractRelations: z.boolean().default(true).describe("Extract entity relationships"),
  extractSentiment: z.boolean().default(false).describe("Perform sentiment analysis"),
  minConfidence: z.number().min(0).max(1).default(0.7).describe("Minimum confidence threshold"),
  backend: z.enum(['rust-bert', 'candle', 'remote', 'stub']).default('stub').describe("NLP backend to use"),
})

const EntityResponseSchema = z.object({
  entities: z.array(z.object({
    id: z.string(),
    text: z.string(),
    type: z.enum(['person', 'organization', 'location', 'concept', 'product', 'event', 'date', 'technology', 'domain']),
    startPos: z.number(),
    endPos: z.number(),
    confidence: z.number(),
    normalizedForm: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  })),
  relations: z.array(z.object({
    source: z.string(),
    target: z.string(),
    relationType: z.string(),
    confidence: z.number(),
    evidence: z.string().optional(),
  })),
  keyPhrases: z.array(z.string()),
  summary: z.string(),
  sentiment: z.object({
    score: z.number(),
    label: z.enum(['negative', 'neutral', 'positive']),
  }).optional(),
  language: z.string(),
  processingTimeMs: z.number(),
})

const EnrichmentRequestSchema = z.object({
  content: z.string().min(1).max(100000).describe("Content to enrich"),
  source: z.string().optional().describe("Source identifier"),
  options: z.object({
    generateInsights: z.boolean().default(true),
    extractEntities: z.boolean().default(true),
    useStreaming: z.boolean().default(false),
  }).optional(),
})

const EnrichmentResponseSchema = z.object({
  sourceContent: z.string(),
  insights: InsightResponseSchema.shape.insights,
  entities: EntityResponseSchema.shape.entities,
  relations: EntityResponseSchema.shape.relations,
  summary: z.string(),
  keyThemes: z.array(z.string()),
  suggestedTags: z.array(z.string()),
  confidence: z.number(),
  processingMetadata: z.object({
    llmProvider: z.string().optional(),
    nlpEngine: z.enum(['rust-bert', 'candle', 'remote', 'stub']),
    processingTimeMs: z.number(),
  }),
})

export const ArsContextaRoutes = lazy(() =>
  new Hono()
    // Health check
    .get(
      "/health",
      describeRoute({
        summary: "Ars Contexta health check",
        description: "Check if Ars Contexta services are available",
        operationId: "ars-contexta.health",
        responses: {
          200: {
            description: "Service status",
            content: {
              "application/json": {
                schema: resolver(z.object({
                  llm: z.boolean(),
                  nlp: z.boolean(),
                  providers: z.array(z.string()),
                })),
              },
            },
          },
        },
      }),
      async (c) => {
        // Check LLM availability
        let llmHealthy = false
        try {
          const client = await createLlmClientWithFallback()
          llmHealthy = await client.health()
        } catch (e) {
          log.warn("LLM health check failed", { error: e })
        }

        // Check NLP availability
        const extractor = createEntityExtractor('stub')
        const nlpHealthy = extractor.isReady()

        return c.json({
          llm: llmHealthy,
          nlp: nlpHealthy,
          providers: ['terminal', 'stub'], // TODO: List actual available providers
        })
      },
    )

    // Generate insights from content
    .post(
      "/insights",
      describeRoute({
        summary: "Generate insights",
        description: "Use LLM to generate insights from content",
        operationId: "ars-contexta.insights",
        responses: {
          200: {
            description: "Generated insights",
            content: {
              "application/json": { schema: resolver(InsightResponseSchema) },
              "text/event-stream": { schema: resolver(z.string()) },
            },
          },
          ...errors(400, 500),
        },
      }),
      validator("json", InsightRequestSchema),
      async (c) => {
        const body = c.req.valid("json")
        const startTime = Date.now()

        try {
          // Create LLM client (uses terminal provider if available)
          const client = await createLlmClientWithFallback(body.model)

          // Generate prompt
          const prompt = generateInsightPrompt({
            content: body.content,
            context: body.context,
            focusAreas: body.focusAreas,
            maxInsights: body.maxInsights,
            minConfidence: body.minConfidence,
          })

          if (body.stream) {
            // Stream response
            return streamSSE(c, async (stream) => {
              const request: LlmRequest = {
                messages: [
                  { role: 'system', content: 'You are an expert knowledge analyst.' },
                  { role: 'user', content: prompt },
                ],
                maxTokens: 2000,
              }

              for await (const chunk of client.stream(request)) {
                await stream.writeSSE({
                  data: JSON.stringify({
                    delta: chunk.delta,
                    finishReason: chunk.finishReason,
                  }),
                })

                if (chunk.finishReason === 'stop') {
                  break
                }
              }
            })
          }

          // Non-streaming response
          const request: LlmRequest = {
            messages: [
              { role: 'system', content: 'You are an expert knowledge analyst.' },
              { role: 'user', content: prompt },
            ],
            maxTokens: 2000,
          }

          const response = await client.complete(request)

          // Parse LLM response (expecting JSON)
          let insights: Insight[] = []
          let summary = ''
          let keyThemes: string[] = []
          let suggestedLinks: string[] = []

          try {
            // Try to parse as JSON
            const parsed = JSON.parse(response.content)
            insights = parsed.insights || []
            summary = parsed.summary || ''
            keyThemes = parsed.keyThemes || []
            suggestedLinks = parsed.suggestedLinks || []
          } catch {
            // Fallback: treat entire response as summary
            summary = response.content
            insights = [{
              id: `insight_${Date.now()}`,
              type: 'pattern',
              description: 'Generated insight from content analysis',
              confidence: 0.7,
              relatedNotes: [],
              source: 'llm',
              timestamp: new Date().toISOString(),
            }]
          }

          return c.json({
            insights,
            summary,
            keyThemes,
            suggestedLinks,
          })

        } catch (error) {
          log.error("Insight generation failed", { error, duration: Date.now() - startTime })
          throw error
        }
      },
    )

    // Extract entities from text
    .post(
      "/entities",
      describeRoute({
        summary: "Extract entities",
        description: "Use NLP to extract entities from text",
        operationId: "ars-contexta.entities",
        responses: {
          200: {
            description: "Extracted entities",
            content: {
              "application/json": { schema: resolver(EntityResponseSchema) },
            },
          },
          ...errors(400, 500),
        },
      }),
      validator("json", EntityExtractionRequestSchema),
      async (c) => {
        const body = c.req.valid("json")

        try {
          // Track with TUI progress
          const result = await trackEntityExtraction(async () => {
            const extractor = createEntityExtractor(body.backend)
            
            const startTime = Date.now()
            const extractionResult = await extractor.extract(body.text, {
              entityTypes: body.entityTypes,
              extractRelations: body.extractRelations,
              extractSentiment: body.extractSentiment,
              minConfidence: body.minConfidence,
            })
            
            return {
              result: extractionResult,
              entityCount: extractionResult.entities.length,
              processingTimeMs: Date.now() - startTime,
            }
          })

          return c.json(result)

        } catch (error) {
          log.error("Entity extraction failed", { error })
          throw error
        }
      },
    )

    // Combined enrichment (insights + entities)
    .post(
      "/enrich",
      describeRoute({
        summary: "Enrich content",
        description: "Combined LLM insight generation and NLP entity extraction",
        operationId: "ars-contexta.enrich",
        responses: {
          200: {
            description: "Enriched content",
            content: {
              "application/json": { schema: resolver(EnrichmentResponseSchema) },
            },
          },
          ...errors(400, 500),
        },
      }),
      validator("json", EnrichmentRequestSchema),
      async (c) => {
        const body = c.req.valid("json")
        const options = body.options || { generateInsights: true, extractEntities: true, useStreaming: false }

        try {
          const result = await trackContentEnrichment(async () => {
            const startTime = Date.now()
            let insights: Insight[] = []
            let entities: Entity[] = []
            let relations: ExtractionResult['relations'] = []
            let summary = ''
            let keyThemes: string[] = []

            // Run NLP extraction
            if (options.extractEntities) {
              const extractor = createEntityExtractor('stub')
              const extractionResult = await extractor.extract(body.content, {
                extractRelations: true,
                extractSentiment: true,
              })
              entities = extractionResult.entities
              relations = extractionResult.relations
              summary = extractionResult.summary
            }

            // Run LLM insight generation
            if (options.generateInsights) {
              const client = await createLlmClientWithFallback()
              const prompt = generateInsightPrompt({
                content: body.content,
                maxInsights: 5,
              })

              const request: LlmRequest = {
                messages: [
                  { role: 'system', content: 'You are an expert knowledge analyst.' },
                  { role: 'user', content: prompt },
                ],
                maxTokens: 2000,
              }

              const response = await client.complete(request)

              try {
                const parsed = JSON.parse(response.content)
                insights = parsed.insights || []
                keyThemes = parsed.keyThemes || []
                if (!summary) summary = parsed.summary || ''
              } catch {
                if (!summary) summary = response.content
              }
            }

            // Generate suggested tags from entities and themes
            const suggestedTags = [
              ...entities.map(e => e.text),
              ...keyThemes,
            ].slice(0, 10)

            return {
              result: {
                sourceContent: body.content,
                insights,
                entities,
                relations,
                summary,
                keyThemes,
                suggestedTags,
                confidence: 0.85,
                processingMetadata: {
                  llmProvider: options.generateInsights ? 'terminal' : undefined,
                  nlpEngine: 'stub',
                  processingTimeMs: Date.now() - startTime,
                },
              },
              entityCount: entities.length,
              insightCount: insights.length,
              processingTimeMs: Date.now() - startTime,
            }
          })

          return c.json(result)

        } catch (error) {
          log.error("Content enrichment failed", { error })
          throw error
        }
      },
    )

    // Get available models/providers
    .get(
      "/providers",
      describeRoute({
        summary: "List available providers",
        description: "Get list of available LLM and NLP providers",
        operationId: "ars-contexta.providers",
        responses: {
          200: {
            description: "Available providers",
            content: {
              "application/json": {
                schema: resolver(z.object({
                  llm: z.array(z.object({
                    id: z.string(),
                    name: z.string(),
                    models: z.array(z.string()),
                  })),
                  nlp: z.array(z.object({
                    id: z.string(),
                    name: z.string(),
                    available: z.boolean(),
                  })),
                })),
              },
            },
          },
        },
      }),
      async (c) => {
        // Get LLM providers from terminal adapter (defined in this module)
        const llmProviders = await TerminalProviderAdapter.listAvailableProviders()

        return c.json({
          llm: llmProviders.length > 0 ? llmProviders : [
            { id: 'terminal', name: 'Terminal Provider', models: ['openai/gpt-4o-mini'] },
            { id: 'stub', name: 'Stub Provider (Testing)', models: ['stub-model'] },
          ],
          nlp: [
            { id: 'rust-bert', name: 'rust-bert (Local)', available: false },
            { id: 'candle', name: 'Candle (Local)', available: false },
            { id: 'remote', name: 'Remote API', available: false },
            { id: 'stub', name: 'Stub (Testing)', available: true },
          ],
        })
      },
    ),
)
