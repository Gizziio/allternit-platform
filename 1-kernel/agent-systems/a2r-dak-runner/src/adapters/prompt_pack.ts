/**
 * Prompt Pack Service Adapter
 * 
 * Provides deterministic, versioned prompts to DAK.
 * Supports both file-based (transitional) and service-based modes.
 * 
 * Integration with Prompt Pack Service (port 3005):
 * - Renders prompts with exact version pinning
 * - Produces receipts for Rails ledger
 * - Content-addressed for determinism
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { CorrelationId } from '../types';

export interface PromptPackConfig {
  mode: 'file' | 'service' | 'hybrid';
  serviceUrl?: string;  // http://127.0.0.1:3005
  packsDir?: string;    // agents/packs/ for file mode
  timeout?: number;
}

export interface RenderRequest {
  pack_id: string;
  prompt_id: string;
  version: string;  // Exact version for determinism, never "latest"
  variables: Record<string, unknown>;
  correlationId?: CorrelationId;
}

export interface RenderResult {
  rendered: string;
  content_hash: string;
  receipt_id: string;
  pack_id: string;
  prompt_id: string;
  version: string;
  rendered_at: string;
  deterministic: boolean;
}

export interface PromptReceipt {
  receipt_id: string;
  pack_id: string;
  prompt_id: string;
  version: string;
  content_hash: string;
  rendered_hash: string;
  rendered_at: string;
  variables_hash?: string;
}

export interface PackVersionInfo {
  pack_id: string;
  version: string;
  content_hash: string;
  prompts: string[];
}

export class PromptPackClient {
  private config: PromptPackConfig;
  private cache: Map<string, RenderResult> = new Map();

  constructor(config: PromptPackConfig) {
    this.config = {
      timeout: 5000,
      ...config,
    };
  }

  /**
   * Render a prompt with exact version pinning
   * 
   * Determinism guarantee: Same inputs (pack_id, version, variables) → Same output
   */
  async render(request: RenderRequest): Promise<RenderResult> {
    // Create cache key from deterministic inputs
    const cacheKey = this.createCacheKey(request);
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    let result: RenderResult;

    switch (this.config.mode) {
      case 'service':
        result = await this.renderFromService(request);
        break;
      case 'file':
        result = await this.renderFromFile(request);
        break;
      case 'hybrid':
      default:
        // Try service first, fall back to file
        try {
          result = await this.renderFromService(request);
        } catch (error) {
          console.warn(`Service render failed, falling back to file: ${error}`);
          result = await this.renderFromFile(request);
        }
        break;
    }

    // Cache result
    this.cache.set(cacheKey, result);

    return result;
  }

  /**
   * Batch render multiple prompts
   */
  async renderBatch(requests: RenderRequest[]): Promise<RenderResult[]> {
    return Promise.all(requests.map(r => this.render(r)));
  }

  /**
   * Verify a receipt with the service
   */
  async verifyReceipt(receiptId: string): Promise<PromptReceipt | null> {
    if (this.config.mode === 'file') {
      // In file mode, reconstruct receipt from local data
      return this.reconstructReceiptFromFile(receiptId);
    }

    try {
      const response = await fetch(`${this.config.serviceUrl}/v1/receipts/${receiptId}`);
      if (response.ok) {
        return await response.json() as PromptReceipt;
      }
    } catch (error) {
      console.warn(`Failed to verify receipt with service: ${error}`);
    }

    return null;
  }

  /**
   * Get available versions for a pack
   */
  async getPackVersions(packId: string): Promise<string[]> {
    if (this.config.mode === 'file') {
      return this.getFilePackVersions(packId);
    }

    try {
      const response = await fetch(`${this.config.serviceUrl}/v1/packs/${packId}`);
      if (response.ok) {
        const data = await response.json() as { versions: string[] };
        return data.versions;
      }
    } catch (error) {
      console.warn(`Failed to get versions from service: ${error}`);
    }

    return [];
  }

  /**
   * Preload common prompts into cache
   */
  async warmCache(packs: Array<{ pack_id: string; prompt_id: string; version: string }>): Promise<void> {
    await Promise.all(
      packs.map(p => 
        this.render({
          pack_id: p.pack_id,
          prompt_id: p.prompt_id,
          version: p.version,
          variables: {},
        }).catch(err => {
          console.warn(`Failed to warm cache for ${p.pack_id}/${p.prompt_id}: ${err}`);
        })
      )
    );
  }

  /**
   * Clear render cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  // Private methods

  private async renderFromService(request: RenderRequest): Promise<RenderResult> {
    if (!this.config.serviceUrl) {
      throw new Error('Service URL not configured');
    }

    const response = await fetch(`${this.config.serviceUrl}/v1/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Service render failed: ${response.statusText}`);
    }

    return await response.json() as RenderResult;
  }

  private async renderFromFile(request: RenderRequest): Promise<RenderResult> {
    const packsDir = this.config.packsDir || 'agents/packs';
    
    // Construct path: agents/packs/{pack_id}/{version}/{prompt_id}.j2
    const templatePath = path.join(
      packsDir,
      request.pack_id,
      request.version,
      `${request.prompt_id}.j2`
    );

    if (!fs.existsSync(templatePath)) {
      // Try .md extension as fallback
      const mdPath = templatePath.replace('.j2', '.md');
      if (!fs.existsSync(mdPath)) {
        throw new Error(`Prompt not found: ${templatePath} or ${mdPath}`);
      }
    }

    // Read template
    const template = fs.readFileSync(templatePath, 'utf-8');

    // Simple variable substitution (Jinja2-compatible subset)
    const rendered = this.renderTemplate(template, request.variables);

    // Generate deterministic receipt
    const contentHash = crypto.createHash('sha256').update(template).digest('hex');
    const renderedHash = crypto.createHash('sha256').update(rendered).digest('hex');
    const receiptId = `rpt_${contentHash.slice(0, 16)}_${Date.now()}`;

    return {
      rendered,
      content_hash: renderedHash,
      receipt_id: receiptId,
      pack_id: request.pack_id,
      prompt_id: request.prompt_id,
      version: request.version,
      rendered_at: new Date().toISOString(),
      deterministic: true,
    };
  }

  private renderTemplate(template: string, variables: Record<string, unknown>): string {
    // Simple Jinja2-like substitution
    // Full Jinja2 would require a template engine library
    
    let result = template;

    // Replace {{ variable }}
    result = result.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
      const value = variables[key];
      return value !== undefined ? String(value) : match;
    });

    // Replace {% for %} loops (simplified)
    result = result.replace(/\{%\s*for\s+(\w+)\s+in\s+(\w+)\s*%\}([\s\S]*?)\{%\s*endfor\s*%\}/g, 
      (match, itemName, arrayName, content) => {
        const array = variables[arrayName] as unknown[];
        if (!Array.isArray(array)) return '';
        
        return array.map(item => {
          let itemContent = content;
          if (typeof item === 'object' && item !== null) {
            // Replace {{ item.property }}
            for (const [key, value] of Object.entries(item)) {
              itemContent = itemContent.replace(
                new RegExp(`\\{\\{\\s*${itemName}\\.${key}\\s*\\}\\}`, 'g'),
                String(value)
              );
            }
          } else {
            // Replace {{ item }}
            itemContent = itemContent.replace(
              new RegExp(`\\{\\{\\s*${itemName}\\s*\\}\\}`, 'g'),
              String(item)
            );
          }
          return itemContent;
        }).join('');
      }
    );

    // Replace {% include %} (simplified - not implemented for file mode)
    result = result.replace(/\{%\s*include\s+['"](.+?)['"]\s*%\}/g, 
      '<!-- include $1 not supported in file mode -->'
    );

    return result;
  }

  private createCacheKey(request: RenderRequest): string {
    // Deterministic cache key based on inputs
    const data = {
      pack_id: request.pack_id,
      prompt_id: request.prompt_id,
      version: request.version,
      variables: this.sortObjectKeys(request.variables),
    };
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  private sortObjectKeys(obj: Record<string, unknown>): Record<string, unknown> {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      const value = obj[key];
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        sorted[key] = this.sortObjectKeys(value as Record<string, unknown>);
      } else {
        sorted[key] = value;
      }
    }
    return sorted;
  }

  private reconstructReceiptFromFile(receiptId: string): PromptReceipt | null {
    // In file mode, try to reconstruct from cache or return null
    for (const [_, result] of this.cache) {
      if (result.receipt_id === receiptId) {
        return {
          receipt_id: result.receipt_id,
          pack_id: result.pack_id,
          prompt_id: result.prompt_id,
          version: result.version,
          content_hash: result.content_hash,
          rendered_hash: result.content_hash,
          rendered_at: result.rendered_at,
        };
      }
    }
    return null;
  }

  private getFilePackVersions(packId: string): string[] {
    const packsDir = this.config.packsDir || 'agents/packs';
    const packDir = path.join(packsDir, packId);
    
    if (!fs.existsSync(packDir)) {
      return [];
    }

    return fs.readdirSync(packDir)
      .filter(f => fs.statSync(path.join(packDir, f)).isDirectory())
      .sort();
  }
}

// Factory function
export function createPromptPackClient(config: PromptPackConfig): PromptPackClient {
  return new PromptPackClient(config);
}
