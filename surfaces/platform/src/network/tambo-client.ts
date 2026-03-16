/**
 * Tambo Client - UI Integration
 * 
 * Provides UI generation with determinism modes:
 * - Standard generation
 * - Validated generation (schema validation)
 * - Reproducible generation (seed-based)
 * - Streaming generation (SSE)
 */

import { A2R_BASE_URL } from '../index.js';

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

export interface StreamChunk {
  type: 'chunk' | 'progress' | 'complete' | 'error' | 'cancelled';
  data: unknown;
}

export interface GenerationConfig {
  mode: 'standard' | 'validated' | 'reproducible' | 'streaming';
  seed?: number;
  emitProgress?: boolean;
  chunkSize?: number;
}

// =============================================================================
// Tambo Client
// =============================================================================

export class TamboClient {
  private baseUrl: string;

  constructor(baseUrl: string = A2R_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Generate UI (standard mode)
   * POST /v1/tambo/generate
   */
  async generateUI(spec: UISpec, uiType: string = 'react'): Promise<GeneratedUI> {
    const response = await fetch(`${this.baseUrl}/v1/tambo/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec, ui_type: uiType }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `Generation failed: ${response.statusText}`);
    }

    return response.json() as Promise<GeneratedUI>;
  }

  /**
   * Generate UI with validation
   * POST /v1/tambo/generate/validated
   */
  async generateUIValidated(spec: UISpec, uiType: string = 'react'): Promise<GeneratedUI> {
    const response = await fetch(`${this.baseUrl}/v1/tambo/generate/validated`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec, ui_type: uiType }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      if (response.status === 400) {
        throw new Error(`Validation failed: ${error.error}`);
      }
      throw new Error(error.error || `Validated generation failed: ${response.statusText}`);
    }

    return response.json() as Promise<GeneratedUI>;
  }

  /**
   * Generate UI with reproducibility (seed-based)
   * POST /v1/tambo/generate/reproducible
   */
  async generateUIReproducible(
    spec: UISpec,
    uiType: string = 'react',
    seed?: number
  ): Promise<GeneratedUI> {
    const deterministicSeed = seed ?? this.generateSeedFromSpec(spec);
    
    const response = await fetch(`${this.baseUrl}/v1/tambo/generate/reproducible`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec, ui_type: uiType, seed: deterministicSeed }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `Reproducible generation failed: ${response.statusText}`);
    }

    return response.json() as Promise<GeneratedUI>;
  }

  /**
   * Generate UI with streaming
   * POST /v1/tambo/generate/stream
   */
  async *generateUIStreaming(
    spec: UISpec,
    uiType: string = 'react',
    config?: { emitProgress?: boolean; chunkSize?: number }
  ): AsyncGenerator<StreamChunk> {
    const response = await fetch(`${this.baseUrl}/v1/tambo/generate/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec, ui_type: uiType }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Streaming generation failed: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Parse SSE events
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
          const lines = event.split('\n');
          let eventType: string = 'data';
          let data: unknown = null;

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7);
            } else if (line.startsWith('data: ')) {
              try {
                data = JSON.parse(line.slice(6));
              } catch {
                data = line.slice(6);
              }
            }
          }

          yield { type: eventType as any, data };
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Save generation state
   * POST /v1/tambo/generations/:id/state
   */
  async saveGenerationState(
    generationId: string,
    state: Record<string, unknown>
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/v1/tambo/generations/${generationId}/state`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to save state: ${response.statusText}`);
    }
  }

  /**
   * Load generation state
   * GET /v1/tambo/generations/:id/state
   */
  async loadGenerationState(generationId: string): Promise<Record<string, unknown> | null> {
    const response = await fetch(
      `${this.baseUrl}/v1/tambo/generations/${generationId}/state`,
      {
        method: 'GET',
      }
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to load state: ${response.statusText}`);
    }

    return response.json() as Promise<Record<string, unknown>>;
  }

  /**
   * Generate deterministic seed from spec
   */
  private generateSeedFromSpec(spec: UISpec): number {
    let hash = 0;
    const str = spec.spec_id;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash);
  }
}

// =============================================================================
// Export singleton
// =============================================================================

export const tamboClient = new TamboClient();
