"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  Image as ImageIcon,
  FileText,
  Code as CodeIcon,
  File as FileIcon,
  DownloadSimple,
  Copy,
  ArrowSquareOut,
  CaretLeft,
  CaretRight,
  MagnifyingGlassPlus,
} from '@phosphor-icons/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ErrorBoundary } from '@/components/error-boundary';
import { ImageRenderer } from '@/views/canvas/renderers/ImageRenderer';
import { DocumentRenderer } from '@/views/canvas/renderers/DocumentRenderer';
import { CodeRenderer } from '@/views/canvas/renderers/CodeRenderer';
import ArtifactRenderer from '@/components/artifact/ArtifactRenderer';
import type { ArtifactUIPart } from '@/lib/ai/ui-parts.types';
import type { ViewType } from '@/nav/nav.types';
import { useAuthBlobUrl, type LibraryItem } from '@/services/library-api';
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

function FallbackPreview({ item }: { item: LibraryItem }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-4 text-[var(--text-secondary)] p-8">
      <FileIcon size={48} className="text-[var(--text-tertiary)]" />
      <div className="text-sm text-center">
        <div className="text-[var(--text-primary)] font-medium">{item.title}</div>
        <div className="text-xs text-[var(--text-tertiary)] mt-1">No inline preview available for this item.</div>
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

function Preview({ item, zoomed = false }: { item: LibraryItem; zoomed?: boolean }) {
  const imgSrc = item.kind === 'image' ? imageSrc(item) : undefined;
  const authImgSrc = useAuthBlobUrl(imgSrc && imgSrc.startsWith('/api/') ? imgSrc : undefined);

  if (item.kind === 'image') {
    if (!imgSrc) return <FallbackPreview item={item} />;
    // Uploaded images are served from an authenticated /api endpoint; render a
    // fetched blob URL since <img> can't send our auth headers.
    if (imgSrc.startsWith('/api/')) {
      if (!authImgSrc) return <FallbackPreview item={item} />;
      return zoomed ? (
        <div className="h-full w-full overflow-auto bg-black/20">
          <img src={authImgSrc} alt={item.title} className="max-w-none" />
        </div>
      ) : (
        <div className="h-full w-full overflow-hidden flex items-center justify-center bg-black/20">
          <img src={authImgSrc} alt={item.title} className="max-w-full max-h-full object-contain" />
        </div>
      );
    }
    return (
      <div className="h-full w-full overflow-hidden">
        <ImageRenderer artifact={toArtifact(item, 'image')} sessionId={item.session_id} />
      </div>
    );
  }

  if (item.kind === 'document') {
    if (item.content) {
      return (
        <div className="h-full overflow-auto">
          <DocumentRenderer artifact={toArtifact(item, 'document')} sessionId={item.session_id} />
        </div>
      );
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

  // artifact (residual): structured content via the sandboxed renderer,
  // otherwise a link/iframe, otherwise a safe fallback.
  if (item.content) {
    return (
      <div className="h-full overflow-auto p-4">
        <ArtifactRenderer content={item.content} type={inferArtifactType(item.content)} height="100%" width="100%" />
      </div>
    );
  }
  if (item.url) {
    if (/^https?:\/\//i.test(item.url)) {
      return <iframe title={item.title} src={item.url} className="w-full h-full border-0 bg-white" />;
    }
    return <FallbackPreview item={item} />;
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
        className="max-w-6xl w-[95vw] h-[85vh] p-0 gap-0 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <DialogHeader className="flex flex-row items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border-default)] text-left space-y-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[var(--text-secondary)]">{KIND_ICON[item.kind] ?? <FileIcon size={14} />}</span>
            <DialogTitle className="text-sm font-medium text-[var(--text-primary)] truncate">
              {item.title}
            </DialogTitle>
            <Badge variant="secondary">{item.kind}</Badge>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {item.kind === 'image' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoomed((z) => !z)}
                title={zoomed ? 'Fit to view' : 'Zoom to natural size'}
                className={cn(zoomed && 'bg-[var(--border-subtle)] text-[var(--text-primary)]')}
              >
                <MagnifyingGlassPlus size={16} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              disabled={!hasPrev}
              onClick={() => onIndexChange(index - 1)}
              title="Previous (←)"
            >
              <CaretLeft size={16} />
            </Button>
            <span className="text-xs text-[var(--text-tertiary)] min-w-[48px] text-center">
              {index + 1} / {items.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              disabled={!hasNext}
              onClick={() => onIndexChange(index + 1)}
              title="Next (→)"
            >
              <CaretRight size={16} />
            </Button>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          <div className="flex-1 min-w-0 min-h-0 bg-[var(--bg-secondary)]">
            <ErrorBoundary fallback={<FallbackPreview item={item} />}>
              <Preview item={item} zoomed={zoomed} />
            </ErrorBoundary>
          </div>

          {/* Metadata panel */}
          <aside className="w-full md:w-80 flex-shrink-0 border-t md:border-t-0 md:border-l border-[var(--border-default)] p-4 flex flex-col gap-4 overflow-auto">
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

            <div className="mt-auto flex flex-col gap-2 pt-2 border-t border-[var(--border-default)]">
              {item.origin !== 'uploaded' && openView && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => openView('chat-agent-session', { sessionId: item.session_id })}
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
