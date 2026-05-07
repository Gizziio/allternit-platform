/**
 * MermaidRenderer.tsx
 * 
 * Renders Mermaid diagrams.
 * Supports flowcharts, sequence diagrams, Gantt charts, etc.
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ArrowsOut,
  DownloadSimple,
  ShareNetwork,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  ArrowsClockwise,
  Code,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import type { ArtifactUIPart } from '@/lib/ai/ui-parts.types';
import type { MoATask } from '@/lib/api/moa-client';
import { cn } from '@/lib/utils';

declare global {
  interface Window {
    mermaid?: {
      render: (id: string, code: string) => Promise<{ svg: string }>;
    };
  }
}

interface MermaidRendererProps {
  artifact: ArtifactUIPart;
  sessionId?: string;
  onMoATaskUpdate?: (tasks: MoATask[]) => void;
}

export function MermaidRenderer({
  artifact,
  sessionId,
  onMoATaskUpdate,
}: MermaidRendererProps) {
  const [zoom, setZoom] = useState(1);
  const [showSource, setShowSource] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<string>('');

  // Parse mermaid content
  const mermaidCode = useMemo(() => {
    if (!artifact.content) {
      // Default demo diagram
      return `graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E`;
    }
    return artifact.content;
  }, [artifact.content]);

  // Render mermaid diagram (client-side)
  useEffect(() => {
    const renderDiagram = async () => {
      setIsRendering(true);
      setRenderError(null);
      
      try {
        // Try to use mermaid if available, otherwise use fallback
        if (typeof window !== 'undefined' && window.mermaid) {
          const mermaid = window.mermaid;
          const id = `mermaid-${Date.now()}`;
          const { svg } = await mermaid.render(id, mermaidCode);
          svgRef.current = svg;
        } else {
          // Fallback: simple SVG generation
          svgRef.current = generateFallbackSVG(mermaidCode);
        }
      } catch (error) {
        setRenderError('Failed to render diagram');
        console.error('Mermaid render error:', error);
      } finally {
        setIsRendering(false);
      }
    };

    renderDiagram();
  }, [mermaidCode]);

  const renderedSvgSrc = useMemo(
    () =>
      svgRef.current
        ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgRef.current)}`
        : null,
    [isRendering, mermaidCode, renderError]
  );

  // Generate simple fallback SVG for basic graphs
  const generateFallbackSVG = (code: string): string => {
    // Parse simple graph definitions
    const lines = code.split('\n').filter(l => l.trim());
    const nodes = new Set<string>();
    const edges: Array<[string, string, string]> = [];
    
    lines.forEach(line => {
      // Extract nodes from arrows (A --> B, A -->|label| B)
      const arrowMatch = line.match(/(\w+)\s*\[([^\]]+)\]\s*-->\s*\|?([^|]*)\|?\s*(\w+)\s*\[([^\]]+)\]/);
      if (arrowMatch) {
        nodes.add(arrowMatch[1]);
        nodes.add(arrowMatch[4]);
        edges.push([arrowMatch[1], arrowMatch[4], arrowMatch[3] || '']);
      }
    });

    // Generate simple SVG
    const nodeArray = Array.from(nodes);
    const width = 400;
    const height = Math.max(200, nodeArray.length * 60);
    const nodeX = width / 2;
    const nodeY = height / (nodeArray.length + 1);

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="mermaid-fallback">`;
    svg += `<style>
      .mermaid-fallback .node rect { fill: #f0f0f0; stroke: #333; stroke-width: 2px; }
      .mermaid-fallback .node text { font: 12px sans-serif; }
      .mermaid-fallback .edge { stroke: #333; stroke-width: 2px; fill: none; }
      .mermaid-fallback .edge-label { font: 10px sans-serif; fill: #666; }
    </style>`;

    // Draw nodes
    nodeArray.forEach((node, i) => {
      const y = (i + 1) * nodeY;
      svg += `<g class="node" transform="translate(${nodeX - 60}, ${y - 20})">`;
      svg += `<rect width="120" height="40" rx="5" />`;
      svg += `<text x="60" y="25" text-anchor="middle">${node}</text>`;
      svg += `</g>`;
    });

    // Draw edges
    edges.forEach(([from, to, label]) => {
      const fromIdx = nodeArray.indexOf(from);
      const toIdx = nodeArray.indexOf(to);
      if (fromIdx >= 0 && toIdx >= 0) {
        const x1 = nodeX;
        const y1 = (fromIdx + 1) * nodeY + 20;
        const x2 = nodeX;
        const y2 = (toIdx + 1) * nodeY - 20;
        
        svg += `<path class="edge" d="M ${x1} ${y1} L ${x2} ${y2}" marker-end="url(#arrowhead)" />`;
        if (label) {
          svg += `<text class="edge-label" x="${x1 + 5}" y="${(y1 + y2) / 2}">${label}</text>`;
        }
      }
    });

    // Arrow marker
    svg += `<defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">`;
    svg += `<polygon points="0 0, 10 3.5, 0 7" fill="#333" /></marker></defs>`;
    svg += `</svg>`;

    return svg;
  };

  // Handle download
  const handleDownload = () => {
    const blob = new Blob([mermaidCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.title || 'diagram'}.mmd`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle SVG download
  const handleDownloadSVG = () => {
    if (!svgRef.current) return;
    const blob = new Blob([svgRef.current], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.title || 'diagram'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)]">
      {/* Toolbar */}
      <div className="h-12 border-b border-[var(--border-subtle)] flex items-center justify-between px-4 bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-3">
          <svg className="w-4 h-4 text-[var(--accent-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {artifact.title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSource(!showSource)}
            className={cn(
              "text-[var(--text-tertiary)]",
              showSource && "text-[var(--accent-primary)]"
            )}
          >
            <Code size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
            className="text-[var(--text-tertiary)]"
          >
            <MagnifyingGlassMinus size={16} />
          </Button>
          <span className="text-xs text-[var(--text-tertiary)] min-w-[40px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom(z => Math.min(3, z + 0.25))}
            className="text-[var(--text-tertiary)]"
          >
            <MagnifyingGlassPlus size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadSVG}
            className="text-[var(--text-tertiary)]"
          >
            <DownloadSimple size={16} />
          </Button>
          <Button variant="ghost" size="sm" className="text-[var(--text-tertiary)]">
            <ShareNetwork size={16} />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-[var(--bg-primary)]">
        {showSource ? (
          /* Source code view */
          <div className="h-full p-4">
            <pre className="font-mono text-sm text-[var(--text-secondary)] bg-[var(--bg-secondary)] rounded-lg p-4 overflow-auto">
              {mermaidCode}
            </pre>
          </div>
        ) : isRendering ? (
          /* Loading state */
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-[var(--text-tertiary)]">
              <ArrowsClockwise className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p className="text-sm">Rendering diagram...</p>
            </div>
          </div>
        ) : renderError ? (
          /* Error state */
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-[var(--text-tertiary)]">
              <p className="text-sm mb-2">{renderError}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSource(true)}
                className="text-[var(--accent-primary)]"
              >
                <Code className="w-4 h-4 mr-2" />
                View Source
              </Button>
            </div>
          </div>
        ) : (
          /* Diagram view */
          <div
            className="h-full flex items-center justify-center p-8"
            ref={containerRef}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
            }}
          >
            {renderedSvgSrc && (
              <img
                alt="Rendered Mermaid diagram"
                className="max-w-full max-h-full"
                src={renderedSvgSrc}
              />
            )}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="h-8 border-t border-[var(--border-subtle)] flex items-center justify-between px-4 text-xs text-[var(--text-tertiary)] bg-[var(--bg-secondary)]">
        <span>Mermaid Diagram</span>
        <span>{mermaidCode.length} characters</span>
      </div>
    </div>
  );
}
