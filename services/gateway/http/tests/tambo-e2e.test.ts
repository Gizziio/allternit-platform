/**
 * Tambo End-to-End Integration Tests
 * 
 * Tests the complete flow:
 * UI Client → Gateway Routes → Tambo Engine → Response
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TamboClient, UISpec, ComponentSpec, LayoutSpec, StyleSpec } from '../tambo-client.js';

// =============================================================================
// Test Helpers
// =============================================================================

const GATEWAY_URL = process.env.A2R_GATEWAY_URL || 'http://127.0.0.1:3210';

function createTestSpec(): UISpec {
  return {
    spec_id: `test-${Date.now()}`,
    title: 'Test UI',
    description: 'A test UI for e2e testing',
    components: [
      {
        component_id: 'btn-1',
        component_type: 'button',
        properties: { label: 'Click me' },
        children: [],
        bindings: [],
      } as ComponentSpec,
    ],
    layout: {
      layout_type: 'flex',
      constraints: {},
      regions: [],
    } as LayoutSpec,
    style: {
      theme: 'default',
      colors: {},
      typography: {
        font_family: 'Arial',
        font_sizes: {},
        line_heights: {},
      },
      spacing: {
        scale: [4, 8, 16, 32],
        unit: 'px',
      },
    } as StyleSpec,
    interactions: [],
    created_at: new Date().toISOString(),
  };
}

// =============================================================================
// E2E Tests
// =============================================================================

describe('Tambo E2E Integration', () => {
  let client: TamboClient;

  beforeAll(() => {
    client = new TamboClient(GATEWAY_URL);
  });

  // Note: These tests require the gateway to be running
  // Run with: npm run test:e2e

  describe('Standard Generation', () => {
    it.skip('should generate UI in standard mode', async () => {
      const spec = createTestSpec();
      
      const result = await client.generateUI(spec, 'react');
      
      expect(result.generation_id).toBeDefined();
      expect(result.spec_id).toBe(spec.spec_id);
      expect(result.ui_code).toBeDefined();
      expect(result.ui_code.length).toBeGreaterThan(0);
      expect(result.components_generated).toBeGreaterThan(0);
    });
  });

  describe('Validated Generation', () => {
    it.skip('should generate UI with validation', async () => {
      const spec = createTestSpec();
      
      const result = await client.generateUIValidated(spec, 'react');
      
      expect(result.generation_id).toBeDefined();
      expect(result.ui_code).toBeDefined();
    });

    it.skip('should reject invalid spec', async () => {
      const invalidSpec = {
        ...createTestSpec(),
        spec_id: '', // Invalid: empty
        components: [], // Invalid: no components
      } as UISpec;
      
      await expect(client.generateUIValidated(invalidSpec, 'react'))
        .rejects.toThrow('Validation');
    });
  });

  describe('Reproducible Generation', () => {
    it.skip('should generate same UI with same seed', async () => {
      const spec = createTestSpec();
      const seed = 42;
      
      const result1 = await client.generateUIReproducible(spec, 'react', seed);
      const result2 = await client.generateUIReproducible(spec, 'react', seed);
      
      // Same seed should produce same hash
      expect(result1.generation_hash).toBe(result2.generation_hash);
    });

    it.skip('should generate different UI with different seeds', async () => {
      const spec = createTestSpec();
      
      const result1 = await client.generateUIReproducible(spec, 'react', 42);
      const result2 = await client.generateUIReproducible(spec, 'react', 99);
      
      // Different seeds should produce different hashes
      expect(result1.generation_hash).not.toBe(result2.generation_hash);
    });
  });

  describe('Streaming Generation', () => {
    it.skip('should stream UI generation chunks', async () => {
      const spec = createTestSpec();
      
      const chunks: any[] = [];
      for await (const chunk of client.generateUIStreaming(spec, 'react')) {
        chunks.push(chunk);
      }
      
      // Should have received chunks
      expect(chunks.length).toBeGreaterThan(0);
      
      // Should have received complete event
      const completeEvent = chunks.find(c => c.type === 'complete');
      expect(completeEvent).toBeDefined();
    });

    it.skip('should emit progress events', async () => {
      const spec = createTestSpec();
      
      const chunks: any[] = [];
      for await (const chunk of client.generateUIStreaming(spec, 'react', { emitProgress: true })) {
        chunks.push(chunk);
      }
      
      // Should have received progress events
      const progressEvents = chunks.filter(c => c.type === 'progress');
      expect(progressEvents.length).toBeGreaterThan(0);
    });
  });

  describe('State Persistence', () => {
    it.skip('should save and load generation state', async () => {
      const generationId = `test-gen-${Date.now()}`;
      const testState = { stage: 'completed', progress: 100 };
      
      // Save state
      await client.saveGenerationState(generationId, testState);
      
      // Load state
      const loaded = await client.loadGenerationState(generationId);
      
      expect(loaded).toEqual(testState);
    });

    it.skip('should return null for non-existent state', async () => {
      const loaded = await client.loadGenerationState('nonexistent');
      expect(loaded).toBeNull();
    });
  });

  describe('Full Workflow', () => {
    it.skip('should complete full deterministic workflow', async () => {
      const spec = createTestSpec();
      const seed = 123;
      
      // Step 1: Generate with validation
      const validated = await client.generateUIValidated(spec, 'react');
      expect(validated.generation_id).toBeDefined();
      
      // Step 2: Generate with reproducibility
      const reproducible = await client.generateUIReproducible(spec, 'react', seed);
      expect(reproducible.generation_hash).toBeDefined();
      
      // Step 3: Save state
      const state = {
        mode: 'reproducible',
        seed,
        hash: reproducible.generation_hash,
      };
      await client.saveGenerationState(reproducible.generation_id, state);
      
      // Step 4: Load and verify state
      const loaded = await client.loadGenerationState(reproducible.generation_id);
      expect(loaded).toEqual(state);
    });
  });
});
