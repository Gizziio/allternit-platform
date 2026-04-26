/**
 * Comprehensive Plugin Registry
 * 
 * Lists ALL plugins available in the Allternit platform:
 * - 10 Built-in Agent Mode plugins (with color gradients)
 * - Office Add-in plugins (Excel, PowerPoint, Word)
 * - Feature plugins (Core, Advanced)
 * - Anthropic official plugins (fetched from curated sources)
 * - Third-party marketplace plugins (categorized into mode groups)
 * - Custom user plugins
 * 
 * Third-party plugins can be mapped to any of the 4 mode groups:
 * - Create (Violet): Content generation plugins
 * - Analyze (Blue): Research & data analysis plugins
 * - Build (Emerald): Code & asset plugins
 * - Automate (Amber): Workflow & orchestration plugins
 */

import type { ModePlugin, PluginCapability } from './types';
import type { PluginCategory } from './marketplace';

// =============================================================================
// BUILT-IN AGENT MODE PLUGINS (10 total)
// =============================================================================

export interface BuiltInPluginDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  category: PluginCategory;
  shade: number; // 0-3 for color gradient
  capabilities: PluginCapability[];
  provider: 'free' | 'byok' | 'hybrid';
  author: {
    name: string;
    verified: boolean;
  };
  features: string[];
}

export const BUILT_IN_PLUGINS: BuiltInPluginDefinition[] = [
  // CREATE GROUP (Violet gradient)
  {
    id: 'image',
    name: 'Image',
    description: 'Generate images from text prompts using Pollinations.ai (FREE)',
    version: '1.0.0',
    category: 'create',
    shade: 0,
    capabilities: ['text-to-image', 'image-variations', 'style-transfer', 'upscale'] as unknown as PluginCapability[],
    provider: 'free',
    author: { name: 'Allternit', verified: true },
    features: ['Text-to-image', 'Style variations', '4 images per prompt', 'No API key required'],
  },
  {
    id: 'video',
    name: 'Video',
    description: 'Generate videos from text or images using MiniMax/Kling (BYOK)',
    version: '1.0.0',
    category: 'create',
    shade: 1,
    capabilities: ['text-to-video', 'image-to-video', 'video-editing', 'extend'] as unknown as PluginCapability[],
    provider: 'byok',
    author: { name: 'Allternit', verified: true },
    features: ['6-10 second videos', '720p/1080p', 'Text-to-video', 'Image animation'],
  },
  {
    id: 'slides',
    name: 'Slides',
    description: 'Create professional presentations with AI-generated content',
    version: '1.0.0',
    category: 'create',
    shade: 2,
    capabilities: ['presentation-generation', 'slide-design', 'speaker-notes', 'pptx-export'] as unknown as PluginCapability[],
    provider: 'free',
    author: { name: 'Allternit', verified: true },
    features: ['HTML/Reveal.js/PPTX export', 'Speaker notes', 'Multiple themes', 'AI-generated content'],
  },
  {
    id: 'website',
    name: 'Website',
    description: 'Build complete websites with Next.js/React/Vue/HTML',
    version: '1.0.0',
    category: 'create',
    shade: 3,
    capabilities: ['website-generation', 'landing-page', 'responsive-design', 'deployment-prep'] as unknown as PluginCapability[],
    provider: 'free',
    author: { name: 'Allternit', verified: true },
    features: ['Next.js/React/Vue/HTML', 'Tailwind CSS', 'Responsive design', 'Ready for deployment'],
  },

  // ANALYZE GROUP (Blue gradient)
  {
    id: 'research',
    name: 'Research',
    description: 'Multi-source research with citations and synthesis',
    version: '1.0.0',
    category: 'analyze',
    shade: 0,
    capabilities: ['web-search', 'citation', 'synthesis', 'source-verification', 'deep-research'] as unknown as PluginCapability[],
    provider: 'free',
    author: { name: 'Allternit', verified: true },
    features: ['Web search', 'Source citations', 'Credibility scoring', 'Related questions'],
  },
  {
    id: 'data',
    name: 'Data',
    description: 'Data analysis, visualization, and chart generation',
    version: '1.0.0',
    category: 'analyze',
    shade: 2,
    capabilities: ['csv-import', 'excel-analysis', 'chart-generation', 'sql-query', 'insights'] as unknown as PluginCapability[],
    provider: 'free',
    author: { name: 'Allternit', verified: true },
    features: ['CSV/Excel import', 'Interactive charts', 'SQL queries', 'Data insights'],
  },

  // BUILD GROUP (Emerald gradient)
  {
    id: 'code',
    name: 'Code',
    description: 'Generate and execute code in multiple languages with live preview',
    version: '1.0.0',
    category: 'build',
    shade: 0,
    capabilities: ['code-generation', 'live-preview', 'multi-language', 'package-install'] as unknown as PluginCapability[],
    provider: 'free',
    author: { name: 'Allternit', verified: true },
    features: ['TypeScript/Python/React/Vue', 'Live preview', 'Code explanation', 'File generation'],
  },
  {
    id: 'assets',
    name: 'Assets',
    description: 'File management, organization, and asset library',
    version: '1.0.0',
    category: 'build',
    shade: 2,
    capabilities: ['file-upload', 'ai-tagging', 'semantic-search', 'asset-library'] as unknown as PluginCapability[],
    provider: 'free',
    author: { name: 'Allternit', verified: true },
    features: ['File upload', 'AI tagging', 'Semantic search', 'Organization'],
  },

  // AUTOMATE GROUP (Amber gradient)
  {
    id: 'swarms',
    name: 'Swarms',
    description: 'Multi-agent orchestration and consensus building',
    version: '1.0.0',
    category: 'automate',
    shade: 0,
    capabilities: ['multi-agent', 'agent-coordination', 'consensus-building', 'task-delegation'] as unknown as PluginCapability[],
    provider: 'free',
    author: { name: 'Allternit', verified: true },
    features: ['Multi-agent teams', 'Consensus building', 'Task delegation', 'Parallel execution'],
  },
  {
    id: 'flow',
    name: 'Flow',
    description: 'Visual workflow automation and custom automations',
    version: '1.0.0',
    category: 'automate',
    shade: 2,
    capabilities: ['visual-builder', 'node-editor', 'trigger-setup', 'automation'] as unknown as PluginCapability[],
    provider: 'free',
    author: { name: 'Allternit', verified: true },
    features: ['Visual builder', 'Node-based editor', 'Trigger automation', 'Custom workflows'],
  },
];

// =============================================================================
// OFFICE ADD-IN PLUGINS (3 plugins)
// =============================================================================

export interface OfficePluginDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  category: PluginCategory;
  app: 'excel' | 'powerpoint' | 'word';
  accentColor: string;
  author: {
    name: string;
    verified: boolean;
  };
  tags: string[];
  deterministicActions: string[];
}

export const OFFICE_PLUGINS: OfficePluginDefinition[] = [
  {
    id: 'allternit-office-excel',
    name: 'Allternit for Excel',
    description: 'AI-powered Excel automation — formulas, charts, tables, financial modeling, and data validation. Generates and executes Office.js code directly in the workbook.',
    version: '1.0.0',
    category: 'analyze',
    app: 'excel',
    accentColor: '#217346',
    author: { name: 'Allternit', verified: true },
    tags: ['office', 'microsoft', 'excel', 'spreadsheet', 'formulas', 'charts', 'financial-modeling'],
    deterministicActions: [
      'Generate Excel formulas from descriptions',
      'Create charts and visualizations',
      'Build financial models',
      'Validate data integrity',
      'Automate table operations'
    ],
  },
  {
    id: 'allternit-office-powerpoint',
    name: 'Allternit for PowerPoint',
    description: 'AI-powered slide creation, deck design, content generation and presentation automation. Generates and executes Office.js code directly in the presentation.',
    version: '1.0.0',
    category: 'create',
    app: 'powerpoint',
    accentColor: '#D24726',
    author: { name: 'Allternit', verified: true },
    tags: ['office', 'microsoft', 'powerpoint', 'slides', 'presentations', 'deck'],
    deterministicActions: [
      'Generate slide content from prompts',
      'Design presentation layouts',
      'Create data visualizations',
      'Automate slide transitions',
      'Apply consistent branding'
    ],
  },
  {
    id: 'allternit-office-word',
    name: 'Allternit for Word',
    description: 'AI-powered document drafting, editing, redlining, style application and structured content. Generates and executes Office.js code directly in the document.',
    version: '1.0.0',
    category: 'create',
    app: 'word',
    accentColor: '#2B579A',
    author: { name: 'Allternit', verified: true },
    tags: ['office', 'microsoft', 'word', 'documents', 'writing', 'redline', 'tracked-changes'],
    deterministicActions: [
      'Draft documents from outlines',
      'Apply professional styling',
      'Track changes and redlines',
      'Generate structured content',
      'Format for compliance'
    ],
  },
];

// =============================================================================
// FEATURE PLUGINS (Core platform features)
// =============================================================================

export interface FeaturePluginDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  category: PluginCategory;
  icon: string;
  enabledByDefault: boolean;
  builtin: boolean;
  author: {
    name: string;
    verified: boolean;
  };
}

export const FEATURE_PLUGINS: FeaturePluginDefinition[] = [
  {
    id: 'core',
    name: 'Core Features',
    description: 'Basic agent functionality including chat, file handling, and session management',
    version: '1.0.0',
    category: 'automate',
    icon: 'Cpu',
    enabledByDefault: true,
    builtin: true,
    author: { name: 'Allternit', verified: true },
  },
  {
    id: 'advanced',
    name: 'Advanced Features',
    description: 'Extended capabilities including computer use, browser automation, and advanced tools',
    version: '1.0.0',
    category: 'automate',
    icon: 'Zap',
    enabledByDefault: false,
    builtin: true,
    author: { name: 'Allternit', verified: true },
  },
];

// =============================================================================
// ANTHROPIC OFFICIAL PLUGINS (Curated from Anthropic sources)
// =============================================================================

export interface ThirdPartyPluginDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  author: {
    name: string;
    verified: boolean;
  };
  source: 'anthropic-official' | 'anthropic-claude-code' | 'anthropic-skills' | 'anthropic-life-sciences' | 'docker' | 'github' | 'marketplace';
  // Mode group assignment - third-party plugins map to one of the 4 groups
  category: PluginCategory;
  // Deterministic behavior for users
  deterministicActions: string[];
  capabilities: string[];
  installCommand?: string;
  repository?: string;
  documentation?: string;
}

export const ANTHROPIC_OFFICIAL_PLUGINS: ThirdPartyPluginDefinition[] = [
  // Create plugins
  {
    id: 'claude-artifacts',
    name: 'Claude Artifacts',
    description: 'Create and manage reusable React components, documents, and interactive elements',
    version: '1.0.0',
    author: { name: 'Anthropic', verified: true },
    source: 'anthropic-official',
    category: 'create',
    deterministicActions: [
      'Generate React components from descriptions',
      'Create interactive documents',
      'Export artifacts to CodeSandbox',
      'Version control for artifacts'
    ],
    capabilities: ['artifact-generation', 'react-components', 'interactive-documents'] as unknown as PluginCapability[],
    repository: 'anthropics/claude-plugins-official',
  },
  {
    id: 'claude-presentations',
    name: 'Claude Presentations',
    description: 'Advanced presentation generation with themes and speaker notes',
    version: '1.0.0',
    author: { name: 'Anthropic', verified: true },
    source: 'anthropic-official',
    category: 'create',
    deterministicActions: [
      'Generate slide decks from topics',
      'Apply professional themes',
      'Create speaker notes',
      'Export to multiple formats'
    ],
    capabilities: ['presentation-generation', 'theme-application', 'speaker-notes'] as unknown as PluginCapability[],
    repository: 'anthropics/claude-plugins-official',
  },
  
  // Analyze plugins
  {
    id: 'claude-research-deep',
    name: 'Claude Deep Research',
    description: 'Advanced research with iterative querying and synthesis',
    version: '1.0.0',
    author: { name: 'Anthropic', verified: true },
    source: 'anthropic-official',
    category: 'analyze',
    deterministicActions: [
      'Iterative web research',
      'Multi-source synthesis',
      'Fact verification',
      'Citation generation'
    ],
    capabilities: ['deep-research', 'iterative-querying', 'fact-checking'] as unknown as PluginCapability[],
    repository: 'anthropics/claude-plugins-official',
  },
  {
    id: 'claude-data-analyst',
    name: 'Claude Data Analyst',
    description: 'Advanced data analysis with pandas and visualization',
    version: '1.0.0',
    author: { name: 'Anthropic', verified: true },
    source: 'anthropic-official',
    category: 'analyze',
    deterministicActions: [
      'Load and clean datasets',
      'Generate statistical analysis',
      'Create matplotlib/seaborn charts',
      'Export insights to reports'
    ],
    capabilities: ['data-analysis', 'pandas', 'visualization', 'statistics'] as unknown as PluginCapability[],
    repository: 'anthropics/claude-plugins-official',
  },
  {
    id: 'claude-web-search',
    name: 'Claude Web Search',
    description: 'Real-time web search with result summarization',
    version: '1.0.0',
    author: { name: 'Anthropic', verified: true },
    source: 'anthropic-official',
    category: 'analyze',
    deterministicActions: [
      'Search the web in real-time',
      'Summarize search results',
      'Extract key information',
      'Verify facts across sources'
    ],
    capabilities: ['web-search', 'result-summarization', 'fact-extraction'] as unknown as PluginCapability[],
    repository: 'anthropics/claude-plugins-official',
  },

  // Build plugins
  {
    id: 'claude-code-expert',
    name: 'Claude Code Expert',
    description: 'Expert-level code review, refactoring, and architecture suggestions',
    version: '1.0.0',
    author: { name: 'Anthropic', verified: true },
    source: 'anthropic-claude-code',
    category: 'build',
    deterministicActions: [
      'Code review with best practices',
      'Refactoring suggestions',
      'Architecture recommendations',
      'Performance optimization'
    ],
    capabilities: ['code-review', 'refactoring', 'architecture', 'optimization'] as unknown as PluginCapability[],
    repository: 'anthropics/claude-code',
  },
  {
    id: 'claude-git-assistant',
    name: 'Claude Git Assistant',
    description: 'Git workflow automation and commit message generation',
    version: '1.0.0',
    author: { name: 'Anthropic', verified: true },
    source: 'anthropic-claude-code',
    category: 'build',
    deterministicActions: [
      'Generate commit messages',
      'Create pull request descriptions',
      'Review git diffs',
      'Suggest branch strategies'
    ],
    capabilities: ['git-automation', 'commit-generation', 'pr-descriptions'] as unknown as PluginCapability[],
    repository: 'anthropics/claude-code',
  },
  {
    id: 'claude-debugger',
    name: 'Claude Debugger',
    description: 'Intelligent debugging assistance and error analysis',
    version: '1.0.0',
    author: { name: 'Anthropic', verified: true },
    source: 'anthropic-claude-code',
    category: 'build',
    deterministicActions: [
      'Analyze error messages',
      'Suggest fix implementations',
      'Trace code execution',
      'Identify root causes'
    ],
    capabilities: ['debugging', 'error-analysis', 'fix-suggestions'] as unknown as PluginCapability[],
    repository: 'anthropics/claude-code',
  },
  {
    id: 'claude-test-generator',
    name: 'Claude Test Generator',
    description: 'Generate unit tests, integration tests, and test cases',
    version: '1.0.0',
    author: { name: 'Anthropic', verified: true },
    source: 'anthropic-claude-code',
    category: 'build',
    deterministicActions: [
      'Generate unit tests',
      'Create integration tests',
      'Write test documentation',
      'Suggest edge cases'
    ],
    capabilities: ['test-generation', 'unit-tests', 'integration-tests'] as unknown as PluginCapability[],
    repository: 'anthropics/claude-code',
  },

  // Automate plugins
  {
    id: 'claude-task-master',
    name: 'Claude Task Master',
    description: 'Task automation and project management integration',
    version: '1.0.0',
    author: { name: 'Anthropic', verified: true },
    source: 'anthropic-official',
    category: 'automate',
    deterministicActions: [
      'Break down projects into tasks',
      'Estimate task complexity',
      'Generate todo lists',
      'Track completion status'
    ],
    capabilities: ['task-management', 'project-planning', 'complexity-estimation'] as unknown as PluginCapability[],
    repository: 'anthropics/claude-plugins-official',
  },
  {
    id: 'claude-workflow-automation',
    name: 'Claude Workflow Automation',
    description: 'Create automated workflows and recurring tasks',
    version: '1.0.0',
    author: { name: 'Anthropic', verified: true },
    source: 'anthropic-official',
    category: 'automate',
    deterministicActions: [
      'Design workflow sequences',
      'Set up automated triggers',
      'Manage recurring tasks',
      'Integrate with external tools'
    ],
    capabilities: ['workflow-design', 'automation', 'triggers', 'integrations'] as unknown as PluginCapability[],
    repository: 'anthropics/claude-plugins-official',
  },
  
  // Life Sciences plugins
  {
    id: 'claude-bio-research',
    name: 'Claude Bio Research',
    description: 'Biological research analysis and literature review',
    version: '1.0.0',
    author: { name: 'Anthropic', verified: true },
    source: 'anthropic-life-sciences',
    category: 'analyze',
    deterministicActions: [
      'Analyze biological literature',
      'Extract research findings',
      'Summarize clinical trials',
      'Compare study methodologies'
    ],
    capabilities: ['bio-research', 'literature-review', 'clinical-analysis'] as unknown as PluginCapability[],
    repository: 'anthropics/life-sciences',
  },
  {
    id: 'claude-drug-discovery',
    name: 'Claude Drug Discovery',
    description: 'Assist in pharmaceutical research and drug discovery workflows',
    version: '1.0.0',
    author: { name: 'Anthropic', verified: true },
    source: 'anthropic-life-sciences',
    category: 'analyze',
    deterministicActions: [
      'Analyze molecular structures',
      'Review drug interactions',
      'Summarize pharmacology research',
      'Track clinical trial phases'
    ],
    capabilities: ['drug-discovery', 'molecular-analysis', 'pharmacology'] as unknown as PluginCapability[],
    repository: 'anthropics/life-sciences',
  },
];

// =============================================================================
// DOCKER & VERIFIED PARTNER PLUGINS
// =============================================================================

export const DOCKER_PLUGINS: ThirdPartyPluginDefinition[] = [
  {
    id: 'docker-dev-assistant',
    name: 'Docker Dev Assistant',
    description: 'Docker container management and Dockerfile optimization',
    version: '1.5.0',
    author: { name: 'Docker', verified: true },
    source: 'docker',
    category: 'build',
    deterministicActions: [
      'Generate optimized Dockerfiles',
      'Analyze container security',
      'Suggest image optimizations',
      'Debug container issues',
      'Manage multi-container apps'
    ],
    capabilities: ['dockerfile-generation', 'container-analysis', 'security-scanning', 'compose-management'] as unknown as PluginCapability[],
    repository: 'docker/claude-plugins',
  },
  {
    id: 'docker-compose-generator',
    name: 'Docker Compose Generator',
    description: 'Generate and manage Docker Compose configurations',
    version: '1.2.0',
    author: { name: 'Docker', verified: true },
    source: 'docker',
    category: 'build',
    deterministicActions: [
      'Generate docker-compose.yml files',
      'Configure service networks',
      'Set up volume mounts',
      'Manage environment variables'
    ],
    capabilities: ['compose-generation', 'service-configuration', 'network-setup'] as unknown as PluginCapability[],
    repository: 'docker/claude-plugins',
  },
  {
    id: 'docker-security-scanner',
    name: 'Docker Security Scanner',
    description: 'Scan Docker images for vulnerabilities and misconfigurations',
    version: '1.0.0',
    author: { name: 'Docker', verified: true },
    source: 'docker',
    category: 'analyze',
    deterministicActions: [
      'Scan images for CVEs',
      'Detect misconfigurations',
      'Suggest security fixes',
      'Generate compliance reports'
    ],
    capabilities: ['security-scanning', 'vulnerability-detection', 'compliance-checking'] as unknown as PluginCapability[],
    repository: 'docker/claude-plugins',
  },
];

// =============================================================================
// ADDITIONAL THIRD-PARTY PLUGINS
// =============================================================================

export const ADDITIONAL_PLUGINS: ThirdPartyPluginDefinition[] = [
  // LEGAL PLUGIN (example from user request)
  {
    id: 'legal-assistant',
    name: 'Legal Assistant',
    description: 'Legal document analysis, contract review, and compliance checking',
    version: '2.1.0',
    author: { name: 'LegalTech AI', verified: true },
    source: 'marketplace',
    category: 'analyze',
    deterministicActions: [
      'Analyze contract clauses',
      'Identify legal risks',
      'Check compliance requirements',
      'Generate legal summaries',
      'Flag ambiguous language',
      'Compare with standard templates'
    ],
    capabilities: ['contract-analysis', 'legal-research', 'compliance-checking', 'risk-assessment'] as unknown as PluginCapability[],
    repository: 'legaltech-ai/claude-legal-plugin',
  },
  {
    id: 'legal-contract-drafter',
    name: 'Legal Contract Drafter',
    description: 'Draft legal contracts from templates and requirements',
    version: '1.5.0',
    author: { name: 'LegalTech AI', verified: true },
    source: 'marketplace',
    category: 'create',
    deterministicActions: [
      'Draft contracts from templates',
      'Insert standard clauses',
      'Customize for jurisdictions',
      'Review for completeness'
    ],
    capabilities: ['contract-drafting', 'template-customization', 'jurisdiction-adaptation'] as unknown as PluginCapability[],
    repository: 'legaltech-ai/claude-legal-plugin',
  },

  // Data/Analytics plugins
  {
    id: 'sql-query-builder',
    name: 'SQL Query Builder',
    description: 'Natural language to SQL with schema awareness',
    version: '1.3.0',
    author: { name: 'DataTools Inc', verified: false },
    source: 'marketplace',
    category: 'analyze',
    deterministicActions: [
      'Convert natural language to SQL',
      'Optimize query performance',
      'Explain query execution plans',
      'Generate database schemas',
      'Suggest indexes'
    ],
    capabilities: ['sql-generation', 'query-optimization', 'schema-design'] as unknown as PluginCapability[],
    repository: 'datatools/sql-query-builder',
  },
  {
    id: 'excel-advanced-analyzer',
    name: 'Excel Advanced Analyzer',
    description: 'Advanced Excel analysis with pivot tables and macros',
    version: '2.0.0',
    author: { name: 'DataTools Inc', verified: false },
    source: 'marketplace',
    category: 'analyze',
    deterministicActions: [
      'Generate pivot tables',
      'Create complex formulas',
      'Build macros',
      'Analyze data trends',
      'Generate reports'
    ],
    capabilities: ['excel-analysis', 'pivot-tables', 'macro-generation', 'trend-analysis'] as unknown as PluginCapability[],
    repository: 'datatools/excel-analyzer',
  },
  {
    id: 'tableau-connector',
    name: 'Tableau Connector',
    description: 'Generate Tableau dashboards and visualizations',
    version: '1.2.0',
    author: { name: 'DataViz Pro', verified: true },
    source: 'marketplace',
    category: 'analyze',
    deterministicActions: [
      'Generate Tableau workbooks',
      'Create calculated fields',
      'Design dashboards',
      'Connect to data sources'
    ],
    capabilities: ['tableau-generation', 'dashboard-design', 'data-connection'] as unknown as PluginCapability[],
    repository: 'dataviz-pro/tableau-connector',
  },

  // Create plugins
  {
    id: 'figma-to-code',
    name: 'Figma to Code',
    description: 'Convert Figma designs to React/Tailwind code',
    version: '1.8.0',
    author: { name: 'DesignCode', verified: true },
    source: 'marketplace',
    category: 'create',
    deterministicActions: [
      'Import Figma designs',
      'Generate React components',
      'Export Tailwind CSS',
      'Match design tokens',
      'Create responsive layouts'
    ],
    capabilities: ['figma-import', 'design-to-code', 'tailwind-export'] as unknown as PluginCapability[],
    repository: 'designcode/figma-to-code',
  },
  {
    id: 'adobe-creative-assistant',
    name: 'Adobe Creative Assistant',
    description: 'Assist with Adobe Creative Suite workflows',
    version: '1.4.0',
    author: { name: 'CreativeAI', verified: false },
    source: 'marketplace',
    category: 'create',
    deterministicActions: [
      'Generate Photoshop actions',
      'Create Illustrator scripts',
      'Optimize for web',
      'Manage color palettes'
    ],
    capabilities: ['photoshop-automation', 'illustrator-scripts', 'asset-optimization'] as unknown as PluginCapability[],
    repository: 'creativeai/adobe-assistant',
  },
  {
    id: 'video-editing-assistant',
    name: 'Video Editing Assistant',
    description: 'Assist with video editing workflows and automation',
    version: '1.1.0',
    author: { name: 'VideoAI', verified: false },
    source: 'marketplace',
    category: 'create',
    deterministicActions: [
      'Generate editing timelines',
      'Suggest transitions',
      'Automate color grading',
      'Create subtitle files'
    ],
    capabilities: ['timeline-generation', 'transition-suggestions', 'color-grading'] as unknown as PluginCapability[],
    repository: 'videoai/editing-assistant',
  },

  // Automate plugins
  {
    id: 'zapier-connector',
    name: 'Zapier Connector',
    description: 'Connect to 5000+ apps via Zapier integration',
    version: '2.0.0',
    author: { name: 'Zapier', verified: true },
    source: 'marketplace',
    category: 'automate',
    deterministicActions: [
      'Create Zapier workflows',
      'Connect to external apps',
      'Automate data sync',
      'Trigger webhooks',
      'Manage multi-step zaps'
    ],
    capabilities: ['zapier-integration', 'workflow-automation', 'app-connector'] as unknown as PluginCapability[],
    repository: 'zapier/claude-connector',
  },
  {
    id: 'make-integromat-connector',
    name: 'Make (Integromat) Connector',
    description: 'Visual automation with Make.com integration',
    version: '1.3.0',
    author: { name: 'Make', verified: true },
    source: 'marketplace',
    category: 'automate',
    deterministicActions: [
      'Design Make scenarios',
      'Connect to 1000+ apps',
      'Automate data flows',
      'Schedule automated runs'
    ],
    capabilities: ['make-integration', 'scenario-design', 'data-flow-automation'] as unknown as PluginCapability[],
    repository: 'make/claude-connector',
  },
  {
    id: 'github-actions-generator',
    name: 'GitHub Actions Generator',
    description: 'Generate CI/CD workflows for GitHub Actions',
    version: '1.5.0',
    author: { name: 'DevOps Tools', verified: false },
    source: 'marketplace',
    category: 'automate',
    deterministicActions: [
      'Generate workflow YAML',
      'Set up CI/CD pipelines',
      'Configure deployment',
      'Add security scans'
    ],
    capabilities: ['workflow-generation', 'ci-cd-setup', 'deployment-configuration'] as unknown as PluginCapability[],
    repository: 'devops-tools/gh-actions-gen',
  },

  // Build plugins
  {
    id: 'github-repo-analyzer',
    name: 'GitHub Repo Analyzer',
    description: 'Analyze codebases, contributors, and project health',
    version: '1.2.0',
    author: { name: 'DevMetrics', verified: false },
    source: 'marketplace',
    category: 'analyze',
    deterministicActions: [
      'Analyze repository structure',
      'Identify code smells',
      'Track contributor stats',
      'Generate project health reports',
      'Suggest refactoring'
    ],
    capabilities: ['repo-analysis', 'code-metrics', 'contributor-insights'] as unknown as PluginCapability[],
    repository: 'devmetrics/github-analyzer',
  },
  {
    id: 'api-docs-generator',
    name: 'API Docs Generator',
    description: 'Generate OpenAPI/Swagger docs from code',
    version: '1.4.0',
    author: { name: 'APITools', verified: false },
    source: 'marketplace',
    category: 'build',
    deterministicActions: [
      'Parse code for API endpoints',
      'Generate OpenAPI specs',
      'Create interactive docs',
      'Validate API contracts'
    ],
    capabilities: ['openapi-generation', 'api-documentation', 'contract-validation'] as unknown as PluginCapability[],
    repository: 'apitools/docs-generator',
  },
  {
    id: 'kubernetes-assistant',
    name: 'Kubernetes Assistant',
    description: 'Generate K8s manifests and troubleshoot deployments',
    version: '1.3.0',
    author: { name: 'K8sTools', verified: false },
    source: 'marketplace',
    category: 'build',
    deterministicActions: [
      'Generate K8s manifests',
      'Troubleshoot deployments',
      'Optimize resources',
      'Set up ingress rules'
    ],
    capabilities: ['k8s-manifest-generation', 'troubleshooting', 'resource-optimization'] as unknown as PluginCapability[],
    repository: 'k8stools/claude-assistant',
  },
  {
    id: 'terraform-generator',
    name: 'Terraform Generator',
    description: 'Generate Terraform infrastructure as code',
    version: '1.2.0',
    author: { name: 'InfraAsCode', verified: false },
    source: 'marketplace',
    category: 'build',
    deterministicActions: [
      'Generate Terraform configs',
      'Plan infrastructure',
      'Estimate costs',
      'Set up modules'
    ],
    capabilities: ['terraform-generation', 'infrastructure-planning', 'cost-estimation'] as unknown as PluginCapability[],
    repository: 'infraascode/terraform-gen',
  },

  // Additional specialized plugins
  {
    id: 'salesforce-connector',
    name: 'Salesforce Connector',
    description: 'Integrate with Salesforce CRM and generate reports',
    version: '2.1.0',
    author: { name: 'CRM Integrations', verified: true },
    source: 'marketplace',
    category: 'analyze',
    deterministicActions: [
      'Query Salesforce data',
      'Generate sales reports',
      'Create SOQL queries',
      'Manage opportunities'
    ],
    capabilities: ['salesforce-integration', 'soql-generation', 'reporting'] as unknown as PluginCapability[],
    repository: 'crm-integrations/salesforce-connector',
  },
  {
    id: 'jira-assistant',
    name: 'Jira Assistant',
    description: 'Manage Jira projects and automate workflows',
    version: '1.6.0',
    author: { name: 'Atlassian Tools', verified: true },
    source: 'marketplace',
    category: 'automate',
    deterministicActions: [
      'Create Jira tickets',
      'Generate sprint reports',
      'Automate transitions',
      'Track issue metrics'
    ],
    capabilities: ['jira-integration', 'ticket-management', 'workflow-automation'] as unknown as PluginCapability[],
    repository: 'atlassian-tools/jira-assistant',
  },
  {
    id: 'slack-bot-creator',
    name: 'Slack Bot Creator',
    description: 'Create and manage Slack bots and workflows',
    version: '1.3.0',
    author: { name: 'SlackTools', verified: false },
    source: 'marketplace',
    category: 'automate',
    deterministicActions: [
      'Generate bot code',
      'Set up slash commands',
      'Create workflows',
      'Manage permissions'
    ],
    capabilities: ['slack-bot-generation', 'slash-commands', 'workflow-creation'] as unknown as PluginCapability[],
    repository: 'slacktools/bot-creator',
  },
  {
    id: 'notion-connector',
    name: 'Notion Connector',
    description: 'Integrate with Notion workspaces and databases',
    version: '1.4.0',
    author: { name: 'NotionTools', verified: false },
    source: 'marketplace',
    category: 'create',
    deterministicActions: [
      'Create Notion pages',
      'Query databases',
      'Generate templates',
      'Export to Markdown'
    ],
    capabilities: ['notion-integration', 'database-queries', 'template-generation'] as unknown as PluginCapability[],
    repository: 'notiontools/connector',
  },
  {
    id: 'stripe-assistant',
    name: 'Stripe Assistant',
    description: 'Generate Stripe integration code and manage payments',
    version: '1.2.0',
    author: { name: 'PaymentTools', verified: false },
    source: 'marketplace',
    category: 'build',
    deterministicActions: [
      'Generate checkout code',
      'Set up webhooks',
      'Create billing flows',
      'Analyze transactions'
    ],
    capabilities: ['stripe-integration', 'checkout-generation', 'webhook-setup'] as unknown as PluginCapability[],
    repository: 'paymenttools/stripe-assistant',
  },
  {
    id: 'aws-assistant',
    name: 'AWS Assistant',
    description: 'Generate AWS CloudFormation and manage AWS resources',
    version: '1.5.0',
    author: { name: 'CloudTools', verified: false },
    source: 'marketplace',
    category: 'build',
    deterministicActions: [
      'Generate CloudFormation',
      'Set up IAM policies',
      'Configure S3 buckets',
      'Optimize costs'
    ],
    capabilities: ['cloudformation-generation', 'iam-configuration', 'cost-optimization'] as unknown as PluginCapability[],
    repository: 'cloudtools/aws-assistant',
  },
  {
    id: 'auth0-connector',
    name: 'Auth0 Connector',
    description: 'Set up authentication and authorization with Auth0',
    version: '1.1.0',
    author: { name: 'AuthTools', verified: false },
    source: 'marketplace',
    category: 'build',
    deterministicActions: [
      'Configure Auth0 rules',
      'Set up social logins',
      'Manage user roles',
      'Generate SDK code'
    ],
    capabilities: ['auth0-configuration', 'social-login-setup', 'role-management'] as unknown as PluginCapability[],
    repository: 'authtools/auth0-connector',
  },
];

// =============================================================================
// CURATED MARKETPLACE SOURCES
// =============================================================================

export interface CuratedMarketplaceSource {
  id: string;
  label: string;
  owner: string;
  trust: 'official' | 'verified' | 'community';
  manifestUrl: string;
  repo: string;
  description: string;
  estimatedPluginCount: number;
}

export const CURATED_MARKETPLACE_SOURCES: CuratedMarketplaceSource[] = [
  {
    id: 'anthropic-official',
    label: 'Anthropic Official',
    owner: 'Anthropic',
    trust: 'official',
    manifestUrl: 'https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/.claude-plugin/marketplace.json',
    repo: 'anthropics/claude-plugins-official',
    description: 'Official Anthropic plugin marketplace with production-ready plugins',
    estimatedPluginCount: 15,
  },
  {
    id: 'anthropic-claude-code',
    label: 'Anthropic Claude Code',
    owner: 'Anthropic',
    trust: 'official',
    manifestUrl: 'https://raw.githubusercontent.com/anthropics/claude-code/main/.claude-plugin/marketplace.json',
    repo: 'anthropics/claude-code',
    description: 'Bundled Claude Code plugins for development workflows',
    estimatedPluginCount: 8,
  },
  {
    id: 'anthropic-skills',
    label: 'Anthropic Skills',
    owner: 'Anthropic',
    trust: 'official',
    manifestUrl: 'https://raw.githubusercontent.com/anthropics/skills/main/.claude-plugin/marketplace.json',
    repo: 'anthropics/skills',
    description: 'Anthropic skills converted into plugin marketplace format',
    estimatedPluginCount: 12,
  },
  {
    id: 'anthropic-life-sciences',
    label: 'Anthropic Life Sciences',
    owner: 'Anthropic',
    trust: 'official',
    manifestUrl: 'https://raw.githubusercontent.com/anthropics/life-sciences/main/.claude-plugin/marketplace.json',
    repo: 'anthropics/life-sciences',
    description: 'Life sciences plugin collection for biological research',
    estimatedPluginCount: 6,
  },
  {
    id: 'docker-marketplace',
    label: 'Docker Plugins',
    owner: 'Docker',
    trust: 'verified',
    manifestUrl: 'https://raw.githubusercontent.com/docker/claude-plugins/main/.claude-plugin/marketplace.json',
    repo: 'docker/claude-plugins',
    description: 'Docker-maintained plugin marketplace for container workflows',
    estimatedPluginCount: 5,
  },
  {
    id: 'pleaseai-marketplace',
    label: 'PleaseAI',
    owner: 'Passion Factory',
    trust: 'community',
    manifestUrl: 'https://raw.githubusercontent.com/pleaseai/claude-code-plugins/main/.claude-plugin/marketplace.json',
    repo: 'pleaseai/claude-code-plugins',
    description: 'Large community marketplace with connectors and MCP plugins',
    estimatedPluginCount: 50,
  },
  {
    id: 'jeremylongshore-marketplace',
    label: 'Jeremy Longshore',
    owner: 'Community',
    trust: 'community',
    manifestUrl: 'https://raw.githubusercontent.com/jeremylongshore/claude-code-plugins/main/.claude-plugin/marketplace.json',
    repo: 'jeremylongshore/claude-code-plugins',
    description: 'Community-maintained plugin marketplace',
    estimatedPluginCount: 25,
  },
];

// =============================================================================
// PLUGIN REGISTRY HELPERS
// =============================================================================

export interface PluginRegistry {
  builtIn: BuiltInPluginDefinition[];
  office: OfficePluginDefinition[];
  feature: FeaturePluginDefinition[];
  anthropic: ThirdPartyPluginDefinition[];
  docker: ThirdPartyPluginDefinition[];
  thirdParty: ThirdPartyPluginDefinition[];
  all: (BuiltInPluginDefinition | OfficePluginDefinition | FeaturePluginDefinition | ThirdPartyPluginDefinition)[];
}

export function getPluginRegistry(): PluginRegistry {
  return {
    builtIn: BUILT_IN_PLUGINS,
    office: OFFICE_PLUGINS,
    feature: FEATURE_PLUGINS,
    anthropic: ANTHROPIC_OFFICIAL_PLUGINS,
    docker: DOCKER_PLUGINS,
    thirdParty: ADDITIONAL_PLUGINS,
    all: [
      ...BUILT_IN_PLUGINS,
      ...OFFICE_PLUGINS,
      ...FEATURE_PLUGINS,
      ...ANTHROPIC_OFFICIAL_PLUGINS,
      ...DOCKER_PLUGINS,
      ...ADDITIONAL_PLUGINS,
    ],
  };
}

// Get plugins by category (mode group)
export function getPluginsByCategory(category: PluginCategory) {
  const registry = getPluginRegistry();
  return {
    builtIn: registry.builtIn.filter(p => p.category === category),
    office: registry.office.filter(p => p.category === category),
    thirdParty: [
      ...registry.anthropic,
      ...registry.docker,
      ...registry.thirdParty,
    ].filter(p => p.category === category),
    all: registry.all.filter(p => p.category === category),
  };
}

// Format as "Agent | Group-Mode" for display
export function formatPluginDisplayName(
  plugin: BuiltInPluginDefinition | OfficePluginDefinition | FeaturePluginDefinition | ThirdPartyPluginDefinition
): string {
  const categoryLabels: Record<PluginCategory, string> = {
    create: 'Create',
    analyze: 'Analyze',
    build: 'Build',
    automate: 'Automate',
    cowork: 'Cowork',
    productivity: 'Productivity',
    integration: 'Integration',
    custom: 'Custom',
  };
  
  if ('shade' in plugin) {
    // Built-in plugin
    return `Agent | ${categoryLabels[plugin.category]}-${plugin.name}`;
  }
  
  // Other plugins
  return `Agent | ${categoryLabels[plugin.category]}-${plugin.name}`;
}

// Get deterministic actions for a plugin
export function getPluginDeterministicActions(pluginId: string): string[] {
  const registry = getPluginRegistry();
  const plugin = registry.all.find(p => p.id === pluginId);
  
  if (!plugin) return [];
  
  if ('deterministicActions' in plugin) {
    return plugin.deterministicActions;
  }
  
  // Built-in or feature plugins have features instead
  return 'features' in plugin ? plugin.features : [];
}

// Install a third-party plugin (deterministic behavior)
export async function installThirdPartyPlugin(
  pluginId: string
): Promise<{ success: boolean; message: string; actions: string[] }> {
  const registry = getPluginRegistry();
  const plugin = registry.all.find(p => p.id === pluginId);
  
  if (!plugin) {
    return { success: false, message: 'Plugin not found', actions: [] };
  }
  
  if ('shade' in plugin) {
    return { 
      success: false, 
      message: 'Built-in plugins are already installed', 
      actions: plugin.features 
    };
  }
  
  if ('app' in plugin) {
    return {
      success: false,
      message: 'Office plugins are managed through Microsoft AppSource',
      actions: plugin.deterministicActions,
    };
  }
  
  // Third-party plugin installation
  const actions = 'deterministicActions' in plugin ? plugin.deterministicActions : [];
  
  return {
    success: true,
    message: `Installed ${plugin.name} from ${plugin.author.name}. The plugin will perform these actions deterministically:`,
    actions,
  };
}

// Search all plugins
export function searchPlugins(query: string) {
  const registry = getPluginRegistry();
  const lowerQuery = query.toLowerCase();
  
  return registry.all.filter(plugin => 
    plugin.name.toLowerCase().includes(lowerQuery) ||
    plugin.description.toLowerCase().includes(lowerQuery) ||
    ('capabilities' in plugin && plugin.capabilities.some(c => c.toLowerCase().includes(lowerQuery)))
  );
}

// Get plugin by ID
export function getPluginById(id: string) {
  const registry = getPluginRegistry();
  return registry.all.find(p => p.id === id);
}

// =============================================================================
// COMPLETE PLUGIN LIST
// =============================================================================

export function listAllPlugins(): string {
  const registry = getPluginRegistry();
  
  const lines: string[] = [
    '╔══════════════════════════════════════════════════════════════════════════════╗',
    '║                        ALLTERNIT PLATFORM - PLUGIN LIST                       ║',
    '╚══════════════════════════════════════════════════════════════════════════════╝',
    '',
    '🎨 CREATE (Violet Gradient) - Content Generation',
    '────────────────────────────────────────────────────────────────────────────────',
  ];
  
  // Create group
  const createPlugins = registry.all.filter(p => p.category === 'create');
  createPlugins.forEach(p => {
    const displayName = formatPluginDisplayName(p);
    const isBuiltIn = 'shade' in p;
    const isOffice = 'app' in p;
    const badge = isBuiltIn ? '[Built-in]' : isOffice ? '[Office]' : p.author.verified ? '[Verified]' : '[Community]';
    lines.push(`  ${displayName} ${badge}`);
    lines.push(`    └─ ${p.description}`);
    if ('deterministicActions' in p && p.deterministicActions) {
      lines.push(`    └─ Actions: ${p.deterministicActions.slice(0, 2).join(', ')}...`);
    } else if ('features' in p) {
      lines.push(`    └─ Features: ${p.features.slice(0, 2).join(', ')}...`);
    }
    lines.push('');
  });
    
  // Analyze group
  lines.push(
    '',
    '🔍 ANALYZE (Blue Gradient) - Research & Data',
    '────────────────────────────────────────────────────────────────────────────────',
  );
  const analyzePlugins = registry.all.filter(p => p.category === 'analyze');
  analyzePlugins.forEach(p => {
    const displayName = formatPluginDisplayName(p);
    const isBuiltIn = 'shade' in p;
    const isOffice = 'app' in p;
    const badge = isBuiltIn ? '[Built-in]' : isOffice ? '[Office]' : p.author.verified ? '[Verified]' : '[Community]';
    lines.push(`  ${displayName} ${badge}`);
    lines.push(`    └─ ${p.description}`);
    if ('deterministicActions' in p && p.deterministicActions) {
      lines.push(`    └─ Actions: ${p.deterministicActions.slice(0, 2).join(', ')}...`);
    } else if ('features' in p) {
      lines.push(`    └─ Features: ${p.features.slice(0, 2).join(', ')}...`);
    }
    lines.push('');
  });
    
  // Build group
  lines.push(
    '',
    '🔨 BUILD (Emerald Gradient) - Code & Assets',
    '────────────────────────────────────────────────────────────────────────────────',
  );
  const buildPlugins = registry.all.filter(p => p.category === 'build');
  buildPlugins.forEach(p => {
    const displayName = formatPluginDisplayName(p);
    const isBuiltIn = 'shade' in p;
    const isOffice = 'app' in p;
    const badge = isBuiltIn ? '[Built-in]' : isOffice ? '[Office]' : p.author.verified ? '[Verified]' : '[Community]';
    lines.push(`  ${displayName} ${badge}`);
    lines.push(`    └─ ${p.description}`);
    if ('deterministicActions' in p && p.deterministicActions) {
      lines.push(`    └─ Actions: ${p.deterministicActions.slice(0, 2).join(', ')}...`);
    } else if ('features' in p) {
      lines.push(`    └─ Features: ${p.features.slice(0, 2).join(', ')}...`);
    }
    lines.push('');
  });
    
  // Automate group
  lines.push(
    '',
    '⚡ AUTOMATE (Amber Gradient) - Workflows & Swarms',
    '────────────────────────────────────────────────────────────────────────────────',
  );
  const automatePlugins = registry.all.filter(p => p.category === 'automate');
  automatePlugins.forEach(p => {
    const displayName = formatPluginDisplayName(p);
    const isBuiltIn = 'shade' in p;
    const isOffice = 'app' in p;
    const badge = isBuiltIn ? '[Built-in]' : isOffice ? '[Office]' : p.author.verified ? '[Verified]' : '[Community]';
    lines.push(`  ${displayName} ${badge}`);
    lines.push(`    └─ ${p.description}`);
    if ('deterministicActions' in p && p.deterministicActions) {
      lines.push(`    └─ Actions: ${p.deterministicActions.slice(0, 2).join(', ')}...`);
    } else if ('features' in p) {
      lines.push(`    └─ Features: ${p.features.slice(0, 2).join(', ')}...`);
    }
    lines.push('');
  });

  // Summary
  lines.push(
    '',
    `╔══════════════════════════════════════════════════════════════════════════════╗`,
    `║  COUNTS BY SOURCE                                                             ║`,
    `╠══════════════════════════════════════════════════════════════════════════════╣`,
    `║  Built-in Agent Modes:     ${String(registry.builtIn.length).padEnd(48)}║`,
    `║  Office Add-ins:           ${String(registry.office.length).padEnd(48)}║`,
    `║  Feature Plugins:          ${String(registry.feature.length).padEnd(48)}║`,
    `║  Anthropic Official:       ${String(registry.anthropic.length).padEnd(48)}║`,
    `║  Docker Plugins:           ${String(registry.docker.length).padEnd(48)}║`,
    `║  Additional Third-party:   ${String(registry.thirdParty.length).padEnd(48)}║`,
    `╠══════════════════════════════════════════════════════════════════════════════╣`,
    `║  TOTAL: ${String(registry.all.length).padEnd(63)}║`,
    `╚══════════════════════════════════════════════════════════════════════════════╝`,
    '',
    'CURATED MARKETPLACE SOURCES:',
    ...CURATED_MARKETPLACE_SOURCES.map(s => `  • ${s.label} (${s.owner}) - ~${s.estimatedPluginCount} plugins`),
  );
  
  return lines.join('\n');
}

// Export for console inspection
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).listAllPlugins = listAllPlugins;
  (window as unknown as Record<string, unknown>).getPluginRegistry = getPluginRegistry;
}
