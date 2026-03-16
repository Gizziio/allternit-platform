import './design/theme.css';
import './design/modeStyles.css';

// Design System Exports
export { GlassCard, GlassCardFlat, GlassCardFloating, GlassCardPrimary, GlassCardSuccess, GlassCardWarning, GlassCardDanger, GlassCardInteractive } from './design/glass/GlassCard';
export { GlassSurface, GlassSurfaceThin, GlassSurfaceBase, GlassSurfaceElevated, GlassSurfaceThick } from './design/glass/GlassSurface';
export { GlassPanel } from './design/glass/GlassPanel';
export { GlassDialog } from './design/glass/GlassDialog';
export { GlassTooltip } from './design/glass/GlassTooltip';
export { GlassPopover } from './design/glass/GlassPopover';
export { GlassInput } from './design/glass/GlassInput';
export { GlassButton } from './design/glass/GlassButton';
export { useGlass } from './design/glass/useGlass';

export * from "./shell/ShellApp";
export * from "./shell/ShellFrame";
export * from "./shell/ShellHeader";
export * from "./shell/ShellRail";
export * from "./shell/ShellCanvas";
export * from "./shell/ShellOverlayLayer";
export * from "./shell/AgentRunnerWindow";
export * from "./shell/ShellShortcuts";

export * from "./nav/nav.types";
export * from "./nav/nav.store";
export * from "./nav/nav.history";
export * from "./nav/nav.policy";
export * from "./nav/nav.selectors";

export * from "./views/registry";
export * from "./views/ViewHost";
export * from "./views/ViewLifecycle";
export * from "./views/lazyRegistry";

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

export * from "./drawers/ConsoleDrawer";
export * from "./drawers/drawer.store";
export * from "./drawers/drawer.types";

export * from "./dock/TaskDock";
export * from "./dock/ticket.model";
export * from "./dock/ticket.store";

export * from "./runner/AgentRunner";
export * from "./runner/runner.store";
export * from "./runner/runner.types";

// AI Elements - Full component suite from elements.ai-sdk.dev
// Includes all 50+ components: Conversation, Message, PromptInput, Tool, Reasoning, etc.
export * from "./components/ai-elements";

// Performance Components and Utilities
export * from "./components/performance";

// Voice Services - Hybrid backend + browser voice capabilities
export * from "./services/voice";
export * from "./providers/mode-provider";
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

// UI Components
export { TooltipProvider } from "./components/ui/tooltip";

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

export * from "./design/tokens";
export * from "./design/GlassSurface";
export * from "./design/GlassCard";
export * from "./design/controls/IconButton";
export * from "./design/controls/SegmentedControl";
export * from "./design/controls/ActionChip";
export * from "./design/motion/motion";

export * from "./integration/a2r/legacy.bridge";
export * from "./components/GlobalDropzone";

// API Client - The canonical way to communicate with the backend
export {
  api,
  GATEWAY_BASE_URL,
  A2R_BASE_URL,
  jobsApi,
  useApi,
  useSessions,
  useSession,
  useSkills,
  useModelDiscovery,
  A2RApiError,
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
  type CreateJobRequest,
  type JobRecord,
  type JobQueueStats,
} from "./integration/api-client";

// DEPRECATED EXPORTS - These will be removed in v2.0
// Use api-client.ts instead of these direct integrations:
// - exec.facade.ts (direct kernel calls)
// - integration/kernel/index.ts (direct kernel calls)
// - integration/execution/* (direct kernel calls)

// Vendor wrappers (internal use - re-exported for convenience)
export * from "./vendor/hotkeys";
export * from "./vendor/command";
export * from "./vendor/panels";
export * from "./vendor/flexlayout";
export * from "./vendor/radix";

export * from "./qa/invariants";
export * from "./qa/smoke";

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
  type TenantQuota,
  type UsageSummary,
  type Measurement,
  type RuntimeBudgetStatus,
  type RuntimeBudgetQuotaUpdate,
  type RuntimeBudgetMetric,
  type RuntimeBudgetAlert,
  type BudgetPercentages,
  type WorkflowListEntry,
  type WorkflowExecution,
  type ValidationResult,
  type NodePosition,
  type PoolStatus,
  type PoolActivity,
  type PoolStats,
  type PoolCreateForm,
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
export * from "./types";

// Performance Utilities
export * from "./lib/performance";

// Lazy loading utilities
export {
  preloadView,
  preloadViews,
  getViewSkeleton,
} from "./views/lazyRegistry";
