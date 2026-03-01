// ============================================================================
// Capsule System Exports
// ============================================================================

// ============================================================================
// Core Types
// ============================================================================
export type {
  CapsuleKind,
  CapsuleId,
  CapsuleContext,
} from "./capsule.types";

// ============================================================================
// Registry
// ============================================================================
export { capsuleKindToViewType } from "./capsule.registry";

// ============================================================================
// A2UI Module - Base Renderer
// ============================================================================
export {
  A2UIRenderer,
  resolvePath,
  resolveValue,
  isVisible,
} from "./a2ui";

export type {
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
  ImageProps,
  CodeProps,
  SearchProps,
  ComponentType,
  VisibleCondition,
  BaseComponentProps,
  COMPONENT_WHITELIST,
} from "./a2ui";

// ============================================================================
// A2UI Module - Extended Renderer (Full Roadmap)
// ============================================================================
export {
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
} from "./a2ui";

export type {
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
  EXTENDED_COMPONENT_WHITELIST,
} from "./a2ui";

// ============================================================================
// Browser Module
// ============================================================================
export {
  BrowserCapsuleEnhanced as BrowserCapsule,
  BrowserCapsuleReal,
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
} from "./browser";

export type {
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
} from "./browser";

// ============================================================================
// A2UI Backend Integration
// ============================================================================
export {
  a2uiApi,
  useA2UIApi,
  useA2UISession,
  useA2UIAction,
  useA2UIBackend,
} from "./a2ui";

export type {
  A2UISession,
  A2UIActionRequest,
  A2UIActionResponse,
  A2UIEvent,
  CapsuleManifest,
  UseA2UIBackendOptions,
  UseA2UIBackendReturn,
} from "./a2ui";

// ============================================================================
// Capsule Host
// ============================================================================
export { CapsuleHost } from "./CapsuleHost";
