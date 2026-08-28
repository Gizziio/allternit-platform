export type ViewType =
  // Core views
  | "home"
  | "chat"
  | "chat-legacy"
  | "project"
  | "elements"
  | "playground"
  | "workspace"
  | "browser"
  | "mini-apps-store"
  | "mini-app-review"
  | "mini-app"
  | "addin-word"
  | "addin-excel"
  | "addin-ppt"
  // Agent views
  | "agent-hub"
  | "bot-home"
  | "bot-inbox"
  | "native-agent"
  | "registry"
  | "memory"
  // Service views
  | "marketplace"
  | "hermes"
  | "oh-my-pi"
  | "openclaw"
  | "openclaw-chat"
  | "openclaw-sessions"
  | "vault-viewer"
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
  // Verification views
  | "verification"
  // Capsule Management (P3.9 MCP Apps)
  | "capsules"
  // Operator Browser Control (P3.10/P3.12)
  | "operator"
  // P3 UI Views
  | "allternit-ix"
  | "form-surfaces"
  | "canvas"
  | "allternit-canvas"  // Allternit-Canvas viewer (Sparkpages equivalent)
  | "hooks"
  // P4 UI Views
  | "evolution"
  | "context-control"
  | "memory-kernel"
  | "acf"
  // Agents Sessions & Memory views
  | "allternit-playground"
  | "agent-studio"
  // AllternitOS View
  | "allternit-os"
  // Other views
  | "settings"
  | "terminal"
  | "monitor"
  | "code"
  | "plugins"
  | "models-manage"
  | "run-replay"
  | "apps-extensions"
  // Runtime Management Views (N11, N12, N16)
  | "runtime-ops"
  | "budget-dashboard"
  | "replay-manager"
  | "prewarm-manager"
  // Chat History views
  | "history"
  | "archived"
  // Unified recents view
  | "recents"
  // Cowork Analytics & Content views
  | "insights"
  | "activity"
  | "goals"
  | "new-document"
  // Automation views
  | "goals-list"
  | "goal-detail"
  | "routines-list"
  | "loops-list"
  | "cron"
  | "dispatch"
  | "remote-control"
  // Code views
  | "new-file"
  | "code-project"
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
  // "chat-agent-session" is a deprecated alias to the cowork workspace.
  | "chat-agent-session"
  | "cowork-agent-session"
  | "code-agent-session"
  | "design-agent-session"
  // Product Discovery
  | "products"
  // Manufacturing
  | "manufacturing"
  // Library (generated artifacts)
  | "library"
  // A://Labs - Course Management
  | "labs"
  | "catalog"
  // Second Brain (meta-learning knowledge base)
  | "brain"
  // Design Mode surface
  | "design"
  | "design-view-questions"
  | "design-view-mobile"
  | "design-view-video"
  | "design-view-docs"
  | "design-view-handoff"
  | "design-view-graph"
  | "design-view-pipeline"
  | "design-view-market"
  | "design-view-compare"
  | "design-marketplace"
  // Docs editor (GenOffice)
  | "docs"
  // Slides editor (GenOffice)
  | "slides"
  // Sheets editor (GenOffice)
  | "sheets"
  // PDF viewer (GenOffice)
  | "pdf"
  // Markdown preview (anydoc conversion)
  | "markdown-preview"
  // Browser Extensions hub
  | "browser-extensions"
  // API Capture / Site APIs
  | "site-apis"
  // Model Lab
  | "model-lab"
  // Allternit Sign (native client-side PDF signing)
  | "sign"
  // Floating chat HUD
  | "hud"
  // Full-screen annotation overlay
  | "hud-annotate";

export type ViewId = string;

export type DrawerType = "console";

export type DrawerScope = "global" | "view";

export interface ViewContext {
  viewId: ViewId;
  viewType: ViewType;
  capsuleId?: string;
  title?: string;
  context?: unknown;
}

export interface NavState {
  activeViewId: ViewId;
  history: ViewId[];
  future: ViewId[];
  openViews: Record<ViewId, ViewContext>;
}

export type NavEvent =
  | { type: "OPEN_VIEW"; viewType: ViewType; capsuleId?: string; allowNew?: boolean; context?: any }
  | { type: "PUSH_VIEW"; viewType: ViewType; viewId: ViewId; title?: string; context?: any }
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
