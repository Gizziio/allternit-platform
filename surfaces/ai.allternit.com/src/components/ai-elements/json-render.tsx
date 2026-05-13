'use client';

/**
 * JSON Render Component
 *
 * Allternit-native integration of @json-render/react.
 * Renders JSON-described UI trees as interactive React components
 * using a shadcn/ui-inspired component catalog.
 *
 * @json-render is Vercel's generative UI system — AI streams JSON
 * that describes UI structure, and this renderer turns it into
 * actual interactive components.
 */

import React, { useMemo } from 'react';
import {
  IconBraces,
  IconTable,
  IconLayoutCards,
  IconForms,
  IconChartBar,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';

import {
  Renderer,
  JSONUIProvider,
  type ComponentRegistry,
  type ComponentRenderProps,
} from '@json-render/react';
import type { UITree, UIElement } from '@json-render/core';

// ─── Types ─────────────────────────────────────────────────────────

export type JsonRenderMode = 'auto' | 'form' | 'table' | 'cards' | 'chart';

export interface JsonRenderProps {
  /** JSON UI tree or data to render */
  data: Record<string, unknown> | Record<string, unknown>[];
  /** Rendering mode (auto-detected if not specified) */
  mode?: JsonRenderMode;
  /** Optional title */
  title?: string;
  /** Schema hints for form rendering */
  schema?: Record<string, { type: string; label?: string; options?: string[] }>;
  className?: string;
}

// ─── Shadcn/UI Component Catalog for @json-render ────────────────

type RendererElementProps<T extends Record<string, unknown> = Record<string, unknown>> =
  ComponentRenderProps<T>['element']['props'];

const shadcnCatalog: ComponentRegistry = {
  text: ({ element, children }) => {
    const props = (element.props ?? {}) as RendererElementProps<{ className?: string; children?: React.ReactNode }>;
    return <span className={cn('text-sm text-[var(--text-primary)]', props.className)}>{children ?? props.children}</span>;
  },
  heading: ({ element, children }) => {
    const props = (element.props ?? {}) as RendererElementProps<{ level?: number; children?: React.ReactNode }>;
    const Tag = `h${Math.min(Math.max(props.level ?? 2, 1), 6)}` as keyof React.JSX.IntrinsicElements;
    return <Tag className="font-semibold text-[var(--text-primary)]">{children ?? props.children}</Tag>;
  },
  button: ({ element }) => {
    const props = (element.props ?? {}) as RendererElementProps<{ label?: string; onClick?: () => void; variant?: string }>;
    return (
      <button
        onClick={props.onClick}
        className={cn(
          'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
          props.variant === 'primary'
            ? 'bg-[var(--accent-primary)] text-black hover:opacity-90'
            : 'border border-[var(--ui-border-muted)] bg-[var(--surface-elevated)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
        )}
      >
        {props.label}
      </button>
    );
  },
  input: ({ element }) => {
    const props = (element.props ?? {}) as RendererElementProps<{
      value?: string;
      onChange?: (value: string) => void;
      placeholder?: string;
      type?: string;
    }>;
    return (
      <input
        type={props.type ?? 'text'}
        value={props.value ?? ''}
        onChange={(event) => props.onChange?.(event.target.value)}
        placeholder={props.placeholder}
        className="w-full rounded-md border border-[var(--ui-border-muted)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
      />
    );
  },
  card: ({ element, children }) => {
    const props = (element.props ?? {}) as RendererElementProps<{ title?: string }>;
    return (
      <div className="rounded-xl border border-[var(--ui-border-muted)] bg-[var(--surface-panel)] p-4">
        {props.title && <h4 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">{props.title}</h4>}
        {children}
      </div>
    );
  },
  row: ({ element, children }) => {
    const props = (element.props ?? {}) as RendererElementProps<{ gap?: number }>;
    return (
      <div className="flex flex-wrap items-center" style={{ gap: `${(props.gap ?? 2) * 4}px` }}>
        {children}
      </div>
    );
  },
  column: ({ element, children }) => {
    const props = (element.props ?? {}) as RendererElementProps<{ gap?: number }>;
    return (
      <div className="flex flex-col" style={{ gap: `${(props.gap ?? 2) * 4}px` }}>
        {children}
      </div>
    );
  },
  badge: ({ element, children }) => {
    const props = (element.props ?? {}) as RendererElementProps<{ variant?: string; children?: React.ReactNode }>;
    return (
      <span
        className={cn(
          'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider',
          props.variant === 'success' && 'bg-green-500/10 text-green-400',
          props.variant === 'error' && 'bg-red-500/10 text-red-400',
          props.variant === 'warning' && 'bg-amber-500/10 text-amber-400',
          (!props.variant || props.variant === 'default') && 'bg-[var(--ui-border-muted)] text-[var(--text-muted)]'
        )}
      >
        {children ?? props.children}
      </span>
    );
  },
  image: ({ element }) => {
    const props = (element.props ?? {}) as RendererElementProps<{ src?: string; alt?: string }>;
    return <img src={props.src} alt={props.alt ?? ''} className="max-w-full rounded-lg border border-[var(--ui-border-muted)]" />;
  },
  link: ({ element, children }) => {
    const props = (element.props ?? {}) as RendererElementProps<{ href?: string; children?: React.ReactNode }>;
    return (
      <a href={props.href} target="_blank" rel="noopener noreferrer" className="text-[var(--accent-primary)] underline-offset-2 hover:underline">
        {children ?? props.children}
      </a>
    );
  },
};

// ─── Mode Icon ─────────────────────────────────────────────────────

function ModeIcon({ mode }: { mode: JsonRenderMode }) {
  const props = { className: 'size-3.5  text-[var(--accent-primary)]' };
  switch (mode) {
    case 'table': return <IconTable {...props} />;
    case 'cards': return <IconLayoutCards {...props} />;
    case 'form': return <IconForms {...props} />;
    case 'chart': return <IconChartBar {...props} />;
    default: return <IconBraces {...props} />;
  }
}

// ─── Build UITree from data ────────────────────────────────────────

function buildTreeFromData(
  data: Record<string, unknown> | Record<string, unknown>[],
  mode: JsonRenderMode,
  title: string,
  schema?: Record<string, { type: string; label?: string; options?: string[] }>
): UITree {
  // If data is already a UITree, return it
  if (data && typeof data === 'object' && 'root' in data && 'elements' in data) {
    return data as unknown as UITree;
  }

  const isArray = Array.isArray(data);
  const items = isArray ? data : [data];
  const elements: Record<string, UIElement> = {};

  // Root container
  elements.root = {
    key: 'root',
    type: 'column',
    props: { gap: 3 },
    children: ['content'],
  };

  if (mode === 'table' && isArray) {
    const columns = items.length > 0 ? Object.keys(items[0]) : [];

    elements.content = {
      key: 'content',
      type: 'card',
      props: { title },
      children: ['table-header', ...items.map((_, i) => `row-${i}`)],
    };

    elements['table-header'] = {
      key: 'table-header',
      type: 'row',
      props: { gap: 4 },
      children: columns.map((c) => `hdr-${c}`),
    };

    columns.forEach((col) => {
      elements[`hdr-${col}`] = {
        key: `hdr-${col}`,
        type: 'text',
        props: { children: col, className: 'font-semibold uppercase text-xs text-[var(--text-muted)]' },
      };
    });

    items.forEach((row, i) => {
      elements[`row-${i}`] = {
        key: `row-${i}`,
        type: 'row',
        props: { gap: 4 },
        children: columns.map((c) => `cell-${i}-${c}`),
      };
      columns.forEach((col) => {
        const value = (row as any)[col];
        elements[`cell-${i}-${col}`] = {
          key: `cell-${i}-${col}`,
          type: 'text',
          props: {
            children: typeof value === 'boolean' ? (value ? 'Yes' : 'No') : typeof value === 'object' ? JSON.stringify(value).slice(0, 40) : String(value ?? '—'),
            className: 'text-xs text-[var(--text-secondary)]',
          },
        };
      });
    });
  } else if (mode === 'cards') {
    elements.content = {
      key: 'content',
      type: 'column',
      props: { gap: 2 },
      children: items.map((_, i) => `card-${i}`),
    };

    items.forEach((item, i) => {
      const itemEntries = Object.entries(item as any);
      elements[`card-${i}`] = {
        key: `card-${i}`,
        type: 'card',
        props: { title: (item as any).name || (item as any).title || (item as any).label || `Item ${i + 1}` },
        children: [`card-fields-${i}`],
      };
      elements[`card-fields-${i}`] = {
        key: `card-fields-${i}`,
        type: 'column',
        props: { gap: 1 },
        children: itemEntries.map(([k]) => `field-${i}-${k}`),
      };
      itemEntries.forEach(([k, v]) => {
        elements[`field-${i}-${k}`] = {
          key: `field-${i}-${k}`,
          type: 'row',
          props: { gap: 2 },
          children: [`lbl-${i}-${k}`, `val-${i}-${k}`],
        };
        elements[`lbl-${i}-${k}`] = {
          key: `lbl-${i}-${k}`,
          type: 'text',
          props: { children: k, className: 'text-xs uppercase text-[var(--text-muted)] w-24 shrink-0' },
        };
        elements[`val-${i}-${k}`] = {
          key: `val-${i}-${k}`,
          type: 'text',
          props: {
            children: typeof v === 'boolean' ? (v ? 'Yes' : 'No') : typeof v === 'object' ? JSON.stringify(v).slice(0, 40) : String(v ?? '—'),
            className: 'text-xs font-medium text-[var(--text-primary)]',
          },
        };
      });
    });
  } else if (mode === 'form' && items.length > 0) {
    const firstItem = items[0] as any;
    const entries = Object.entries(firstItem);

    elements.content = {
      key: 'content',
      type: 'card',
      props: { title },
      children: ['form-fields'],
    };
    elements['form-fields'] = {
      key: 'form-fields',
      type: 'column',
      props: { gap: 3 },
      children: entries.map(([k]) => `field-${k}`),
    };
    entries.forEach(([k, v]) => {
      const fieldSchema = schema?.[k];
      elements[`field-${k}`] = {
        key: `field-${k}`,
        type: 'column',
        props: { gap: 1 },
        children: [`lbl-${k}`, `inp-${k}`],
      };
      elements[`lbl-${k}`] = {
        key: `lbl-${k}`,
        type: 'text',
        props: { children: fieldSchema?.label || k, className: 'text-[12px] font-medium text-[var(--text-secondary)]' },
      };
      elements[`inp-${k}`] = {
        key: `inp-${k}`,
        type: 'input',
        props: {
          value: String(v ?? ''),
          type: typeof v === 'number' ? 'number' : 'text',
          placeholder: fieldSchema?.label || k,
        },
      };
    });
  } else {
    // Chart mode — simple bar chart from first numeric field
    elements.content = {
      key: 'content',
      type: 'card',
      props: { title },
      children: ['chart-bars'],
    };

    const numericField = items.length > 0
      ? Object.entries(items[0] as any).find(([, v]) => typeof v === 'number')?.[0]
      : undefined;
    const maxValue = numericField
      ? Math.max(...items.map((d: any) => Number(d[numericField] || 0)))
      : 1;

    elements['chart-bars'] = {
      key: 'chart-bars',
      type: 'column',
      props: { gap: 2 },
      children: items.map((_, i) => `bar-${i}`),
    };

    items.forEach((item: any, i: number) => {
      const value = numericField ? Number(item[numericField] || 0) : 0;
      const percent = maxValue > 0 ? (value / maxValue) * 100 : 0;
      const label = item.name || item.label || item.title || `Item ${i + 1}`;

      elements[`bar-${i}`] = {
        key: `bar-${i}`,
        type: 'column',
        props: { gap: 1 },
        children: [`bar-label-${i}`, `bar-track-${i}`],
      };
      elements[`bar-label-${i}`] = {
        key: `bar-label-${i}`,
        type: 'row',
        props: { gap: 2 },
        children: [`bar-name-${i}`, `bar-value-${i}`],
      };
      elements[`bar-name-${i}`] = {
        key: `bar-name-${i}`,
        type: 'text',
        props: { children: String(label), className: 'text-xs text-[var(--text-secondary)]' },
      };
      elements[`bar-value-${i}`] = {
        key: `bar-value-${i}`,
        type: 'text',
        props: { children: String(value), className: 'text-xs font-medium tabular-nums text-[var(--text-primary)]' },
      };
      elements[`bar-track-${i}`] = {
        key: `bar-track-${i}`,
        type: 'row',
        props: {},
        children: [`bar-fill-${i}`],
      };
      elements[`bar-fill-${i}`] = {
        key: `bar-fill-${i}`,
        type: 'text',
        props: {
          children: '',
          className: cn('h-2 rounded-full bg-[var(--accent-primary)]', percent === 0 && 'opacity-0'),
        },
      };
    });
  }

  return { root: 'root', elements };
}

// ─── Main Component ────────────────────────────────────────────────

export function JsonRender({
  data,
  mode = 'auto',
  title = 'Data View',
  schema,
  className,
}: JsonRenderProps) {
  const resolvedMode = useMemo<JsonRenderMode>(() => {
    if (mode !== 'auto') return mode;
    if (Array.isArray(data)) {
      if (data.length > 0 && data.every((d) => typeof d === 'object' && d !== null)) {
        return 'table';
      }
      return 'cards';
    }
    if (schema) return 'form';
    return 'cards';
  }, [data, mode, schema]);

  const tree = useMemo(
    () => buildTreeFromData(data, resolvedMode, title, schema),
    [data, resolvedMode, title, schema]
  );

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-[var(--ui-border-muted)] bg-[var(--surface-panel)]',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--ui-border-muted)] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7  items-center justify-center rounded-md bg-[var(--accent-primary)]/10">
            <ModeIcon mode={resolvedMode} />
          </div>
          <span className="text-sm font-semibold text-[var(--text-primary)]">{title}</span>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-[var(--surface-elevated)] px-2 py-1">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            {resolvedMode}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <JSONUIProvider registry={shadcnCatalog} initialData={{}}>
          <Renderer tree={tree} registry={shadcnCatalog} />
        </JSONUIProvider>
      </div>
    </div>
  );
}
