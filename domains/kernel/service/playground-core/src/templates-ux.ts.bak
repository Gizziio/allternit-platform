/**
 * UX Playground Templates
 *
 * High-leverage UX templates for visual agent workflows.
 */

import type { ContextBundle, PlaygroundTemplateType, PlaygroundOutputs } from './types';

// ============================================================================
// Template 3: Site Structure Audit
// ============================================================================

export interface SitemapNode {
  url: string;
  depth: number;
  parent?: string;
  children?: string[];
  traffic?: number;
  conversions?: number;
}

export interface SiteAuditConfig {
  detectOrphans: boolean;
  detectDeepPages: boolean;
  maxDepth: number;
}

export function createSiteAuditTemplate(
  sitemap: SitemapNode[],
  config?: SiteAuditConfig
) {
  const template: PlaygroundTemplateType = 'site-structure-audit';
  
  const inputs: ContextBundle = {
    sitemap: sitemap.map(n => ({
      url: n.url,
      depth: n.depth,
      parent: n.parent,
      children: n.children,
    })),
  };

  const generateOutput = (): PlaygroundOutputs => {
    const orphans = sitemap.filter(n => !n.parent && n.depth > 0);
    const deepPages = sitemap.filter(n => n.depth > (config?.maxDepth || 3));
    
    const redirectMap = orphans.map(o => ({
      from: o.url,
      to: sitemap.find(n => n.depth === 1)?.url || '/',
      reason: 'orphan',
    }));

    return {
      prompt: {
        text: `Restructure the site navigation to address:\n- ${orphans.length} orphan pages\n- ${deepPages.length} pages exceeding max depth\n\nProposed redirects:\n${redirectMap.map(r => `${r.from} → ${r.to}`).join('\n')}`,
        metadata: {
          templateType: template,
          generatedAt: new Date().toISOString(),
          inputHash: generateHash(JSON.stringify(inputs)),
        },
      },
    };
  };

  return { template, inputs, config, generateOutput };
}

// ============================================================================
// Template 4: Component Variation
// ============================================================================

export interface ComponentProp {
  name: string;
  type: 'boolean' | 'string' | 'number' | 'enum';
  values?: unknown[];
  defaultValue?: unknown;
}

export interface ComponentVariationConfig {
  props: ComponentProp[];
  showSideBySide: boolean;
  enableComments: boolean;
}

export function createComponentVariationTemplate(
  componentName: string,
  props: ComponentProp[],
  config?: ComponentVariationConfig
) {
  const template: PlaygroundTemplateType = 'component-variation';
  
  const inputs: ContextBundle = {
    componentProps: {
      [componentName]: props.reduce((acc, p) => ({
        ...acc,
        [p.name]: p.defaultValue,
      }), {}),
    },
  };

  const generateOutput = (selectedVariants: Record<string, unknown>): PlaygroundOutputs => {
    return {
      patch: {
        patches: [{
          path: `src/components/${componentName}.tsx`,
          newContent: `// Updated props: ${JSON.stringify(selectedVariants)}`,
        }],
        metadata: {
          generatedAt: new Date().toISOString(),
          inputHash: generateHash(JSON.stringify(inputs)),
          deterministic: true,
        },
      },
    };
  };

  return { template, inputs, config, generateOutput };
}

// ============================================================================
// Template 5: Copy Review
// ============================================================================

export interface CopyVariant {
  id: string;
  baseline: string;
  variants: string[];
  constraints?: Array<{ type: string; value: unknown }>;
}

export interface CopyReviewConfig {
  toneConstraints?: string[];
  lengthConstraints?: { min: number; max: number };
  requiredKeywords?: string[];
}

export function createCopyReviewTemplate(
  copyItems: CopyVariant[],
  config?: CopyReviewConfig
) {
  const template: PlaygroundTemplateType = 'copy-review';
  
  const inputs: ContextBundle = {
    copyVariants: copyItems,
  };

  const generateOutput = (selections: Record<string, string>): PlaygroundOutputs => {
    const acceptedCopy = Object.entries(selections).map(([id, text]) => {
      const item = copyItems.find(i => i.id === id);
      return {
        id,
        baseline: item?.baseline,
        selected: text,
      };
    });

    return {
      prompt: {
        text: `Apply the following copy changes:\n\n${acceptedCopy.map(c => `- ${c.id}: "${c.selected}"`).join('\n')}`,
        metadata: {
          templateType: template,
          generatedAt: new Date().toISOString(),
          inputHash: generateHash(JSON.stringify(inputs)),
        },
      },
    };
  };

  return { template, inputs, config, generateOutput };
}

// ============================================================================
// Template 6: Rive Playground
// ============================================================================

export interface RiveConfig {
  parameters: Array<{ name: string; type: 'number' | 'boolean'; min?: number; max?: number }>;
  stateMachines: string[];
  artboards: string[];
}

export function createRivePlaygroundTemplate(
  riveFile: string,
  config: RiveConfig
) {
  const template: PlaygroundTemplateType = 'rive-playground';
  
  const inputs: ContextBundle = {
    files: [{
      path: riveFile,
      language: 'rive',
      content: '',
    }],
  };

  const generateOutput = (parameters: Record<string, unknown>): PlaygroundOutputs => {
    return {
      patch: {
        patches: [{
          path: riveFile,
          newContent: JSON.stringify({ parameters, timestamp: new Date().toISOString() }),
        }],
        metadata: {
          generatedAt: new Date().toISOString(),
          inputHash: generateHash(JSON.stringify(inputs)),
          deterministic: true,
        },
      },
    };
  };

  return { template, inputs, config, generateOutput };
}

// ============================================================================
// Utilities
// ============================================================================

function generateHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// ============================================================================
// Template Registry
// ============================================================================

export const uxTemplates = {
  siteAudit: createSiteAuditTemplate,
  componentVariation: createComponentVariationTemplate,
  copyReview: createCopyReviewTemplate,
  rive: createRivePlaygroundTemplate,
};
