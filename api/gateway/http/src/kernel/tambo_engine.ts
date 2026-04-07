/**
 * Tambo Engine - TypeScript Wrapper for Rust NAPI
 * 
 * Provides TypeScript interface to the Rust Tambo engine via Node-API.
 */

// Import the NAPI module (will be built from Rust)
let tamboNapi: any;
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import * as path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

try {
  // Try absolute path from project root
  const napiPath = path.resolve(__dirname, '../../../../domains/kernel/infrastructure/tambo-napi/index.node');
  tamboNapi = require(napiPath);
  console.log('[TamboEngine] ✅ Loaded NAPI module from:', napiPath);
} catch (err) {
  console.warn('[TamboEngine] ⚠️  NAPI module not found, using mock implementation');
  console.warn('[TamboEngine] Error:', (err as Error).message);
  tamboNapi = null;
}

// =============================================================================
// Types
// =============================================================================

export interface UISpec {
  spec_id: string;
  title: string;
  description: string;
  components: ComponentSpec[];
  layout: LayoutSpec;
  style: StyleSpec;
  interactions: InteractionSpec[];
  created_at: string;
}

export interface ComponentSpec {
  component_id: string;
  component_type: string;
  properties: Record<string, unknown>;
  children: string[];
  bindings: DataBinding[];
}

export interface DataBinding {
  property: string;
  source: string;
  transform?: string;
}

export interface LayoutSpec {
  layout_type: string;
  constraints: LayoutConstraints;
  regions: LayoutRegionSpec[];
}

export interface LayoutConstraints {
  min_width?: number;
  max_width?: number;
  min_height?: number;
  max_height?: number;
}

export interface LayoutRegionSpec {
  region_id: string;
  region_type: string;
  position: RegionPosition;
  size: RegionSize;
}

export interface RegionPosition {
  x: number;
  y: number;
}

export interface RegionSize {
  width: number;
  height: number;
}

export interface StyleSpec {
  theme: string;
  colors: Record<string, string>;
  typography: TypographySpec;
  spacing: SpacingSpec;
}

export interface TypographySpec {
  font_family: string;
  font_sizes: Record<string, number>;
  line_heights: Record<string, number>;
}

export interface SpacingSpec {
  scale: number[];
  unit: string;
}

export interface InteractionSpec {
  interaction_id: string;
  trigger: string;
  action: string;
}

export interface GeneratedUI {
  generation_id: string;
  spec_id: string;
  ui_code: string;
  ui_type: string;
  components_generated: number;
  confidence: number;
  generation_hash?: string;
}

// =============================================================================
// Tambo Engine Implementation
// =============================================================================

export class TamboEngine {
  private engine: any;

  constructor() {
    if (tamboNapi) {
      this.engine = new tamboNapi.TamboEngineNapi();
    } else {
      console.warn('Using mock TamboEngine - Rust NAPI module not available');
      this.engine = null;
    }
  }

  /**
   * Initialize engine with default components (instance method)
   */
  async initialize(): Promise<void> {
    if (this.engine && typeof this.engine.initWithDefaults === 'function') {
      await this.engine.initWithDefaults();
    }
  }

  /**
   * Initialize engine with default components (static factory)
   */
  static async initWithDefaults(): Promise<TamboEngine> {
    const instance = new TamboEngine();
    await instance.initialize();
    return instance;
  }

  /**
   * Convert UISpec to NAPI format (snake_case to camelCase)
   */
  private toNapiSpec(spec: UISpec): any {
    return {
      specId: spec.spec_id,
      title: spec.title,
      description: spec.description,
      components: spec.components.map(c => ({
        componentId: c.component_id,
        componentType: c.component_type,
        properties: c.properties,
        children: c.children,
        bindings: c.bindings.map(b => ({
          property: b.property,
          source: b.source,
          transform: b.transform,
        })),
      })),
      layout: {
        layoutType: spec.layout.layout_type,
        constraints: {
          minWidth: spec.layout.constraints.min_width,
          maxWidth: spec.layout.constraints.max_width,
          minHeight: spec.layout.constraints.min_height,
          maxHeight: spec.layout.constraints.max_height,
        },
        regions: spec.layout.regions.map(r => ({
          regionId: r.region_id,
          regionType: r.region_type,
          position: { x: r.position.x, y: r.position.y },
          size: { width: r.size.width, height: r.size.height },
        })),
      },
      style: {
        theme: spec.style.theme,
        colors: spec.style.colors,
        typography: {
          fontFamily: spec.style.typography.font_family,
          fontSizes: spec.style.typography.font_sizes,
          lineHeights: spec.style.typography.line_heights,
        },
        spacing: {
          scale: spec.style.spacing.scale,
          unit: spec.style.spacing.unit,
        },
      },
      interactions: spec.interactions.map(i => ({
        interactionId: i.interaction_id,
        trigger: i.trigger,
        action: i.action,
        target: (i as any).target || '',
      })),
      createdAt: spec.created_at,
    };
  }

  /**
   * Convert NAPI result to GeneratedUI format
   */
  private fromNapiResult(result: any): GeneratedUI {
    return {
      generation_id: result.generationId,
      spec_id: result.specId,
      ui_code: result.uiCode,
      ui_type: result.uiType,
      components_generated: result.componentsGenerated,
      confidence: result.confidence,
      generation_hash: result.generationHash,
    };
  }

  /**
   * Generate UI (standard mode)
   */
  async generateUI(spec: UISpec, uiType: string): Promise<GeneratedUI> {
    if (!this.engine) {
      // Mock implementation for development
      return this.mockGenerateUI(spec, uiType);
    }

    const napiSpec = this.toNapiSpec(spec);
    const result = await this.engine.generateUi(napiSpec, uiType);
    return this.fromNapiResult(result);
  }

  /**
   * Generate UI with validation
   */
  async generateUIValidated(spec: UISpec, uiType: string): Promise<GeneratedUI> {
    // Validate spec
    const validationError = this.validateSpec(spec);
    if (validationError) {
      throw new Error(`Validation failed: ${validationError}`);
    }

    if (!this.engine) {
      return this.mockGenerateUI(spec, uiType);
    }

    const napiSpec = this.toNapiSpec(spec);
    const result = await this.engine.generateUiValidated(napiSpec, uiType);
    return this.fromNapiResult(result);
  }

  /**
   * Validate UI spec
   */
  private validateSpec(spec: UISpec): string | null {
    if (!spec.spec_id || spec.spec_id.trim() === '') {
      return 'spec_id is required and cannot be empty';
    }
    if (!spec.title || spec.title.trim() === '') {
      return 'title is required and cannot be empty';
    }
    if (!spec.components || spec.components.length === 0) {
      return 'At least one component is required';
    }
    return null;
  }

  /**
   * Generate UI with reproducibility (seed-based)
   */
  async generateUIReproducible(spec: UISpec, uiType: string, seed: number): Promise<GeneratedUI> {
    if (!this.engine) {
      return this.mockGenerateUIReproducible(spec, uiType, seed);
    }

    const napiSpec = this.toNapiSpec(spec);
    const result = await this.engine.generateUiReproducible(napiSpec, uiType, seed);
    return this.fromNapiResult(result);
  }

  /**
   * Mock reproducible generation with deterministic hash
   */
  private mockGenerateUIReproducible(spec: UISpec, uiType: string, seed: number): GeneratedUI {
    // Use seed to create deterministic generation ID
    const generationId = `gen_seed_${seed}_${this.computeHash(spec.spec_id, String(seed))}`;
    
    // Generate simple mock UI code
    const uiCode = `// Generated UI for ${spec.title} (seed: ${seed})
import React from 'react';

export default function GeneratedUI() {
  return (
    <div className="generated-ui">
      <h1>${spec.title}</h1>
      <p>${spec.description}</p>
      <div className="components">
        ${spec.components.map(c => `<div key="${c.component_id}">${c.component_type}</div>`).join('\n        ')}
      </div>
    </div>
  );
}`;

    // Compute deterministic hash from seed and spec
    const hash = this.computeHash(generationId, spec.spec_id, uiCode, String(seed));

    return {
      generation_id: generationId,
      spec_id: spec.spec_id,
      ui_code: uiCode,
      ui_type: uiType,
      components_generated: spec.components.length,
      confidence: 0.9,
      generation_hash: hash,
    };
  }

  /**
   * Save generation state
   */
  async saveGenerationState(generationId: string, specId: string, state: Record<string, unknown>): Promise<void> {
    if (!this.engine) {
      // Mock implementation - store in memory
      if (!this.mockStates) {
        this.mockStates = new Map();
      }
      this.mockStates.set(generationId, {
        generation_id: generationId,
        spec_id: specId,
        state,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      console.log(`[Mock] Saved state for ${generationId}`);
      return;
    }

    await this.engine.saveGenerationState(generationId, specId, JSON.stringify(state));
  }

  /**
   * Load generation state
   */
  async loadGenerationState(generationId: string): Promise<Record<string, unknown> | null> {
    if (!this.engine) {
      // Mock implementation - load from memory
      if (this.mockStates) {
        const state = this.mockStates.get(generationId);
        if (state) {
          console.log(`[Mock] Loaded state for ${generationId}`);
          return state.state;
        }
      }
      console.log(`[Mock] No state found for ${generationId}`);
      return null;
    }

    const stateStr = await this.engine.loadGenerationState(generationId);
    return stateStr ? JSON.parse(stateStr) : null;
  }

  // Mock state storage
  private mockStates: Map<string, any> | null = null;

  /**
   * Mock implementation for development
   */
  private mockGenerateUI(spec: UISpec, uiType: string): GeneratedUI {
    const generationId = `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Generate simple mock UI code
    const uiCode = `// Generated UI for ${spec.title}
import React from 'react';

export default function GeneratedUI() {
  return (
    <div className="generated-ui">
      <h1>${spec.title}</h1>
      <p>${spec.description}</p>
      <div className="components">
        ${spec.components.map(c => `<div key="${c.component_id}">${c.component_type}</div>`).join('\n        ')}
      </div>
    </div>
  );
}`;

    return {
      generation_id: generationId,
      spec_id: spec.spec_id,
      ui_code: uiCode,
      ui_type: uiType,
      components_generated: spec.components.length,
      confidence: 0.9,
      generation_hash: this.computeHash(generationId, spec.spec_id, uiCode),
    };
  }

  /**
   * Compute hash for reproducibility verification
   */
  private computeHash(...args: string[]): string {
    let hash = 0;
    const str = args.join('|');
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return Math.abs(hash).toString(16).padStart(16, '0');
  }

  // =============================================================================
  // Hash Engine Methods
  // =============================================================================

  /**
   * Hash arbitrary content
   */
  hashContent(content: string): string {
    if (!this.engine) {
      return this.computeHash(content);
    }
    return this.engine.hashContent(content);
  }

  /**
   * Verify content against expected hash
   */
  verifyHash(content: string, expectedHash: string): boolean {
    if (!this.engine) {
      return this.computeHash(content) === expectedHash;
    }
    return this.engine.verifyHash(content, expectedHash);
  }

  // =============================================================================
  // Spec Diff Engine Methods
  // =============================================================================

  /**
   * Compare two specs and return differences
   */
  diffSpecs(oldSpec: UISpec, newSpec: UISpec): any {
    if (!this.engine) {
      // Mock implementation
      return {
        has_changes: JSON.stringify(oldSpec) !== JSON.stringify(newSpec),
        component_changes: [],
        layout_changes: [],
        style_changes: [],
        breaking_changes: [],
      };
    }

    const oldNapiSpec = this.toNapiSpec(oldSpec);
    const newNapiSpec = this.toNapiSpec(newSpec);
    return this.engine.diffSpecs(oldNapiSpec, newNapiSpec);
  }

  /**
   * Check if spec diff has breaking changes
   */
  hasBreakingChanges(diff: any): boolean {
    if (!this.engine) {
      return diff.breaking_changes && diff.breaking_changes.length > 0;
    }
    return this.engine.hasBreakingChanges(diff);
  }

  /**
   * Generate human-readable summary of changes
   */
  summarizeChanges(diff: any): string {
    if (!this.engine) {
      const changes = diff.component_changes?.length || 0;
      return `Changes: ${changes} component(s) modified`;
    }
    return this.engine.summarizeChanges(diff);
  }

  // =============================================================================
  // Accessibility (A11y) Engine Methods
  // =============================================================================

  /**
   * Validate spec for accessibility
   */
  validateA11y(spec: UISpec): any {
    if (!this.engine) {
      // Mock implementation - basic checks
      const violations = [];
      if (!spec.components || spec.components.length === 0) {
        violations.push({
          rule: 'empty-spec',
          severity: 'Error',
          description: 'Spec has no components',
          element: 'spec',
          remediation: 'Add at least one component',
          wcag_reference: 'N/A',
        });
      }
      
      return {
        passed: violations.length === 0,
        score: violations.length === 0 ? 1.0 : 0.5,
        violations,
        warnings: [],
      };
    }

    const napiSpec = this.toNapiSpec(spec);
    return this.engine.validateA11Y(napiSpec);
  }

  /**
   * Validate generated UI for accessibility
   */
  validateUiA11y(ui: GeneratedUI): any {
    if (!this.engine) {
      // Mock implementation
      return {
        passed: true,
        score: 1.0,
        violations: [],
        warnings: [],
      };
    }

    const napiUi = {
      generationId: ui.generation_id,
      specId: ui.spec_id,
      uiCode: ui.ui_code,
      uiType: ui.ui_type,
      componentsGenerated: ui.components_generated,
      confidence: ui.confidence,
      generationHash: ui.generation_hash,
    };
    return this.engine.validateUiA11Y(napiUi);
  }

  /**
   * Generate accessibility report
   */
  generateA11yReport(result: any): string {
    if (!this.engine) {
      return `# Accessibility Report

**Score:** ${(result.score * 100).toFixed(0)}%
**Status:** ${result.passed ? 'PASSED' : 'FAILED'}

## Violations (${result.violations?.length || 0})
${result.violations?.map((v: any) => `- **${v.rule}**: ${v.description}`).join('\n') || 'None'}

## Warnings (${result.warnings?.length || 0})
${result.warnings?.map((w: any) => `- **${w.rule}**: ${w.description}`).join('\n') || 'None'}
`;
    }
    return this.engine.generateA11YReport(result);
  }
}
