/**
 * Allternit Canvas Artifact Renderer
 * Derived from Lobe Chat's artifact renderer (MIT).
 * Reskinned for Allternit with native design tokens.
 */

import React, { memo, useEffect, useMemo, useRef } from 'react';
import {
  injectAioIds,
  injectAioTargetCapture,
  parseAioTargetMessage,
  type AioTargetPayload,
} from '@/lib/design/aio-targeting';
import { ARTIFACT_CSP, injectSandboxCsp } from './sandbox-csp';
import { DeckRenderer, MobileRenderer } from './typed-renderers';

export { ARTIFACT_CSP, injectSandboxCsp };

interface ArtifactRendererProps {
  content: string;
  type?: string;
  height?: string;
  width?: string;
  /**
   * Click-to-target (mapping doc §3 port #5): when enabled, element ids and a
   * click-capture script are injected into the sandboxed srcdoc and clicks on
   * elements postMessage back to the parent (opaque origin → `event.origin`
   * is the string 'null'). Only meaningful together with `onAioTarget`.
   */
  aioTargeting?: boolean;
  /** Called with the validated payload when an element is clicked in targeting mode. */
  onAioTarget?: (payload: AioTargetPayload) => void;
}

const SANDBOX_STORAGE_SHIM = `<script data-allternit-artifact-storage-shim>
(() => {
  if (window.__allternitArtifactStorageShim) return;
  Object.defineProperty(window, '__allternitArtifactStorageShim', { value: true });
  const createStorage = () => {
    const data = Object.create(null);
    return {
      clear() { for (const key of Object.keys(data)) delete data[key]; },
      getItem(key) { const k = String(key); return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
      key(index) { return Object.keys(data)[index] ?? null; },
      get length() { return Object.keys(data).length; },
      removeItem(key) { delete data[String(key)]; },
      setItem(key, value) { data[String(key)] = String(value); },
    };
  };
  const defineStorage = (name) => {
    try { void window[name]; return; } catch {
      Object.defineProperty(window, name, { configurable: true, value: createStorage() });
    }
  };
  defineStorage('localStorage');
  defineStorage('sessionStorage');
})();
</script>`;

export function injectSandboxStorageShim(htmlContent: string): string {
  if (htmlContent.includes('data-allternit-artifact-storage-shim')) return htmlContent;
  const headTag = htmlContent.match(/<head(?:\s[^>]*)?>/i);
  if (headTag) {
    const idx = htmlContent.indexOf(headTag[0]) + headTag[0].length;
    return htmlContent.slice(0, idx) + '\n' + SANDBOX_STORAGE_SHIM + htmlContent.slice(idx);
  }
  const htmlTag = htmlContent.match(/<html(?:\s[^>]*)?>/i);
  if (htmlTag) {
    const idx = htmlContent.indexOf(htmlTag[0]) + htmlTag[0].length;
    return htmlContent.slice(0, idx) + '\n<head>' + SANDBOX_STORAGE_SHIM + '</head>' + htmlContent.slice(idx);
  }
  return SANDBOX_STORAGE_SHIM + '\n' + htmlContent;
}

const HTMLRenderer = memo<{
  htmlContent: string;
  height?: string;
  width?: string;
  aioTargeting?: boolean;
  onAioTarget?: (payload: AioTargetPayload) => void;
}>(
  ({ htmlContent, width = '100%', height = '360px', aioTargeting = false, onAioTarget }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Click-to-target: the sandboxed srcdoc iframe has an opaque origin, so
    // the only channel from the artifact DOM to the parent is postMessage.
    // Accept only messages from our iframe's contentWindow with origin 'null'
    // (opaque) and a strictly validated payload shape.
    useEffect(() => {
      if (!aioTargeting || !onAioTarget) return;
      const handler = (event: MessageEvent) => {
        if (event.origin !== 'null') return;
        if (iframeRef.current?.contentWindow == null) return;
        if (event.source !== iframeRef.current.contentWindow) return;
        const payload = parseAioTargetMessage(event.data);
        if (payload) onAioTarget(payload);
      };
      window.addEventListener('message', handler);
      return () => window.removeEventListener('message', handler);
    }, [aioTargeting, onAioTarget]);

    const srcDoc = useMemo(() => {
      // CSP first: it must precede every resource-bearing element to govern it.
      const shimmed = injectSandboxStorageShim(injectSandboxCsp(htmlContent));
      if (!aioTargeting) return shimmed;
      return injectAioTargetCapture(injectAioIds(shimmed));
    }, [htmlContent, aioTargeting]);

    return (
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts allow-forms allow-modals"
        srcDoc={srcDoc}
        style={{
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          height,
          width,
          background: 'var(--bg-secondary)',
        }}
        title="artifact-html-renderer"
      />
    );
  }
);

const SVGRenderer = memo<{ content: string; height?: string; width?: string }>(
  ({ content, width = '100%', height = '360px' }) => (
    // SVG artifacts are untrusted documents too — render inside the sandboxed
    // iframe (opaque origin) instead of injecting markup into the host document.
    <HTMLRenderer
      htmlContent={`<html><body style="margin:0">${content}</body></html>`}
      height={height}
      width={width}
    />
  ),
);

const MarkdownRenderer = memo<{ content: string; height?: string; width?: string }>(
  ({ content, width = '100%', height = '360px' }) => {
    const html = useMemo(() => {
      return content
        .replace(/^### (.*$)/gim, '<h3 style="margin:12px 0 6px;color:var(--text-primary)">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 style="margin:14px 0 8px;color:var(--text-primary)">$1</h2>')
        .replace(/^# (.*$)/gim, '<h1 style="margin:16px 0 10px;color:var(--text-primary)">$1</h1>')
        .replace(/```([\s\S]*?)```/g, '<pre style="background:var(--surface-panel);padding:12px;border-radius:8px;overflow:auto"><code>$1</code></pre>')
        .replace(/`([^`]+)`/g, '<code style="background:var(--surface-panel);padding:2px 4px;border-radius:4px">$1</code>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br/>');
    }, [content]);

    // The markdown transform does not sanitize raw inline HTML, so the result
    // is untrusted — render it in the sandboxed iframe, never the host document.
    return <HTMLRenderer htmlContent={html} height={height} width={width} />;
  },
);

const MermaidRenderer = memo<{ content: string }>(({ content }) => (
  <div
    style={{
      padding: 'var(--spacing-md)',
      border: '1px solid var(--border-subtle)',
      borderRadius: '10px',
      background: 'var(--bg-secondary)',
      color: 'var(--text-secondary)',
      fontSize: '13px',
      fontFamily: 'var(--font-mono)',
      whiteSpace: 'pre-wrap',
    }}
  >
    {content}
  </div>
));

const ArtifactRenderer = memo<ArtifactRendererProps>(({ content, type, height, width, aioTargeting, onAioTarget }) => {
  switch (type) {
    case 'application/lobe.artifacts.react':
    case 'code/react': {
      // For React components, render as a code preview until Sandpack is integrated
      return (
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '6px 12px', background: 'var(--surface-panel)', fontSize: '12px', color: 'var(--text-secondary)' }}>
            React Component Preview
          </div>
          <HTMLRenderer htmlContent={content} height={height} width={width} aioTargeting={aioTargeting} onAioTarget={onAioTarget} />
        </div>
      );
    }
    case 'image/svg+xml':
    case 'media/svg': {
      return <SVGRenderer content={content} height={height} width={width} />;
    }
    case 'application/lobe.artifacts.mermaid':
    case 'media/mermaid': {
      return <MermaidRenderer content={content} />;
    }
    case 'text/markdown':
    case 'document/markdown': {
      return <MarkdownRenderer content={content} height={height} width={width} />;
    }
    case 'document/html': {
      return <HTMLRenderer htmlContent={content} height={height} width={width} aioTargeting={aioTargeting} onAioTarget={onAioTarget} />;
    }
    // Allternit typed renderers (docs/design/artifacts-api.md §2.1, Phase 2):
    // same sandboxed iframe, plus type-specific presentation chrome.
    case 'application/vnd.allternit.deck': {
      return <DeckRenderer htmlContent={content} height={height} width={width} />;
    }
    case 'application/vnd.allternit.mobile': {
      return <MobileRenderer htmlContent={content} height={height} />;
    }
    case 'application/vnd.allternit.prototype': {
      // Hotspot linking is in-document anchor navigation — the standard
      // sandboxed iframe already supports it. The typed case pins the MIME
      // type to a defined renderer instead of the default fallback.
      return <HTMLRenderer htmlContent={content} height={height} width={width} aioTargeting={aioTargeting} onAioTarget={onAioTarget} />;
    }
    default: {
      return <HTMLRenderer htmlContent={content} height={height} width={width} aioTargeting={aioTargeting} onAioTarget={onAioTarget} />;
    }
  }
});

export default ArtifactRenderer;
