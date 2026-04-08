/**
 * Claude Desktop Bundled Plugins
 * 
 * These are the official plugins that ship with the Claude Desktop application.
 * They are stored in: ~/Library/Application Support/Claude/local-agent-mode-sessions/*/cowork_plugins/marketplaces/knowledge-work-plugins/
 * 
 * All plugins are authored by Anthropic and include comprehensive skills.
 */

export interface ClaudeDesktopPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: 'Anthropic' | 'Partner';
  category: string;
  skills: string[]; // List of skill directories
  source: 'knowledge-work-plugins' | 'partner-built';
}

// =============================================================================
// ANTHROPIC KNOWLEDGE WORK PLUGINS (15 plugins)
// =============================================================================

export const ANTHROPIC_KNOWLEDGE_WORK_PLUGINS: ClaudeDesktopPlugin[] = [
  {
    id: 'bio-research',
    name: 'Bio Research',
    version: '1.0.0',
    description: 'Connect to preclinical research tools and databases (literature search, genomics analysis, target prioritization) to accelerate early-stage life sciences R&D',
    author: 'Anthropic',
    category: 'analyze',
    skills: [
      'literature-search',
      'genomics-analysis',
      'target-prioritization',
    ],
    source: 'knowledge-work-plugins',
  },
  {
    id: 'cowork-plugin-management',
    name: 'CoWork Plugin Management',
    version: '0.2.2',
    description: 'Create, customize, and manage plugins tailored to your organization\'s tools and workflows. Configure MCP servers, adjust plugin behavior, and adapt templates to match how your team works.',
    author: 'Anthropic',
    category: 'automate',
    skills: [
      'cowork-plugin-customizer',
      'create-cowork-plugin',
    ],
    source: 'knowledge-work-plugins',
  },
  {
    id: 'customer-support',
    name: 'Customer Support',
    version: '1.1.0',
    description: 'Triage tickets, draft responses, escalate issues, and build your knowledge base. Research customer context and turn resolved issues into self-service content.',
    author: 'Anthropic',
    category: 'analyze',
    skills: [
      'ticket-triage',
      'response-drafting',
      'knowledge-base-building',
      'customer-research',
    ],
    source: 'knowledge-work-plugins',
  },
  {
    id: 'data',
    name: 'Data',
    version: '1.0.0',
    description: 'Write SQL, explore datasets, and generate insights faster. Build visualizations and dashboards, and turn raw data into clear stories for stakeholders.',
    author: 'Anthropic',
    category: 'analyze',
    skills: [
      'sql-writing',
      'dataset-exploration',
      'visualization-building',
      'dashboard-creation',
      'insight-generation',
    ],
    source: 'knowledge-work-plugins',
  },
  {
    id: 'design',
    name: 'Design',
    version: '1.1.0',
    description: 'Accelerate design workflows — critique, design system management, UX writing, accessibility audits, research synthesis, and dev handoff. From exploration to pixel-perfect specs.',
    author: 'Anthropic',
    category: 'create',
    skills: [
      'design-critique',
      'design-system-management',
      'ux-writing',
      'accessibility-audits',
      'research-synthesis',
      'dev-handoff',
    ],
    source: 'knowledge-work-plugins',
  },
  {
    id: 'engineering',
    name: 'Engineering',
    version: '1.1.0',
    description: 'Streamline engineering workflows — standups, code review, architecture decisions, incident response, and technical documentation. Works with your existing tools or standalone.',
    author: 'Anthropic',
    category: 'build',
    skills: [
      'standup-management',
      'code-review',
      'architecture-decisions',
      'incident-response',
      'technical-documentation',
    ],
    source: 'knowledge-work-plugins',
  },
  {
    id: 'enterprise-search',
    name: 'Enterprise Search',
    version: '1.1.0',
    description: 'Search across all of your company\'s tools in one place. Find anything across email, chat, documents, and wikis without switching between apps.',
    author: 'Anthropic',
    category: 'analyze',
    skills: [
      'cross-tool-search',
      'email-search',
      'chat-search',
      'document-search',
      'wiki-search',
    ],
    source: 'knowledge-work-plugins',
  },
  {
    id: 'finance',
    name: 'Finance',
    version: '1.1.0',
    description: 'Streamline finance and accounting workflows, from journal entries and reconciliation to financial statements and variance analysis. Speed up audit prep, month-end close, and keeping your books clean.',
    author: 'Anthropic',
    category: 'analyze',
    skills: [
      'journal-entries',
      'reconciliation',
      'financial-statements',
      'variance-analysis',
      'audit-prep',
      'month-end-close',
    ],
    source: 'knowledge-work-plugins',
  },
  {
    id: 'human-resources',
    name: 'Human Resources',
    version: '1.1.0',
    description: 'Streamline people operations — recruiting, onboarding, performance reviews, compensation analysis, and policy guidance. Maintain compliance and keep your team running smoothly.',
    author: 'Anthropic',
    category: 'analyze',
    skills: [
      'recruiting',
      'onboarding',
      'performance-reviews',
      'compensation-analysis',
      'policy-guidance',
    ],
    source: 'knowledge-work-plugins',
  },
  {
    id: 'legal',
    name: 'Legal',
    version: '1.1.0',
    description: 'Speed up contract review, NDA triage, and compliance workflows for in-house legal teams. Draft legal briefs, organize precedent research, and manage institutional knowledge.',
    author: 'Anthropic',
    category: 'analyze',
    skills: [
      'nda-triage',
      'contract-review',
      'compliance',
      'legal-risk-assessment',
      'meeting-briefing',
      'canned-responses',
    ],
    source: 'knowledge-work-plugins',
  },
  {
    id: 'marketing',
    name: 'Marketing',
    version: '1.1.0',
    description: 'Create content, plan campaigns, and analyze performance across marketing channels. Maintain brand voice consistency, track competitors, and report on what\'s working.',
    author: 'Anthropic',
    category: 'create',
    skills: [
      'content-creation',
      'campaign-planning',
      'performance-analysis',
      'brand-voice-consistency',
      'competitor-tracking',
      'reporting',
    ],
    source: 'knowledge-work-plugins',
  },
  {
    id: 'operations',
    name: 'Operations',
    version: '1.1.0',
    description: 'Optimize business operations — vendor management, process documentation, change management, capacity planning, and compliance tracking. Keep your organization running efficiently.',
    author: 'Anthropic',
    category: 'automate',
    skills: [
      'vendor-management',
      'process-documentation',
      'change-management',
      'capacity-planning',
      'compliance-tracking',
    ],
    source: 'knowledge-work-plugins',
  },
  {
    id: 'product-management',
    name: 'Product Management',
    version: '1.1.0',
    description: 'Write feature specs, plan roadmaps, and synthesize user research faster. Keep stakeholders updated and stay ahead of the competitive landscape.',
    author: 'Anthropic',
    category: 'create',
    skills: [
      'feature-specs',
      'roadmap-planning',
      'user-research-synthesis',
      'stakeholder-updates',
      'competitive-landscape',
    ],
    source: 'knowledge-work-plugins',
  },
  {
    id: 'productivity',
    name: 'Productivity',
    version: '1.1.0',
    description: 'Manage tasks, plan your day, and build up memory of important context about your work. Syncs with your calendar, email, and chat to keep everything organized and on track.',
    author: 'Anthropic',
    category: 'automate',
    skills: [
      'task-management',
      'day-planning',
      'context-memory',
      'calendar-sync',
      'email-sync',
      'chat-sync',
    ],
    source: 'knowledge-work-plugins',
  },
  {
    id: 'sales',
    name: 'Sales',
    version: '1.1.0',
    description: 'Prospect, craft outreach, and build deal strategy faster. Prep for calls, manage your pipeline, and write personalized messaging that moves deals forward.',
    author: 'Anthropic',
    category: 'analyze',
    skills: [
      'prospecting',
      'outreach-crafting',
      'deal-strategy',
      'call-prep',
      'pipeline-management',
      'personalized-messaging',
    ],
    source: 'knowledge-work-plugins',
  },
];

// =============================================================================
// PARTNER-BUILT PLUGINS (4 plugins)
// =============================================================================

export const PARTNER_BUILT_PLUGINS: ClaudeDesktopPlugin[] = [
  {
    id: 'apollo',
    name: 'Apollo',
    version: '1.0.0',
    description: 'Sales intelligence and engagement platform integration',
    author: 'Partner',
    category: 'analyze',
    skills: [
      'contact-enrichment',
      'sequence-automation',
      'prospecting',
    ],
    source: 'partner-built',
  },
  {
    id: 'brand-voice',
    name: 'Brand Voice',
    version: '1.0.0',
    description: 'Brand voice consistency and content guidelines',
    author: 'Partner',
    category: 'create',
    skills: [
      'voice-consistency',
      'content-guidelines',
      'brand-compliance',
    ],
    source: 'partner-built',
  },
  {
    id: 'common-room',
    name: 'Common Room',
    version: '1.0.0',
    description: 'Community intelligence and member insights',
    author: 'Partner',
    category: 'analyze',
    skills: [
      'member-insights',
      'community-analytics',
      'engagement-tracking',
    ],
    source: 'partner-built',
  },
  {
    id: 'slack',
    name: 'Slack',
    version: '1.0.0',
    description: 'Slack workspace integration and automation',
    author: 'Partner',
    category: 'automate',
    skills: [
      'message-automation',
      'channel-management',
      'notification-routing',
    ],
    source: 'partner-built',
  },
];

// =============================================================================
// ALL CLAUDE DESKTOP PLUGINS
// =============================================================================

export const ALL_CLAUDE_DESKTOP_PLUGINS: ClaudeDesktopPlugin[] = [
  ...ANTHROPIC_KNOWLEDGE_WORK_PLUGINS,
  ...PARTNER_BUILT_PLUGINS,
];

// =============================================================================
// PLUGIN CATEGORIES
// =============================================================================

export const PLUGIN_CATEGORIES = {
  analyze: [
    'bio-research',
    'customer-support',
    'data',
    'enterprise-search',
    'finance',
    'human-resources',
    'legal',
    'sales',
    'apollo',
    'common-room',
  ],
  create: [
    'design',
    'marketing',
    'product-management',
    'brand-voice',
  ],
  build: [
    'engineering',
  ],
  automate: [
    'cowork-plugin-management',
    'operations',
    'productivity',
    'slack',
  ],
};

// =============================================================================
// HELPERS
// =============================================================================

export function getPluginById(id: string): ClaudeDesktopPlugin | undefined {
  return ALL_CLAUDE_DESKTOP_PLUGINS.find(p => p.id === id);
}

export function getPluginsByCategory(category: keyof typeof PLUGIN_CATEGORIES): ClaudeDesktopPlugin[] {
  const ids = PLUGIN_CATEGORIES[category] || [];
  return ALL_CLAUDE_DESKTOP_PLUGINS.filter(p => ids.includes(p.id));
}

export function getAnthropicPlugins(): ClaudeDesktopPlugin[] {
  return ANTHROPIC_KNOWLEDGE_WORK_PLUGINS;
}

export function getPartnerPlugins(): ClaudeDesktopPlugin[] {
  return PARTNER_BUILT_PLUGINS;
}

// =============================================================================
// TOTAL COUNT
// =============================================================================

export const PLUGIN_COUNTS = {
  anthropic: ANTHROPIC_KNOWLEDGE_WORK_PLUGINS.length,
  partner: PARTNER_BUILT_PLUGINS.length,
  total: ALL_CLAUDE_DESKTOP_PLUGINS.length,
};

// Summary:
// - 15 Anthropic Knowledge Work Plugins
// - 4 Partner-Built Plugins
// - 19 Total Claude Desktop Bundled Plugins
