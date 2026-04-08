/**
 * Vendored Plugins Registry
 * 
 * This file tracks all third-party plugins that have been downloaded
 * and vendored into the codebase at src/plugins/vendor/
 * 
 * Benefits:
 * - Plugins work offline
 * - Immune to external source changes/removal
 * - Faster loading (no network requests)
 * - Auditable and reviewable
 * - Deterministic builds
 */

import type { UnifiedPlugin } from '@/lib/plugins/unified-registry';

export interface VendoredPlugin extends UnifiedPlugin {
  vendored: {
    date: string;           // When it was vendored (ISO date)
    sourceRepo: string;     // Original source (e.g., "anthropics/claude-plugins-official")
    sourceRef: string;      // Git ref (e.g., "main", "v1.2.0")
    commitHash?: string;    // Specific commit for reproducibility
    vendorPath: string;     // Path in codebase (relative to src/plugins/vendor/)
  };
}

// =============================================================================
// VENDORED PLUGINS FROM ANTHROPIC OFFICIAL
// =============================================================================

export const VENDORED_ANTHROPIC_PLUGINS: VendoredPlugin[] = [
  {
    id: 'claude-artifacts',
    name: 'Claude Artifacts',
    description: 'Create and manage reusable React components, documents, and interactive elements',
    version: '1.0.0',
    source: 'marketplace',
    status: 'not-installed', // User must install from vendored copy
    category: 'create',
    author: { name: 'Anthropic', verified: true },
    capabilities: ['artifact-generation', 'react-components', 'interactive-documents'],
    deterministicActions: [
      'Generate React components from descriptions',
      'Create interactive documents',
      'Export artifacts to CodeSandbox',
      'Version control for artifacts'
    ],
    icon: 'Code',
    tags: ['anthropic', 'official', 'react', 'components', 'artifacts'],
    vendored: {
      date: '2024-01-15',
      sourceRepo: 'anthropics/claude-plugins-official',
      sourceRef: 'main',
      vendorPath: 'anthropic/claude-artifacts/',
    },
  },
  {
    id: 'claude-deep-research',
    name: 'Claude Deep Research',
    description: 'Advanced research with iterative querying and synthesis',
    version: '1.0.0',
    source: 'marketplace',
    status: 'not-installed',
    category: 'analyze',
    author: { name: 'Anthropic', verified: true },
    capabilities: ['deep-research', 'iterative-querying', 'fact-checking'],
    deterministicActions: [
      'Iterative web research',
      'Multi-source synthesis',
      'Fact verification',
      'Citation generation'
    ],
    icon: 'Search',
    tags: ['anthropic', 'official', 'research', 'web-search'],
    vendored: {
      date: '2024-01-15',
      sourceRepo: 'anthropics/claude-plugins-official',
      sourceRef: 'main',
      vendorPath: 'anthropic/claude-deep-research/',
    },
  },
  {
    id: 'claude-data-analyst',
    name: 'Claude Data Analyst',
    description: 'Advanced data analysis with pandas and visualization',
    version: '1.0.0',
    source: 'marketplace',
    status: 'not-installed',
    category: 'analyze',
    author: { name: 'Anthropic', verified: true },
    capabilities: ['data-analysis', 'pandas', 'visualization', 'statistics'],
    deterministicActions: [
      'Load and clean datasets',
      'Generate statistical analysis',
      'Create matplotlib/seaborn charts',
      'Export insights to reports'
    ],
    icon: 'BarChart',
    tags: ['anthropic', 'official', 'data', 'pandas', 'visualization'],
    vendored: {
      date: '2024-01-15',
      sourceRepo: 'anthropics/claude-plugins-official',
      sourceRef: 'main',
      vendorPath: 'anthropic/claude-data-analyst/',
    },
  },
  {
    id: 'claude-web-search',
    name: 'Claude Web Search',
    description: 'Real-time web search with result summarization',
    version: '1.0.0',
    source: 'marketplace',
    status: 'not-installed',
    category: 'analyze',
    author: { name: 'Anthropic', verified: true },
    capabilities: ['web-search', 'result-summarization', 'fact-extraction'],
    deterministicActions: [
      'Search the web in real-time',
      'Summarize search results',
      'Extract key information',
      'Verify facts across sources'
    ],
    icon: 'Globe',
    tags: ['anthropic', 'official', 'web-search', 'real-time'],
    vendored: {
      date: '2024-01-15',
      sourceRepo: 'anthropics/claude-plugins-official',
      sourceRef: 'main',
      vendorPath: 'anthropic/claude-web-search/',
    },
  },
  {
    id: 'claude-code-expert',
    name: 'Claude Code Expert',
    description: 'Expert-level code review, refactoring, and architecture suggestions',
    version: '1.0.0',
    source: 'marketplace',
    status: 'not-installed',
    category: 'build',
    author: { name: 'Anthropic', verified: true },
    capabilities: ['code-review', 'refactoring', 'architecture', 'optimization'],
    deterministicActions: [
      'Code review with best practices',
      'Refactoring suggestions',
      'Architecture recommendations',
      'Performance optimization'
    ],
    icon: 'Code2',
    tags: ['anthropic', 'official', 'code-review', 'refactoring'],
    vendored: {
      date: '2024-01-15',
      sourceRepo: 'anthropics/claude-code',
      sourceRef: 'main',
      vendorPath: 'anthropic/claude-code-expert/',
    },
  },
  {
    id: 'claude-git-assistant',
    name: 'Claude Git Assistant',
    description: 'Git workflow automation and commit message generation',
    version: '1.0.0',
    source: 'marketplace',
    status: 'not-installed',
    category: 'build',
    author: { name: 'Anthropic', verified: true },
    capabilities: ['git-automation', 'commit-generation', 'pr-descriptions'],
    deterministicActions: [
      'Generate commit messages',
      'Create pull request descriptions',
      'Review git diffs',
      'Suggest branch strategies'
    ],
    icon: 'GitBranch',
    tags: ['anthropic', 'official', 'git', 'github', 'version-control'],
    vendored: {
      date: '2024-01-15',
      sourceRepo: 'anthropics/claude-code',
      sourceRef: 'main',
      vendorPath: 'anthropic/claude-git-assistant/',
    },
  },
  {
    id: 'claude-debugger',
    name: 'Claude Debugger',
    description: 'Intelligent debugging assistance and error analysis',
    version: '1.0.0',
    source: 'marketplace',
    status: 'not-installed',
    category: 'build',
    author: { name: 'Anthropic', verified: true },
    capabilities: ['debugging', 'error-analysis', 'fix-suggestions'],
    deterministicActions: [
      'Analyze error messages',
      'Suggest fix implementations',
      'Trace code execution',
      'Identify root causes'
    ],
    icon: 'Bug',
    tags: ['anthropic', 'official', 'debugging', 'error-analysis'],
    vendored: {
      date: '2024-01-15',
      sourceRepo: 'anthropics/claude-code',
      sourceRef: 'main',
      vendorPath: 'anthropic/claude-debugger/',
    },
  },
  {
    id: 'claude-test-generator',
    name: 'Claude Test Generator',
    description: 'Generate unit tests, integration tests, and test cases',
    version: '1.0.0',
    source: 'marketplace',
    status: 'not-installed',
    category: 'build',
    author: { name: 'Anthropic', verified: true },
    capabilities: ['test-generation', 'unit-tests', 'integration-tests'],
    deterministicActions: [
      'Generate unit tests',
      'Create integration tests',
      'Write test documentation',
      'Suggest edge cases'
    ],
    icon: 'TestTube',
    tags: ['anthropic', 'official', 'testing', 'unit-tests'],
    vendored: {
      date: '2024-01-15',
      sourceRepo: 'anthropics/claude-code',
      sourceRef: 'main',
      vendorPath: 'anthropic/claude-test-generator/',
    },
  },
  {
    id: 'claude-task-master',
    name: 'Claude Task Master',
    description: 'Task automation and project management integration',
    version: '1.0.0',
    source: 'marketplace',
    status: 'not-installed',
    category: 'automate',
    author: { name: 'Anthropic', verified: true },
    capabilities: ['task-management', 'project-planning', 'complexity-estimation'],
    deterministicActions: [
      'Break down projects into tasks',
      'Estimate task complexity',
      'Generate todo lists',
      'Track completion status'
    ],
    icon: 'CheckSquare',
    tags: ['anthropic', 'official', 'tasks', 'project-management'],
    vendored: {
      date: '2024-01-15',
      sourceRepo: 'anthropics/claude-plugins-official',
      sourceRef: 'main',
      vendorPath: 'anthropic/claude-task-master/',
    },
  },
  {
    id: 'claude-workflow-automation',
    name: 'Claude Workflow Automation',
    description: 'Create automated workflows and recurring tasks',
    version: '1.0.0',
    source: 'marketplace',
    status: 'not-installed',
    category: 'automate',
    author: { name: 'Anthropic', verified: true },
    capabilities: ['workflow-design', 'automation', 'triggers', 'integrations'],
    deterministicActions: [
      'Design workflow sequences',
      'Set up automated triggers',
      'Manage recurring tasks',
      'Integrate with external tools'
    ],
    icon: 'Workflow',
    tags: ['anthropic', 'official', 'workflow', 'automation'],
    vendored: {
      date: '2024-01-15',
      sourceRepo: 'anthropics/claude-plugins-official',
      sourceRef: 'main',
      vendorPath: 'anthropic/claude-workflow-automation/',
    },
  },
  {
    id: 'claude-bio-research',
    name: 'Claude Bio Research',
    description: 'Biological research analysis and literature review',
    version: '1.0.0',
    source: 'marketplace',
    status: 'not-installed',
    category: 'analyze',
    author: { name: 'Anthropic', verified: true },
    capabilities: ['bio-research', 'literature-review', 'clinical-analysis'],
    deterministicActions: [
      'Analyze biological literature',
      'Extract research findings',
      'Summarize clinical trials',
      'Compare study methodologies'
    ],
    icon: 'Dna',
    tags: ['anthropic', 'official', 'bio', 'life-sciences', 'research'],
    vendored: {
      date: '2024-01-15',
      sourceRepo: 'anthropics/life-sciences',
      sourceRef: 'main',
      vendorPath: 'anthropic/claude-bio-research/',
    },
  },
  {
    id: 'claude-drug-discovery',
    name: 'Claude Drug Discovery',
    description: 'Assist in pharmaceutical research and drug discovery workflows',
    version: '1.0.0',
    source: 'marketplace',
    status: 'not-installed',
    category: 'analyze',
    author: { name: 'Anthropic', verified: true },
    capabilities: ['drug-discovery', 'molecular-analysis', 'pharmacology'],
    deterministicActions: [
      'Analyze molecular structures',
      'Review drug interactions',
      'Summarize pharmacology research',
      'Track clinical trial phases'
    ],
    icon: 'Pill',
    tags: ['anthropic', 'official', 'pharma', 'drug-discovery', 'life-sciences'],
    vendored: {
      date: '2024-01-15',
      sourceRepo: 'anthropics/life-sciences',
      sourceRef: 'main',
      vendorPath: 'anthropic/claude-drug-discovery/',
    },
  },
];

// =============================================================================
// VENDORED PLUGINS FROM DOCKER
// =============================================================================

export const VENDORED_DOCKER_PLUGINS: VendoredPlugin[] = [
  {
    id: 'docker-dev-assistant',
    name: 'Docker Dev Assistant',
    description: 'Docker container management and Dockerfile optimization',
    version: '1.5.0',
    source: 'marketplace',
    status: 'not-installed',
    category: 'build',
    author: { name: 'Docker', verified: true },
    capabilities: ['dockerfile-generation', 'container-analysis', 'security-scanning', 'compose-management'],
    deterministicActions: [
      'Generate optimized Dockerfiles',
      'Analyze container security',
      'Suggest image optimizations',
      'Debug container issues',
      'Manage multi-container apps'
    ],
    icon: 'Container',
    tags: ['docker', 'verified', 'containers', 'devops'],
    vendored: {
      date: '2024-01-15',
      sourceRepo: 'docker/claude-plugins',
      sourceRef: 'main',
      vendorPath: 'docker/docker-dev-assistant/',
    },
  },
  {
    id: 'docker-compose-generator',
    name: 'Docker Compose Generator',
    description: 'Generate and manage Docker Compose configurations',
    version: '1.2.0',
    source: 'marketplace',
    status: 'not-installed',
    category: 'build',
    author: { name: 'Docker', verified: true },
    capabilities: ['compose-generation', 'service-configuration', 'network-setup'],
    deterministicActions: [
      'Generate docker-compose.yml files',
      'Configure service networks',
      'Set up volume mounts',
      'Manage environment variables'
    ],
    icon: 'Layers',
    tags: ['docker', 'verified', 'compose', 'orchestration'],
    vendored: {
      date: '2024-01-15',
      sourceRepo: 'docker/claude-plugins',
      sourceRef: 'main',
      vendorPath: 'docker/docker-compose-generator/',
    },
  },
  {
    id: 'docker-security-scanner',
    name: 'Docker Security Scanner',
    description: 'Scan Docker images for vulnerabilities and misconfigurations',
    version: '1.0.0',
    source: 'marketplace',
    status: 'not-installed',
    category: 'analyze',
    author: { name: 'Docker', verified: true },
    capabilities: ['security-scanning', 'vulnerability-detection', 'compliance-checking'],
    deterministicActions: [
      'Scan images for CVEs',
      'Detect misconfigurations',
      'Suggest security fixes',
      'Generate compliance reports'
    ],
    icon: 'Shield',
    tags: ['docker', 'verified', 'security', 'scanning'],
    vendored: {
      date: '2024-01-15',
      sourceRepo: 'docker/claude-plugins',
      sourceRef: 'main',
      vendorPath: 'docker/docker-security-scanner/',
    },
  },
];

// =============================================================================
// ADDITIONAL VENDORED PLUGINS
// =============================================================================

export const VENDORED_ADDITIONAL_PLUGINS: VendoredPlugin[] = [
  {
    id: 'legal-assistant',
    name: 'Legal Assistant',
    description: 'Legal document analysis, contract review, and compliance checking',
    version: '2.1.0',
    source: 'marketplace',
    status: 'not-installed',
    category: 'analyze',
    author: { name: 'LegalTech AI', verified: true },
    capabilities: ['contract-analysis', 'legal-research', 'compliance-checking', 'risk-assessment'],
    deterministicActions: [
      'Analyze contract clauses',
      'Identify legal risks',
      'Check compliance requirements',
      'Generate legal summaries',
      'Flag ambiguous language',
      'Compare with standard templates'
    ],
    icon: 'Scale',
    tags: ['legal', 'contracts', 'compliance', 'verified'],
    vendored: {
      date: '2024-01-15',
      sourceRepo: 'legaltech-ai/claude-legal-plugin',
      sourceRef: 'main',
      vendorPath: 'third-party/legal-assistant/',
    },
  },
  {
    id: 'figma-to-code',
    name: 'Figma to Code',
    description: 'Convert Figma designs to React/Tailwind code',
    version: '1.8.0',
    source: 'marketplace',
    status: 'not-installed',
    category: 'create',
    author: { name: 'DesignCode', verified: true },
    capabilities: ['figma-import', 'design-to-code', 'tailwind-export'],
    deterministicActions: [
      'Import Figma designs',
      'Generate React components',
      'Export Tailwind CSS',
      'Match design tokens',
      'Create responsive layouts'
    ],
    icon: 'Figma',
    tags: ['figma', 'design', 'react', 'tailwind', 'verified'],
    vendored: {
      date: '2024-01-15',
      sourceRepo: 'designcode/figma-to-code',
      sourceRef: 'main',
      vendorPath: 'third-party/figma-to-code/',
    },
  },
  {
    id: 'zapier-connector',
    name: 'Zapier Connector',
    description: 'Connect to 5000+ apps via Zapier integration',
    version: '2.0.0',
    source: 'marketplace',
    status: 'not-installed',
    category: 'automate',
    author: { name: 'Zapier', verified: true },
    capabilities: ['zapier-integration', 'workflow-automation', 'app-connector'],
    deterministicActions: [
      'Create Zapier workflows',
      'Connect to external apps',
      'Automate data sync',
      'Trigger webhooks',
      'Manage multi-step zaps'
    ],
    icon: 'Zap',
    tags: ['zapier', 'automation', 'integration', 'verified'],
    vendored: {
      date: '2024-01-15',
      sourceRepo: 'zapier/claude-connector',
      sourceRef: 'main',
      vendorPath: 'third-party/zapier-connector/',
    },
  },
];

// =============================================================================
// ALLTERNIT EXTENSION PLUGINS
// =============================================================================

export const ALLTERNIT_EXTENSION_PLUGINS: VendoredPlugin[] = [
  {
    id: 'allternit-office-excel',
    name: 'Allternit for Excel',
    description: 'AI-powered Excel automation — formulas, charts, tables, financial modeling, and data validation. Generates and executes Office.js code directly in the workbook.',
    version: '1.0.0',
    source: 'marketplace',
    status: 'not-installed',
    category: 'productivity',
    author: { name: 'Allternit', verified: true },
    capabilities: ['formula-generation', 'chart-creation', 'financial-modeling', 'data-validation', 'table-operations'],
    deterministicActions: [
      'Generate Excel formulas from natural language',
      'Build financial models (DCF, P&L, 3-statement)',
      'Create charts and pivot tables',
      'Clean and validate data ranges',
      'Apply professional formatting',
    ],
    icon: 'Table',
    tags: ['office', 'excel', 'spreadsheet', 'microsoft', 'financial-modeling', 'formulas'],
    vendored: {
      date: '2026-04-08',
      sourceRepo: 'allternit/allternit-extensions',
      sourceRef: 'main',
      vendorPath: 'office-excel/',
    },
  },
  {
    id: 'allternit-office-word',
    name: 'Allternit for Word',
    description: 'AI-powered document drafting, editing, redlining, style application and structured content. Generates and executes Office.js code directly in the document.',
    version: '1.0.0',
    source: 'marketplace',
    status: 'not-installed',
    category: 'productivity',
    author: { name: 'Allternit', verified: true },
    capabilities: ['document-rewriting', 'tracked-changes', 'summarization', 'template-filling', 'table-creation'],
    deterministicActions: [
      'Rewrite and improve document sections with tracked changes',
      'Summarize contracts, reports, and long documents',
      'Fill document templates and content controls',
      'Apply consistent heading structure',
      'Insert and format tables',
    ],
    icon: 'FileText',
    tags: ['office', 'word', 'documents', 'microsoft', 'writing', 'redline', 'tracked-changes'],
    vendored: {
      date: '2026-04-08',
      sourceRepo: 'allternit/allternit-extensions',
      sourceRef: 'main',
      vendorPath: 'office-word/',
    },
  },
  {
    id: 'allternit-office-powerpoint',
    name: 'Allternit for PowerPoint',
    description: 'AI-powered slide creation, deck design, content generation and presentation automation. Generates and executes Office.js code directly in the presentation.',
    version: '1.0.0',
    source: 'marketplace',
    status: 'not-installed',
    category: 'productivity',
    author: { name: 'Allternit', verified: true },
    capabilities: ['slide-generation', 'deck-design', 'content-rewriting', 'speaker-notes', 'presentation-summary'],
    deterministicActions: [
      'Generate full presentation outlines and populate slides',
      'Rewrite slide content and apply design themes',
      'Write and edit speaker notes',
      'Create data-driven slides from tables',
      'Build executive briefing and pitch decks',
    ],
    icon: 'Presentation',
    tags: ['office', 'powerpoint', 'slides', 'microsoft', 'presentations', 'deck'],
    vendored: {
      date: '2026-04-08',
      sourceRepo: 'allternit/allternit-extensions',
      sourceRef: 'main',
      vendorPath: 'office-powerpoint/',
    },
  },
  {
    id: 'allternit-chrome',
    name: 'Allternit for Chrome',
    description: 'AI-powered browser companion — summarize pages, extract structured data, research across tabs, automate repetitive tasks, and save content to your connected tools.',
    version: '1.0.0',
    source: 'marketplace',
    status: 'not-installed',
    category: 'productivity',
    author: { name: 'Allternit', verified: true },
    capabilities: ['page-summarization', 'data-extraction', 'web-research', 'browser-automation', 'content-saving'],
    deterministicActions: [
      'Summarize any webpage in TL;DR, bullets, or detailed format',
      'Extract tables, contacts, prices, and dates from pages',
      'Research topics using the current page as a starting point',
      'Automate repetitive tasks on any webpage',
      'Save page content to Notion, Linear, Slack, or clipboard',
    ],
    icon: 'Globe',
    tags: ['chrome', 'browser', 'web', 'summarize', 'extract', 'research', 'automation'],
    vendored: {
      date: '2026-04-08',
      sourceRepo: 'allternit/allternit-extensions',
      sourceRef: 'main',
      vendorPath: 'chrome/',
    },
  },
];

// =============================================================================
// ALL VENDORED PLUGINS
// =============================================================================

export const ALL_VENDORED_PLUGINS: VendoredPlugin[] = [
  ...VENDORED_ANTHROPIC_PLUGINS,
  ...VENDORED_DOCKER_PLUGINS,
  ...VENDORED_ADDITIONAL_PLUGINS,
  ...ALLTERNIT_EXTENSION_PLUGINS,
];

// =============================================================================
// VENDORED PLUGIN METADATA
// =============================================================================

export interface VendorMetadata {
  lastSyncDate: string;
  totalPlugins: number;
  bySource: Record<string, number>;
}

export const VENDOR_METADATA: VendorMetadata = {
  lastSyncDate: '2026-04-08',
  totalPlugins: ALL_VENDORED_PLUGINS.length,
  bySource: {
    'anthropics/claude-plugins-official': 4,
    'anthropics/claude-code': 4,
    'anthropics/life-sciences': 2,
    'docker/claude-plugins': 3,
    'legaltech-ai/claude-legal-plugin': 1,
    'designcode/figma-to-code': 1,
    'zapier/claude-connector': 1,
    'allternit/allternit-extensions': 4,
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function getVendoredPluginById(id: string): VendoredPlugin | undefined {
  return ALL_VENDORED_PLUGINS.find(p => p.id === id);
}

export function getVendoredPluginsByCategory(category: string): VendoredPlugin[] {
  return ALL_VENDORED_PLUGINS.filter(p => p.category === category);
}

export function getVendoredPluginsBySource(sourceRepo: string): VendoredPlugin[] {
  return ALL_VENDORED_PLUGINS.filter(p => p.vendored.sourceRepo === sourceRepo);
}

// Get the filesystem path for a vendored plugin
export function getVendoredPluginPath(pluginId: string): string | undefined {
  const plugin = getVendoredPluginById(pluginId);
  if (!plugin) return undefined;
  return `src/plugins/vendor/${plugin.vendored.vendorPath}`;
}

// Convert vendored plugin to unified plugin format
export function toUnifiedPlugin(vendored: VendoredPlugin): UnifiedPlugin {
  return {
    ...vendored,
    marketplaceInfo: {
      sourceId: vendored.vendored.sourceRepo,
      sourceTrust: vendored.author.verified ? 'verified' : 'community',
      repository: vendored.vendored.sourceRepo,
    },
  };
}
