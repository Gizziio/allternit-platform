// ============================================================================
// A2UI Protocol Types for React Renderer
// ============================================================================

/** Component whitelist for security - only these components can be rendered */
export const COMPONENT_WHITELIST = [
  'Container',
  'Card', 
  'Text',
  'Button',
  'TextField',
  'List',
  'DataTable',
  'Tabs',
  'Badge',
  'Accordion',
  'Stack',
  'Grid',
  'Divider',
  'Icon',
  'Image',
  'Select',
  'Switch',
  'Checkbox',
  'RadioGroup',
  'Slider',
  'Progress',
  'Spinner',
  'Alert',
  'Dialog',
  'Tooltip',
  'Popover',
  'Menu',
  'Breadcrumbs',
  'Pagination',
  'Search',
  'Code',
  'Markdown',
] as const;

export type ComponentType = typeof COMPONENT_WHITELIST[number];

/** Visibility condition for conditional rendering */
export interface VisibleCondition {
  path: string;
  eq?: unknown;
  ne?: unknown;
  gt?: number;
  lt?: number;
  contains?: string;
}

/** Base props for all A2UI components */
export interface BaseComponentProps {
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  visibleWhen?: VisibleCondition;
  disabled?: boolean | string; // boolean or data path
}

// ============================================================================
// Layout Components
// ============================================================================

export interface ContainerProps extends BaseComponentProps {
  direction?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  align?: 'start' | 'center' | 'end' | 'stretch';
  wrap?: boolean;
  gap?: number | string;
  padding?: number | string;
  background?: string;
  border?: boolean;
  borderRadius?: number | string;
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  scroll?: boolean;
  children?: ComponentNode[];
}

export interface StackProps extends BaseComponentProps {
  direction?: 'horizontal' | 'vertical';
  gap?: number | string;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between';
  children?: ComponentNode[];
}

export interface GridProps extends BaseComponentProps {
  columns?: number | string;
  rows?: number | string;
  gap?: number | string;
  columnGap?: number | string;
  rowGap?: number | string;
  children?: ComponentNode[];
}

// ============================================================================
// Content Components
// ============================================================================

export interface TextProps extends BaseComponentProps {
  content?: string;
  contentPath?: string; // Data model path for dynamic content
  variant?: 'heading' | 'body' | 'caption' | 'code' | 'label';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  color?: string;
  align?: 'left' | 'center' | 'right';
  truncate?: boolean;
  markdown?: boolean;
}

export interface CardProps extends BaseComponentProps {
  title?: string;
  subtitle?: string;
  header?: ComponentNode;
  footer?: ComponentNode;
  padding?: boolean | number;
  hoverable?: boolean;
  clickable?: boolean;
  onClick?: string; // Action ID
  children?: ComponentNode[];
}

export interface ImageProps extends BaseComponentProps {
  src: string;
  srcPath?: string; // Data model path for dynamic src
  alt?: string;
  width?: number | string;
  height?: number | string;
  objectFit?: 'cover' | 'contain' | 'fill';
  rounded?: boolean;
}

export interface CodeProps extends BaseComponentProps {
  content: string;
  language?: string;
  showLineNumbers?: boolean;
  copyable?: boolean;
}

// ============================================================================
// Interactive Components
// ============================================================================

export interface ButtonProps extends BaseComponentProps {
  label?: string;
  labelPath?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  iconPosition?: 'left' | 'right';
  loading?: boolean | string; // boolean or data path
  action?: string; // Action ID to trigger
  actionPayload?: Record<string, unknown>;
  submitForm?: string; // Form ID to submit
}

export interface TextFieldProps extends BaseComponentProps {
  label?: string;
  placeholder?: string;
  valuePath: string; // Data model path for two-way binding
  type?: 'text' | 'password' | 'email' | 'number' | 'tel' | 'url';
  multiline?: boolean;
  rows?: number;
  disabled?: boolean | string;
  required?: boolean;
  error?: string | string; // Static error or data path
  helperText?: string;
  autoFocus?: boolean;
  submitAction?: string; // Action to trigger on Enter
  debounce?: number; // ms
}

export interface SelectProps extends BaseComponentProps {
  label?: string;
  valuePath: string;
  options: Array<{ label: string; value: string }> | string; // Array or data path
  placeholder?: string;
  disabled?: boolean | string;
  searchable?: boolean;
  clearable?: boolean;
  multiple?: boolean;
}

export interface SwitchProps extends BaseComponentProps {
  label?: string;
  valuePath: string;
  disabled?: boolean | string;
  size?: 'sm' | 'md';
}

export interface CheckboxProps extends BaseComponentProps {
  label?: string;
  valuePath: string;
  disabled?: boolean | string;
  indeterminate?: boolean;
}

export interface RadioGroupProps extends BaseComponentProps {
  label?: string;
  valuePath: string;
  options: Array<{ label: string; value: string }>;
  disabled?: boolean | string;
  direction?: 'horizontal' | 'vertical';
}

export interface SliderProps extends BaseComponentProps {
  label?: string;
  valuePath: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean | string;
  showValue?: boolean;
}

// ============================================================================
// Data Display Components
// ============================================================================

export interface ListProps extends BaseComponentProps {
  items: unknown[] | string; // Array or data path
  itemTemplate?: ComponentNode;
  emptyText?: string;
  loading?: boolean | string;
  selectable?: boolean;
  selectionPath?: string;
  onSelect?: string; // Action ID
}

export interface DataTableProps extends BaseComponentProps {
  columns: Array<{
    key: string;
    header: string;
    width?: number | string;
    sortable?: boolean;
    cell?: ComponentNode; // Custom cell template
  }>;
  rows: unknown[] | string; // Array or data path
  sortPath?: string;
  sortDirectionPath?: string;
  selectionPath?: string;
  onRowClick?: string; // Action ID
  pagination?: {
    pagePath: string;
    pageSizePath: string;
    totalPath: string;
    onPageChange: string; // Action ID
  };
  loading?: boolean | string;
  emptyText?: string;
}

export interface BadgeProps extends BaseComponentProps {
  content?: string;
  contentPath?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
}

export interface ProgressProps extends BaseComponentProps {
  value: number | string; // Number or data path (0-100)
  valuePath?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'linear' | 'circular';
  showValue?: boolean;
}

export interface SpinnerProps extends BaseComponentProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'primary';
}

// ============================================================================
// Navigation Components
// ============================================================================

export interface TabsProps extends BaseComponentProps {
  tabs: Array<{
    id: string;
    label: string;
    icon?: string;
    content?: ComponentNode[];
  }>;
  activeTabPath: string;
  onTabChange?: string; // Action ID
  variant?: 'default' | 'pills' | 'underline';
}

export interface AccordionProps extends BaseComponentProps {
  items: Array<{
    id: string;
    title: string;
    content: ComponentNode[];
  }>;
  allowMultiple?: boolean;
  expandedPaths?: string[]; // Data paths for expanded state
}

export interface BreadcrumbsProps extends BaseComponentProps {
  items: Array<{
    label: string;
    href?: string;
    active?: boolean;
  }> | string; // Array or data path
  onNavigate?: string; // Action ID
}

export interface PaginationProps extends BaseComponentProps {
  pagePath: string;
  pageSize: number;
  totalPath: string;
  onPageChange: string; // Action ID
  showSizeChanger?: boolean;
}

export interface MenuProps extends BaseComponentProps {
  trigger: ComponentNode;
  items: Array<{
    id: string;
    label: string;
    icon?: string;
    action?: string; // Action ID
    disabled?: boolean;
    separator?: boolean;
  }>;
}

// ============================================================================
// Feedback Components
// ============================================================================

export interface AlertProps extends BaseComponentProps {
  title?: string;
  message?: string;
  messagePath?: string;
  variant?: 'info' | 'success' | 'warning' | 'error';
  dismissible?: boolean;
  onDismiss?: string; // Action ID
}

export interface DialogProps extends BaseComponentProps {
  title?: string;
  openPath: string;
  onClose?: string; // Action ID
  children?: ComponentNode[];
  actions?: Array<{
    label: string;
    variant?: ButtonProps['variant'];
    action?: string;
  }>;
}

export interface TooltipProps extends BaseComponentProps {
  content: string;
  children: ComponentNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export interface PopoverProps extends BaseComponentProps {
  trigger: ComponentNode;
  children?: ComponentNode[];
  openPath?: string;
  onOpenChange?: string; // Action ID
}

// ============================================================================
// Search Components
// ============================================================================

export interface SearchProps extends BaseComponentProps {
  valuePath: string;
  placeholder?: string;
  onSearch: string; // Action ID
  loading?: boolean | string;
  results?: ComponentNode[];
  debounce?: number;
}

// ============================================================================
// Component Node Union
// ============================================================================

/** Union type for all component nodes */
export type ComponentNode =
  | { type: 'Container'; props: ContainerProps }
  | { type: 'Stack'; props: StackProps }
  | { type: 'Grid'; props: GridProps }
  | { type: 'Text'; props: TextProps }
  | { type: 'Card'; props: CardProps }
  | { type: 'Image'; props: ImageProps }
  | { type: 'Code'; props: CodeProps }
  | { type: 'Button'; props: ButtonProps }
  | { type: 'TextField'; props: TextFieldProps }
  | { type: 'Select'; props: SelectProps }
  | { type: 'Switch'; props: SwitchProps }
  | { type: 'Checkbox'; props: CheckboxProps }
  | { type: 'RadioGroup'; props: RadioGroupProps }
  | { type: 'Slider'; props: SliderProps }
  | { type: 'List'; props: ListProps }
  | { type: 'DataTable'; props: DataTableProps }
  | { type: 'Badge'; props: BadgeProps }
  | { type: 'Progress'; props: ProgressProps }
  | { type: 'Spinner'; props: SpinnerProps }
  | { type: 'Tabs'; props: TabsProps }
  | { type: 'Accordion'; props: AccordionProps }
  | { type: 'Breadcrumbs'; props: BreadcrumbsProps }
  | { type: 'Pagination'; props: PaginationProps }
  | { type: 'Menu'; props: MenuProps }
  | { type: 'Alert'; props: AlertProps }
  | { type: 'Dialog'; props: DialogProps }
  | { type: 'Tooltip'; props: TooltipProps }
  | { type: 'Popover'; props: PopoverProps }
  | { type: 'Search'; props: SearchProps };

// ============================================================================
// A2UI Payload
// ============================================================================

export interface A2UISurface {
  id: string;
  name?: string;
  root: ComponentNode;
}

export interface A2UIAction {
  id: string;
  type: 'ui' | 'api' | 'navigate' | 'emit';
  handler?: string;
  params?: Record<string, unknown>;
}

export interface A2UIPayload {
  version: string;
  surfaces: A2UISurface[];
  dataModel?: Record<string, unknown>;
  actions?: A2UIAction[];
}

// ============================================================================
// Render Context
// ============================================================================

export interface RenderContext {
  /** Current data model state */
  dataModel: Record<string, unknown>;
  /** Function to update data model */
  updateDataModel: (path: string, value: unknown) => void;
  /** Function to trigger actions */
  onAction: (actionId: string, payload?: Record<string, unknown>) => void;
  /** Component whitelist for security */
  whitelist: string[];
}
