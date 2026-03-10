export type ViewType =
  // Core views
  | "home"
  | "chat"
  | "chat-legacy"
  | "elements"
  | "playground"
  | "workspace"
  | "browser"
  // Agent views
  | "studio"
  | "agent"
  | "agent-hub"
  | "native-agent"
  | "rails"
  | "registry"
  | "memory"
  // Service views
  | "marketplace"
  | "openclaw"
  | "openclaw-chat"
  | "openclaw-sessions"
  | "dag"
  // Infrastructure views (P4 DAG tasks)
  | "swarm"
  | "policy"
  | "task-executor"
  | "ontology"
  | "directive"
  | "evaluation"
  | "gc-agents"
  // AI & Vision views (P4/P5 DAG tasks)
  | "ivkge"
  | "multimodal"
  | "tambo"
  // Security & Governance views (P5 DAG tasks)
  | "receipts"
  | "policy-gating"
  | "security"
  | "purpose"
  // Browser & Execution views (P5 DAG tasks)
  | "browserview"
  | "dag-wih"
  | "checkpointing"
  // Observability views (P4 DAG tasks)
  | "observability"
  // Cloud & Deploy views
  | "deploy"
  | "nodes"
  // Capsule Management (P3.9 MCP Apps)
  | "capsules"
  // Operator Browser Control (P3.10/P3.12)
  | "operator"
  // P3 UI Views
  | "a2r-ix"
  | "form-surfaces"
  | "canvas"
  | "a2r-canvas"  // A2r-Canvas viewer (Sparkpages equivalent)
  | "hooks"
  // P4 UI Views
  | "evolution"
  | "context-control"
  | "memory-kernel"
  | "acf"
  // Other views
  | "settings"
  | "terminal"
  | "runner"
  | "monitor"
  | "code"
  | "plugins"
  | "models-manage"
  | "run-replay"
  | "promotion"
  // Runtime Management Views (N11, N12, N16)
  | "runtime-ops"
  | "budget-dashboard"
  | "replay-manager"
  | "prewarm-manager"
  // Chat History views
  | "history"
  | "archived"
  // Cowork Analytics & Content views
  | "insights"
  | "activity"
  | "goals"
  | "new-document"
  // Code views
  | "new-file"
  | "search"
  | "debug"
  | "code-explorer"
  | "code-git"
  | "code-threads"
  | "code-automations"
  | "code-skills"
  // Cowork-specific content views
  | "cowork-runs"
  | "cowork-drafts"
  | "cowork-tasks"
  | "cowork-cron"
  | "cowork-project"
  | "cowork-documents"
  | "cowork-tables"
  | "cowork-files"
  | "cowork-exports"
  | "cowork-new-task"
  // Agent Session Views (full-screen agent experiences)
  | "chat-agent-session"
  | "cowork-agent-session"
  | "code-agent-session"
  | "browser-agent-session"
  // Product Discovery
  | "products";

export type ViewId = string;

export type DrawerType = "console";

export type DrawerScope = "global" | "view";

export interface ViewContext {
  viewId: ViewId;
  viewType: ViewType;
  capsuleId?: string;
  title?: string;
}

export interface NavState {
  activeViewId: ViewId;
  history: ViewId[];
  future: ViewId[];
  openViews: Record<ViewId, ViewContext>;
}

export type NavEvent =
  | { type: "OPEN_VIEW"; viewType: ViewType; capsuleId?: string; allowNew?: boolean }
  | { type: "FOCUS_VIEW"; viewId: ViewId }
  | { type: "CLOSE_VIEW"; viewId: ViewId }
  | { type: "BACK" }
  | { type: "FORWARD" };

export interface SpawnPolicy {
  singleton: boolean;
  maxInstances: number;
  allowNew: boolean;
  surface?: "view" | "capsule";
  ownsTabs?: boolean;
}
