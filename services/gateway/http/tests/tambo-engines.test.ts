/**
 * Tambo Engines Unit Tests
 * 
 * Tests for Hash, Spec Diff, and A11y engines via HTTP API.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TamboClient } from '../tambo-client.js';
import {
  UISpec,
  ComponentSpec,
  LayoutSpec,
  StyleSpec,
  HashResult,
  HashVerificationResult,
  SpecDiff,
  BreakingChangesResponse,
  SummaryResponse,
  A11yResult,
  A11yReportResponse,
} from '../src/types/tambo.js';

const GATEWAY_URL = process.env.A2R_GATEWAY_URL || 'http://127.0.0.1:3210';

// =============================================================================
// Test Helpers
// =============================================================================

function createTestSpec(overrides?: Partial<UISpec>): UISpec {
  return {
    spec_id: `test-${Date.now()}`,
    title: 'Test UI',
    description: 'A test UI specification',
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
    ...overrides,
  };
}

async function httpPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${GATEWAY_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`HTTP ${response.status}: ${error.error || 'Unknown error'}`);
  }
  
  return response.json() as Promise<T>;
}

// =============================================================================
// Hash Engine Tests
// =============================================================================

describe('Hash Engine', () => {
  describe('POST /v1/tambo/hash', () => {
    it('should hash content deterministically', async () => {
      const content = 'test content to hash';
      
      const result1 = await httpPost<HashResult>('/v1/tambo/hash', { content });
      const result2 = await httpPost<HashResult>('/v1/tambo/hash', { content });
      
      expect(result1.hash).toBeDefined();
      expect(result1.hash).toBe(result2.hash);
      expect(result1.hash.length).toBeGreaterThan(0);
    });

    it('should produce different hashes for different content', async () => {
      const result1 = await httpPost<HashResult>('/v1/tambo/hash', { content: 'content A' });
      const result2 = await httpPost<HashResult>('/v1/tambo/hash', { content: 'content B' });
      
      expect(result1.hash).not.toBe(result2.hash);
    });

    it('should handle empty content', async () => {
      const result = await httpPost<HashResult>('/v1/tambo/hash', { content: '' });
      expect(result.hash).toBeDefined();
    });

    it('should handle large content', async () => {
      const content = 'x'.repeat(10000);
      const result = await httpPost<HashResult>('/v1/tambo/hash', { content });
      expect(result.hash).toBeDefined();
      expect(result.hash.length).toBeGreaterThan(0);
    });
  });

  describe('POST /v1/tambo/hash/verify', () => {
    it('should verify correct hash', async () => {
      const content = 'test content';
      const { hash } = await httpPost<HashResult>('/v1/tambo/hash', { content });
      
      const result = await httpPost<HashVerificationResult>('/v1/tambo/hash/verify', {
        content,
        hash,
      });
      
      expect(result.valid).toBe(true);
    });

    it('should reject incorrect hash', async () => {
      const result = await httpPost<HashVerificationResult>('/v1/tambo/hash/verify', {
        content: 'test content',
        hash: 'incorrect_hash',
      });
      
      expect(result.valid).toBe(false);
    });

    it('should reject hash for different content', async () => {
      const { hash } = await httpPost<HashResult>('/v1/tambo/hash', { content: 'original' });
      
      const result = await httpPost<HashVerificationResult>('/v1/tambo/hash/verify', {
        content: 'different',
        hash,
      });
      
      expect(result.valid).toBe(false);
    });
  });
});

// =============================================================================
// Spec Diff Engine Tests
// =============================================================================

describe('Spec Diff Engine', () => {
  describe('POST /v1/tambo/diff', () => {
    it('should detect no changes for identical specs', async () => {
      const spec = createTestSpec();
      
      const diff = await httpPost<SpecDiff>('/v1/tambo/diff', {
        old_spec: spec,
        new_spec: spec,
      });
      
      expect(diff.has_changes).toBe(false);
      expect(diff.component_changes).toHaveLength(0);
      expect(diff.breaking_changes).toHaveLength(0);
    });

    it('should detect component additions', async () => {
      const oldSpec = createTestSpec({ components: [] });
      const newSpec = createTestSpec();
      
      const diff = await httpPost<SpecDiff>('/v1/tambo/diff', {
        old_spec: oldSpec,
        new_spec: newSpec,
      });
      
      expect(diff.has_changes).toBe(true);
      expect(diff.component_changes.length).toBeGreaterThan(0);
      expect(diff.component_changes[0].change_type).toBe('Added');
    });

    it('should detect component removals', async () => {
      const oldSpec = createTestSpec();
      const newSpec = createTestSpec({ components: [] });
      
      const diff = await httpPost<SpecDiff>('/v1/tambo/diff', {
        old_spec: oldSpec,
        new_spec: newSpec,
      });
      
      expect(diff.has_changes).toBe(true);
      expect(diff.breaking_changes.length).toBeGreaterThan(0);
    });

    it('should detect property changes', async () => {
      const oldSpec = createTestSpec();
      const newSpec = createTestSpec({
        components: [{
          component_id: 'btn-1',
          component_type: 'button',
          properties: { label: 'Updated label' },
          children: [],
          bindings: [],
        } as ComponentSpec],
      });
      
      const diff = await httpPost<SpecDiff>('/v1/tambo/diff', {
        old_spec: oldSpec,
        new_spec: newSpec,
      });
      
      expect(diff.has_changes).toBe(true);
      const modifiedChange = diff.component_changes.find(
        c => c.change_type === 'Modified'
      );
      expect(modifiedChange).toBeDefined();
    });
  });

  describe('POST /v1/tambo/diff/breaking', () => {
    it('should identify breaking changes', async () => {
      const oldSpec = createTestSpec();
      const newSpec = createTestSpec({ components: [] });
      
      const diff = await httpPost<SpecDiff>('/v1/tambo/diff', {
        old_spec: oldSpec,
        new_spec: newSpec,
      });
      
      const result = await httpPost<BreakingChangesResponse>('/v1/tambo/diff/breaking', { diff });
      expect(result.has_breaking_changes).toBe(true);
    });

    it('should identify non-breaking changes', async () => {
      const oldSpec = createTestSpec();
      const newSpec = createTestSpec({ description: 'Updated description' });
      
      const diff = await httpPost<SpecDiff>('/v1/tambo/diff', {
        old_spec: oldSpec,
        new_spec: newSpec,
      });
      
      const result = await httpPost<BreakingChangesResponse>('/v1/tambo/diff/breaking', { diff });
      expect(result.has_breaking_changes).toBe(false);
    });
  });

  describe('POST /v1/tambo/diff/summary', () => {
    it('should generate human-readable summary', async () => {
      const oldSpec = createTestSpec();
      const newSpec = createTestSpec({ title: 'Updated title' });
      
      const diff = await httpPost<SpecDiff>('/v1/tambo/diff', {
        old_spec: oldSpec,
        new_spec: newSpec,
      });
      
      const result = await httpPost<SummaryResponse>('/v1/tambo/diff/summary', { diff });
      expect(result.summary).toBeDefined();
      expect(result.summary.length).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// A11y Engine Tests
// =============================================================================

describe('A11y Engine', () => {
  describe('POST /v1/tambo/a11y/validate', () => {
    it('should pass valid accessible spec', async () => {
      const spec = createTestSpec({
        components: [{
          component_id: 'btn-1',
          component_type: 'button',
          properties: { label: 'Submit form' },
          children: [],
          bindings: [],
        } as ComponentSpec],
      });
      
      const result = await httpPost<A11yResult>('/v1/tambo/a11y/validate', { spec });
      
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.violations).toBeDefined();
      expect(result.warnings).toBeDefined();
    });

    it('should fail spec with missing labels', async () => {
      const spec = createTestSpec({
        components: [{
          component_id: 'btn-1',
          component_type: 'button',
          properties: {}, // Missing label
          children: [],
          bindings: [],
        } as ComponentSpec],
      });
      
      const result = await httpPost<A11yResult>('/v1/tambo/a11y/validate', { spec });
      
      // Should have warnings or violations for missing label
      const hasIssues = result.violations.length > 0 || result.warnings.length > 0;
      expect(hasIssues || result.score < 1).toBe(true);
    });

    it('should check empty spec', async () => {
      const spec = createTestSpec({ components: [] });
      
      const result = await httpPost<A11yResult>('/v1/tambo/a11y/validate', { spec });
      
      expect(result.passed).toBeDefined();
      expect(result.score).toBeDefined();
    });

    it('should validate multiple components', async () => {
      const spec = createTestSpec({
        components: [
          {
            component_id: 'btn-1',
            component_type: 'button',
            properties: { label: 'Button 1' },
            children: [],
            bindings: [],
          } as ComponentSpec,
          {
            component_id: 'input-1',
            component_type: 'input',
            properties: { placeholder: 'Enter value' },
            children: [],
            bindings: [],
          } as ComponentSpec,
        ],
      });
      
      const result = await httpPost<A11yResult>('/v1/tambo/a11y/validate', { spec });
      
      expect(result.passed).toBeDefined();
      expect(result.violations).toBeDefined();
    });
  });

  describe('POST /v1/tambo/a11y/report', () => {
    it('should generate markdown report', async () => {
      const result: A11yResult = {
        passed: true,
        score: 0.95,
        violations: [],
        warnings: [
          {
            rule: 'contrast',
            description: 'Low contrast detected',
            element: 'button',
            suggestion: 'Increase contrast ratio',
          },
        ],
      };
      
      const reportResult = await httpPost<A11yReportResponse>('/v1/tambo/a11y/report', { result });
      
      expect(reportResult.report).toBeDefined();
      expect(reportResult.report.length).toBeGreaterThan(0);
      expect(reportResult.report).toContain('95'); // Score should be mentioned
    });

    it('should include violations in report', async () => {
      const result: A11yResult = {
        passed: false,
        score: 0.5,
        violations: [
          {
            rule: 'missing-label',
            severity: 'Serious',
            description: 'Button lacks accessible label',
            element: 'btn-1',
            remediation: 'Add aria-label or text content',
            wcag_reference: 'WCAG 2.1 1.3.1',
          },
        ],
        warnings: [],
      };
      
      const reportResult = await httpPost<A11yReportResponse>('/v1/tambo/a11y/report', { result });
      
      expect(reportResult.report).toContain('missing-label');
    });
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('Integration: Full Workflow', () => {
  it('should generate UI, hash it, diff specs, and validate a11y', async () => {
    // 1. Create initial spec
    const specV1 = createTestSpec({ spec_id: 'integration-test-v1' });
    
    // 2. Generate UI
    const generated = await httpPost<GeneratedUI>('/v1/tambo/generate', {
      spec: specV1,
      ui_type: 'react',
    });
    
    expect(generated.ui_code).toBeDefined();
    
    // 3. Hash the generated UI
    const { hash } = await httpPost<HashResult>('/v1/tambo/hash', {
      content: generated.ui_code,
    });
    expect(hash).toBeDefined();
    
    // 4. Create modified spec
    const specV2 = createTestSpec({
      spec_id: 'integration-test-v1',
      title: 'Updated Title',
      components: [
        {
          component_id: 'btn-1',
          component_type: 'button',
          properties: { label: 'Updated Button' },
          children: [],
          bindings: [],
        } as ComponentSpec,
      ],
    });
    
    // 5. Diff specs
    const diff = await httpPost<SpecDiff>('/v1/tambo/diff', {
      old_spec: specV1,
      new_spec: specV2,
    });
    expect(diff.has_changes).toBe(true);
    
    // 6. Check breaking changes
    const breakingResult = await httpPost<BreakingChangesResponse>('/v1/tambo/diff/breaking', { diff });
    expect(breakingResult.has_breaking_changes).toBeDefined();
    
    // 7. Validate a11y of new spec
    const a11yResult = await httpPost<A11yResult>('/v1/tambo/a11y/validate', { spec: specV2 });
    expect(a11yResult.passed).toBeDefined();
    
    // 8. Generate a11y report
    const reportResult = await httpPost<A11yReportResponse>('/v1/tambo/a11y/report', {
      result: a11yResult,
    });
    expect(reportResult.report).toBeDefined();
  });
});
