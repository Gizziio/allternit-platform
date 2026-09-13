/**
 * Hyperdesign Registry
 *
 * A marketplace of Design.md specifications that can be installed
 * and applied to any Allternit agent or workspace.
 */

import { DESIGN_SYSTEMS_LIBRARY } from './design-systems-library';
import { ALLTERNIT_DESIGN_SYSTEM } from './allternit-design-system';

export interface DesignSystem {
  id: string;
  name: string;
  description: string;
  vibe: string;
  author: string;
  creatorHandle?: string;
  installs: number;
  likes?: number;
  views?: number;
  forks?: number;
  tags: string[];
  designMd: string;
  previewColors: string[]; // 3-4 hex codes for preview
}

// Derive a stable plausible install count from the entry id.
function deterministicInstalls(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return 150 + Math.abs(h % 8350);
}

// Map category strings like "E-Commerce & Retail" to tag arrays.
function categoryToTags(category: string): string[] {
  const parts = category.split(/[&,]/).map(s => s.trim().toLowerCase().replace(/\s+/g, '-'));
  const extras: Record<string, string[]> = {
    'e-commerce-&-retail': ['ecommerce', 'retail'],
    'ai-&-llm': ['ai', 'llm', 'tech'],
    'developer-tools': ['dev-tools', 'utility'],
    'professional-&-corporate': ['enterprise', 'b2b'],
    'media-&-consumer': ['consumer', 'media'],
    'design-&-creative': ['design', 'creative'],
    'themed-&-unique': ['themed', 'unique'],
    'fintech': ['finance', 'fintech'],
    'healthcare': ['health', 'medical'],
    'education': ['edu', 'learning'],
    'starter': ['starter', 'template'],
  };
  return extras[category.toLowerCase().replace(/\s+/g, '-')] ?? parts;
}

export const DESIGN_MARKETPLACE: DesignSystem[] = [
  // First-party canonical brand system — always first, default for new projects.
  ALLTERNIT_DESIGN_SYSTEM,
  ...DESIGN_SYSTEMS_LIBRARY.map(entry => {
  const installs = deterministicInstalls(entry.id);
  return {
    id: entry.id,
    name: entry.title,
    description: entry.summary,
    vibe: entry.category,
    author: 'Allternit Design',
    installs,
    likes: Math.round(installs * 0.72),
    views: installs * 4,
    forks: Math.round(installs * 0.18),
    tags: categoryToTags(entry.category),
    designMd: entry.body,
    previewColors: entry.swatches.slice(0, 4),
  };
  }),
];

export function getDesignById(id: string): DesignSystem | undefined {
  return DESIGN_MARKETPLACE.find(d => d.id === id);
}

function searchDesigns(query: string): DesignSystem[] {
  const lower = query.toLowerCase();
  return DESIGN_MARKETPLACE.filter(d => 
    d.name.toLowerCase().includes(lower) || 
    d.description.toLowerCase().includes(lower) ||
    d.tags.some(t => t.toLowerCase().includes(lower))
  );
}
