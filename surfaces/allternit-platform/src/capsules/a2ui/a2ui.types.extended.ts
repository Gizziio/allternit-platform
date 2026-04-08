// ============================================================================
// Extended A2UI Types - Roadmap Components
// ============================================================================
// Additional component types for the complete roadmap implementation
// ============================================================================

import type { BaseComponentProps, ComponentNode, VisibleCondition } from './a2ui.types';

// Re-export base types for convenience
export type {
  BaseComponentProps,
  ComponentNode,
  VisibleCondition,
  A2UIPayload,
  A2UISurface,
  A2UIAction,
  RenderContext,
} from './a2ui.types';

// ============================================================================
// Phase 1: High-Priority Components
// ============================================================================

/** Chart/Graph component props */
export interface ChartProps extends BaseComponentProps {
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'radar' | 'composed';
  data: Array<Record<string, unknown>> | string; // Array or data path
  dataPath?: string;
  xAxis?: {
    key: string;
    label?: string;
    type?: 'category' | 'number' | 'time';
  };
  yAxis?: {
    label?: string;
    min?: number;
    max?: number;
  };
  series: Array<{
    key: string;
    name: string;
    color?: string;
    type?: 'line' | 'bar' | 'area';
  }>;
  legend?: boolean;
  tooltip?: boolean;
  grid?: boolean;
  onPointClick?: string; // Action ID
  height?: number;
  animated?: boolean;
  stacked?: boolean;
}

/** DatePicker component props */
export interface DatePickerProps extends BaseComponentProps {
  label?: string;
  valuePath: string; // ISO date string
  mode?: 'single' | 'range' | 'multiple';
  minDate?: string; // ISO date
  maxDate?: string; // ISO date
  disabledDates?: string[] | string; // data path
  showTime?: boolean;
  timeFormat?: '12h' | '24h';
  disabled?: boolean | string;
  placeholder?: string;
}

/** Calendar component props */
export interface CalendarProps extends BaseComponentProps {
  valuePath: string;
  events?: Array<{
    date: string; // ISO date
    title: string;
    color?: string;
    action?: string;
    allDay?: boolean;
  }> | string; // data path
  mode?: 'month' | 'week' | 'day';
  onDateClick?: string;
  onEventClick?: string;
  onDateRangeSelect?: string;
  showWeekends?: boolean;
  firstDayOfWeek?: 0 | 1; // 0 = Sunday, 1 = Monday
}

/** FileUpload component props */
export interface FileUploadProps extends BaseComponentProps {
  label?: string;
  valuePath: string; // Array of uploaded files
  accept?: string; // '.pdf,.jpg' or 'image/*,application/pdf'
  multiple?: boolean;
  maxSize?: number; // bytes
  maxFiles?: number;
  dragDrop?: boolean;
  preview?: boolean; // Show image previews
  uploadAction?: string; // Action to trigger upload
  onUploadProgress?: string;
  onUploadComplete?: string;
  onUploadError?: string;
  onFileSelect?: string;
  disabled?: boolean | string;
}

// ============================================================================
// Phase 2: Medium-Priority Components
// ============================================================================

/** RichText/MarkdownEditor component props */
export interface RichTextProps extends BaseComponentProps {
  label?: string;
  valuePath: string;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  toolbar?: Array<'bold' | 'italic' | 'underline' | 'strikethrough' | 'heading' | 'code' | 'quote' | 'unordered-list' | 'ordered-list' | 'link' | 'image' | 'table'>;
  mode?: 'markdown' | 'wysiwyg';
  onChange?: string;
  disabled?: boolean | string;
  charLimit?: number;
  wordLimit?: number;
}

/** TreeNode structure for TreeView */
export interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
  icon?: string;
  expandable?: boolean;
  disabled?: boolean;
  metadata?: Record<string, unknown>;
  badge?: string;
  badgeColor?: string;
}

/** TreeView component props */
export interface TreeViewProps extends BaseComponentProps {
  items: TreeNode[] | string; // data path
  selectionPath?: string; // Selected node ID(s)
  expandedPaths?: string[] | string; // data path for expanded state
  onSelect?: string;
  onExpand?: string;
  onCollapse?: string;
  onDoubleClick?: string;
  draggable?: boolean;
  onDrop?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  showLines?: boolean;
  multiSelect?: boolean;
}

/** SplitPane component props */
export interface SplitPaneProps extends BaseComponentProps {
  direction: 'horizontal' | 'vertical';
  sizes: number[]; // Percentages (must sum to 100)
  minSize?: number | number[];
  maxSize?: number | number[];
  children: ComponentNode[]; // Must match sizes length
  resizable?: boolean;
  onResize?: string;
  snap?: boolean;
  gutterSize?: number;
}

/** TimelineItem structure */
export interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  timestamp: string; // ISO date
  icon?: string;
  color?: string;
  status?: 'pending' | 'active' | 'completed' | 'error' | 'warning';
  metadata?: Record<string, unknown>;
  actions?: Array<{
    label: string;
    action: string;
    payload?: unknown;
  }>;
}

/** Timeline component props */
export interface TimelineProps extends BaseComponentProps {
  items: TimelineItem[] | string; // data path
  mode?: 'vertical' | 'horizontal';
  alignment?: 'left' | 'right' | 'alternate';
  onItemClick?: string;
  showConnectors?: boolean;
  reverse?: boolean;
  loading?: boolean | string;
}

// ============================================================================
// Phase 3: Enhanced Interactions
// ============================================================================

/** Animation configuration for components */
export interface AnimationConfig {
  animateIn?: 'fade' | 'fadeUp' | 'fadeDown' | 'fadeLeft' | 'fadeRight' | 'scale' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'none';
  animateOut?: 'fade' | 'fadeUp' | 'fadeDown' | 'fadeLeft' | 'fadeRight' | 'scale' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'none';
  duration?: number; // ms
  delay?: number; // ms
  stagger?: number; // For lists - delay between children (ms)
  easing?: 'ease' | 'easeIn' | 'easeOut' | 'easeInOut' | 'linear';
}

/** Enhanced base props with animation */
export interface AnimatedBaseProps extends BaseComponentProps {
  animation?: AnimationConfig;
}

/** Enhanced conditional visibility */
export interface EnhancedVisibleCondition {
  // Simple conditions
  path?: string;
  eq?: unknown;
  ne?: unknown;
  gt?: number;
  lt?: number;
  gte?: number;
  lte?: number;
  contains?: string;
  startsWith?: string;
  endsWith?: string;
  matches?: string; // Regex pattern
  
  // Complex logic
  and?: EnhancedVisibleCondition[];
  or?: EnhancedVisibleCondition[];
  not?: EnhancedVisibleCondition;
}

/** Data source configuration for auto-refresh */
export interface DataSourceConfig {
  pollInterval?: number; // ms, 0 or undefined = no polling
  onError?: string; // Action ID
  retryCount?: number;
  retryDelay?: number;
  cacheDuration?: number; // ms
  debounce?: number; // ms for input-triggered refreshes
}

/** Component with data source support */
export interface DataComponentProps extends BaseComponentProps {
  dataSource?: DataSourceConfig;
}

// ============================================================================
// Phase 4: Agent-Specific Components
// ============================================================================

/** Agent thinking/progress step */
export interface AgentThinkingStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  detail?: string;
  timestamp?: string;
  duration?: number; // ms
}

/** AgentThinking component props */
export interface AgentThinkingProps extends BaseComponentProps {
  status: 'idle' | 'reasoning' | 'searching' | 'coding' | 'waiting' | 'planning' | 'executing';
  steps?: AgentThinkingStep[] | string; // data path
  message?: string;
  showSparkles?: boolean;
  collapsible?: boolean;
  expandedPath?: string;
  estimatedTime?: number; // seconds
  progress?: number; // 0-100
  onCancel?: string; // Action ID
}

/** Tool call display component */
export interface ToolCallProps extends BaseComponentProps {
  tool: string;
  toolName?: string;
  toolIcon?: string;
  input: Record<string, unknown> | string; // data path
  output?: Record<string, unknown> | string; // data path
  error?: string | string; // data path
  status: 'pending' | 'running' | 'success' | 'error';
  duration?: number; // ms
  startTime?: string; // ISO timestamp
  expanded?: boolean;
  expandable?: boolean;
  onRerun?: string; // Action ID
  onExpand?: string;
  onCollapse?: string;
}

/** Artifact preview component */
export interface ArtifactPreviewProps extends BaseComponentProps {
  type: 'code' | 'diagram' | 'image' | 'markdown' | 'json' | 'html' | 'text' | 'pdf';
  content: string | string; // data path
  language?: string; // for code type
  filename?: string;
  title?: string;
  description?: string;
  downloadAction?: string;
  copyAction?: string;
  fullscreenAction?: string;
  height?: number;
  showLineNumbers?: boolean;
  wrapLines?: boolean;
}

// ============================================================================
// Phase 5: Layout Improvements
// ============================================================================

/** Breakpoint configuration */
export interface BreakpointConfig {
  maxWidth?: number;
  direction?: 'row' | 'column';
  columns?: number;
  stack?: boolean;
  gap?: number | string;
  padding?: number | string;
}

/** ResponsiveContainer component props */
export interface ResponsiveContainerProps extends BaseComponentProps {
  breakpoints: {
    xs?: BreakpointConfig; // < 640px
    sm?: BreakpointConfig; // >= 640px
    md?: BreakpointConfig; // >= 768px
    lg?: BreakpointConfig; // >= 1024px
    xl?: BreakpointConfig; // >= 1280px
  };
  children: ComponentNode[];
  defaultDirection?: 'row' | 'column';
  defaultGap?: number | string;
}

/** DockPanel component props */
export interface DockPanelProps extends BaseComponentProps {
  position: 'top' | 'bottom' | 'left' | 'right';
  size: number; // pixels
  resizable?: boolean;
  collapsible?: boolean;
  collapsed?: boolean | string; // data path
  collapsedSize?: number;
  onCollapse?: string;
  onExpand?: string;
  onResize?: string;
  header?: ComponentNode;
  headerHeight?: number;
  children: ComponentNode[];
}

// ============================================================================
// Extended Component Node Union
// ============================================================================

/** Extended union type with all roadmap components */
export type ExtendedComponentNode =
  | ComponentNode
  | { type: 'Chart'; props: ChartProps }
  | { type: 'DatePicker'; props: DatePickerProps }
  | { type: 'Calendar'; props: CalendarProps }
  | { type: 'FileUpload'; props: FileUploadProps }
  | { type: 'RichText'; props: RichTextProps }
  | { type: 'TreeView'; props: TreeViewProps }
  | { type: 'SplitPane'; props: SplitPaneProps }
  | { type: 'Timeline'; props: TimelineProps }
  | { type: 'AgentThinking'; props: AgentThinkingProps }
  | { type: 'ToolCall'; props: ToolCallProps }
  | { type: 'ArtifactPreview'; props: ArtifactPreviewProps }
  | { type: 'ResponsiveContainer'; props: ResponsiveContainerProps }
  | { type: 'DockPanel'; props: DockPanelProps };

// ============================================================================
// Extended Component Whitelist
// ============================================================================

export const EXTENDED_COMPONENT_WHITELIST = [
  // Base components
  'Container', 'Card', 'Text', 'Button', 'TextField', 'List', 'DataTable', 
  'Tabs', 'Badge', 'Accordion', 'Stack', 'Grid', 'Divider', 'Icon', 'Image',
  'Select', 'Switch', 'Checkbox', 'RadioGroup', 'Slider', 'Progress', 'Spinner',
  'Alert', 'Dialog', 'Tooltip', 'Popover', 'Menu', 'Breadcrumbs', 'Pagination',
  'Search', 'Code', 'Markdown',
  // Extended components
  'Chart', 'DatePicker', 'Calendar', 'FileUpload', 'RichText', 'TreeView',
  'SplitPane', 'Timeline', 'AgentThinking', 'ToolCall', 'ArtifactPreview',
  'ResponsiveContainer', 'DockPanel',
] as const;

export type ExtendedComponentType = typeof EXTENDED_COMPONENT_WHITELIST[number];
