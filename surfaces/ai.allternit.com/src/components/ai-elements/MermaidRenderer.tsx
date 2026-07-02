"use client";

import React, { useState, useEffect, useRef } from "react";
import DOMPurify from 'dompurify';

const sanitizeContent = (dirty: string): string => {
  if (typeof window === 'undefined') return dirty;
  return DOMPurify.sanitize(dirty, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 
               'ellipse', 'g', 'defs', 'use', 'text', 'tspan', 'tref',
               'marker', 'linearGradient', 'radialGradient', 'stop',
               'pattern', 'clipPath', 'mask', 'filter'],
    ADD_ATTR: ['viewBox', 'preserveAspectRatio', 'cx', 'cy', 'r', 'rx', 'ry',
               'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height',
               'transform', 'fill', 'stroke', 'stroke-width', 'stroke-linecap',
               'stroke-linejoin', 'opacity', 'd', 'points', 'marker-end',
               'marker-start', 'marker-mid', 'gradientUnits', 'gradientTransform',
               'offset', 'stop-color', 'stop-opacity', 'clip-path', 'mask',
               'filter', 'xmlns', 'xmlns:xlink', 'version'],
    FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover', 'onmouseout',
                  'onfocus', 'onblur', 'onchange', 'onsubmit', 'onreset'],
  });
};

export function MermaidRenderer({ content }: { content: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prevContent, setPrevContent] = useState(content);
  
  if (content !== prevContent) {
    setPrevContent(content);
    setSvg(null);
    setError(null);
  }

  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!content) return;
    let cancelled = false;

    import("@streamdown/mermaid")
      .then(({ mermaid }) => {
        const mm = mermaid.getMermaid();
        return mm.render(idRef.current, content);
      })
      .then(({ svg: rendered }: { svg: string }) => {
        if (!cancelled) setSvg(rendered);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(String(err));
      });

    return () => { cancelled = true; };
  }, [content]);

  if (error) {
    return (
      <div className="p-5 px-6">
        <div className="text-[12px] text-red-400/70 uppercase tracking-wider mb-2.5">
          Diagram error
        </div>
        <pre className="text-[12px] text-[#abb2bf] white-space-pre-wrap leading-relaxed font-mono">
          {content}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="p-8 flex items-center justify-center gap-2">
        <div className="size-1.5 rounded-full bg-[rgba(212,176,140,0.5)] animate-pulse" />
        <span className="text-[12px] text-[rgba(255,255,255,0.3)]">Rendering diagram…</span>
      </div>
    );
  }

  return (
    <div className="p-6 flex justify-center overflow-x-auto">
      <img
        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitizeContent(svg))}`}
        alt="SVG artifact"
        className="max-w-full max-h-full"
      />
    </div>
  );
}
