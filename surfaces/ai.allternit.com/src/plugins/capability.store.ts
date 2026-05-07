/**
 * Capability Store
 * 
 * Unified store for managing all platform capabilities:
 * Skills, Commands, Connectors, MCPs, Plugins, CLI Tools, Webhooks
 * 
 * Pattern: LocalStorage persistence + Event bus for cross-component sync
 */

import type {
  Capability,
  CapabilityType,
  Skill,
  Command,
  Connector,
  McpServer,
  CliTool,
  Webhook
} from './capability.types';

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEYS: Record<CapabilityType, string> = {
  skill: 'allternit:capabilities:skills:v1',
  command: 'allternit:capabilities:commands:v1',
  connector: 'allternit:capabilities:connectors:v1',
  mcp: 'allternit:capabilities:mcps:v1',
  plugin: 'allternit:capabilities:plugins:v1',
  'cli-tool': 'allternit:capabilities:cli-tools:v1',
  webhook: 'allternit:capabilities:webhooks:v1',
};

// ============================================================================
// Helper Functions
// ============================================================================

function safeJSONParse<T>(json: string | null, defaultValue: T): T {
  if (!json) return defaultValue;
  try {
    return JSON.parse(json) as T;
  } catch (e) {
    console.error('[CapabilityStore] JSON parse error:', e);
    return defaultValue;
  }
}

// ============================================================================
// Default Registries
// ============================================================================

export const DEFAULT_SKILLS: Skill[] = [
  {
    id: 'skill-data-analysis',
    type: 'skill',
    name: 'Data Analysis',
    description: 'Advanced data analysis with pandas, numpy, and visualization tools.',
    category: 'data',
    tags: ['python', 'data', 'visualization'],
    enabledByDefault: false,
    content: '# Data Analysis Skill\n\nUse this skill to analyze data...',
    variables: [
      { name: 'file_path', description: 'Path to data file', required: true },
      { name: 'analysis_type', description: 'Type of analysis', required: false, defaultValue: 'summary' },
    ],
    examples: [
      { title: 'CSV Analysis', description: 'Analyze a CSV file', input: { analysis_type: 'csv' } },
    ],
  },
  {
    id: 'skill-web-scraping',
    type: 'skill',
    name: 'Web Scraping',
    description: 'Extract data from websites using BeautifulSoup and Selenium.',
    category: 'web',
    tags: ['python', 'scraping', 'automation'],
    enabledByDefault: false,
    content: '# Web Scraping Skill\n\nExtract data from websites...',
    variables: [
      { name: 'url', description: 'URL to scrape', required: true },
      { name: 'selector', description: 'CSS selector', required: true },
    ],
    examples: [],
  },
  {
    id: 'skill-deploy-app',
    type: 'skill',
    name: 'Deploy Application',
    description: 'Deploy applications to various platforms.',
    category: 'devops',
    tags: ['deploy', 'docker', 'kubernetes'],
    enabledByDefault: false,
    content: '# Deploy Application\n\nDeploy your app...',
    variables: [
      { name: 'platform', description: 'Target platform', required: true },
      { name: 'version', description: 'App version', required: false },
    ],
    examples: [],
  },
];

export const DEFAULT_COMMANDS: Command[] = [
  {
    id: 'cmd-new-chat',
    type: 'command',
    name: 'New Chat',
    description: 'Start a new chat session',
    trigger: '/new-chat',
    triggerType: 'slash',
    handler: 'shell:newChat',
    category: 'navigation',
    tags: ['chat', 'session'],
    enabledByDefault: true,
    arguments: [],
    shortcuts: ['Cmd+N'],
  },
  {
    id: 'cmd-clear',
    type: 'command',
    name: 'Clear Conversation',
    description: 'Clear the current conversation',
    trigger: '/clear',
    triggerType: 'slash',
    handler: 'shell:clear',
    category: 'navigation',
    tags: ['chat', 'clear'],
    enabledByDefault: true,
    arguments: [],
  },
  {
    id: 'cmd-agent',
    type: 'command',
    name: 'Agent Mode',
    description: 'Switch to agent mode',
    trigger: '@agent',
    triggerType: 'mention',
    handler: 'shell:agentMode',
    category: 'mode',
    tags: ['agent', 'mode'],
    enabledByDefault: true,
    arguments: [
      { name: 'agent_id', description: 'Agent ID', required: false, type: 'string' },
    ],
  },
];

export const DEFAULT_CONNECTORS: Connector[] = [
  {
    id: 'conn-github',
    type: 'connector',
    name: 'GitHub',
    description: 'Connect to GitHub repositories, issues, and pull requests.',
    appName: 'GitHub',
    appUrl: 'https://github.com',
    authType: 'token',
    category: 'development',
    tags: ['git', 'code', 'collaboration'],
    enabledByDefault: false,
    actions: [
      { id: 'create-issue', name: 'Create Issue', description: 'Create a new issue', inputs: {}, outputs: {} },
      { id: 'create-pr', name: 'Create Pull Request', description: 'Create a PR', inputs: {}, outputs: {} },
    ],
    webhooks: [
      { event: 'push', path: '/webhooks/github/push', description: 'On code push' },
      { event: 'pull_request', path: '/webhooks/github/pr', description: 'On PR activity' },
    ],
  },
  {
    id: 'conn-slack',
    type: 'connector',
    name: 'Slack',
    description: 'Send messages and interact with Slack workspaces.',
    appName: 'Slack',
    appUrl: 'https://slack.com',
    authType: 'oauth',
    category: 'communication',
    tags: ['chat', 'team', 'notifications'],
    enabledByDefault: false,
    actions: [
      { id: 'send-message', name: 'Send Message', description: 'Send a message to a channel', inputs: {}, outputs: {} },
    ],
  },
  {
    id: 'conn-linear',
    type: 'connector',
    name: 'Linear',
    description: 'Manage issues and projects with Linear.',
    appName: 'Linear',
    appUrl: 'https://linear.app',
    authType: 'apikey',
    category: 'project-management',
    tags: ['issues', 'project', 'tracking'],
    enabledByDefault: false,
    actions: [
      { id: 'create-issue', name: 'Create Issue', description: 'Create a Linear issue', inputs: {}, outputs: {} },
    ],
  },
];

export const DEFAULT_MCPS: McpServer[] = [
  {
    id: 'mcp-filesystem',
    type: 'mcp',
    name: 'Filesystem MCP',
    description: 'Access and manipulate the local filesystem.',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/Users/macbook/Desktop'],
    category: 'core',
    tags: ['files', 'system', 'local'],
    enabledByDefault: false,
    tools: [
      { name: 'read_file', description: 'Read a file', inputSchema: {} },
      { name: 'write_file', description: 'Write a file', inputSchema: {} },
      { name: 'list_directory', description: 'List directory contents', inputSchema: {} },
    ],
    resources: [],
  },
  {
    id: 'mcp-postgres',
    type: 'mcp',
    name: 'PostgreSQL MCP',
    description: 'Query PostgreSQL databases.',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://localhost/mydb'],
    category: 'database',
    tags: ['database', 'sql', 'postgres'],
    enabledByDefault: false,
    tools: [
      { name: 'query', description: 'Execute a SQL query', inputSchema: {} },
    ],
    resources: [],
  },
  {
    id: 'mcp-puppeteer',
    type: 'mcp',
    name: 'Puppeteer MCP',
    description: 'Browser automation with Puppeteer.',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    category: 'browser',
    tags: ['browser', 'automation', 'scraping'],
    enabledByDefault: false,
    tools: [
      { name: 'navigate', description: 'Navigate to URL', inputSchema: {} },
      { name: 'screenshot', description: 'Take a screenshot', inputSchema: {} },
    ],
    resources: [],
  },
];

export const DEFAULT_CLI_TOOLS: CliTool[] = [
  {
    id: 'cli-docker',
    type: 'cli-tool',
    name: 'Docker',
    description: 'Container management platform',
    command: 'docker',
    checkCommand: 'docker --version',
    installCommands: {
      macos: 'brew install docker',
      linux: 'curl -fsSL https://get.docker.com | sh',
    },
    category: 'system',
    tags: ['containers', 'devops', 'virtualization'],
    enabledByDefault: false,
  },
  {
    id: 'cli-kubectl',
    type: 'cli-tool',
    name: 'kubectl',
    description: 'Kubernetes command-line tool',
    command: 'kubectl',
    checkCommand: 'kubectl version --client',
    installCommands: {
      macos: 'brew install kubectl',
      linux: 'curl -LO https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl',
    },
    category: 'system',
    tags: ['kubernetes', 'containers', 'orchestration'],
    enabledByDefault: false,
  },
  {
    id: 'cli-gh',
    type: 'cli-tool',
    name: 'GitHub CLI',
    description: 'GitHub command-line interface',
    command: 'gh',
    checkCommand: 'gh --version',
    installCommands: {
      macos: 'brew install gh',
      linux: 'curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg',
    },
    category: 'dev',
    tags: ['git', 'github', 'collaboration'],
    enabledByDefault: false,
  },
  {
    id: 'cli-fzf',
    type: 'cli-tool',
    name: 'fzf',
    description: 'Command-line fuzzy finder',
    command: 'fzf',
    checkCommand: 'fzf --version',
    installCommands: {
      macos: 'brew install fzf',
      linux: 'apt-get install fzf',
    },
    category: 'shell',
    tags: ['productivity', 'search', 'navigation'],
    enabledByDefault: false,
  },
  {
    id: 'cli-jq',
    type: 'cli-tool',
    name: 'jq',
    description: 'JSON processor',
    command: 'jq',
    checkCommand: 'jq --version',
    installCommands: {
      macos: 'brew install jq',
      linux: 'apt-get install jq',
    },
    category: 'text',
    tags: ['json', 'processing', 'data'],
    enabledByDefault: false,
  },
];

export const DEFAULT_WEBHOOKS: Webhook[] = [
  {
    id: 'wh-github-push',
    type: 'webhook',
    name: 'GitHub Push',
    description: 'Trigger on GitHub code push events',
    path: '/webhooks/github/push',
    method: 'POST',
    eventType: 'github.push',
    connectedSkill: 'skill-deploy-app',
    category: 'development',
    tags: ['github', 'git', 'automation'],
    enabledByDefault: false,
    triggerCount: 0,
  },
  {
    id: 'wh-stripe-payment',
    type: 'webhook',
    name: 'Stripe Payment',
    description: 'Trigger on Stripe payment events',
    path: '/webhooks/stripe/payment',
    method: 'POST',
    eventType: 'stripe.payment',
    category: 'payment',
    tags: ['stripe', 'payment', 'ecommerce'],
    enabledByDefault: false,
    triggerCount: 0,
  },
  {
    id: 'wh-linear-issue',
    type: 'webhook',
    name: 'Linear Issue Update',
    description: 'Trigger on Linear issue changes',
    path: '/webhooks/linear/issue',
    method: 'POST',
    eventType: 'linear.issue',
    category: 'project-management',
    tags: ['linear', 'issues', 'tracking'],
    enabledByDefault: false,
    triggerCount: 0,
  },
];

// ============================================================================
// Event Bus
// ============================================================================

type Listener = () => void;
const listeners = new Map<CapabilityType, Set<Listener>>();

function getListeners(type: CapabilityType): Set<Listener> {
  if (!listeners.has(type)) {
    listeners.set(type, new Set());
  }
  return listeners.get(type)!;
}

function notify(type: CapabilityType): void {
  getListeners(type).forEach((fn) => fn());
}

export function subscribeToCapabilityChanges(type: CapabilityType, fn: Listener): () => void {
  const set = getListeners(type);
  set.add(fn);
  return () => set.delete(fn);
}

// ============================================================================
// Read/Write Functions
// ============================================================================

function writeEnabled(type: CapabilityType, enabledIds: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEYS[type], JSON.stringify([...enabledIds]));
  } catch {
    // Ignore write errors
  }
}

// ============================================================================
// Generic Toggle Functions
// ============================================================================

export function getEnabledIds(type: CapabilityType): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS[type]);
    if (!raw) return [];
    return safeJSONParse<string[]>(raw, []);
  } catch {
    return [];
  }
}

export function isEnabled(type: CapabilityType, id: string): boolean {
  return getEnabledIds(type).includes(id);
}

export function enable(type: CapabilityType, id: string): void {
  const ids = new Set(getEnabledIds(type));
  ids.add(id);
  writeEnabled(type, ids);
  notify(type);
}

export function disable(type: CapabilityType, id: string): void {
  const ids = new Set(getEnabledIds(type));
  ids.delete(id);
  writeEnabled(type, ids);
  notify(type);
}

export function toggle(type: CapabilityType, id: string): void {
  if (isEnabled(type, id)) {
    disable(type, id);
  } else {
    enable(type, id);
  }
}

// ============================================================================
// Type-Specific Getters
// ============================================================================

export function getSkills(): Skill[] {
  const enabledIds = new Set(getEnabledIds('skill'));
  return DEFAULT_SKILLS.map((s) => ({ ...s, enabled: enabledIds.has(s.id) }));
}

export function getCommands(): Command[] {
  const enabledIds = new Set(getEnabledIds('command'));
  return DEFAULT_COMMANDS.map((c) => ({ ...c, enabled: enabledIds.has(c.id) }));
}

export function getConnectors(): Connector[] {
  const enabledIds = new Set(getEnabledIds('connector'));
  return DEFAULT_CONNECTORS.map((c) => ({ ...c, enabled: enabledIds.has(c.id) }));
}

export function getMcps(): McpServer[] {
  const enabledIds = new Set(getEnabledIds('mcp'));
  return DEFAULT_MCPS.map((m) => ({ ...m, enabled: enabledIds.has(m.id) }));
}

export function getCliTools(): CliTool[] {
  const enabledIds = new Set(getEnabledIds('cli-tool'));
  return DEFAULT_CLI_TOOLS.map((c) => ({ ...c, enabled: enabledIds.has(c.id) }));
}

export function getWebhooks(): Webhook[] {
  const enabledIds = new Set(getEnabledIds('webhook'));
  return DEFAULT_WEBHOOKS.map((w) => ({ ...w, enabled: enabledIds.has(w.id) }));
}

// ============================================================================
// Get All Enabled Capabilities (for Agent Launchpad)
// ============================================================================

export function getAllEnabledCapabilities(): Capability[] {
  return [
    ...getSkills().filter((s) => isEnabled('skill', s.id)),
    ...getCommands().filter((c) => isEnabled('command', c.id)),
    ...getConnectors().filter((c) => isEnabled('connector', c.id)),
    ...getMcps().filter((m) => isEnabled('mcp', m.id)),
    ...getCliTools().filter((c) => isEnabled('cli-tool', c.id)),
    ...getWebhooks().filter((w) => isEnabled('webhook', w.id)),
  ];
}
