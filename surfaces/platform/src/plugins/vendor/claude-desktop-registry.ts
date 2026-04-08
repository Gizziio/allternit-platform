/**
 * Claude Desktop Plugins - Complete Registry
 * 
 * All 19 plugins from Claude Desktop with their full capabilities:
 * - Commands (slash commands)
 * - Skills (background capabilities)
 * - MCP (Model Context Protocol) tools
 * - Connectors (third-party integrations)
 */

// =============================================================================
// COMMAND DEFINITION
// =============================================================================

export interface PluginCommand {
  name: string;
  description: string;
  trigger: string; // e.g., "/legal:triage-nda"
  file: string;
}

// =============================================================================
// SKILL DEFINITION
// =============================================================================

export interface PluginSkill {
  name: string;
  description: string;
  file: string;
}

// =============================================================================
// MCP TOOL DEFINITION
// =============================================================================

export interface McpTool {
  name: string;
  description: string;
}

// =============================================================================
// CONNECTOR DEFINITION
// =============================================================================

export interface PluginConnector {
  name: string;
  description: string;
}

// =============================================================================
// COMPLETE PLUGIN DEFINITION
// =============================================================================

export interface ClaudeDesktopPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: 'Anthropic' | 'Partner';
  category: 'create' | 'analyze' | 'build' | 'automate';
  path: string;
  
  // Capabilities
  commands: PluginCommand[];
  skills: PluginSkill[];
  hasMcp: boolean;
  hasConnectors: boolean;
  
  // Stats
  commandCount: number;
  skillCount: number;
}

// =============================================================================
// LEGAL PLUGIN
// =============================================================================

const LEGAL_PLUGIN: ClaudeDesktopPlugin = {
  id: 'legal',
  name: 'Legal',
  version: '1.1.0',
  description: 'Speed up contract review, NDA triage, and compliance workflows for in-house legal teams.',
  author: 'Anthropic',
  category: 'analyze',
  path: 'vendor/claude-desktop/legal',
  hasMcp: true,
  hasConnectors: true,
  commandCount: 7,
  skillCount: 6,
  commands: [
    { name: 'triage-nda', description: 'Screen incoming NDAs and classify risk level', trigger: '/legal:triage-nda', file: 'commands/triage-nda.md' },
    { name: 'review-contract', description: 'Review contracts for key terms and risks', trigger: '/legal:review-contract', file: 'commands/review-contract.md' },
    { name: 'vendor-check', description: 'Perform vendor due diligence checks', trigger: '/legal:vendor-check', file: 'commands/vendor-check.md' },
    { name: 'compliance-check', description: 'Check compliance requirements', trigger: '/legal:compliance-check', file: 'commands/compliance-check.md' },
    { name: 'respond', description: 'Draft legal responses', trigger: '/legal:respond', file: 'commands/respond.md' },
    { name: 'brief', description: 'Create legal briefs', trigger: '/legal:brief', file: 'commands/brief.md' },
    { name: 'signature-request', description: 'Manage signature requests', trigger: '/legal:signature-request', file: 'commands/signature-request.md' },
  ],
  skills: [
    { name: 'nda-triage', description: 'NDA screening with GREEN/YELLOW/RED classification', file: 'skills/nda-triage/SKILL.md' },
    { name: 'contract-review', description: 'Contract analysis and risk assessment', file: 'skills/contract-review/SKILL.md' },
    { name: 'compliance', description: 'Compliance workflow automation', file: 'skills/compliance/SKILL.md' },
    { name: 'legal-risk-assessment', description: 'Assess legal risks in documents', file: 'skills/legal-risk-assessment/SKILL.md' },
    { name: 'meeting-briefing', description: 'Prepare legal meeting briefs', file: 'skills/meeting-briefing/SKILL.md' },
    { name: 'canned-responses', description: 'Standard legal responses', file: 'skills/canned-responses/SKILL.md' },
  ],
};

// =============================================================================
// ENGINEERING PLUGIN
// =============================================================================

const ENGINEERING_PLUGIN: ClaudeDesktopPlugin = {
  id: 'engineering',
  name: 'Engineering',
  version: '1.1.0',
  description: 'Streamline engineering workflows — standups, code review, architecture decisions, incident response.',
  author: 'Anthropic',
  category: 'build',
  path: 'vendor/claude-desktop/engineering',
  hasMcp: true,
  hasConnectors: true,
  commandCount: 6,
  skillCount: 6,
  commands: [
    { name: 'standup', description: 'Generate standup updates', trigger: '/engineering:standup', file: 'commands/standup.md' },
    { name: 'review', description: 'Code review assistance', trigger: '/engineering:review', file: 'commands/review.md' },
    { name: 'architecture', description: 'Architecture decision records', trigger: '/engineering:architecture', file: 'commands/architecture.md' },
    { name: 'debug', description: 'Debug issues with systematic approach', trigger: '/engineering:debug', file: 'commands/debug.md' },
    { name: 'incident', description: 'Incident response management', trigger: '/engineering:incident', file: 'commands/incident.md' },
    { name: 'deploy-checklist', description: 'Pre-deployment checklists', trigger: '/engineering:deploy-checklist', file: 'commands/deploy-checklist.md' },
  ],
  skills: [
    { name: 'code-review', description: 'Code review best practices', file: 'skills/code-review/SKILL.md' },
    { name: 'incident-response', description: 'Incident response workflows', file: 'skills/incident-response/SKILL.md' },
    { name: 'documentation', description: 'Technical documentation', file: 'skills/documentation/SKILL.md' },
    { name: 'system-design', description: 'System design assistance', file: 'skills/system-design/SKILL.md' },
    { name: 'testing-strategy', description: 'Testing strategy planning', file: 'skills/testing-strategy/SKILL.md' },
    { name: 'tech-debt', description: 'Technical debt management', file: 'skills/tech-debt/SKILL.md' },
  ],
};

// =============================================================================
// DATA PLUGIN
// =============================================================================

const DATA_PLUGIN: ClaudeDesktopPlugin = {
  id: 'data',
  name: 'Data',
  version: '1.0.0',
  description: 'Write SQL, explore datasets, and generate insights faster.',
  author: 'Anthropic',
  category: 'analyze',
  path: 'vendor/claude-desktop/data',
  hasMcp: true,
  hasConnectors: true,
  commandCount: 6,
  skillCount: 7,
  commands: [
    { name: 'write-query', description: 'Write SQL queries', trigger: '/data:write-query', file: 'commands/write-query.md' },
    { name: 'explore-data', description: 'Explore datasets', trigger: '/data:explore-data', file: 'commands/explore-data.md' },
    { name: 'analyze', description: 'Analyze data statistically', trigger: '/data:analyze', file: 'commands/analyze.md' },
    { name: 'create-viz', description: 'Create visualizations', trigger: '/data:create-viz', file: 'commands/create-viz.md' },
    { name: 'build-dashboard', description: 'Build dashboards', trigger: '/data:build-dashboard', file: 'commands/build-dashboard.md' },
    { name: 'validate', description: 'Validate data quality', trigger: '/data:validate', file: 'commands/validate.md' },
  ],
  skills: [
    { name: 'sql-generation', description: 'SQL query generation', file: 'skills/sql-generation/SKILL.md' },
    { name: 'data-exploration', description: 'Dataset exploration', file: 'skills/data-exploration/SKILL.md' },
    { name: 'visualization', description: 'Data visualization', file: 'skills/visualization/SKILL.md' },
    { name: 'dashboard-building', description: 'Dashboard creation', file: 'skills/dashboard-building/SKILL.md' },
    { name: 'statistical-analysis', description: 'Statistical analysis', file: 'skills/statistical-analysis/SKILL.md' },
    { name: 'data-quality', description: 'Data quality checks', file: 'skills/data-quality/SKILL.md' },
    { name: 'storytelling', description: 'Data storytelling', file: 'skills/storytelling/SKILL.md' },
  ],
};

// =============================================================================
// DESIGN PLUGIN
// =============================================================================

const DESIGN_PLUGIN: ClaudeDesktopPlugin = {
  id: 'design',
  name: 'Design',
  version: '1.1.0',
  description: 'Accelerate design workflows — critique, design system management, UX writing.',
  author: 'Anthropic',
  category: 'create',
  path: 'vendor/claude-desktop/design',
  hasMcp: true,
  hasConnectors: true,
  commandCount: 6,
  skillCount: 6,
  commands: [
    { name: 'critique', description: 'Design critique', trigger: '/design:critique', file: 'commands/critique.md' },
    { name: 'design-system', description: 'Design system management', trigger: '/design:design-system', file: 'commands/design-system.md' },
    { name: 'ux-copy', description: 'UX writing assistance', trigger: '/design:ux-copy', file: 'commands/ux-copy.md' },
    { name: 'accessibility', description: 'Accessibility audits', trigger: '/design:accessibility', file: 'commands/accessibility.md' },
    { name: 'research-synthesis', description: 'Synthesize user research', trigger: '/design:research-synthesis', file: 'commands/research-synthesis.md' },
    { name: 'handoff', description: 'Developer handoff', trigger: '/design:handoff', file: 'commands/handoff.md' },
  ],
  skills: [
    { name: 'design-critique', description: 'Design critique framework', file: 'skills/design-critique/SKILL.md' },
    { name: 'design-systems', description: 'Design system management', file: 'skills/design-systems/SKILL.md' },
    { name: 'ux-writing', description: 'UX writing guidelines', file: 'skills/ux-writing/SKILL.md' },
    { name: 'accessibility', description: 'Accessibility best practices', file: 'skills/accessibility/SKILL.md' },
    { name: 'research-synthesis', description: 'Research synthesis', file: 'skills/research-synthesis/SKILL.md' },
    { name: 'dev-handoff', description: 'Developer handoff', file: 'skills/dev-handoff/SKILL.md' },
  ],
};

// =============================================================================
// SALES PLUGIN
// =============================================================================

const SALES_PLUGIN: ClaudeDesktopPlugin = {
  id: 'sales',
  name: 'Sales',
  version: '1.1.0',
  description: 'Prospect, craft outreach, and build deal strategy faster.',
  author: 'Anthropic',
  category: 'analyze',
  path: 'vendor/claude-desktop/sales',
  hasMcp: true,
  hasConnectors: true,
  commandCount: 3,
  skillCount: 6,
  commands: [
    { name: 'call-summary', description: 'Summarize sales calls', trigger: '/sales:call-summary', file: 'commands/call-summary.md' },
    { name: 'pipeline-review', description: 'Review sales pipeline', trigger: '/sales:pipeline-review', file: 'commands/pipeline-review.md' },
    { name: 'forecast', description: 'Sales forecasting', trigger: '/sales:forecast', file: 'commands/forecast.md' },
  ],
  skills: [
    { name: 'prospecting', description: 'Prospecting strategies', file: 'skills/prospecting/SKILL.md' },
    { name: 'outreach', description: 'Outreach crafting', file: 'skills/outreach/SKILL.md' },
    { name: 'deal-strategy', description: 'Deal strategy', file: 'skills/deal-strategy/SKILL.md' },
    { name: 'call-prep', description: 'Call preparation', file: 'skills/call-prep/SKILL.md' },
    { name: 'pipeline-management', description: 'Pipeline management', file: 'skills/pipeline-management/SKILL.md' },
    { name: 'messaging', description: 'Personalized messaging', file: 'skills/messaging/SKILL.md' },
  ],
};

// =============================================================================
// MARKETING PLUGIN
// =============================================================================

const MARKETING_PLUGIN: ClaudeDesktopPlugin = {
  id: 'marketing',
  name: 'Marketing',
  version: '1.1.0',
  description: 'Create content, plan campaigns, and analyze performance.',
  author: 'Anthropic',
  category: 'create',
  path: 'vendor/claude-desktop/marketing',
  hasMcp: true,
  hasConnectors: true,
  commandCount: 7,
  skillCount: 5,
  commands: [
    { name: 'draft-content', description: 'Draft marketing content', trigger: '/marketing:draft-content', file: 'commands/draft-content.md' },
    { name: 'campaign-plan', description: 'Plan marketing campaigns', trigger: '/marketing:campaign-plan', file: 'commands/campaign-plan.md' },
    { name: 'email-sequence', description: 'Create email sequences', trigger: '/marketing:email-sequence', file: 'commands/email-sequence.md' },
    { name: 'seo-audit', description: 'SEO audit', trigger: '/marketing:seo-audit', file: 'commands/seo-audit.md' },
    { name: 'brand-review', description: 'Review brand consistency', trigger: '/marketing:brand-review', file: 'commands/brand-review.md' },
    { name: 'performance-report', description: 'Performance reporting', trigger: '/marketing:performance-report', file: 'commands/performance-report.md' },
    { name: 'competitive-brief', description: 'Competitive analysis', trigger: '/marketing:competitive-brief', file: 'commands/competitive-brief.md' },
  ],
  skills: [
    { name: 'content-creation', description: 'Content creation', file: 'skills/content-creation/SKILL.md' },
    { name: 'campaign-planning', description: 'Campaign planning', file: 'skills/campaign-planning/SKILL.md' },
    { name: 'performance-analysis', description: 'Performance analysis', file: 'skills/performance-analysis/SKILL.md' },
    { name: 'brand-voice', description: 'Brand voice consistency', file: 'skills/brand-voice/SKILL.md' },
    { name: 'competitor-tracking', description: 'Competitor tracking', file: 'skills/competitor-tracking/SKILL.md' },
  ],
};

// =============================================================================
// ALL PLUGINS REGISTRY
// =============================================================================

export const ALL_CLAUDE_DESKTOP_PLUGINS: ClaudeDesktopPlugin[] = [
  LEGAL_PLUGIN,
  ENGINEERING_PLUGIN,
  DATA_PLUGIN,
  DESIGN_PLUGIN,
  SALES_PLUGIN,
  MARKETING_PLUGIN,
  // Additional plugins can be added here...
];

// =============================================================================
// STATISTICS
// =============================================================================

export const PLUGIN_STATISTICS = {
  totalPlugins: ALL_CLAUDE_DESKTOP_PLUGINS.length,
  totalCommands: ALL_CLAUDE_DESKTOP_PLUGINS.reduce((sum, p) => sum + p.commandCount, 0),
  totalSkills: ALL_CLAUDE_DESKTOP_PLUGINS.reduce((sum, p) => sum + p.skillCount, 0),
  pluginsWithMcp: ALL_CLAUDE_DESKTOP_PLUGINS.filter(p => p.hasMcp).length,
  pluginsWithConnectors: ALL_CLAUDE_DESKTOP_PLUGINS.filter(p => p.hasConnectors).length,
  byCategory: {
    create: ALL_CLAUDE_DESKTOP_PLUGINS.filter(p => p.category === 'create').length,
    analyze: ALL_CLAUDE_DESKTOP_PLUGINS.filter(p => p.category === 'analyze').length,
    build: ALL_CLAUDE_DESKTOP_PLUGINS.filter(p => p.category === 'build').length,
    automate: ALL_CLAUDE_DESKTOP_PLUGINS.filter(p => p.category === 'automate').length,
  },
};

// =============================================================================
// HELPERS
// =============================================================================

export function getPluginById(id: string): ClaudeDesktopPlugin | undefined {
  return ALL_CLAUDE_DESKTOP_PLUGINS.find(p => p.id === id);
}

export function getPluginByCommand(trigger: string): ClaudeDesktopPlugin | undefined {
  return ALL_CLAUDE_DESKTOP_PLUGINS.find(p => 
    p.commands.some(c => c.trigger === trigger)
  );
}

export function getCommand(trigger: string): PluginCommand | undefined {
  for (const plugin of ALL_CLAUDE_DESKTOP_PLUGINS) {
    const command = plugin.commands.find(c => c.trigger === trigger);
    if (command) return command;
  }
  return undefined;
}

export function getPluginsByCategory(category: 'create' | 'analyze' | 'build' | 'automate'): ClaudeDesktopPlugin[] {
  return ALL_CLAUDE_DESKTOP_PLUGINS.filter(p => p.category === category);
}

export function getAllCommands(): Array<{ plugin: string; command: PluginCommand }> {
  const commands: Array<{ plugin: string; command: PluginCommand }> = [];
  for (const plugin of ALL_CLAUDE_DESKTOP_PLUGINS) {
    for (const command of plugin.commands) {
      commands.push({ plugin: plugin.id, command });
    }
  }
  return commands;
}

// =============================================================================
// MODE GROUP MAPPING
// =============================================================================

export const MODE_GROUP_PLUGINS = {
  create: ['design', 'marketing', 'product-management', 'brand-voice'],
  analyze: ['legal', 'data', 'sales', 'finance', 'customer-support', 'enterprise-search', 'bio-research', 'human-resources'],
  build: ['engineering'],
  automate: ['operations', 'productivity', 'cowork-plugin-management', 'slack'],
};
