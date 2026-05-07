// ============================================================================
// A2UI React Renderer
// ============================================================================
// Renders A2UI payloads using React components and Radix UI primitives.
// This is a pure React implementation that doesn't use the vanilla JS renderer
// from the 6-apps/ui package.
// ============================================================================

import React, { useCallback, useMemo, useState } from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import * as RadixTabs from '@radix-ui/react-tabs';
// Note: Additional Radix components can be added as needed:
// import * as RadixCheckbox from '@radix-ui/react-checkbox';
// import * as RadixRadioGroup from '@radix-ui/react-radio-group';
// import * as RadixSlider from '@radix-ui/react-slider';
import {
  Check,
  X,
  Warning,
  CheckCircle,
  Info,
  CircleNotch,
  Copy,
} from '@phosphor-icons/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import {
  COMPONENT_WHITELIST,
  type A2UIPayload as A2UIPayloadType,
  type ComponentNode,
  type RenderContext,
  type ContainerProps,
  type StackProps,
  type GridProps,
  type TextProps,
  type CardProps,
  type ButtonProps,
  type TextFieldProps,
  type BadgeProps,
  type SpinnerProps,
  type TabsProps,
  type AlertProps,
  type ImageProps,
  type CodeProps,
} from './a2ui.types';

// ============================================================================
// Utility Functions
// ============================================================================

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Resolve a value from the data model using a path */
export function resolvePath(dataModel: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = dataModel;

  for (const part of parts) {
    if (typeof current === 'object' && current !== null && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/** Evaluate a visible condition */
function evaluateCondition(
  condition: { path: string; eq?: unknown; ne?: unknown; gt?: number; lt?: number; contains?: string },
  dataModel: Record<string, unknown>
): boolean {
  const value = resolvePath(dataModel, condition.path);

  if (condition.eq !== undefined) return value === condition.eq;
  if (condition.ne !== undefined) return value !== condition.ne;
  if (condition.gt !== undefined) return typeof value === 'number' && value > condition.gt;
  if (condition.lt !== undefined) return typeof value === 'number' && value < condition.lt;
  if (condition.contains !== undefined) {
    return typeof value === 'string' && value.includes(condition.contains);
  }
  return true;
}

/** Check if a component should be visible */
export function isVisible(
  props: { visibleWhen?: { path: string; eq?: unknown; ne?: unknown } },
  dataModel: Record<string, unknown>
): boolean {
  if (!props.visibleWhen) return true;
  return evaluateCondition(props.visibleWhen, dataModel);
}

/** Resolve a value that could be a literal or a data path */
export function resolveValue<T>(
  value: T | string | undefined,
  dataModel: Record<string, unknown>,
  defaultValue: T
): T {
  if (value === undefined) return defaultValue;
  if (typeof value === 'string' && value.startsWith('$.')) {
    const resolved = resolvePath(dataModel, value.slice(2));
    return resolved !== undefined ? (resolved as T) : defaultValue;
  }
  return value as T;
}

// ============================================================================
// Component Renderers
// ============================================================================

interface ComponentRendererProps {
  node: ComponentNode;
  context: RenderContext;
}

/** Container component */
function ContainerRenderer({ node, context }: ComponentRendererProps) {
  const props = node.props as ContainerProps;
  if (!isVisible(props, context.dataModel)) return null;

  const direction = props.direction || 'column';
  const justifyMap: Record<string, string> = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around',
    evenly: 'justify-evenly',
  };
  const alignMap: Record<string, string> = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
  };

  return (
    <div
      className={cn(
        'flex',
        direction === 'row' && 'flex-row',
        direction === 'column' && 'flex-col',
        direction === 'row-reverse' && 'flex-row-reverse',
        direction === 'column-reverse' && 'flex-col-reverse',
        justifyMap[props.justify || 'start'],
        alignMap[props.align || 'stretch'],
        props.wrap && 'flex-wrap',
        props.scroll && 'overflow-auto',
        props.border && 'border border-[var(--border-subtle)]',
        props.className
      )}
      style={{
        gap: typeof props.gap === 'number' ? `${props.gap}px` : props.gap,
        padding: typeof props.padding === 'number' ? `${props.padding}px` : props.padding,
        background: props.background,
        borderRadius: typeof props.borderRadius === 'number' ? `${props.borderRadius}px` : props.borderRadius,
        ...props.style,
      }}
    >
      {props.children?.map((child, idx) => (
        <A2UIComponent key={child.props?.id || idx} node={child} context={context} />
      ))}
    </div>
  );
}

/** Stack component */
function StackRenderer({ node, context }: ComponentRendererProps) {
  const props = node.props as StackProps;
  if (!isVisible(props, context.dataModel)) return null;

  return (
    <div
      className={cn(
        'flex',
        props.direction === 'horizontal' ? 'flex-row' : 'flex-col',
        props.align && `items-${props.align}`,
        props.justify && `justify-${props.justify}`,
        props.className
      )}
      style={{
        gap: typeof props.gap === 'number' ? `${props.gap}px` : props.gap,
        ...props.style,
      }}
    >
      {props.children?.map((child, idx) => (
        <A2UIComponent key={child.props?.id || idx} node={child} context={context} />
      ))}
    </div>
  );
}

/** Grid component */
function GridRenderer({ node, context }: ComponentRendererProps) {
  const props = node.props as GridProps;
  if (!isVisible(props, context.dataModel)) return null;

  return (
    <div
      className={cn('grid', props.className)}
      style={{
        gridTemplateColumns: typeof props.columns === 'number' ? `repeat(${props.columns}, 1fr)` : props.columns,
        gridTemplateRows: typeof props.rows === 'number' ? `repeat(${props.rows}, 1fr)` : props.rows,
        gap: typeof props.gap === 'number' ? `${props.gap}px` : props.gap,
        columnGap: typeof props.columnGap === 'number' ? `${props.columnGap}px` : props.columnGap,
        rowGap: typeof props.rowGap === 'number' ? `${props.rowGap}px` : props.rowGap,
        ...props.style,
      }}
    >
      {props.children?.map((child, idx) => (
        <A2UIComponent key={child.props?.id || idx} node={child} context={context} />
      ))}
    </div>
  );
}

/** Text component */
function TextRenderer({ node, context }: ComponentRendererProps) {
  const props = node.props as TextProps;
  if (!isVisible(props, context.dataModel)) return null;

  const content = props.contentPath
    ? String(resolvePath(context.dataModel, props.contentPath) ?? '')
    : props.content ?? '';

  const sizeClasses: Record<string, string> = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
  };

  const weightClasses: Record<string, string> = {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
  };

  const variantClasses: Record<string, string> = {
    heading: 'font-semibold text-[var(--text-primary)]',
    body: 'text-[var(--text-secondary)]',
    caption: 'text-xs text-[var(--text-tertiary)]',
    code: 'font-mono text-sm bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded',
    label: 'text-sm font-medium text-[var(--text-primary)]',
  };

  return (
    <span
      className={cn(
        sizeClasses[props.size || 'md'],
        weightClasses[props.weight || 'normal'],
        variantClasses[props.variant || 'body'],
        props.align && `text-${props.align}`,
        props.truncate && 'truncate block',
        props.className
      )}
      style={{ color: props.color, ...props.style }}
    >
      {content}
    </span>
  );
}

/** Card component */
function CardRenderer({ node, context }: ComponentRendererProps) {
  const props = node.props as CardProps;
  if (!isVisible(props, context.dataModel)) return null;

  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--border-subtle)] bg-[var(--glass-bg-base)]',
        props.hoverable && 'transition-all duration-200 hover:shadow-lg hover:border-[var(--border-hover)]',
        props.clickable && 'cursor-pointer',
        props.className
      )}
      onClick={() => props.onClick && context.onAction(props.onClick)}
      style={props.style}
    >
      {(props.header || props.title) && (
        <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
          {props.header ? (
            <A2UIComponent node={props.header} context={context} />
          ) : (
            <div>
              <div className="font-semibold text-[var(--text-primary)]">{props.title}</div>
              {props.subtitle && (
                <div className="text-sm text-[var(--text-secondary)]">{props.subtitle}</div>
              )}
            </div>
          )}
        </div>
      )}
      <div className={cn('p-4', props.padding === false && 'p-0', typeof props.padding === 'number' && `p-[${props.padding}px]`)}>
        {props.children?.map((child, idx) => (
          <A2UIComponent key={child.props?.id || idx} node={child} context={context} />
        ))}
      </div>
      {props.footer && (
        <div className="px-4 py-3 border-t border-[var(--border-subtle)]">
          <A2UIComponent node={props.footer} context={context} />
        </div>
      )}
    </div>
  );
}

/** Button component */
function ButtonRenderer({ node, context }: ComponentRendererProps) {
  const props = node.props as ButtonProps;
  if (!isVisible(props, context.dataModel)) return null;

  const label = props.labelPath
    ? String(resolvePath(context.dataModel, props.labelPath) ?? '')
    : props.label ?? '';

  const isLoading = resolveValue(props.loading, context.dataModel, false);

  const variantClasses: Record<string, string> = {
    primary: 'bg-[var(--accent-chat)] text-white hover:opacity-90',
    secondary: 'bg-[var(--glass-bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:bg-[var(--glass-bg-hover)]',
    ghost: 'text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]',
    danger: 'bg-red-500 text-white hover:bg-red-600',
  };

  const sizeClasses: Record<string, string> = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-[var(--accent-chat)]/20',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[props.variant || 'secondary'],
        sizeClasses[props.size || 'md'],
        props.className
      )}
      disabled={isLoading}
      onClick={() => {
        if (props.action) {
          context.onAction(props.action, props.actionPayload);
        }
      }}
      style={props.style}
    >
      {isLoading && <CircleNotch className="w-4 h-4 animate-spin" />}
      {props.icon && props.iconPosition !== 'right' && <span>{props.icon}</span>}
      {label}
      {props.icon && props.iconPosition === 'right' && <span>{props.icon}</span>}
    </button>
  );
}

/** TextField component */
function TextFieldRenderer({ node, context }: ComponentRendererProps) {
  const props = node.props as TextFieldProps;
  if (!isVisible(props, context.dataModel)) return null;

  const value = String(resolvePath(context.dataModel, props.valuePath) ?? '');
  const error = props.error
    ? typeof props.error === 'string' && props.error.startsWith('$.')
      ? String(resolvePath(context.dataModel, props.error.slice(2)) ?? '')
      : props.error
    : undefined;

  const isDisabled = resolveValue(props.disabled, context.dataModel, false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    context.updateDataModel(props.valuePath, e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && props.submitAction) {
      context.onAction(props.submitAction, { [props.valuePath]: value });
    }
  };

  return (
    <div className={cn('space-y-1.5', props.className)} style={props.style}>
      {props.label && (
        <label className="text-sm font-medium text-[var(--text-primary)]">
          {props.label}
          {props.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      {props.multiline ? (
        <textarea
          value={value}
          onChange={handleChange}
          placeholder={props.placeholder}
          disabled={isDisabled}
          rows={props.rows || 3}
          autoFocus={props.autoFocus}
          className={cn(
            'w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border',
            'text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
            'focus:outline-none focus:ring-2 focus:ring-[var(--accent-chat)]/20 focus:border-[var(--accent-chat)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
            'resize-y min-h-[80px]'
          )}
        />
      ) : (
        <input
          type={props.type || 'text'}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={props.placeholder}
          disabled={isDisabled}
          autoFocus={props.autoFocus}
          className={cn(
            'w-full h-10 px-3 rounded-lg bg-[var(--bg-secondary)] border',
            'text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
            'focus:outline-none focus:ring-2 focus:ring-[var(--accent-chat)]/20 focus:border-[var(--accent-chat)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
          )}
        />
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      {props.helperText && !error && <p className="text-xs text-[var(--text-tertiary)]">{props.helperText}</p>}
    </div>
  );
}

/** Badge component */
function BadgeRenderer({ node, context }: ComponentRendererProps) {
  const props = node.props as BadgeProps;
  if (!isVisible(props, context.dataModel)) return null;

  const content = props.contentPath
    ? String(resolvePath(context.dataModel, props.contentPath) ?? '')
    : props.content ?? '';

  const variantClasses: Record<string, string> = {
    default: 'bg-[var(--glass-bg-elevated)] text-[var(--text-secondary)]',
    primary: 'bg-[var(--accent-chat)]/10 text-[var(--accent-chat)]',
    success: 'bg-green-500/10 text-green-600',
    warning: 'bg-yellow-500/10 text-yellow-600',
    danger: 'bg-red-500/10 text-red-600',
  };

  const sizeClasses: Record<string, string> = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-0.5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        variantClasses[props.variant || 'default'],
        sizeClasses[props.size || 'md'],
        props.className
      )}
      style={props.style}
    >
      {content}
    </span>
  );
}

/** Spinner component */
function SpinnerRenderer({ node, context }: ComponentRendererProps) {
  const props = node.props as SpinnerProps;
  if (!isVisible(props, context.dataModel)) return null;

  const sizeClasses: Record<string, string> = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <CircleNotch
      className={cn(
        'animate-spin',
        sizeClasses[props.size || 'md'],
        props.variant === 'primary' && 'text-[var(--accent-chat)]',
        props.className
      )}
      style={props.style}
    />
  );
}

/** Alert component */
function AlertRenderer({ node, context }: ComponentRendererProps) {
  const props = node.props as AlertProps;
  if (!isVisible(props, context.dataModel)) return null;

  const message = props.messagePath
    ? String(resolvePath(context.dataModel, props.messagePath) ?? '')
    : props.message ?? '';

  const variantConfig: Record<string, { icon: React.ReactNode; className: string }> = {
    info: {
      icon: <Info size={16} />,
      className: 'bg-blue-500/10 border-blue-500/20 text-blue-700',
    },
    success: {
      icon: <CheckCircle size={16} />,
      className: 'bg-green-500/10 border-green-500/20 text-green-700',
    },
    warning: {
      icon: <Warning size={16} />,
      className: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-700',
    },
    error: {
      icon: <Warning size={16} />,
      className: 'bg-red-500/10 border-red-500/20 text-red-700',
    },
  };

  const config = variantConfig[props.variant || 'info'];

  return (
    <div
      className={cn(
        'flex gap-3 p-4 rounded-lg border',
        config.className,
        props.className
      )}
      style={props.style}
    >
      <div className="shrink-0 mt-0.5">{config.icon}</div>
      <div className="flex-1 min-w-0">
        {props.title && <div className="font-semibold mb-1">{props.title}</div>}
        <div className="text-sm">{message}</div>
      </div>
      {props.dismissible && (
        <button
          onClick={() => props.onDismiss && context.onAction(props.onDismiss)}
          className="shrink-0 opacity-60 hover:opacity-100"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

/** Tabs component */
function TabsRenderer({ node, context }: ComponentRendererProps) {
  const props = node.props as TabsProps;
  if (!isVisible(props, context.dataModel)) return null;

  const activeTab = String(resolvePath(context.dataModel, props.activeTabPath) ?? props.tabs[0]?.id);

  return (
    <RadixTabs.Root
      value={activeTab}
      onValueChange={(value: string) => {
        context.updateDataModel(props.activeTabPath, value);
        if (props.onTabChange) {
          context.onAction(props.onTabChange, { tabId: value });
        }
      }}
      className={cn('w-full', props.className)}
    >
      <RadixTabs.List
        className={cn(
          'flex gap-1 border-b border-[var(--border-subtle)] mb-4',
          props.variant === 'pills' && 'border-b-0 gap-2',
          props.variant === 'underline' && 'gap-0'
        )}
      >
        {props.tabs.map((tab) => (
          <RadixTabs.Trigger
            key={tab.id}
            value={tab.id}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors',
              'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
              'data-[state=active]:text-[var(--text-primary)]',
              props.variant === 'pills' && 'rounded-full data-[state=active]:bg-[var(--glass-bg-elevated)]',
              props.variant === 'underline' && 'border-b-2 border-transparent data-[state=active]:border-[var(--accent-chat)] -mb-[1px]',
              props.variant === 'default' && 'data-[state=active]:border-b-2 data-[state=active]:border-[var(--accent-chat)] -mb-[1px]'
            )}
          >
            <div className="flex items-center gap-2">
              {tab.icon && <span>{tab.icon}</span>}
              {tab.label}
            </div>
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {props.tabs.map((tab) => (
        <RadixTabs.Content key={tab.id} value={tab.id} className="outline-none">
          {tab.content?.map((child, idx) => (
            <A2UIComponent key={child.props?.id || idx} node={child} context={context} />
          ))}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}

/** Image component */
function ImageRenderer({ node, context }: ComponentRendererProps) {
  const props = node.props as ImageProps;
  if (!isVisible(props, context.dataModel)) return null;

  const src = props.srcPath
    ? String(resolvePath(context.dataModel, props.srcPath) ?? props.src)
    : props.src;

  return (
    <img
      src={src}
      alt={props.alt}
      className={cn(
        'object-cover',
        props.rounded && 'rounded-lg',
        props.className
      )}
      style={{
        width: typeof props.width === 'number' ? `${props.width}px` : props.width,
        height: typeof props.height === 'number' ? `${props.height}px` : props.height,
        objectFit: props.objectFit,
        ...props.style,
      }}
    />
  );
}

/** Code component */
function CodeRenderer({ node, context }: ComponentRendererProps) {
  const props = node.props as CodeProps;
  if (!isVisible(props, context.dataModel)) return null;

  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(props.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('relative group', props.className)} style={props.style}>
      {props.copyable && (
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded-md bg-[var(--glass-bg-elevated)]
                     opacity-0 group-hover:opacity-100 transition-opacity
                     text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      )}
      <pre
        className={cn(
          'p-4 rounded-lg bg-[var(--bg-secondary)] overflow-x-auto',
          'font-mono text-sm text-[var(--text-secondary)]'
        )}
      >
        {props.showLineNumbers && (
          <code>
            {props.content.split('\n').map((line, i) => (
              <div key={i} className="table-row">
                <span className="table-cell text-right pr-4 text-[var(--text-tertiary)] select-none w-12">
                  {i + 1}
                </span>
                <span className="table-cell">{line}</span>
              </div>
            ))}
          </code>
        )}
        {!props.showLineNumbers && <code>{props.content}</code>}
      </pre>
    </div>
  );
}

// ============================================================================
// Main Component Dispatcher
// ============================================================================

interface A2UIComponentProps {
  node: ComponentNode;
  context: RenderContext;
}

/** Main A2UI component dispatcher */
function A2UIComponent({ node, context }: A2UIComponentProps) {
  // Security check: ensure component is in whitelist
  if (!context.whitelist.includes(node.type)) {
    console.warn(`[A2UI] Component type "${node.type}" is not in whitelist`);
    return null;
  }

  switch (node.type) {
    case 'Container':
      return <ContainerRenderer node={node} context={context} />;
    case 'Stack':
      return <StackRenderer node={node} context={context} />;
    case 'Grid':
      return <GridRenderer node={node} context={context} />;
    case 'Text':
      return <TextRenderer node={node} context={context} />;
    case 'Card':
      return <CardRenderer node={node} context={context} />;
    case 'Button':
      return <ButtonRenderer node={node} context={context} />;
    case 'TextField':
      return <TextFieldRenderer node={node} context={context} />;
    case 'Badge':
      return <BadgeRenderer node={node} context={context} />;
    case 'Spinner':
      return <SpinnerRenderer node={node} context={context} />;
    case 'Alert':
      return <AlertRenderer node={node} context={context} />;
    case 'Tabs':
      return <TabsRenderer node={node} context={context} />;
    case 'Image':
      return <ImageRenderer node={node} context={context} />;
    case 'Code':
      return <CodeRenderer node={node} context={context} />;
    // TODO: Add more component renderers
    default:
      console.warn(`[A2UI] Unimplemented component type: ${node.type}`);
      return (
        <div className="p-4 rounded bg-yellow-500/10 text-yellow-700 text-sm">
          [A2UI] Component "{node.type}" not yet implemented
        </div>
      );
  }
}

// ============================================================================
// Main A2UI Renderer Export
// ============================================================================

export interface A2UIRendererProps {
  /** A2UI payload to render */
  payload: A2UIPayloadType;
  /** Optional initial data model */
  initialDataModel?: Record<string, unknown>;
  /** Callback when action is triggered */
  onAction?: (actionId: string, payload?: Record<string, unknown>) => void;
  /** Callback when data model changes */
  onDataModelChange?: (dataModel: Record<string, unknown>) => void;
  /** Custom component whitelist (defaults to COMPONENT_WHITELIST) */
  whitelist?: string[];
  /** Additional CSS class */
  className?: string;
}

/**
 * A2UI Renderer - Renders A2UI payloads as React components
 * 
 * Usage:
 * ```tsx
 * <A2UIRenderer
 *   payload={payload}
 *   onAction={(actionId, payload) => console.log('Action:', actionId, payload)}
 * />
 * ```
 */
export function A2UIRenderer({
  payload,
  initialDataModel = {},
  onAction,
  onDataModelChange,
  whitelist = COMPONENT_WHITELIST as unknown as string[],
  className,
}: A2UIRendererProps) {
  const [dataModel, setDataModel] = useState<Record<string, unknown>>(() => ({
    ...payload.dataModel,
    ...initialDataModel,
  }));

  const updateDataModel = useCallback((path: string, value: unknown) => {
    setDataModel((prev: Record<string, unknown>) => {
      const parts = path.split('.');
      const next = { ...prev };
      let current: Record<string, unknown> = next;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        current[part] = { ...(current[part] as Record<string, unknown>) };
        current = current[part] as Record<string, unknown>;
      }

      current[parts[parts.length - 1]] = value;
      return next;
    });
  }, []);

  // Notify parent of data model changes
  React.useEffect(() => {
    onDataModelChange?.(dataModel);
  }, [dataModel, onDataModelChange]);

  const context = useMemo<RenderContext>(
    () => ({
      dataModel,
      updateDataModel,
      onAction: (actionId: string, payload?: Record<string, unknown>) => {
        console.log('[A2UI] Action triggered:', actionId, payload);
        onAction?.(actionId, payload);
      },
      whitelist,
    }),
    [dataModel, updateDataModel, onAction, whitelist]
  );

  return (
    <RadixTooltip.Provider delayDuration={100}>
      <div className={cn('a2ui-root', className)}>
        {payload.surfaces.map((surface) => (
          <div key={surface.id} className="a2ui-surface" data-surface-id={surface.id}>
            <A2UIComponent node={surface.root} context={context} />
          </div>
        ))}
      </div>
    </RadixTooltip.Provider>
  );
}

export default A2UIRenderer;
