import type { SpawnPolicy, ViewType } from "./nav.types";

export const DEFAULT_POLICIES: Record<ViewType, SpawnPolicy> = {
  home: { singleton: true, maxInstances: 1, allowNew: false, surface: "view", ownsTabs: false },
  chat: { singleton: false, maxInstances: 20, allowNew: true, surface: "view", ownsTabs: false },
  "chat-legacy": { singleton: false, maxInstances: 20, allowNew: true, surface: "view", ownsTabs: false },
  elements: { singleton: true, maxInstances: 1, allowNew: false, surface: "view", ownsTabs: false },
  playground: { singleton: true, maxInstances: 1, allowNew: false, surface: "view", ownsTabs: false },
  workspace: { singleton: false, maxInstances: 20, allowNew: true, surface: "view", ownsTabs: false },
  browser: { singleton: true, maxInstances: 1, allowNew: false, surface: "capsule", ownsTabs: true },
  studio: { singleton: false, maxInstances: 10, allowNew: true, surface: "view", ownsTabs: false },
  marketplace: { singleton: true, maxInstances: 1, allowNew: false, surface: "view", ownsTabs: false },
  registry: { singleton: true, maxInstances: 1, allowNew: false, surface: "view", ownsTabs: false },
  memory: { singleton: true, maxInstances: 1, allowNew: false, surface: "view", ownsTabs: false },
  settings: { singleton: true, maxInstances: 1, allowNew: false, surface: "view", ownsTabs: false },
  runner: { singleton: true, maxInstances: 1, allowNew: false, surface: "view", ownsTabs: false },
  rails: { singleton: true, maxInstances: 1, allowNew: false, surface: "view", ownsTabs: false },
  agent: { singleton: true, maxInstances: 1, allowNew: false, surface: "view", ownsTabs: false },
  "agent-hub": { singleton: true, maxInstances: 1, allowNew: false, surface: "view", ownsTabs: false },
  
  // Mode-specific Agent Session views
  "chat-agent-session": { singleton: false, maxInstances: 10, allowNew: true, surface: "view", ownsTabs: false },
  "cowork-agent-session": { singleton: false, maxInstances: 10, allowNew: true, surface: "view", ownsTabs: false },
  "code-agent-session": { singleton: false, maxInstances: 10, allowNew: true, surface: "view", ownsTabs: false },
  
  terminal: { singleton: false, maxInstances: 10, allowNew: true, surface: "view", ownsTabs: false },

  plugins: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  code: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'run-replay': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  promotion: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'models-manage': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  monitor: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  openclaw: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'openclaw-chat': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'openclaw-sessions': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },

  // Agent views
  'native-agent': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },

  // P4 DAG Infrastructure views
  dag: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  swarm: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  policy: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'task-executor': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  ontology: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  directive: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  evaluation: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'gc-agents': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },

  // P4/P5 AI & Vision views
  ivkge: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  multimodal: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  tambo: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },

  // P5 Security & Governance views
  receipts: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'policy-gating': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  security: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  purpose: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },

  // P5 Browser & Execution views
  browserview: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'dag-wih': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  checkpointing: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },

  // P4 Observability views
  observability: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },

  // Cloud & Deploy views
  deploy: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },

  // Missing views added
  nodes: { singleton: false, maxInstances: 5, allowNew: true, surface: 'view', ownsTabs: false },

  // Capsule Management (P3.9 MCP Apps)
  capsules: { singleton: false, maxInstances: 5, allowNew: true, surface: 'view', ownsTabs: false },

  // Operator Browser Control (P3.10/P3.12)
  operator: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },

  // P3 UI Views
  'allternit-ix': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'form-surfaces': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  canvas: { singleton: false, maxInstances: 3, allowNew: true, surface: 'view', ownsTabs: false },
  'allternit-canvas': { singleton: false, maxInstances: 3, allowNew: true, surface: 'view', ownsTabs: false },
  hooks: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },

  // P4 UI Views
  evolution: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'context-control': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'memory-kernel': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  acf: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },

  // Verification view
  verification: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },

  // AllternitOS view
  'allternit-os': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },

  // Runtime Management Views (N11, N12, N16)
  'runtime-ops': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'budget-dashboard': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'replay-manager': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'prewarm-manager': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  // Chat History views
  history: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  archived: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },

  // Cowork Analytics & Content views
  insights: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  activity: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  goals: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'new-document': { singleton: false, maxInstances: 20, allowNew: true, surface: 'view', ownsTabs: false },

  // Code views
  'new-file': { singleton: false, maxInstances: 20, allowNew: true, surface: 'view', ownsTabs: false },
  'code-project': { singleton: false, maxInstances: 10, allowNew: true, surface: 'view', ownsTabs: false },
  search: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  debug: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'code-explorer': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'code-git': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'code-threads': { singleton: false, maxInstances: 10, allowNew: true, surface: 'view', ownsTabs: false },
  'code-automations': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'code-skills': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },

  // Cowork-specific content views
  'cowork-runs': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'cowork-drafts': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'cowork-tasks': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'cowork-cron': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'cowork-project': { singleton: false, maxInstances: 10, allowNew: true, surface: 'view', ownsTabs: false },
  'cowork-documents': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'cowork-tables': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'cowork-files': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'cowork-exports': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'cowork-new-task': { singleton: false, maxInstances: 5, allowNew: true, surface: 'view', ownsTabs: false },
  
  // Product Discovery
  products: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },

  // A://Labs - Course Management
  labs: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  catalog: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },

  // Design surface
  design: { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  "design-marketplace": { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },

  // Cowork Team (Multica absorption)
  'cowork-team': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'cowork-team-board': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'cowork-team-agents': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'cowork-team-workspaces': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
  'cowork-team-skills': { singleton: true, maxInstances: 1, allowNew: false, surface: 'view', ownsTabs: false },
};

export function makeStableViewId(viewType: ViewType, capsuleId?: string) {
  return capsuleId ?? viewType;
}
