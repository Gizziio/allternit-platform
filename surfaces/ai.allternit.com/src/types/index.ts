/**
 * Type Definitions
 * 
 * Consolidated types ported from 6-ui/shell-ui Rust code.
 * These types support the full Shell UI capabilities.
 */

// BrowserView Types
export { type BrowserAction, type BrowserActionResult, type BrowserState, type BrowserViewConfig, type CaptureResult, CaptureSize, type ClickAction, type CookieInfo, type EvaluateAction, type ExtractAction, type HistoryEntry, type NavigateAction, type PageInfo, type PlaywrightConfig, type ProxyConfig, RendererType, type ScreenshotAction, type ScreenshotResult, type ScrollAction, type SessionConfig, type SessionMetadata, type SimpleAction, type TypeTextAction, type ViewportSize, type WaitForAction, defaultBrowserConfig, defaultViewport, developmentPlaywrightConfig, productionPlaywrightConfig } from './browser';

// Runtime Types (Budget, Prewarm, Replay, Settings)
export { ActivityType, AlertLevel, type BudgetAlert, type BudgetDashboard, type FormattedUsageStats, type LoggingConfig, type MeasurementEntry, type PoolActivity, type PoolCreateForm, type PoolError, PoolHealth, type PoolResources, type PoolStats, type PoolStatus, type PrewarmPoolManager, type QuotaForm, type ReplayEntry, type ReplayEvent, ReplayEventType, type ReplayManager, type ReplayMetadata, type ReplaySession, RuntimeDriver, type RuntimeResources, type RuntimeSettings, type SandboxConfig, type TenantQuota, type UsageSummary, defaultPoolResources, defaultQuotaForm, defaultRuntimeSettings } from './runtime';

// Workflow Types (Designer, Monitor, Executable)
export { type DesignerEdge, type DesignerNode, type EdgeCondition, type ExecutableEdge, type ExecutableNode, type ExecutableWorkflow, type ExecutionError, type ExecutionLog, ExecutionStatus, NodeCategory, type NodeExecution, type NodePosition, type NodeTypeDefinition, type PortDefinition, PortType, type RetryPolicy, type ValidationError, type ViewportState, type WorkflowDesigner, type WorkflowDraft, type WorkflowExecution, type WorkflowListEntry, type WorkflowMonitor, WorkflowPhase, type WorkflowSystemStatus, type WorkflowTemplate, type WorkflowVariable } from './workflow';
