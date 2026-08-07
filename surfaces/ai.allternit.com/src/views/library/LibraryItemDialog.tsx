"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  Image as ImageIcon,
  FileText,
  Code as CodeIcon,
  File as FileIcon,
  VideoCamera,
  Globe,
  DownloadSimple,
  Copy,
  ArrowSquareOut,
  CaretLeft,
  CaretRight,
  MagnifyingGlassPlus,
  X,
} from '@phosphor-icons/react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/error-boundary';
import { DocumentRenderer } from '@/views/canvas/renderers/DocumentRenderer';
import { CodeRenderer } from '@/views/canvas/renderers/CodeRenderer';
import ArtifactRenderer, { injectSandboxStorageShim } from '@/components/artifact/ArtifactRenderer';
import ReactMarkdown from 'react-markdown';
import type { ArtifactUIPart } from '@/lib/ai/ui-parts.types';
import type { ViewType } from '@/nav/nav.types';
import { useAuthBlobUrl, type LibraryItem } from '@/services/library-api';
import { useChatSessionStore } from '@/views/chat/ChatSessionStore';
import { useCodeSessionStore } from '@/views/code/CodeSessionStore';
import { useCoworkSessionStore } from '@/views/cowork/CoworkSessionStore';
import { useDesignSessionStore } from '@/views/design/DesignSessionStore';
import { cn } from '@/lib/utils';

interface LibraryItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: LibraryItem[];
  index: number;
  onIndexChange: (index: number) => void;
  openView?: (viewType: ViewType, context?: any) => void;
}

function imageSrc(item: LibraryItem): string | undefined {
  if (item.url) return item.url;
  if (item.content && item.content.startsWith('data:image')) return item.content;
  return undefined;
}

function inferArtifactType(content: string): string {
  const trimmed = content.trimStart();
  if (trimmed.startsWith('<svg')) return 'image/svg+xml';
  if (trimmed.startsWith('<')) return 'document/html';
  return 'text/markdown';
}

function toArtifact(item: LibraryItem, kind: ArtifactUIPart['kind']): ArtifactUIPart {
  const url = item.kind === 'image' ? imageSrc(item) : item.url;
  return {
    type: 'artifact',
    artifactId: item.id,
    kind,
    url,
    content: item.content,
    title: item.title,
  };
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

function shortId(id: string): string {
  if (!id) return '';
  return id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // ignore
  }
}

type SessionSurface = 'chat' | 'code' | 'cowork' | 'design';

function resolveSessionSurface(sessionId: string): SessionSurface {
  if (useChatSessionStore.getState().sessions.some((s) => s.id === sessionId)) return 'chat';
  if (useCodeSessionStore.getState().sessions.some((s) => s.id === sessionId)) return 'code';
  if (useCoworkSessionStore.getState().sessions.some((s) => s.id === sessionId)) return 'cowork';
  if (useDesignSessionStore.getState().sessions.some((s) => s.id === sessionId)) return 'design';
  return 'chat';
}

const SURFACE_DEFAULT_VIEW: Record<SessionSurface, ViewType> = {
  chat: 'chat',
  code: 'code',
  cowork: 'workspace',
  design: 'design',
};

async function downloadItem(item: LibraryItem) {
  let href = item.url;
  let revoke: string | undefined;

  if (href && href.startsWith('/api/')) {
    // Authenticated raw file: fetch with credentials, then download the blob.
    try {
      const res = await fetch(href, { credentials: 'include' });
      if (!res.ok) return;
      const blob = await res.blob();
      href = URL.createObjectURL(blob);
      revoke = href;
    } catch {
      return;
    }
  } else if (!href && item.content) {
    const mime =
      item.kind === 'image'
        ? 'image/png'
        : item.kind === 'code'
          ? 'text/html'
          : 'text/plain';
    const blob = new Blob([item.content], { type: mime });
    href = URL.createObjectURL(blob);
    revoke = href;
  }
  if (!href) return;
  const a = document.createElement('a');
  a.href = href;
  a.download = (item.title || 'download').replace(/[^\w.-]+/g, '_');
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revoke) setTimeout(() => URL.revokeObjectURL(revoke!), 1000);
}

function isVideoUrl(url?: string): boolean {
  if (!url) return false;
  return /\.(mp4|webm|mov|mkv|ogv)$/i.test(url) || url.includes('pollinations.ai/video');
}

function isHtmlContent(content?: string): boolean {
  if (!content) return false;
  return content.trimStart().startsWith('<');
}

function FallbackPreview({ item }: { item: LibraryItem }) {
  const isVideo = isVideoUrl(item.url) || isVideoUrl(item.content);
  const isWebsite = isHtmlContent(item.content) || item.url?.startsWith('website://');
  const label = isVideo ? 'video' : isWebsite ? 'website' : item.kind;
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-4 text-[var(--text-secondary)] p-8 bg-[var(--bg-secondary)] rounded-lg">
      {isVideo ? (
        <VideoCamera size={48} className="text-[var(--text-tertiary)]" />
      ) : isWebsite ? (
        <Globe size={48} className="text-[var(--text-tertiary)]" />
      ) : (
        <FileIcon size={48} className="text-[var(--text-tertiary)]" />
      )}
      <div className="text-sm text-center">
        <div className="text-[var(--text-primary)] font-medium">{item.title}</div>
        <div className="text-xs text-[var(--text-tertiary)] mt-1">
          No inline preview available for this {label}.
        </div>
      </div>
      {(item.url || item.content) && (
        <Button variant="outline" size="sm" onClick={() => downloadItem(item)}>
          <DownloadSimple size={14} />
          Download
        </Button>
      )}
    </div>
  );
}

function SimpleImagePreview({ item, zoomed }: { item: LibraryItem; zoomed: boolean }) {
  const imgSrc = imageSrc(item);
  const authSrc = useAuthBlobUrl(imgSrc && imgSrc.startsWith('/api/') ? imgSrc : undefined);
  const src = imgSrc?.startsWith('/api/') ? authSrc : imgSrc;

  if (!src) return <FallbackPreview item={item} />;
  return zoomed ? (
    <div className="h-full w-full overflow-auto bg-[var(--bg-secondary)] flex items-start justify-start p-4">
      <img src={src} alt={item.title} className="max-w-none shadow-lg rounded-lg" />
    </div>
  ) : (
    <div className="h-full w-full flex items-start justify-center bg-[var(--bg-secondary)] p-4">
      <img
        src={src}
        alt={item.title}
        className="max-w-full max-h-full object-contain shadow-lg rounded-lg"
      />
    </div>
  );
}

function VideoPreview({ item }: { item: LibraryItem }) {
  const src = item.url || item.content;
  if (!src || isHtmlContent(src)) return <FallbackPreview item={item} />;
  return (
    <div className="h-full w-full flex items-start justify-center bg-[#0f0f10] rounded-lg p-4">
      <video
        controls
        src={src}
        className="max-w-full max-h-full rounded-lg shadow-lg"
        preload="metadata"
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
}

function WebsitePreview({ item }: { item: LibraryItem }) {
  const html = item.content || '';
  const url = item.url && /^https?:\/\//i.test(item.url) ? item.url : undefined;
  const srcDoc = url ? undefined : injectSandboxStorageShim(html);
  const iframeSrc = url || undefined;

  return (
    <div className="h-full w-full flex flex-col rounded-lg overflow-hidden border border-[var(--border-default)] bg-white shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-default)] bg-[var(--bg-elevated)]">
        <Globe size={14} className="text-[var(--text-tertiary)]" />
        <span className="text-xs text-[var(--text-secondary)] truncate flex-1">
          {url || 'Local HTML preview'}
        </span>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            <ArrowSquareOut size={14} />
          </a>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <iframe
          sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
          src={iframeSrc}
          srcDoc={srcDoc}
          className="w-full h-full border-0 bg-white"
          title={item.title}
        />
      </div>
    </div>
  );
}

function DocumentMarkdownPreview({ content }: { content: string }) {
  return (
    <div className="h-full w-full overflow-auto bg-white p-4">
      <article className="max-w-3xl mx-auto" style={{ color: 'var(--text-primary)' }}>
        <ReactMarkdown
          components={{
            h1: ({ children }) => <h1 className="text-2xl font-semibold tracking-tight mb-4 mt-0">{children}</h1>,
            h2: ({ children }) => <h2 className="text-xl font-semibold tracking-tight mb-3 mt-6">{children}</h2>,
            h3: ({ children }) => <h3 className="text-lg font-semibold tracking-tight mb-2 mt-5">{children}</h3>,
            p: ({ children }) => <p className="text-[15px] leading-relaxed mb-4 text-[var(--text-secondary)]">{children}</p>,
            ul: ({ children }) => <ul className="list-disc pl-5 mb-4 text-[var(--text-secondary)]">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-5 mb-4 text-[var(--text-secondary)]">{children}</ol>,
            li: ({ children }) => <li className="mb-1 text-[15px] leading-relaxed">{children}</li>,
            strong: ({ children }) => <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>,
            a: ({ children, href }) => (
              <a href={href} className="text-[var(--accent-primary)] underline hover:opacity-80" target="_blank" rel="noreferrer">
                {children}
              </a>
            ),
            code: ({ children }) => <code className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[13px] font-mono">{children}</code>,
            pre: ({ children }) => <pre className="p-4 rounded-lg bg-[var(--bg-secondary)] overflow-auto text-[13px] font-mono mb-4">{children}</pre>,
            hr: () => <hr className="border-[var(--border-default)] my-6" />,
            blockquote: ({ children }) => <blockquote className="border-l-4 border-[var(--border-default)] pl-4 italic text-[var(--text-tertiary)] mb-4">{children}</blockquote>,
          }}
        >
          {content}
        </ReactMarkdown>
      </article>
    </div>
  );
}

function Preview({ item, zoomed = false }: { item: LibraryItem; zoomed?: boolean }) {
  if (item.kind === 'image') {
    return <SimpleImagePreview item={item} zoomed={zoomed} />;
  }

  if (item.kind === 'document') {
    if (item.content) {
      // Prefer a lightweight markdown/HTML reader for the library overlay.
      // The full editor can be opened from the source session.
      if (isHtmlContent(item.content)) {
        return <WebsitePreview item={item} />;
      }
      return <DocumentMarkdownPreview content={item.content} />;
    }
    if (item.url && !item.url.startsWith('/api/')) {
      return <iframe title={item.title} src={item.url} className="w-full h-full border-0 bg-white" />;
    }
    return <FallbackPreview item={item} />;
  }

  if (item.kind === 'code') {
    if (item.content) {
      return (
        <div className="h-full overflow-auto">
          <CodeRenderer artifact={toArtifact(item, 'html')} sessionId={item.session_id} />
        </div>
      );
    }
    return <FallbackPreview item={item} />;
  }

  // Residual artifact bucket: websites (HTML), videos, slides, sheets, etc.
  if (isHtmlContent(item.content)) {
    return <WebsitePreview item={item} />;
  }
  if (isVideoUrl(item.url) || isVideoUrl(item.content)) {
    return <VideoPreview item={item} />;
  }
  if (item.content) {
    return (
      <div className="h-full overflow-auto p-4">
        <ArtifactRenderer content={item.content} type={inferArtifactType(item.content)} height="100%" width="100%" />
      </div>
    );
  }
  if (item.url && /^https?:\/\//i.test(item.url)) {
    return <iframe title={item.title} src={item.url} className="w-full h-full border-0 bg-white" />;
  }
  return <FallbackPreview item={item} />;
}

const KIND_ICON: Record<string, React.ReactNode> = {
  image: <ImageIcon size={14} />,
  document: <FileText size={14} />,
  code: <CodeIcon size={14} />,
  artifact: <FileIcon size={14} />,
};

export function LibraryItemDialog({
  open,
  onOpenChange,
  items,
  index,
  onIndexChange,
  openView,
}: LibraryItemDialogProps) {
  const [zoomed, setZoomed] = useState(false);
  const item = items[index];
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (target as any)?.isContentEditable) return;
      if (e.key === 'ArrowRight' && hasNext) {
        e.preventDefault();
        onIndexChange(index + 1);
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        e.preventDefault();
        onIndexChange(index - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index, hasPrev, hasNext, onIndexChange]);

  useEffect(() => {
    setZoomed(false);
  }, [item?.id]);

  const meta = useMemo(() => {
    if (!item) return null;
    return {
      created: item.created_at ? new Date(item.created_at).toLocaleString() : '—',
    };
  }, [item]);

  if (!item) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className={cn(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 grid !w-[96vw] !max-w-6xl !h-[76vh] !max-h-[680px]',
          '!p-0 !gap-0 overflow-hidden flex flex-col !rounded-2xl shadow-2xl',
          '!bg-[var(--bg-elevated)] !text-[var(--text-primary)] !border-[var(--border-default)]'
        )}
      >
        {/* Header */}
        <DialogHeader className="!flex-row !items-center justify-between gap-3 px-4 py-2 border-b border-[var(--border-default)] bg-[var(--bg-elevated)] !text-left !space-y-0 flex-shrink-0 h-12">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[var(--text-secondary)] flex-shrink-0">{KIND_ICON[item.kind] ?? <FileIcon size={16} />}</span>
            <div className="flex flex-col min-w-0 leading-none">
              <DialogTitle className="!text-[15px] !font-semibold text-[var(--text-primary)] truncate">
                {item.title}
              </DialogTitle>
              <span className="text-[11px] text-[var(--text-tertiary)] capitalize mt-0.5">{item.kind}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {item.kind === 'image' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoomed((z) => !z)}
                title={zoomed ? 'Fit to view' : 'Zoom to natural size'}
                className={cn(zoomed && 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]')}
              >
                <MagnifyingGlassPlus size={18} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              disabled={!hasPrev}
              onClick={() => onIndexChange(index - 1)}
              title="Previous (←)"
            >
              <CaretLeft size={18} />
            </Button>
            <span className="text-xs text-[var(--text-tertiary)] min-w-[52px] text-center tabular-nums">
              {index + 1} / {items.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              disabled={!hasNext}
              onClick={() => onIndexChange(index + 1)}
              title="Next (→)"
            >
              <CaretRight size={18} />
            </Button>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" title="Close (Esc)" className="ml-1">
                <X size={18} />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Preview */}
          <div className="flex-1 min-w-0 min-h-0 bg-[var(--bg-secondary)] overflow-auto">
            <ErrorBoundary fallback={<FallbackPreview item={item} />}>
              <Preview item={item} zoomed={zoomed} />
            </ErrorBoundary>
          </div>

          {/* Metadata panel */}
          <aside className="w-full md:w-60 flex-shrink-0 border-t md:border-t-0 md:border-l border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 flex flex-col gap-3 overflow-auto">
            <div className="flex flex-col gap-3.5">
              <MetaRow label="Title" value={item.title} />
              <MetaRow label="Kind" value={item.kind} />
              <MetaRow label="Origin" value={item.origin} />
              <MetaRow
                label="Created"
                value={`${relativeTime(item.created_at)}${meta?.created ? ` · ${meta.created}` : ''}`}
              />
              {item.origin === 'uploaded' ? (
                <MetaRow label="Provenance" value="Uploaded file" />
              ) : (
                <>
                  <MetaRow label="Source session" value={item.session_id} mono copyable />
                  <MetaRow label="Canvas" value={shortId(item.canvas_id)} mono />
                </>
              )}
            </div>

            <div className="mt-auto flex flex-col gap-2 pt-4 border-t border-[var(--border-default)]">
              {item.origin !== 'uploaded' && openView && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    const surface = resolveSessionSurface(item.session_id);
                    openView(`${surface}-agent-session`, {
                      sessionId: item.session_id,
                      originView: SURFACE_DEFAULT_VIEW[surface],
                    });
                  }}
                >
                  <ArrowSquareOut size={14} />
                  Open source
                </Button>
              )}
              {item.origin !== 'uploaded' && (
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(item.session_id)}>
                  <Copy size={14} />
                  Copy session id
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={!item.url && !item.content}
                onClick={() => downloadItem(item)}
              >
                <DownloadSimple size={14} />
                Download
              </Button>
              {item.url && (
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(item.url!)}>
                  <Copy size={14} />
                  Copy link
                </Button>
              )}
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetaRow({
  label,
  value,
  mono,
  copyable,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={cn(
            'text-sm text-[var(--text-primary)] break-all',
            mono && 'font-mono text-xs text-[var(--text-secondary)]'
          )}
          title={value}
        >
          {value || '—'}
        </span>
        {copyable && value && (
          <button
            type="button"
            onClick={() => copyToClipboard(value)}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] flex-shrink-0"
            title="Copy"
          >
            <Copy size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

export default LibraryItemDialog;
