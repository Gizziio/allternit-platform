/**
 * Allternit Canvas Artifact Renderer
 * Derived from Lobe Chat's artifact renderer (MIT).
 * Reskinned for Allternit with native design tokens.
 */

import React, { memo, useMemo } from 'react';

interface ArtifactRendererProps {
  content: string;
  type?: string;
  height?: string;
  width?: string;
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

function injectSandboxStorageShim(htmlContent: string): string {
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

const HTMLRenderer = memo<{ htmlContent: string; height?: string; width?: string }>(
  ({ htmlContent, width = '100%', height = '360px' }) => (
    <iframe
      sandbox="allow-scripts allow-forms allow-modals"
      srcDoc={injectSandboxStorageShim(htmlContent)}
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: '10px',
        height,
        width,
        background: 'var(--bg-secondary)',
      }}
      title="artifact-html-renderer"
    />
  )
);

const SVGRenderer = memo<{ content: string }>(({ content }) => (
  <div
    style={{
      border: '1px solid var(--border-subtle)',
      borderRadius: '10px',
      padding: 'var(--spacing-md)',
      background: 'var(--bg-secondary)',
      overflow: 'auto',
    }}
    dangerouslySetInnerHTML={{ __html: content }}
  />
));

const MarkdownRenderer = memo<{ content: string }>(({ content }) => {
  // Simple markdown-like renderer for now; can be swapped for react-markdown later
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

  return (
    <div
      style={{
        color: 'var(--text-primary)',
        fontSize: '14px',
        lineHeight: 1.6,
        padding: 'var(--spacing-md)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '10px',
        background: 'var(--bg-secondary)',
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

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

export const ArtifactRenderer = memo<ArtifactRendererProps>(({ content, type, height, width }) => {
  switch (type) {
    case 'application/lobe.artifacts.react':
    case 'code/react': {
      // For React components, render as a code preview until Sandpack is integrated
      return (
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '6px 12px', background: 'var(--surface-panel)', fontSize: '12px', color: 'var(--text-secondary)' }}>
            React Component Preview
          </div>
          <HTMLRenderer htmlContent={content} height={height} width={width} />
        </div>
      );
    }
    case 'image/svg+xml':
    case 'media/svg': {
      return <SVGRenderer content={content} />;
    }
    case 'application/lobe.artifacts.mermaid':
    case 'media/mermaid': {
      return <MermaidRenderer content={content} />;
    }
    case 'text/markdown':
    case 'document/markdown': {
      return <MarkdownRenderer content={content} />;
    }
    case 'document/html': {
      return <HTMLRenderer htmlContent={content} height={height} width={width} />;
    }
    default: {
      return <HTMLRenderer htmlContent={content} height={height} width={width} />;
    }
  }
});

export default ArtifactRenderer;
