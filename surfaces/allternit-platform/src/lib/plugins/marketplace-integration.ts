/**
 * Marketplace Integration
 * 
 * Bridges the gap between:
 * - Bundled plugins (physically in repo: built-in + vendor)
 * - Downloadable plugins (vendored registry + external sources)
 * 
 * Provides a unified interface for the Plugin Marketplace UI.
 */

import type {
  MarketplacePlugin,
  InstalledPlugin,
  PluginCategory
} from './marketplace';
import type { PluginCapability } from './types';
import { 
  VENDORED_ANTHROPIC_PLUGINS,
  VENDORED_DOCKER_PLUGINS,
  VENDORED_ADDITIONAL_PLUGINS,
  type VendoredPlugin 
} from '@/plugins/vendor/vendored-plugins';

// =============================================================================
// PLUGIN SOURCE TYPES
// =============================================================================

export type BundledPluginSource = 
  | 'built-in'      // 10 core agent modes (image, video, etc.)
  | 'vendor';       // 16 Claude Desktop plugins

export type DownloadablePluginSource = 
  | 'vendored'      // Available in repo but not bundled (18 plugins)
  | 'external';     // Fetched from external repos (70+ plugins)

export interface BundledPlugin extends MarketplacePlugin {
  sourceType: 'bundled';
  bundledSource: BundledPluginSource;
  installPath: string;  // Local path in repo
}

export interface DownloadablePlugin extends MarketplacePlugin {
  sourceType: 'downloadable';
  downloadableSource: DownloadablePluginSource;
  downloadUrl: string;
  repository?: string;
  commitHash?: string;
  vendoredDate?: string;
}

export type UnifiedMarketplacePlugin = BundledPlugin | DownloadablePlugin;

// =============================================================================
// BUNDLED PLUGINS REGISTRY
// =============================================================================

export const BUNDLED_PLUGINS: BundledPlugin[] = [
  // === BUILT-IN (10 plugins) ===
  {
    id: 'image',
    name: 'Image',
    description: 'Generate images from text prompts using Pollinations.ai (FREE)',
    version: '1.0.0',
    author: { name: 'Allternit', verified: true },
    category: 'create',
    capabilities: ['text-to-image', 'image-variations', 'style-transfer', 'upscale'] as unknown as PluginCapability[],
    license: 'Proprietary',
    price: { type: 'free' },
    downloads: 0,
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isBuiltIn: true,
    shade: 0,
    sourceType: 'bundled',
    bundledSource: 'built-in',
    installPath: 'plugins/built-in/image',
  },
  {
    id: 'video',
    name: 'Video',
    description: 'Generate videos from text or images using MiniMax/Kling (BYOK)',
    version: '1.0.0',
    author: { name: 'Allternit', verified: true },
    category: 'create',
    capabilities: ['text-to-video', 'image-to-video', 'video-editing', 'extend'] as unknown as PluginCapability[],
    license: 'Proprietary',
    price: { type: 'free' },
    downloads: 0,
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isBuiltIn: true,
    shade: 1,
    sourceType: 'bundled',
    bundledSource: 'built-in',
    installPath: 'plugins/built-in/video',
  },
  {
    id: 'slides',
    name: 'Slides',
    description: 'Create professional presentations with AI-generated content',
    version: '1.0.0',
    author: { name: 'Allternit', verified: true },
    category: 'create',
    capabilities: ['presentation-generation', 'slide-design', 'speaker-notes', 'pptx-export'] as unknown as PluginCapability[],
    license: 'Proprietary',
    price: { type: 'free' },
    downloads: 0,
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isBuiltIn: true,
    shade: 2,
    sourceType: 'bundled',
    bundledSource: 'built-in',
    installPath: 'plugins/built-in/slides',
  },
  {
    id: 'website',
    name: 'Website',
    description: 'Build complete websites with Next.js/React/Vue/HTML',
    version: '1.0.0',
    author: { name: 'Allternit', verified: true },
    category: 'create',
    capabilities: ['website-generation', 'landing-page', 'responsive-design', 'deployment-prep'] as unknown as PluginCapability[],
    license: 'Proprietary',
    price: { type: 'free' },
    downloads: 0,
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isBuiltIn: true,
    shade: 3,
    sourceType: 'bundled',
    bundledSource: 'built-in',
    installPath: 'plugins/built-in/website',
  },
  {
    id: 'research',
    name: 'Research',
    description: 'Multi-source research with citations and synthesis',
    version: '1.0.0',
    author: { name: 'Allternit', verified: true },
    category: 'analyze',
    capabilities: ['web-search', 'citation', 'synthesis', 'source-verification', 'deep-research'] as unknown as PluginCapability[],
    license: 'Proprietary',
    price: { type: 'free' },
    downloads: 0,
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isBuiltIn: true,
    shade: 0,
    sourceType: 'bundled',
    bundledSource: 'built-in',
    installPath: 'plugins/built-in/research',
  },
  {
    id: 'data',
    name: 'Data',
    description: 'Data analysis, visualization, and chart generation',
    version: '1.0.0',
    author: { name: 'Allternit', verified: true },
    category: 'analyze',
    capabilities: ['csv-import', 'excel-analysis', 'chart-generation', 'sql-query', 'insights'] as unknown as PluginCapability[],
    license: 'Proprietary',
    price: { type: 'free' },
    downloads: 0,
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isBuiltIn: true,
    shade: 1,
    sourceType: 'bundled',
    bundledSource: 'built-in',
    installPath: 'plugins/built-in/data',
  },
  {
    id: 'code',
    name: 'Code',
    description: 'Generate and execute code in multiple languages with live preview',
    version: '1.0.0',
    author: { name: 'Allternit', verified: true },
    category: 'build',
    capabilities: ['code-generation', 'live-preview', 'multi-language', 'package-install'] as unknown as PluginCapability[],
    license: 'Proprietary',
    price: { type: 'free' },
    downloads: 0,
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isBuiltIn: true,
    shade: 0,
    sourceType: 'bundled',
    bundledSource: 'built-in',
    installPath: 'plugins/built-in/code',
  },
  {
    id: 'assets',
    name: 'Assets',
    description: 'File management, organization, and asset library',
    version: '1.0.0',
    author: { name: 'Allternit', verified: true },
    category: 'build',
    capabilities: ['file-upload', 'ai-tagging', 'semantic-search', 'asset-library'] as unknown as PluginCapability[],
    license: 'Proprietary',
    price: { type: 'free' },
    downloads: 0,
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isBuiltIn: true,
    shade: 1,
    sourceType: 'bundled',
    bundledSource: 'built-in',
    installPath: 'plugins/built-in/assets',
  },
  {
    id: 'swarms',
    name: 'Swarms',
    description: 'Multi-agent orchestration and consensus building',
    version: '1.0.0',
    author: { name: 'Allternit', verified: true },
    category: 'automate',
    capabilities: ['multi-agent', 'agent-coordination', 'consensus-building', 'task-delegation'] as unknown as PluginCapability[],
    license: 'Proprietary',
    price: { type: 'free' },
    downloads: 0,
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isBuiltIn: true,
    shade: 0,
    sourceType: 'bundled',
    bundledSource: 'built-in',
    installPath: 'plugins/built-in/swarms',
  },
  {
    id: 'flow',
    name: 'Flow',
    description: 'Visual workflow automation and custom automations',
    version: '1.0.0',
    author: { name: 'Allternit', verified: true },
    category: 'automate',
    capabilities: ['visual-builder', 'node-editor', 'trigger-setup', 'automation'] as unknown as PluginCapability[],
    license: 'Proprietary',
    price: { type: 'free' },
    downloads: 0,
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isBuiltIn: true,
    shade: 1,
    sourceType: 'bundled',
    bundledSource: 'built-in',
    installPath: 'plugins/built-in/flow',
  },

  // === OUR EXTENSIONS (4 plugins) ===
  {
    id: 'office-excel',
    name: 'Allternit for Excel',
    description: 'AI-powered Excel automation — formulas, charts, tables, financial modeling',
    version: '1.0.0',
    author: { name: 'Allternit', verified: true },
    category: 'analyze',
    capabilities: ['excel-automation', 'formulas', 'charts', 'financial-modeling'] as unknown as PluginCapability[],
    license: 'Proprietary',
    price: { type: 'free' },
    downloads: 5000,
    rating: { average: 4.7, count: 42 },
    publishedAt: '2024-01-01',
    updatedAt: '2024-03-20',
    shade: 2,
    sourceType: 'bundled',
    bundledSource: 'built-in',
    installPath: 'plugins/built-in/office-excel',
  },
  {
    id: 'office-word',
    name: 'Allternit for Word',
    description: 'AI-powered document drafting, editing, redlining, style application',
    version: '1.0.0',
    author: { name: 'Allternit', verified: true },
    category: 'create',
    capabilities: ['word-automation', 'documents', 'writing', 'redline'] as unknown as PluginCapability[],
    license: 'Proprietary',
    price: { type: 'free' },
    downloads: 4800,
    rating: { average: 4.6, count: 38 },
    publishedAt: '2024-01-01',
    updatedAt: '2024-03-20',
    shade: 3,
    sourceType: 'bundled',
    bundledSource: 'built-in',
    installPath: 'plugins/built-in/office-word',
  },
  {
    id: 'office-powerpoint',
    name: 'Allternit for PowerPoint',
    description: 'AI-powered slide creation, deck design, content generation',
    version: '1.0.0',
    author: { name: 'Allternit', verified: true },
    category: 'create',
    capabilities: ['powerpoint-automation', 'slides', 'presentations', 'deck-design'] as unknown as PluginCapability[],
    license: 'Proprietary',
    price: { type: 'free' },
    downloads: 5200,
    rating: { average: 4.8, count: 45 },
    publishedAt: '2024-01-01',
    updatedAt: '2024-03-20',
    shade: 1,
    sourceType: 'bundled',
    bundledSource: 'built-in',
    installPath: 'plugins/built-in/office-powerpoint',
  },
  {
    id: 'chrome',
    name: 'Allternit Chrome Extension',
    description: 'Browser automation, web capture, and extension workflows',
    version: '1.0.0',
    author: { name: 'Allternit', verified: true },
    category: 'automate',
    capabilities: ['browser-automation', 'web-capture', 'extension-workflows'] as unknown as PluginCapability[],
    license: 'Proprietary',
    price: { type: 'free' },
    downloads: 8500,
    rating: { average: 4.7, count: 67 },
    publishedAt: '2024-01-01',
    updatedAt: '2024-03-20',
    shade: 3,
    sourceType: 'bundled',
    bundledSource: 'built-in',
    installPath: 'plugins/built-in/chrome',
  },

  // === VENDOR PLUGINS (16 Claude Desktop plugins) ===
  {
    id: 'legal',
    name: 'Legal',
    description: 'Speed up contract review, NDA triage, and compliance workflows',
    version: '1.1.0',
    author: { name: 'Anthropic', verified: true },
    category: 'analyze',
    capabilities: ['contract-review', 'nda-triage', 'compliance-check', 'legal-briefs'] as unknown as PluginCapability[],
    license: 'MIT',
    price: { type: 'free' },
    downloads: 15000,
    rating: { average: 4.8, count: 124 },
    publishedAt: '2024-01-15',
    updatedAt: '2024-03-20',
    shade: 2,
    sourceType: 'bundled',
    bundledSource: 'vendor',
    installPath: 'plugins/vendor/claude-desktop/legal',
  },
  {
    id: 'engineering',
    name: 'Engineering',
    description: 'Streamline engineering workflows — standups, code review, incidents',
    version: '1.1.0',
    author: { name: 'Anthropic', verified: true },
    category: 'build',
    capabilities: ['code-review', 'standup-notes', 'incident-response', 'architecture-decisions'] as unknown as PluginCapability[],
    license: 'MIT',
    price: { type: 'free' },
    downloads: 22000,
    rating: { average: 4.9, count: 312 },
    publishedAt: '2024-01-15',
    updatedAt: '2024-03-20',
    shade: 2,
    sourceType: 'bundled',
    bundledSource: 'vendor',
    installPath: 'plugins/vendor/claude-desktop/engineering',
  },
  {
    id: 'data-claude',
    name: 'Data (Claude)',
    description: 'Write SQL, explore datasets, and generate insights faster',
    version: '1.0.0',
    author: { name: 'Anthropic', verified: true },
    category: 'analyze',
    capabilities: ['sql-generation', 'data-exploration', 'visualization', 'dashboards'] as unknown as PluginCapability[],
    license: 'MIT',
    price: { type: 'free' },
    downloads: 18000,
    rating: { average: 4.7, count: 89 },
    publishedAt: '2024-01-15',
    updatedAt: '2024-03-20',
    shade: 3,
    sourceType: 'bundled',
    bundledSource: 'vendor',
    installPath: 'plugins/vendor/claude-desktop/data',
  },
  {
    id: 'design',
    name: 'Design',
    description: 'Accelerate design workflows — critique, design system management, UX',
    version: '1.1.0',
    author: { name: 'Anthropic', verified: true },
    category: 'create',
    capabilities: ['design-critique', 'design-systems', 'ux-writing', 'accessibility'] as unknown as PluginCapability[],
    license: 'MIT',
    price: { type: 'free' },
    downloads: 12000,
    rating: { average: 4.6, count: 67 },
    publishedAt: '2024-01-15',
    updatedAt: '2024-03-20',
    shade: 1,
    sourceType: 'bundled',
    bundledSource: 'vendor',
    installPath: 'plugins/vendor/claude-desktop/design',
  },
  {
    id: 'sales',
    name: 'Sales',
    description: 'Prospect, craft outreach, and build deal strategy faster',
    version: '1.1.0',
    author: { name: 'Anthropic', verified: true },
    category: 'analyze',
    capabilities: ['call-summary', 'pipeline-review', 'forecasting', 'outreach'] as unknown as PluginCapability[],
    license: 'MIT',
    price: { type: 'free' },
    downloads: 9500,
    rating: { average: 4.5, count: 45 },
    publishedAt: '2024-01-15',
    updatedAt: '2024-03-20',
    shade: 3,
    sourceType: 'bundled',
    bundledSource: 'vendor',
    installPath: 'plugins/vendor/claude-desktop/sales',
  },
  {
    id: 'marketing',
    name: 'Marketing',
    description: 'Create content, plan campaigns, and analyze performance',
    version: '1.1.0',
    author: { name: 'Anthropic', verified: true },
    category: 'create',
    capabilities: ['content-creation', 'campaign-planning', 'seo-audit', 'brand-review'] as unknown as PluginCapability[],
    license: 'MIT',
    price: { type: 'free' },
    downloads: 14000,
    rating: { average: 4.7, count: 78 },
    publishedAt: '2024-01-15',
    updatedAt: '2024-03-20',
    shade: 2,
    sourceType: 'bundled',
    bundledSource: 'vendor',
    installPath: 'plugins/vendor/claude-desktop/marketing',
  },
  {
    id: 'finance',
    name: 'Finance',
    description: 'Accounting, SOX compliance, and financial analysis workflows',
    version: '1.0.0',
    author: { name: 'Anthropic', verified: true },
    category: 'analyze',
    capabilities: ['accounting', 'sox-testing', 'reconciliation', 'variance-analysis'] as unknown as PluginCapability[],
    license: 'MIT',
    price: { type: 'free' },
    downloads: 8200,
    rating: { average: 4.6, count: 34 },
    publishedAt: '2024-01-15',
    updatedAt: '2024-03-20',
    shade: 2,
    sourceType: 'bundled',
    bundledSource: 'vendor',
    installPath: 'plugins/vendor/claude-desktop/finance',
  },
  {
    id: 'human-resources',
    name: 'Human Resources',
    description: 'People ops, onboarding, and performance management',
    version: '1.0.0',
    author: { name: 'Anthropic', verified: true },
    category: 'analyze',
    capabilities: ['onboarding', 'performance-reviews', 'comp-analysis', 'policy-lookup'] as unknown as PluginCapability[],
    license: 'MIT',
    price: { type: 'free' },
    downloads: 7800,
    rating: { average: 4.5, count: 28 },
    publishedAt: '2024-01-15',
    updatedAt: '2024-03-20',
    shade: 3,
    sourceType: 'bundled',
    bundledSource: 'vendor',
    installPath: 'plugins/vendor/claude-desktop/human-resources',
  },
  {
    id: 'customer-support',
    name: 'Customer Support',
    description: 'Ticketing, KB articles, and response drafting',
    version: '1.0.0',
    author: { name: 'Anthropic', verified: true },
    category: 'analyze',
    capabilities: ['ticket-triage', 'kb-articles', 'response-drafting', 'escalation'] as unknown as PluginCapability[],
    license: 'MIT',
    price: { type: 'free' },
    downloads: 11000,
    rating: { average: 4.7, count: 56 },
    publishedAt: '2024-01-15',
    updatedAt: '2024-03-20',
    shade: 1,
    sourceType: 'bundled',
    bundledSource: 'vendor',
    installPath: 'plugins/vendor/claude-desktop/customer-support',
  },
  {
    id: 'operations',
    name: 'Operations',
    description: 'Process docs, runbooks, and vendor management',
    version: '1.0.0',
    author: { name: 'Anthropic', verified: true },
    category: 'automate',
    capabilities: ['process-docs', 'runbooks', 'vendor-review', 'change-requests'] as unknown as PluginCapability[],
    license: 'MIT',
    price: { type: 'free' },
    downloads: 6500,
    rating: { average: 4.4, count: 23 },
    publishedAt: '2024-01-15',
    updatedAt: '2024-03-20',
    shade: 0,
    sourceType: 'bundled',
    bundledSource: 'vendor',
    installPath: 'plugins/vendor/claude-desktop/operations',
  },
  {
    id: 'product-management',
    name: 'Product Management',
    description: 'Roadmaps, specs, and research synthesis',
    version: '1.0.0',
    author: { name: 'Anthropic', verified: true },
    category: 'create',
    capabilities: ['roadmap-planning', 'spec-writing', 'research-synthesis', 'metrics'] as unknown as PluginCapability[],
    license: 'MIT',
    price: { type: 'free' },
    downloads: 10500,
    rating: { average: 4.6, count: 42 },
    publishedAt: '2024-01-15',
    updatedAt: '2024-03-20',
    shade: 3,
    sourceType: 'bundled',
    bundledSource: 'vendor',
    installPath: 'plugins/vendor/claude-desktop/product-management',
  },
  {
    id: 'enterprise-search',
    name: 'Enterprise Search',
    description: 'Knowledge synthesis and enterprise-wide search',
    version: '1.0.0',
    author: { name: 'Anthropic', verified: true },
    category: 'analyze',
    capabilities: ['search-strategy', 'knowledge-synthesis', 'source-management'] as unknown as PluginCapability[],
    license: 'MIT',
    price: { type: 'free' },
    downloads: 7200,
    rating: { average: 4.5, count: 31 },
    publishedAt: '2024-01-15',
    updatedAt: '2024-03-20',
    shade: 0,
    sourceType: 'bundled',
    bundledSource: 'vendor',
    installPath: 'plugins/vendor/claude-desktop/enterprise-search',
  },
  {
    id: 'bio-research',
    name: 'Bio Research',
    description: 'Scientific research synthesis and bioinformatics workflows',
    version: '1.0.0',
    author: { name: 'Anthropic', verified: true },
    category: 'analyze',
    capabilities: ['research-synthesis', 'bioinformatics', 'problem-selection'] as unknown as PluginCapability[],
    license: 'MIT',
    price: { type: 'free' },
    downloads: 4800,
    rating: { average: 4.8, count: 19 },
    publishedAt: '2024-01-15',
    updatedAt: '2024-03-20',
    shade: 0,
    sourceType: 'bundled',
    bundledSource: 'vendor',
    installPath: 'plugins/vendor/claude-desktop/bio-research',
  },
  {
    id: 'productivity',
    name: 'Productivity',
    description: 'Daily task management and productivity workflows',
    version: '1.0.0',
    author: { name: 'Anthropic', verified: true },
    category: 'automate',
    capabilities: ['task-management', 'daily-updates', 'productivity-tracking'] as unknown as PluginCapability[],
    license: 'MIT',
    price: { type: 'free' },
    downloads: 15600,
    rating: { average: 4.6, count: 89 },
    publishedAt: '2024-01-15',
    updatedAt: '2024-03-20',
    shade: 1,
    sourceType: 'bundled',
    bundledSource: 'vendor',
    installPath: 'plugins/vendor/claude-desktop/productivity',
  },
  {
    id: 'cowork-plugin-management',
    name: 'Plugin Management',
    description: 'Create and customize cowork plugins',
    version: '1.0.0',
    author: { name: 'Anthropic', verified: true },
    category: 'automate',
    capabilities: ['plugin-creation', 'plugin-customization', 'mcp-management'] as unknown as PluginCapability[],
    license: 'MIT',
    price: { type: 'free' },
    downloads: 3200,
    rating: { average: 4.3, count: 12 },
    publishedAt: '2024-01-15',
    updatedAt: '2024-03-20',
    shade: 2,
    sourceType: 'bundled',
    bundledSource: 'vendor',
    installPath: 'plugins/vendor/claude-desktop/cowork-plugin-management',
  },
  {
    id: 'partner-built',
    name: 'Partner Plugins',
    description: 'Apollo, Brand Voice, Common Room, Slack integrations',
    version: '1.0.0',
    author: { name: 'Anthropic Partners', verified: true },
    category: 'integration',
    capabilities: ['apollo', 'brand-voice', 'common-room', 'slack'] as unknown as PluginCapability[],
    license: 'MIT',
    price: { type: 'free' },
    downloads: 21000,
    rating: { average: 4.7, count: 145 },
    publishedAt: '2024-01-15',
    updatedAt: '2024-03-20',
    shade: 0,
    sourceType: 'bundled',
    bundledSource: 'vendor',
    installPath: 'plugins/vendor/claude-desktop/partner-built',
  },
];

// =============================================================================
// DOWNLOADABLE PLUGINS (from vendored-plugins.ts)
// =============================================================================

function convertVendoredToDownloadable(vendored: VendoredPlugin[]): DownloadablePlugin[] {
  return vendored.map(plugin => ({
    id: plugin.id,
    name: plugin.name,
    description: plugin.description,
    version: plugin.version,
    author: plugin.author,
    category: plugin.category,
    capabilities: plugin.capabilities,
    license: 'MIT',
    price: { type: 'free' },
    downloads: 0,
    rating: { average: 0, count: 0 },
    publishedAt: plugin.vendored.date,
    updatedAt: plugin.vendored.date,
    repository: plugin.vendored.sourceRepo,
    icon: plugin.icon,
    tags: plugin.tags,
    sourceType: 'downloadable',
    downloadableSource: 'vendored',
    downloadUrl: `https://github.com/${plugin.vendored.sourceRepo}/archive/refs/heads/${plugin.vendored.sourceRef}.zip`,
    commitHash: plugin.vendored.commitHash,
    vendoredDate: plugin.vendored.date,
  })) as unknown as DownloadablePlugin[];
}

export function getDownloadablePlugins(): DownloadablePlugin[] {
  return [
    ...convertVendoredToDownloadable(VENDORED_ANTHROPIC_PLUGINS),
    ...convertVendoredToDownloadable(VENDORED_DOCKER_PLUGINS),
    ...convertVendoredToDownloadable(VENDORED_ADDITIONAL_PLUGINS),
  ];
}

// =============================================================================
// EXTERNAL MARKETPLACE SOURCES (70+ plugins)
// =============================================================================

export const EXTERNAL_MARKETPLACE_SOURCES = [
  {
    id: 'anthropic-official',
    name: 'Anthropic Official',
    url: 'https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/.claude-plugin/marketplace.json',
    trust: 'official' as const,
    estimatedPlugins: 25,
  },
  {
    id: 'anthropic-claude-code',
    name: 'Claude Code',
    url: 'https://raw.githubusercontent.com/anthropics/claude-code/main/.claude-plugin/marketplace.json',
    trust: 'official' as const,
    estimatedPlugins: 15,
  },
  {
    id: 'anthropic-skills',
    name: 'Anthropic Skills',
    url: 'https://raw.githubusercontent.com/anthropics/claude-skills/main/marketplace.json',
    trust: 'official' as const,
    estimatedPlugins: 20,
  },
  {
    id: 'docker-extensions',
    name: 'Docker Extensions',
    url: 'https://raw.githubusercontent.com/docker/extensions-sdk/main/marketplace.json',
    trust: 'verified' as const,
    estimatedPlugins: 10,
  },
];

// =============================================================================
// UNIFIED ACCESS
// =============================================================================

export function getAllPlugins(): UnifiedMarketplacePlugin[] {
  return [...BUNDLED_PLUGINS, ...getDownloadablePlugins()];
}

export function getBundledPlugins(): BundledPlugin[] {
  return BUNDLED_PLUGINS;
}

export function getBundledBySource(source: BundledPluginSource): BundledPlugin[] {
  return BUNDLED_PLUGINS.filter(p => p.bundledSource === source);
}

export function getPluginsByCategory(category: PluginCategory): UnifiedMarketplacePlugin[] {
  return getAllPlugins().filter(p => p.category === category);
}

export function searchPlugins(query: string): UnifiedMarketplacePlugin[] {
  const lower = query.toLowerCase();
  return getAllPlugins().filter(p => 
    p.name.toLowerCase().includes(lower) ||
    p.description.toLowerCase().includes(lower) ||
    p.id.toLowerCase().includes(lower) ||
    (p as any).tags?.some((t: string) => t.toLowerCase().includes(lower))
  );
}

// =============================================================================
// INSTALLATION HELPERS
// =============================================================================

export function isBundled(pluginId: string): boolean {
  return BUNDLED_PLUGINS.some(p => p.id === pluginId);
}

export function getBundledPlugin(pluginId: string): BundledPlugin | undefined {
  return BUNDLED_PLUGINS.find(p => p.id === pluginId);
}

export function getDownloadablePlugin(pluginId: string): DownloadablePlugin | undefined {
  return getDownloadablePlugins().find(p => p.id === pluginId);
}

// =============================================================================
// STATS
// =============================================================================

export const MARKETPLACE_STATS = {
  bundled: {
    total: BUNDLED_PLUGINS.length,
    builtIn: BUNDLED_PLUGINS.filter(p => p.bundledSource === 'built-in').length,
    vendor: BUNDLED_PLUGINS.filter(p => p.bundledSource === 'vendor').length,
  },
  downloadable: {
    vendored: getDownloadablePlugins().length,
    external: EXTERNAL_MARKETPLACE_SOURCES.reduce((sum, s) => sum + s.estimatedPlugins, 0),
  },
  totalAvailable: BUNDLED_PLUGINS.length + getDownloadablePlugins().length + 
    EXTERNAL_MARKETPLACE_SOURCES.reduce((sum, s) => sum + s.estimatedPlugins, 0),
};
