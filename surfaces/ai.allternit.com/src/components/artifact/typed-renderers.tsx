/**
 * Typed renderers for the Allternit artifact MIME types
 * (`application/vnd.allternit.deck` / `.prototype` / `.mobile`) — the §2.1
 * Phase 2 decision (docs/design/artifacts-api.md).
 *
 * A "typed renderer" is deliberately a thin chrome layer over the SAME
 * sandboxed srcdoc iframe every artifact renders in — the storage model does
 * not care about type, and execution policy stays identical (no
 * allow-same-origin, CSP untouched). What the type adds is presentation:
 *
 * - deck    — a chrome bar with a live slide counter (fed by the deck-stage
 *             web component's `slideIndexChanged` postMessage) and prev/next
 *             buttons that navigate through the iframe's `#slide-N` hash, on
 *             top of the deck's own in-document nav zones and keyboard nav.
 * - mobile  — the artifact renders inside a 390px device frame.
 * - prototype — plain sandboxed render; hotspot linking is in-document anchor
 *             navigation, which the standard sandboxed iframe already
 *             supports. The typed case exists so the MIME type maps to a
 *             defined renderer, not a fallback.
 */

import React, { memo, useEffect, useRef, useState } from 'react';
import { CaretLeft, CaretRight, DeviceMobile, Presentation } from '@phosphor-icons/react';
import { injectSandboxStorageShim, injectSandboxCsp } from './ArtifactRenderer';

type TypedRendererProps = {
  htmlContent: string;
  height?: string;
  width?: string;
};

function useSandboxedSrcDoc(htmlContent: string): string {
  return React.useMemo(
    () => injectSandboxStorageShim(injectSandboxCsp(htmlContent)),
    [htmlContent],
  );
}

// ─── Deck ────────────────────────────────────────────────────────────────────

interface DeckSlideMessage {
  slideIndexChanged?: number;
  totalSlides?: number;
}

function parseDeckSlideMessage(data: unknown): DeckSlideMessage | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (typeof d.slideIndexChanged !== 'number') return null;
  return { slideIndexChanged: d.slideIndexChanged, totalSlides: typeof d.totalSlides === 'number' ? d.totalSlides : undefined };
}

export const DeckRenderer = memo<TypedRendererProps>(({ htmlContent, height = '480px', width = '100%' }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [slide, setSlide] = useState<{ index: number; total: number } | null>(null);

  // The deck-stage component posts { slideIndexChanged, totalSlides } on every
  // navigation. The sandboxed iframe has an opaque origin ('null') — accept
  // only messages from our own iframe, same as the aio-targeting channel.
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== 'null') return;
      if (iframeRef.current?.contentWindow == null) return;
      if (event.source !== iframeRef.current.contentWindow) return;
      const payload = parseDeckSlideMessage(event.data);
      if (payload) {
        setSlide({ index: payload.slideIndexChanged!, total: payload.totalSlides ?? 0 });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const goTo = (index: number) => {
    // Assigning location on a cross-origin window is a permitted navigation
    // (reading it is not). deck-stage listens for hashchange and goes to the
    // slide; if a deck skeleton without hash nav is used, its own click zones
    // and keyboard nav still work inside the iframe.
    try {
      iframeRef.current?.contentWindow?.location.assign(`#slide-${index + 1}`);
    } catch {
      // Navigation blocked — in-document nav remains available.
    }
  };

  const srcDoc = useSandboxedSrcDoc(htmlContent);

  return (
    <div style={{ width }} className="overflow-hidden rounded-[10px] border border-[var(--border-subtle)]">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface-panel)] border-b border-[var(--border-subtle)]">
        <Presentation className="size-4 text-[var(--text-secondary)]" />
        <span className="text-[12px] font-semibold text-[var(--text-secondary)]">Deck</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => goTo(Math.max(0, (slide?.index ?? 1) - 1))}
            className="flex items-center justify-center size-6 rounded border border-[var(--border-subtle)] bg-[var(--surface-hover)] text-[rgba(255,255,255,0.5)] cursor-pointer"
          >
            <CaretLeft className="size-3.5" />
          </button>
          <span className="text-[11px] font-mono text-[rgba(255,255,255,0.4)] min-w-[48px] text-center">
            {slide ? `${slide.index + 1}${slide.total ? ` / ${slide.total}` : ''}` : '— / —'}
          </span>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => goTo(slide ? slide.index + 1 : 1)}
            className="flex items-center justify-center size-6 rounded border border-[var(--border-subtle)] bg-[var(--surface-hover)] text-[rgba(255,255,255,0.5)] cursor-pointer"
          >
            <CaretRight className="size-3.5" />
          </button>
        </div>
      </div>
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts allow-forms allow-modals"
        srcDoc={srcDoc}
        style={{ border: 'none', height, width: '100%', background: '#000', display: 'block' }}
        title="artifact-deck-renderer"
      />
    </div>
  );
});

// ─── Mobile ──────────────────────────────────────────────────────────────────

export const MobileRenderer = memo<TypedRendererProps>(({ htmlContent, height = '720px' }) => {
  const srcDoc = useSandboxedSrcDoc(htmlContent);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="rounded-[28px] border border-[var(--border-subtle)] bg-black p-2"
        style={{ width: 406 }}
      >
        <iframe
          sandbox="allow-scripts allow-forms allow-modals"
          srcDoc={srcDoc}
          style={{ border: 'none', borderRadius: 20, height, width: 390, background: '#fff', display: 'block' }}
          title="artifact-mobile-renderer"
        />
      </div>
      <div className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
        <DeviceMobile className="size-3.5" /> 390px device frame
      </div>
    </div>
  );
});
