/**
 * AllternitIXRendererView
 *
 * UI for A2R-IX JSON Renderer / Interface eXecution.
 * Real JSON → UI renderer demo with specification editor and live preview.
 */

'use client';

import React, { useState } from 'react';
import { GlassSurface } from '@/design/GlassSurface';
import {
  Lightning,
  Code,
  CheckCircle,
  Warning,
  Play,
  List,
  X,
  CaretDown,
  Plus,
  Copy,
  ArrowCounterClockwise,
} from '@phosphor-icons/react';

interface ComponentInfo {
  name: string;
  description: string;
}

const COMPONENT_CATALOG: ComponentInfo[] = [
  { name: 'card', description: 'Container with title & glass effect' },
  { name: 'button', description: 'Interactive button with actions' },
  { name: 'metric', description: 'KPI display with trend indicator' },
  { name: 'table', description: 'Data table with sorting & filtering' },
  { name: 'chart', description: 'Line/bar/pie chart visualization' },
  { name: 'input', description: 'Text input with validation' },
  { name: 'select', description: 'Dropdown select component' },
  { name: 'badge', description: 'Status/tag display element' },
  { name: 'grid', description: 'Responsive column layout' },
  { name: 'stack', description: 'Vertical/horizontal flex stack' },
];

const DEFAULT_SPEC = `{
  "type": "card",
  "props": {
    "title": "Agent Status",
    "variant": "glass"
  },
  "children": [
    {
      "type": "metric",
      "props": {
        "label": "Active Runs",
        "value": 3,
        "trend": "up"
      }
    },
    {
      "type": "button",
      "props": {
        "label": "View All",
        "action": "nav:rails"
      }
    }
  ]
}`;

interface RenderedComponent {
  type: string;
  props: Record<string, any>;
  children?: RenderedComponent[];
}

function parseJson(text: string): { valid: boolean; data?: RenderedComponent; error?: string } {
  try {
    const data = JSON.parse(text);
    return { valid: true, data };
  } catch (e) {
    return { valid: false, error: String(e).replace('SyntaxError: ', '') };
  }
}

function countComponents(spec: RenderedComponent): number {
  let count = 1;
  if (spec.children) {
    count += spec.children.reduce((sum, child) => sum + countComponents(child), 0);
  }
  return count;
}

function MockRenderedOutput({ spec }: { spec: RenderedComponent }) {
  return (
    <div className="space-y-4">
      <div className="p-6 rounded-2xl bg-gradient-to-br from-[var(--bg-secondary)] via-transparent to-[var(--bg-secondary)] border border-[var(--border-subtle)]">
        <div className="text-sm font-semibold text-[var(--accent-primary)] mb-3">
          {spec.props?.title || 'Component'}
        </div>

        {spec.children?.map((child, idx) => {
          if (child.type === 'metric') {
            return (
              <div key={idx} className="mb-4 p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
                <div className="text-xs text-[var(--text-tertiary)] mb-1">
                  {child.props?.label}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[var(--accent-primary)]">
                    {child.props?.value}
                  </span>
                  {child.props?.trend === 'up' && (
                    <span className="text-xs text-green-500 font-medium">↑ up</span>
                  )}
                  {child.props?.trend === 'down' && (
                    <span className="text-xs text-red-500 font-medium">↓ down</span>
                  )}
                </div>
              </div>
            );
          }
          if (child.type === 'button') {
            return (
              <button
                key={idx}
                className="w-full px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-[var(--bg-primary)] font-medium text-sm hover:opacity-90 transition-opacity"
              >
                {child.props?.label}
              </button>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

export function AllternitIXRendererView() {
  const [jsonText, setJsonText] = useState(DEFAULT_SPEC);
  const [renderTime, setRenderTime] = useState(0);
  const [catalogOpen, setCatalogOpen] = useState(true);
  const [lastValidSpec, setLastValidSpec] = useState<RenderedComponent | null>(null);

  const parseResult = parseJson(jsonText);
  const isValid = parseResult.valid;
  const componentCount = isValid && parseResult.data ? countComponents(parseResult.data) : 0;

  const handleRender = () => {
    if (isValid && parseResult.data) {
      const start = performance.now();
      setLastValidSpec(parseResult.data);
      const end = performance.now();
      setRenderTime(Math.round((end - start) * 10) / 10);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonText);
  };

  const handleReset = () => {
    setJsonText(DEFAULT_SPEC);
    setLastValidSpec(null);
  };

  return (
    <GlassSurface className="h-full w-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lightning className="w-6 h-6 text-[var(--accent-primary)]" />
            <div>
              <h2 className="text-lg font-semibold">A2R-IX Renderer</h2>
              <p className="text-sm text-[var(--text-tertiary)]">
                JSON specification → UI execution
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCatalogOpen(!catalogOpen)}
              className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
              title={catalogOpen ? 'Hide catalog' : 'Show catalog'}
            >
              {catalogOpen ? <X size={20} /> : <List size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: JSON editor + catalog */}
        <div className="w-[400px] flex flex-col border-r border-[var(--border-subtle)] overflow-hidden">
          {/* Editor section */}
          <div className="flex-1 flex flex-col overflow-hidden border-b border-[var(--border-subtle)]">
            <div className="px-4 pt-3 pb-2 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2 mb-2">
                <Code className="w-4 h-4 text-[var(--text-tertiary)]" />
                <span className="text-xs font-semibold text-[var(--text-secondary)]">JSON SPEC</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleRender}
                  disabled={!isValid}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[var(--accent-primary)] text-[var(--bg-primary)] font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                >
                  <Play size={16} />
                  Render
                </button>
                <button
                  onClick={handleCopy}
                  className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-primary)] transition-colors"
                  title="Copy JSON"
                >
                  <Copy size={16} />
                </button>
                <button
                  onClick={handleReset}
                  className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-primary)] transition-colors"
                  title="Reset to default"
                >
                  <ArrowCounterClockwise size={16} />
                </button>
              </div>
            </div>

            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              className="flex-1 px-4 py-3 bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono text-xs resize-none outline-none border-0"
              placeholder="Paste or edit JSON spec here..."
              spellCheck="false"
            />
          </div>

          {/* Status bar */}
          <div className="px-4 py-3 bg-[var(--bg-secondary)] border-t border-[var(--border-subtle)] text-xs text-[var(--text-tertiary)] space-y-1">
            <div className="flex items-center gap-2">
              {isValid ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Valid JSON</span>
                </>
              ) : (
                <>
                  <Warning className="w-4 h-4 text-red-500" />
                  <span>{parseResult.error || 'Invalid JSON'}</span>
                </>
              )}
            </div>
            {isValid && (
              <>
                <div className="text-[var(--text-secondary)]">{componentCount} components</div>
                {renderTime > 0 && (
                  <div className="text-[var(--text-secondary)]">Render time: {renderTime}ms</div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Center: Rendered output */}
        <div className="flex-1 overflow-auto p-6 bg-[var(--bg-primary)]">
          <div className="max-w-2xl">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--accent-primary)]" />
              RENDERED OUTPUT
            </h3>
            {lastValidSpec ? (
              <MockRenderedOutput spec={lastValidSpec} />
            ) : (
              <div className="p-8 rounded-xl border border-dashed border-[var(--border-subtle)] text-center text-[var(--text-tertiary)]">
                <p className="text-sm">Click "Render" to preview the specification</p>
              </div>
            )}
          </div>
        </div>

        {/* Right panel: Component catalog (collapsible) */}
        {catalogOpen && (
          <div className="w-[240px] border-l border-[var(--border-subtle)] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
              <h3 className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-2">
                <CaretDown size={16} />
                COMPONENT CATALOG
              </h3>
            </div>
            <div className="flex-1 overflow-auto px-3 py-3 space-y-2">
              {COMPONENT_CATALOG.map((comp) => (
                <div
                  key={comp.name}
                  className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] cursor-help hover:border-[var(--accent-primary)] transition-colors group"
                  title={comp.description}
                >
                  <div className="font-mono text-xs font-semibold text-[var(--accent-primary)] mb-1">
                    {comp.name}
                  </div>
                  <div className="text-xs text-[var(--text-tertiary)] line-clamp-2 group-hover:text-[var(--text-secondary)] transition-colors">
                    {comp.description}
                  </div>
                </div>
              ))}
              <button className="w-full p-3 rounded-lg border border-dashed border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] text-sm flex items-center justify-center gap-2 transition-colors">
                <Plus size={16} />
                Add Component
              </button>
            </div>
          </div>
        )}
      </div>
    </GlassSurface>
  );
}

export default AllternitIXRendererView;
