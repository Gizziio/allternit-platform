/**
 * Tambo API Routes - TypeScript Implementation
 * 
 * HTTP endpoints for UI generation with determinism modes.
 * Routes call the Rust Tambo engine via NAPI bindings.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TamboEngine } from '../kernel/tambo_engine.js';
import {
  validateHashContent,
  validateVerifyHashRequest,
  validateDiffSpecs,
  validateA11ySpec,
  validateA11yUI,
  createValidationError,
} from '../validation/tambo.js';
import {
  GenerateUIRequest,
  GenerateUIResponse,
  DiffSpecsRequest,
  DiffSpecsResponse,
  BreakingChangesRequest,
  BreakingChangesResponse,
  SummaryRequest,
  SummaryResponse,
  HashContentRequest,
  HashContentResponse,
  VerifyHashRequest,
  VerifyHashResponse,
  ValidateA11yRequest,
  ValidateA11yResponse,
  ValidateUiA11yRequest,
  ValidateUiA11yResponse,
  A11yReportRequest,
  A11yReportResponse,
  SaveGenerationStateRequest,
  SaveGenerationStateResponse,
  GenerationState,
  TamboError,
} from '../types/tambo.js';

// =============================================================================
// Local Types (for route-specific bodies)
// =============================================================================

// Re-export types for local use
export type {
  UISpec,
  ComponentSpec,
  DataBinding,
  LayoutSpec,
  LayoutConstraints,
  LayoutRegionSpec,
  RegionPosition,
  RegionSize,
  StyleSpec,
  TypographySpec,
  SpacingSpec,
  InteractionSpec,
  GeneratedUI,
  UIType,
  SpecDiff,
  ComponentChange,
  ChangeType,
  LayoutChange,
  StyleChange,
  BreakingChange,
  Severity,
  A11yResult,
  A11yViolation,
  A11yWarning,
  A11ySeverity,
  HashResult,
  HashVerificationResult,
  GenerationState,
  TamboError,
} from '../types/tambo.js';

// Local type aliases for routes
type LocalUISpec = import('../types/tambo.js').UISpec;
type LocalGeneratedUI = import('../types/tambo.js').GeneratedUI;

interface GenerateUIBody extends GenerateUIRequest {}
interface DiffSpecsBody extends DiffSpecsRequest {}
interface BreakingChangesBody extends BreakingChangesRequest {}
interface SummaryBody extends SummaryRequest {}
interface HashContentBody extends HashContentRequest {}
interface VerifyHashBody extends VerifyHashRequest {}
interface ValidateA11yBody extends ValidateA11yRequest {}
interface ValidateUiA11yBody extends ValidateUiA11yRequest {}
interface A11yReportBody extends A11yReportRequest {}
interface SaveStateBody { state: Record<string, unknown>; }

// =============================================================================
// Route Registration
// =============================================================================

export async function registerTamboRoutes(fastify: FastifyInstance, engine: TamboEngine): Promise<void> {
  // Standard generation
  fastify.post('/generate', async (request: FastifyRequest<{ Body: GenerateUIBody }>, reply: FastifyReply) => {
    try {
      const { spec, ui_type } = request.body;
      
      const result = await engine.generateUI(spec, ui_type);
      
      return reply.send({
        generation_id: result.generation_id,
        spec_id: result.spec_id,
        ui_code: result.ui_code,
        ui_type: result.ui_type,
        components_generated: result.components_generated,
        confidence: result.confidence,
      } as GenerateUIResponse);
    } catch (error: any) {
      request.log.error({ error }, 'Generation failed');
      return reply.code(500).send({ error: error.message || 'Generation failed' });
    }
  });

  // Validated generation
  fastify.post('/generate/validated', async (request: FastifyRequest<{ Body: GenerateUIBody }>, reply: FastifyReply) => {
    try {
      const { spec, ui_type } = request.body;
      
      const result = await engine.generateUIValidated(spec, ui_type);
      
      return reply.send({
        generation_id: result.generation_id,
        spec_id: result.spec_id,
        ui_code: result.ui_code,
        ui_type: result.ui_type,
        components_generated: result.components_generated,
        confidence: result.confidence,
      } as GenerateUIResponse);
    } catch (error: any) {
      request.log.error({ error }, 'Validated generation failed');
      if (error.message?.includes('Validation')) {
        return reply.code(400).send({ error: error.message });
      }
      return reply.code(500).send({ error: error.message || 'Validated generation failed' });
    }
  });

  // Reproducible generation
  fastify.post('/generate/reproducible', async (request: FastifyRequest<{ Body: GenerateUIBody }>, reply: FastifyReply) => {
    try {
      const { spec, ui_type, seed } = request.body;
      
      // Generate deterministic seed if not provided, ensuring it's a number
      const deterministicSeed = typeof seed === 'number' ? seed : generateSeedFromSpec(spec);
      
      const result = await engine.generateUIReproducible(spec, ui_type, deterministicSeed);
      
      return reply.send({
        generation_id: result.generation_id,
        spec_id: result.spec_id,
        ui_code: result.ui_code,
        ui_type: result.ui_type,
        components_generated: result.components_generated,
        confidence: result.confidence,
        generation_hash: result.generation_hash,
      } as GenerateUIResponse);
    } catch (error: any) {
      request.log.error({ error }, 'Reproducible generation failed');
      return reply.code(500).send({ error: error.message || 'Reproducible generation failed' });
    }
  });

  // Streaming generation (SSE) - simplified for now
  // Full streaming requires more complex NAPI integration
  fastify.post('/generate/stream', async (request: FastifyRequest<{ Body: GenerateUIBody }>, reply: FastifyReply) => {
    try {
      const { spec, ui_type } = request.body;
      
      // Set SSE headers
      reply.header('Content-Type', 'text/event-stream');
      reply.header('Cache-Control', 'no-cache');
      reply.header('Connection', 'keep-alive');
      reply.header('X-Accel-Buffering', 'no');

      // For now, generate synchronously and send as chunks
      // TODO: Implement proper async streaming via NAPI
      const result = await engine.generateUI(spec, ui_type);
      
      // Send chunks
      const lines = result.ui_code.split('\n');
      for (const line of lines) {
        reply.raw.write(`data: ${JSON.stringify({ type: 'chunk', data: line + '\n' })}\n\n`);
      }
      
      // Send complete event
      reply.raw.write(`event: complete\ndata: ${JSON.stringify({ generation_id: result.generation_id })}\n\n`);
      reply.raw.end();
    } catch (error: any) {
      request.log.error({ error }, 'Streaming generation failed');
      return reply.code(500).send({ error: error.message || 'Streaming generation failed' });
    }
  });

  // Get generation state
  fastify.get('/generations/:id/state', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      
      const state = await engine.loadGenerationState(id);
      
      if (!state) {
        return reply.code(404).send({ error: 'Generation state not found' });
      }
      
      return reply.send(state);
    } catch (error: any) {
      request.log.error({ error }, 'Failed to load generation state');
      return reply.code(500).send({ error: error.message || 'Failed to load generation state' });
    }
  });

  // Save generation state
  fastify.post('/generations/:id/state', async (request: FastifyRequest<{ Params: { id: string }; Body: SaveStateBody }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { state } = request.body;
      
      // Get spec_id from the generation (would need lookup in production)
      const specId = `spec_${id}`;
      
      await engine.saveGenerationState(id, specId, state);
      
      return reply.code(200).send({ success: true });
    } catch (error: any) {
      request.log.error({ error }, 'Failed to save generation state');
      return reply.code(500).send({ error: error.message || 'Failed to save generation state' });
    }
  });

  // =============================================================================
  // Hash Engine Routes
  // =============================================================================

  // Hash content
  fastify.post('/hash', async (request: FastifyRequest<{ Body: { content: string } }>, reply: FastifyReply) => {
    try {
      const { content } = request.body;
      
      // Validate input
      const validation = validateHashContent(content);
      if (!validation.valid) {
        return reply.code(400).send(createValidationError(validation));
      }
      
      const hash = engine.hashContent(content);
      return reply.send({ hash });
    } catch (error: any) {
      request.log.error({ error }, 'Hash failed');
      return reply.code(500).send({ error: error.message || 'Hash failed', code: 'HASH_ERROR' });
    }
  });

  // Verify hash
  fastify.post('/hash/verify', async (request: FastifyRequest<{ Body: { content: string; hash: string } }>, reply: FastifyReply) => {
    try {
      const { content, hash } = request.body;
      
      // Validate input
      const validation = validateVerifyHashRequest(content, hash);
      if (!validation.valid) {
        return reply.code(400).send(createValidationError(validation));
      }
      
      const valid = engine.verifyHash(content, hash);
      return reply.send({ valid });
    } catch (error: any) {
      request.log.error({ error }, 'Hash verification failed');
      return reply.code(500).send({ error: error.message || 'Hash verification failed', code: 'HASH_VERIFY_ERROR' });
    }
  });

  // =============================================================================
  // Spec Diff Engine Routes
  // =============================================================================

  // Compare two specs
  fastify.post('/diff', async (request: FastifyRequest<{ Body: DiffSpecsBody }>, reply: FastifyReply) => {
    try {
      const { old_spec, new_spec } = request.body;
      
      // Validate input
      const validation = validateDiffSpecs(old_spec, new_spec);
      if (!validation.valid) {
        return reply.code(400).send(createValidationError(validation));
      }
      
      const diff = engine.diffSpecs(old_spec, new_spec);
      return reply.send(diff);
    } catch (error: any) {
      request.log.error({ error }, 'Diff failed');
      return reply.code(500).send({ error: error.message || 'Diff failed', code: 'DIFF_ERROR' });
    }
  });

  // Check if diff has breaking changes
  fastify.post('/diff/breaking', async (request: FastifyRequest<{ Body: { diff: any } }>, reply: FastifyReply) => {
    try {
      const { diff } = request.body;
      const hasBreaking = engine.hasBreakingChanges(diff);
      return reply.send({ has_breaking_changes: hasBreaking });
    } catch (error: any) {
      request.log.error({ error }, 'Breaking changes check failed');
      return reply.code(500).send({ error: error.message || 'Breaking changes check failed' });
    }
  });

  // Summarize changes
  fastify.post('/diff/summary', async (request: FastifyRequest<{ Body: { diff: any } }>, reply: FastifyReply) => {
    try {
      const { diff } = request.body;
      const summary = engine.summarizeChanges(diff);
      return reply.send({ summary });
    } catch (error: any) {
      request.log.error({ error }, 'Summary failed');
      return reply.code(500).send({ error: error.message || 'Summary failed' });
    }
  });

  // =============================================================================
  // Accessibility (A11y) Engine Routes
  // =============================================================================

  // Validate spec accessibility
  fastify.post('/a11y/validate', async (request: FastifyRequest<{ Body: ValidateA11yBody }>, reply: FastifyReply) => {
    try {
      const { spec } = request.body;
      
      // Validate input
      const validation = validateA11ySpec(spec);
      if (!validation.valid) {
        return reply.code(400).send(createValidationError(validation));
      }
      
      const result = engine.validateA11y(spec);
      return reply.send(result);
    } catch (error: any) {
      request.log.error({ error }, 'A11y validation failed');
      return reply.code(500).send({ error: error.message || 'A11y validation failed', code: 'A11Y_ERROR' });
    }
  });

  // Validate generated UI accessibility
  fastify.post('/a11y/validate-ui', async (request: FastifyRequest<{ Body: ValidateUiA11yBody }>, reply: FastifyReply) => {
    try {
      const { ui } = request.body;
      const result = engine.validateUiA11y(ui as LocalGeneratedUI);
      return reply.send(result);
    } catch (error: any) {
      request.log.error({ error }, 'UI A11y validation failed');
      return reply.code(500).send({ error: error.message || 'UI A11y validation failed' });
    }
  });

  // Generate accessibility report
  fastify.post('/a11y/report', async (request: FastifyRequest<{ Body: { result: any } }>, reply: FastifyReply) => {
    try {
      const { result } = request.body;
      const report = engine.generateA11yReport(result);
      return reply.send({ report });
    } catch (error: any) {
      request.log.error({ error }, 'A11y report generation failed');
      return reply.code(500).send({ error: error.message || 'A11y report generation failed' });
    }
  });
}

// =============================================================================
// Helper Functions
// =============================================================================

function generateSeedFromSpec(spec: LocalUISpec): number {
  // Generate deterministic seed from spec_id
  let hash = 0;
  const str = spec.spec_id;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash);
}
