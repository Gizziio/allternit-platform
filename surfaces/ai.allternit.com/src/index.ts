// @ts-nocheck
import './design/theme.css';
import './design/modeStyles.css';

// Design System Exports
export { GlassPanel } from './design/glass/GlassPanel';
export { GlassDialog } from './design/glass/GlassDialog';
export { GlassTooltip } from './design/glass/GlassTooltip';
export { GlassPopover } from './design/glass/GlassPopover';
export { GlassInput } from './design/glass/GlassInput';
export { GlassButton } from './design/glass/GlassButton';
export { useGlass } from './design/glass/useGlass';

export { ShellApp } from './shell/ShellApp';
export { ShellFrame } from './shell/ShellFrame';
export { type AppMode, ShellHeader } from './shell/ShellHeader';
export { ShellRail } from './shell/ShellRail';
export { ShellCanvas } from './shell/ShellCanvas';
export { ShellOverlayLayer } from './shell/ShellOverlayLayer';
export { AgentRunnerWindow } from './shell/AgentRunnerWindow';
export { SHORTCUTS } from './shell/ShellShortcuts';

export { type DrawerScope, type DrawerType, type NavEvent, type NavState, type SpawnPolicy, type ViewContext, type ViewId, type ViewType } from './nav/nav.types';
export { createInitialNavState, navReducer } from './nav/nav.store';
export { goBack, goForward, pushHistory } from './nav/nav.history';
export { DEFAULT_POLICIES, makeStableViewId } from './nav/nav.policy';
export { canGoBack, canGoForward, selectActiveView, selectFuture, selectHistory, selectOpenViews } from './nav/nav.selectors';

export { type ViewInstance, type ViewRegistry, createViewRegistry } from './views/registry';
export { ViewHost } from './views/ViewHost';
export { type ViewLifecycle } from './views/ViewLifecycle';
export { AgentHub, AgentView, BlueprintCanvas, AutonomousCodeFactoryView, BrowserView, BudgetDashboardView, CanvasProtocolView, CapsuleManagerView, ChatView, Checkpointing, CloudDeployView, CodeRoot, ContextControlPlaneView, CoworkRoot, DAGWIH, DagIntegrationPage, DirectiveCompiler, EvaluationHarness, EvolutionLayerView, FormSurfacesView, GCAgents, HomeView, HooksSystemView, IVKGEPanel, type LazyViewComponent, LazyViewWrapper, MemoryKernelView, MultimodalInput, NativeAgentView, NodesView, ObservabilityDashboard, OntologyViewer, OpenClawControlUI, OperatorBrowserView, PlaygroundView, PluginRegistryView, PolicyGating, PolicyManager, PrewarmManagerView, ProjectView, PromotionDashboardView, PurposeBinding, ReceiptsViewer, ReplayManagerView, RunReplayView, RuntimeOperationsView, SecurityDashboard, SkillsRegistryView, SwarmDashboard, SwarmMonitor, UIForge, TaskExecutor, TerminalView, ToolsView } from './views/lazyRegistry';

// Capsule System
export {
  // Core
  CapsuleHost,
  capsuleKindToViewType,
  // Browser
  BrowserCapsule,
  openSampleA2UITab,
  sampleA2UIPayload,
  useBrowserStore,
  useActiveTab,
  useTabCount,
  useActiveTabType,
  parseBrowserInput,
  createWebTab,
  createA2UITab,
  createMiniappTab,
  createComponentTab,
  // A2UI Renderer - Base
  A2UIRenderer,
  // A2UI Renderer - Extended (Full Roadmap)
  A2UIRendererExtended,
  ChartRenderer,
  DatePickerRenderer,
  CalendarRenderer,
  FileUploadRenderer,
  RichTextRenderer,
  TreeViewRenderer,
  SplitPaneRenderer,
  TimelineRenderer,
  AgentThinkingRenderer,
  ToolCallRenderer,
  ArtifactPreviewRenderer,
  ResponsiveContainerRenderer,
  DockPanelRenderer,
  // Backend Integration
  a2uiApi,
  useA2UIApi,
  useA2UISession,
  useA2UIAction,
  useA2UIBackend,
  // Utilities
  resolvePath,
  resolveValue,
  isVisible,
} from "./capsules";

export type {
  // Capsule Types
  CapsuleKind,
  CapsuleId,
  CapsuleContext,
  // Browser Types
  BrowserTab,
  BrowserContentType,
  WebTab,
  A2UITab,
  MiniappTab,
  ComponentTab,
  MiniappManifest,
  CapsuleRegistryEntry,
  CapsuleRuntimeState,
  ProtocolParseResult,
  // A2UI Types - Base
  A2UIRendererProps,
  A2UIPayload,
  A2UISurface,
  A2UIAction,
  ComponentNode,
  RenderContext,
  ContainerProps,
  StackProps,
  GridProps,
  TextProps,
  CardProps,
  ButtonProps,
  TextFieldProps,
  SelectProps,
  SwitchProps,
  CheckboxProps,
  RadioGroupProps,
  SliderProps,
  ListProps,
  DataTableProps,
  BadgeProps,
  ProgressProps,
  SpinnerProps,
  TabsProps,
  AccordionProps,
  AlertProps,
  DialogProps,
  TooltipProps,
  PopoverProps,
  MenuProps,
  CodeProps,
  SearchProps,
  ComponentType,
  VisibleCondition,
  BaseComponentProps,
  // A2UI Types - Extended
  A2UIRendererExtendedProps,
  ExtendedComponentNode,
  ExtendedComponentType,
  ExtendedChartProps,
  ExtendedDatePickerProps,
  ExtendedCalendarProps,
  ExtendedFileUploadProps,
  ExtendedRichTextProps,
  ExtendedTreeViewProps,
  TreeNode,
  ExtendedSplitPaneProps,
  ExtendedTimelineProps,
  TimelineItem,
  ExtendedAgentThinkingProps,
  AgentThinkingStep,
  ExtendedToolCallProps,
  ExtendedArtifactPreviewProps,
  ExtendedResponsiveContainerProps,
  ExtendedDockPanelProps,
  AnimationConfig,
  EnhancedVisibleCondition,
  DataSourceConfig,
  BreakpointConfig,
  // A2UI Backend Types
  A2UISession,
  A2UIActionRequest,
  A2UIActionResponse,
  A2UIEvent,
  CapsuleManifest,
  UseA2UIBackendOptions,
  UseA2UIBackendReturn,
} from "./capsules";

export { ConsoleDrawer } from './drawers/ConsoleDrawer';
export { useDrawerStore } from './drawers/drawer.store';
export { type DrawerState, type DrawerStoreState } from './drawers/drawer.types';

export { TaskDock } from './dock/TaskDock';
export { type Ticket, type TicketStatus } from './dock/ticket.model';
export { useTicketStore } from './dock/ticket.store';

export { AgentRunner } from './runner/AgentRunner';
export { type RunnerPlan, type RunnerPlanStep, useRunnerStore } from './runner/runner.store';
export { type RunState, type RunnerRun, type RunnerTraceEntry, type TraceKind, type TraceStatus } from './runner/runner.types';

// AI Elements - Full component suite from elements.ai-sdk.dev
// Includes all 50+ components: Conversation, Message, PromptInput, Tool, Reasoning, etc.

// Performance Components and Utilities

// Voice Services - Hybrid backend + browser voice capabilities
export * from "./services/voice";
export { ModeProvider, useMode, useModeValue } from './providers/mode-provider';
export {
  VoiceProvider,
  useVoice,
  usePersonaState,
  useVoiceSettings,
  useTTS,
  useSTT,
} from "./providers/voice-provider";
export type {
  VoiceContextState,
  VoiceProviderProps,
} from "./providers/voice-provider";


// Visual Verification Components
export {
  VisualVerificationPanel,
  ConfidenceMeter,
  EvidenceCard,
  ArtifactViewer,
  TrendChart,
} from "./components/visual";
export type {
  ArtifactType,
  EvidenceCardProps,
  ArtifactViewerProps,
  TrendChartProps,
  VisualVerificationPanelProps,
} from "./components/visual";

// Verification View
export { VerificationView } from "./views/VerificationView";
export type { VerificationViewProps } from "./views/VerificationView";

export { tokens } from './design/tokens';
export { GlassSurface, GlassSurfaceBase, GlassSurfaceElevated, GlassSurfaceThick, GlassSurfaceThin, type GlassIntensity, type GlassSurfaceProps } from './design/GlassSurface';
export { GlassCard, GlassCardDanger, GlassCardFlat, GlassCardFloating, GlassCardInteractive, GlassCardPrimary, GlassCardSuccess, GlassCardWarning, type GlassCardProps } from './design/GlassCard';
export { IconButton } from './design/controls/IconButton';
export { SegmentedControl } from './design/controls/SegmentedControl';
export { ActionChip } from './design/controls/ActionChip';
export { motion } from './design/motion/motion';

export { type DropHandler, type DropTarget, DropzoneContext, type FileWithData, type GlobalDropzoneContextValue, GlobalDropzoneProvider, useDropTarget, useGlobalDropzone } from './components/GlobalDropzone';

// API Client - The canonical way to communicate with the backend
export {
  api,
  GATEWAY_BASE_URL,
  ALLTERNIT_BASE_URL,
  useApi,
  useSessions,
  useSession,
  useSkills,
  useModelDiscovery,
  AllternitApiError,
  type ChatMessage,
  type Session,
  type Skill,
  type Workflow as WorkflowDefinition,
  type Capsule,
  type ToolCall,
  type Agent,
  type ApiErrorDetails,
  type EventType,
  type StreamEvent,
  type EventHandler,
  type ErrorHandler,
  type ProviderAuthStatus,
  type DiscoveredModel,
  type ModelDiscoveryResult,
  type ModelValidationResult,
} from "./integration/api-client";

// DEPRECATED EXPORTS - These will be removed in v2.0
// Use api-client.ts instead of these direct integrations:
// - exec.facade.ts (direct kernel calls)
// - integration/kernel/index.ts (direct kernel calls)
// - integration/execution/* (direct kernel calls)

// Vendor wrappers (internal use - re-exported for convenience)
export { AllternitHotkeysProvider, HOTKEY_SCOPES, PLATFORM_SHORTCUTS, useAllternitHotkeys, useHotkeyScopes, useHotkeys } from './vendor/hotkeys';
export { type AllternitCommandAction, AllternitCommandPalette, AllternitCommandProvider, KBarAnimator, KBarPortal, KBarPositioner, KBarProvider, KBarResults, KBarSearch, useAllternitCommand, useMatches, useRegisterActions } from './vendor/command';
export { AllternitPanel as RNPPanel, AllternitPanelGroup as RNPPanelGroup, AllternitResizeHandle as RNPResizeHandle } from './vendor/panels';
export { FlexLayout, FlexLayoutHost, ensureSingletonTab, useFlexLayoutModel } from './vendor/flexlayout';
export { // Accordion
  Accordion, // Alert Dialog
  AlertDialog, // Avatar
  Avatar, // Collapsible
  Collapsible, // Dialog
  Dialog, // Dropdown Menu
  DropdownMenu, // Hover Card
  HoverCard, // Label
  Label, // Popover
  Popover, // Progress
  Progress, // Scroll Area
  ScrollArea, // Select
  Select, // Separator
  Separator, // Slider
  Slider, // Switch
  Switch, // Tabs
  Tabs, // Toggle
  Toggle, // Tooltip
  Tooltip, AccordionContent, AccordionItem, AccordionTrigger, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger, AvatarFallback, AvatarImage, CollapsibleContent, CollapsibleTrigger, DialogContent, DialogDescription, DialogTitle, DialogTrigger, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuPortal, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, HoverCardContent, HoverCardTrigger, PopoverContent, PopoverTrigger, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger, SelectValue, TabsContent, TabsList, TabsTrigger, TooltipContent, TooltipProvider, TooltipTrigger, useControllableState } from './vendor/radix';

export { assertNoDockingOutsideBrowser, assertSinglePrimaryView } from './qa/invariants';
export { runAllSmokeTests, smokeBridge, smokeCommand, smokeConsole, smokeDocking, smokeExecutionBridge, smokeFlexLayout, smokeGlass, smokeHotkeys, smokeNavigation, smokePanels, smokeRadix, smokeReport, smokeRunner } from './qa/smoke';

// Hooks - Ported from Rust consolidation
export {
  useBudget,
  useReplay,
  usePrewarm,
  useWorkflow,
  useToast,
  useProviderAuth,
  useAgentAvatar,
  useVisualVerification,
  DEFAULT_VISUAL_STATE,
  type ToastOptions,
  type UseAgentAvatarOptions,
  type UseAgentAvatarReturn,
  type Measurement,
  type RuntimeBudgetStatus,
  type RuntimeBudgetQuotaUpdate,
  type RuntimeBudgetMetric,
  type RuntimeBudgetAlert,
  type BudgetPercentages,
  type ValidationResult,
  type AuthStatus,
  type ModelsResponse,
  type ModelInfo,
  type ValidationResponse,
  type VerificationResult,
  type VerificationStatus,
  type Artifact,
  type TrendDataPoint,
  type UseVisualVerificationOptions,
  type UseVisualVerificationReturn,
} from "./hooks";

// Services - Ported from Rust consolidation  
export * from "./services";

// Types - Ported from Rust consolidation
export { ActivityType, AlertLevel, CaptureSize, ExecutionStatus, NodeCategory, PoolHealth, PortType, RendererType, ReplayEventType, RuntimeDriver, WorkflowPhase, defaultBrowserConfig, defaultPoolResources, defaultQuotaForm, defaultRuntimeSettings, defaultViewport, developmentPlaywrightConfig, productionPlaywrightConfig } from './types';
export type { BrowserAction, BrowserActionResult, BrowserState, BrowserViewConfig, BudgetAlert, BudgetDashboard, CaptureResult, ClickAction, CookieInfo, DesignerEdge, DesignerNode, EdgeCondition, EvaluateAction, ExecutableEdge, ExecutableNode, ExecutableWorkflow, ExecutionError, ExecutionLog, ExtractAction, FormattedUsageStats, HistoryEntry, LoggingConfig, MeasurementEntry, NavigateAction, NodeExecution, NodePosition, NodeTypeDefinition, PageInfo, PlaywrightConfig, PoolActivity, PoolCreateForm, PoolError, PoolResources, PoolStats, PoolStatus, PortDefinition, PrewarmPoolManager, ProxyConfig, QuotaForm, ReplayEntry, ReplayEvent, ReplayManager, ReplayMetadata, ReplaySession, RetryPolicy, RuntimeResources, RuntimeSettings, SandboxConfig, ScreenshotAction, ScreenshotResult, ScrollAction, SessionConfig, SessionMetadata, SimpleAction, TenantQuota, TypeTextAction, UsageSummary, ValidationError, ViewportSize, ViewportState, WaitForAction, WorkflowDesigner, WorkflowDraft, WorkflowExecution, WorkflowListEntry, WorkflowMonitor, WorkflowSystemStatus, WorkflowTemplate, WorkflowVariable } from './types';

// Performance Utilities
export { // Aliases for convenience
  type BundleSizeReport, DEFAULT_PERFORMANCE_BUDGET, type DebouncedFunction, PERFORMANCE_THRESHOLDS, type PerformanceBudget, type ThrottledFunction, type WebVitalMetric, checkPerformanceBudget, clearMarks, clearMeasures, debounce, debounceLeadingTrailing, mark, measure, memo, memoIgnoring, memoWithComparison, memoWithDeepComparison, observeLongTasks, prefetchResource, preloadResource, rafThrottle, reportWebVitals, throttle, trackBundleSize, useBatchedCallback, useCallback, useCallbackDebug, useConditionalRef, useDebouncedCallback, useDebouncedValue, useFrameRateMonitor, useMemo, useMemoDebug, useMemoizedComputation, useMemoizedDerived, useMemoizedList, useMountTiming, useRafCallback, useRenderCount, useRenderPerformance, useResizeHandler, useScrollHandler, useStableCallback, useThrottledCallback, useThrottledValue, useUpdatingRef, useWhyDidYouUpdate } from './lib/performance';

// Lazy loading utilities
export {
  preloadView,
  preloadViews,
  getViewSkeleton,
} from "./views/lazyRegistry";
