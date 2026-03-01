// ============================================================================
// A2UI Module Exports
// ============================================================================

// ============================================================================
// Base Renderer (Lightweight - Core Components Only)
// ============================================================================
export { A2UIRenderer } from "./A2UIRenderer";
export type { A2UIRendererProps } from "./A2UIRenderer";

// ============================================================================
// Extended Renderer (Full Roadmap - All Components)
// ============================================================================
export { A2UIRendererExtended } from "./A2UIRendererExtended";
export type { A2UIRendererExtendedProps } from "./A2UIRendererExtended";

// ============================================================================
// Component Renderers (Individual exports for custom builds)
// ============================================================================
export {
  ChartRenderer,
  DatePickerRenderer,
  CalendarRenderer,
  FileUploadRenderer,
} from "./components/Phase1Components";

export {
  RichTextRenderer,
  TreeViewRenderer,
  SplitPaneRenderer,
  TimelineRenderer,
} from "./components/Phase2Components";

export {
  AgentThinkingRenderer,
  ToolCallRenderer,
  ArtifactPreviewRenderer,
} from "./components/Phase3Components";

export {
  ResponsiveContainerRenderer,
  DockPanelRenderer,
} from "./components/Phase4Components";

// ============================================================================
// Base Types
// ============================================================================
export type {
  A2UIPayload,
  A2UISurface,
  A2UIAction,
  ComponentNode,
  RenderContext,
  // Component Props
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
  // Utilities
  ComponentType,
  VisibleCondition,
  BaseComponentProps,
  COMPONENT_WHITELIST,
} from "./a2ui.types";

// ============================================================================
// Extended Types (Full Roadmap)
// ============================================================================
export type {
  // Extended components
  ExtendedComponentNode,
  ExtendedComponentType,
  // Phase 1
  ChartProps as ExtendedChartProps,
  DatePickerProps as ExtendedDatePickerProps,
  CalendarProps as ExtendedCalendarProps,
  FileUploadProps as ExtendedFileUploadProps,
  // Phase 2
  RichTextProps as ExtendedRichTextProps,
  TreeViewProps as ExtendedTreeViewProps,
  TreeNode,
  SplitPaneProps as ExtendedSplitPaneProps,
  TimelineProps as ExtendedTimelineProps,
  TimelineItem,
  // Phase 3
  AgentThinkingProps as ExtendedAgentThinkingProps,
  AgentThinkingStep,
  ToolCallProps as ExtendedToolCallProps,
  ArtifactPreviewProps as ExtendedArtifactPreviewProps,
  // Phase 4
  ResponsiveContainerProps as ExtendedResponsiveContainerProps,
  DockPanelProps as ExtendedDockPanelProps,
  // Utilities
  AnimationConfig,
  EnhancedVisibleCondition,
  DataSourceConfig,
  BreakpointConfig,
  EXTENDED_COMPONENT_WHITELIST,
} from "./a2ui.types.extended";

// ============================================================================
// Backend Integration
// ============================================================================
export {
  a2uiApi,
  useA2UIApi,
  useA2UISession,
  useA2UIAction,
} from "@/integration/a2ui-client";

export {
  useA2UIBackend,
  type UseA2UIBackendOptions,
  type UseA2UIBackendReturn,
} from "./useA2UIBackend";

export type {
  A2UISession,
  A2UIActionRequest,
  A2UIActionResponse,
  A2UIEvent,
  CapsuleManifest,
} from "@/integration/a2ui-client";

// ============================================================================
// Utility Functions
// ============================================================================
export { resolvePath, resolveValue, isVisible } from "./A2UIRenderer";
