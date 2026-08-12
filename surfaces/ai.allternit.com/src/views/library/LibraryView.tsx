"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  Images,
  Image as ImageIcon,
  FileText,
  Code as CodeIcon,
  File as FileIcon,
  VideoCamera,
  Globe,
  MagnifyingGlass,
  SquaresFour,
  ArrowsClockwise,
  CaretDown,
  ChatCircleDots,
  ShareNetwork,
} from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { ErrorBoundary } from '@/components/error-boundary';
import { cn } from '@/lib/utils';
import type { ViewType } from '@/nav/nav.types';
import { fetchLibraryItems, useAuthBlobUrl, type LibraryItem } from '@/services/library-api';
import { canvasApi, sessionApi } from '@/lib/agents/native-agent-api';
import { generateMedia, fetchMediaProvidersForMode, type MediaProvider } from '@/services/media-api';
import { LibraryItemDialog } from './LibraryItemDialog';

type FilterId = 'all' | 'image' | 'artifact' | 'document' | 'file';

const FILTERS: { id: FilterId; label: string; kind?: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'image', label: 'Images', kind: 'image' },
  { id: 'artifact', label: 'Artifacts', kind: 'artifact' },
  { id: 'document', label: 'Documents', kind: 'document' },
  { id: 'file', label: 'Files', kind: 'file' },
];

type SortMode = 'newest' | 'oldest' | 'type';

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'type', label: 'Type' },
];

const PAGE_SIZE = 60;

interface LibraryViewProps {
  openView?: (viewType: ViewType, context?: any) => void;
}

function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function imageSrc(item: LibraryItem): string | undefined {
  if (item.url) return item.url;
  if (item.content && item.content.startsWith('data:image')) return item.content;
  return undefined;
}

function createdTime(item: LibraryItem): number {
  const t = new Date(item.created_at).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return mo === 1 ? '1 month ago' : `${mo} months ago`;
  const yr = Math.floor(mo / 12);
  return yr === 1 ? '1 year ago' : `${yr} years ago`;
}

const KIND_ICON: Record<string, React.ReactNode> = {
  image: <ImageIcon size={28} />,
  document: <FileText size={28} />,
  code: <CodeIcon size={28} />,
  artifact: <FileIcon size={28} />,
};

export function LibraryView({ openView }: LibraryViewProps) {
  const [filter, setFilter] = useState<FilterId>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('newest');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [creating, setCreating] = useState(false);

  const activeFilter = FILTERS.find((f) => f.id === filter) ?? FILTERS[0];
  const activeKind = activeFilter.kind;
  const activeSort = SORT_OPTIONS.find((s) => s.id === sort) ?? SORT_OPTIONS[0];

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['library', activeKind ?? 'all', debouncedSearch],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      fetchLibraryItems({
        kind: activeKind,
        search: debouncedSearch || undefined,
        limit: PAGE_SIZE,
        cursor: pageParam,
      }),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });

  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const sortedItems = useMemo(() => {
    const arr = [...items];
    if (sort === 'oldest') {
      arr.sort((a, b) => createdTime(a) - createdTime(b));
    } else if (sort === 'type') {
      arr.sort((a, b) => {
        const k = a.kind.localeCompare(b.kind);
        return k !== 0 ? k : a.title.localeCompare(b.title);
      });
    } else {
      arr.sort((a, b) => createdTime(b) - createdTime(a));
    }
    return arr;
  }, [items, sort]);

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const openItem = (index: number) => {
    setSelectedIndex(index);
    setDialogOpen(true);
  };

  return (
    <div className="h-full w-full flex flex-col bg-[var(--bg-elevated)] text-[var(--text-primary)] overflow-auto">
      <div className="w-full max-w-6xl mx-auto px-8 pt-10 pb-12 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <h1
            className="text-3xl font-medium tracking-tight"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Artifacts Library
          </h1>

          <div className="flex items-center gap-2 flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] text-sm text-[var(--text-secondary)] hover:border-[var(--border-hover)] transition-colors"
                >
                  Filter by <span className="font-medium text-[var(--text-primary)]">{activeFilter.label}</span>
                  <CaretDown size={12} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {FILTERS.map((f) => (
                  <DropdownMenuItem
                    key={f.id}
                    onSelect={() => setFilter(f.id)}
                    className={cn(f.id === filter && 'font-medium')}
                  >
                    {f.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] text-sm text-[var(--text-secondary)] hover:border-[var(--border-hover)] transition-colors"
                >
                  Sort by <span className="font-medium text-[var(--text-primary)]">{activeSort.label}</span>
                  <CaretDown size={12} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {SORT_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.id}
                    onSelect={() => setSort(opt.id)}
                    className={cn(opt.id === sort && 'font-medium')}
                  >
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={creating}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[var(--text-primary)] text-[var(--bg-elevated)] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {creating ? 'Creating…' : 'New artifact'}
                  <CaretDown size={12} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onSelect={async () => {
                    setCreating(true);
                    try {
                      await createArtifact('website');
                      await refetch();
                    } finally {
                      setCreating(false);
                    }
                  }}
                >
                  <Globe size={16} className="mr-2" />
                  Website
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={async () => {
                    setCreating(true);
                    try {
                      await createArtifact('document');
                      await refetch();
                    } finally {
                      setCreating(false);
                    }
                  }}
                >
                  <FileText size={16} className="mr-2" />
                  Document
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={async () => {
                    setCreating(true);
                    try {
                      await createArtifact('sheet');
                      await refetch();
                    } finally {
                      setCreating(false);
                    }
                  }}
                >
                  <SquaresFour size={16} className="mr-2" />
                  Spreadsheet
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={async () => {
                    setCreating(true);
                    try {
                      await createArtifact('slides');
                      await refetch();
                    } finally {
                      setCreating(false);
                    }
                  }}
                >
                  <FileText size={16} className="mr-2" />
                  Slide deck
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={async () => {
                    setCreating(true);
                    try {
                      await createArtifact('image');
                      await refetch();
                    } finally {
                      setCreating(false);
                    }
                  }}
                >
                  <ImageIcon size={16} className="mr-2" />
                  Image
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={async () => {
                    setCreating(true);
                    try {
                      await createArtifact('video');
                      await refetch();
                    } finally {
                      setCreating(false);
                    }
                  }}
                >
                  <VideoCamera size={16} className="mr-2" />
                  Video
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openView?.('chat')}>
                  <ChatCircleDots size={16} className="mr-2" />
                  Create chat artifact
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openView?.('workspace')}>
                  <ShareNetwork size={16} className="mr-2" />
                  Create Cowork artifact
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-6">
          <MagnifyingGlass
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search artifacts…"
            className="pl-10 h-11 rounded-xl border-[var(--border-default)] text-[15px]"
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
          />
        </div>

        {/* Content */}
        <div className="mt-8">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] overflow-hidden">
                  <Skeleton variant="rounded" width="100%" height={150} />
                  <div className="p-4 flex flex-col gap-2">
                    <Skeleton variant="text" width="70%" height={15} />
                    <Skeleton variant="text" width="40%" height={11} />
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-[var(--text-secondary)]">
              <p className="text-sm">Failed to load your artifacts.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <ArrowsClockwise size={14} />
                Retry
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24">
              <Images size={48} className="text-[var(--text-tertiary)] opacity-40" />
              <div className="text-sm text-[var(--text-secondary)]">
                {debouncedSearch ? 'No artifacts match your search.' : 'No artifacts yet.'}
              </div>
              <div className="text-xs text-[var(--text-tertiary)] max-w-sm text-center">
                Generated images, documents and files from your agent sessions will appear here.
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {sortedItems.map((item, i) => (
                  <LibraryCard key={item.id} item={item} onClick={() => openItem(i)} />
                ))}
              </div>

              <div ref={sentinelRef} className="h-8" />

              <div className="flex justify-center py-6">
                {isFetchingNextPage ? (
                  <span className="text-xs text-[var(--text-tertiary)] inline-flex items-center gap-2">
                    <ArrowsClockwise size={14} className="animate-spin" /> Loading more…
                  </span>
                ) : hasNextPage ? (
                  <Button variant="outline" size="sm" onClick={() => fetchNextPage()}>
                    Load more
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>

      <LibraryItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        items={sortedItems}
        index={selectedIndex}
        onIndexChange={setSelectedIndex}
        openView={openView}
      />
    </div>
  );
}

function inferArtifactLabel(item: LibraryItem): string {
  if (item.kind !== 'artifact') return item.kind;
  const url = item.url ?? '';
  const content = item.content ?? '';
  if (/\.(mp4|webm|mov|mkv|ogv)$/i.test(url) || url.includes('pollinations.ai/video')) return 'video';
  if (url.startsWith('website://') || content.trimStart().startsWith('<')) return 'website';
  if (item.title.toLowerCase().includes('slide')) return 'slides';
  if (item.title.toLowerCase().includes('sheet')) return 'sheet';
  return 'artifact';
}

const PLACEHOLDER_ICON: Record<string, React.ReactNode> = {
  image: <ImageIcon size={28} />,
  document: <FileText size={28} />,
  code: <CodeIcon size={28} />,
  artifact: <FileIcon size={28} />,
  video: <VideoCamera size={28} />,
  website: <Globe size={28} />,
  slides: <FileText size={28} />,
  sheet: <FileText size={28} />,
};

function makeTemplateArtifact(
  type: 'website' | 'document' | 'sheet' | 'slides'
): { artifactId: string; kind: string; title: string; content?: string; url?: string } {
  const artifactId = `art-${type}-${Date.now()}`;
  switch (type) {
    case 'website':
      return {
        artifactId,
        kind: 'html',
        title: 'Allternit Website',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Allternit</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0b0b0c; color: #f5f5f5; }
  .hero { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 80px 24px; }
  h1 { font-size: clamp(2.5rem, 6vw, 5rem); font-weight: 700; letter-spacing: -0.04em; margin: 0 0 16px; }
  p { font-size: clamp(1rem, 2vw, 1.25rem); color: #a1a1aa; max-width: 560px; line-height: 1.6; margin: 0 0 32px; }
  .cta { display: inline-flex; align-items: center; gap: 8px; padding: 14px 28px; background: #f5f5f5; color: #0b0b0c; border-radius: 999px; font-weight: 600; text-decoration: none; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; max-width: 960px; margin: 0 auto; padding: 80px 24px; }
  .card { background: #141416; border: 1px solid #27272a; border-radius: 16px; padding: 24px; }
  .card h3 { margin: 0 0 8px; font-size: 1.1rem; }
  .card p { margin: 0; font-size: 0.95rem; color: #a1a1aa; }
</style>
</head>
<body>
  <section class="hero">
    <h1>Create with confidence</h1>
    <p>Websites, documents, slides, sheets, images and video — all in one deterministic workspace.</p>
    <a class="cta" href="#">Start creating</a>
  </section>
  <section class="grid">
    <div class="card"><h3>Websites</h3><p>Self-contained HTML artifacts that preview inline and export cleanly.</p></div>
    <div class="card"><h3>Documents</h3><p>Rich text and markdown artifacts with one-click export.</p></div>
    <div class="card"><h3>Slides</h3><p>Full-viewport slide decks you can present directly from the library.</p></div>
    <div class="card"><h3>Media</h3><p>Images and video generated through your choice of provider.</p></div>
  </section>
</body>
</html>`,
      };
    case 'document':
      return {
        artifactId,
        kind: 'document',
        title: 'Allternit Document',
        content: `# Allternit Document

This is a deterministic document artifact created from the Artifacts Library.

## Capabilities
- Clean inline preview
- One-click download as Markdown or HTML
- Source session tracking for regeneration

## Next steps
Use the **New artifact** menu to create websites, spreadsheets, slide decks, images, and videos with the provider of your choice.`,
      };
    case 'sheet':
      return {
        artifactId,
        kind: 'sheet',
        title: 'Allternit Spreadsheet',
        content: `<div style="padding:16px;font-family:system-ui,sans-serif">
<table style="border-collapse:collapse;width:100%">
<thead><tr style="background:#f4f4f5"><th style="border:1px solid #d4d4d8;padding:10px;text-align:left">Quarter</th><th style="border:1px solid #d4d4d8;padding:10px;text-align:left">Revenue</th><th style="border:1px solid #d4d4d8;padding:10px;text-align:left">Growth</th></tr></thead>
<tbody>
<tr><td style="border:1px solid #d4d4d8;padding:10px">Q1</td><td style="border:1px solid #d4d4d8;padding:10px">$120,000</td><td style="border:1px solid #d4d4d8;padding:10px">12%</td></tr>
<tr style="background:#fafafa"><td style="border:1px solid #d4d4d8;padding:10px">Q2</td><td style="border:1px solid #d4d4d8;padding:10px">$150,000</td><td style="border:1px solid #d4d4d8;padding:10px">25%</td></tr>
<tr><td style="border:1px solid #d4d4d8;padding:10px">Q3</td><td style="border:1px solid #d4d4d8;padding:10px">$180,000</td><td style="border:1px solid #d4d4d8;padding:10px">20%</td></tr>
<tr style="background:#fafafa"><td style="border:1px solid #d4d4d8;padding:10px">Q4</td><td style="border:1px solid #d4d4d8;padding:10px">$210,000</td><td style="border:1px solid #d4d4d8;padding:10px">17%</td></tr>
</tbody>
</table>
</div>`,
      };
    case 'slides':
      return {
        artifactId,
        kind: 'slides',
        title: 'Allternit Slide Deck',
        content: `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #0b0b0c; color: #f5f5f5; }
  .slide { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 48px; box-sizing: border-box; }
  .slide:nth-child(even) { background: #141416; }
  h1 { font-size: clamp(2.5rem, 5vw, 4rem); margin: 0 0 16px; letter-spacing: -0.03em; }
  p { font-size: clamp(1rem, 2vw, 1.35rem); color: #a1a1aa; max-width: 640px; line-height: 1.5; }
</style>
</head>
<body>
  <div class="slide"><h1>Allternit Deck</h1><p>Created deterministically from the Artifacts Library.</p></div>
  <div class="slide"><h1>Beautiful by default</h1><p>Each slide is a full-viewport section you can scroll through and present directly.</p></div>
  <div class="slide"><h1>Export ready</h1><p>Download the HTML or open the source session with one click.</p></div>
</body>
</html>`,
      };
  }
}

function pickProvider(providers: MediaProvider[], preferFree = true): MediaProvider | undefined {
  if (preferFree) {
    const free = providers.find((p) => p.available && p.tier === 'free');
    if (free) return free;
  }
  return providers.find((p) => p.available) ?? providers[0];
}

async function createArtifact(
  type: 'website' | 'document' | 'sheet' | 'slides' | 'image' | 'video'
) {
  const session = await sessionApi.createSession({
    name: `Artifact: ${type}`,
    origin_surface: 'code',
    metadata: { artifact_creation: true, artifact_type: type },
  });

  let component: { type: string; artifactId: string; kind: string; title: string; content?: string; url?: string };

  if (type === 'image' || type === 'video') {
    const providers = await fetchMediaProvidersForMode(type);
    const provider = pickProvider(providers, true);
    if (!provider) {
      throw new Error(`No ${type} provider available. Connect an image/video provider first.`);
    }
    const result = await generateMedia(type, {
      providerID: provider.id,
      prompt: type === 'image'
        ? 'A polished, minimal product illustration for a modern AI creative platform, soft lighting, clean composition'
        : 'Abstract gentle flowing light particles in deep blue and teal, cinematic, seamless loop',
      aspectRatio: '16:9',
      ...(type === 'video' ? { duration: 6, fps: 24 } : {}),
    });
    const artifact = result.artifacts[0];
    if (!artifact || !artifact.url) {
      throw new Error(`${provider.name} did not return a ${type} URL.`);
    }
    component = {
      type: 'artifact',
      artifactId: artifact.id,
      kind: type,
      title: `Allternit ${type === 'image' ? 'Image' : 'Video'}`,
      url: artifact.url,
    };
  } else {
    const template = makeTemplateArtifact(type);
    component = {
      type: 'artifact',
      artifactId: template.artifactId,
      kind: template.kind,
      title: template.title,
      content: template.content,
    };
  }

  await canvasApi.createCanvas(session.id, {
    title: component.title,
    components: [component],
    metadata: { artifactId: component.artifactId, kind: component.kind },
  });

  return component;
}

function LibraryCard({ item, onClick }: { item: LibraryItem; onClick: () => void }) {
  const src = item.kind === 'image' ? imageSrc(item) : undefined;
  const blobSrc = useAuthBlobUrl(src);
  const label = inferArtifactLabel(item);
  const isDocumentLike = item.kind === 'document' || item.kind === 'code';
  const textPreview =
    isDocumentLike && item.content && !item.content.startsWith('data:')
      ? item.content
      : undefined;

  return (
    <ErrorBoundary fallback={null}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'group text-left flex flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] overflow-hidden',
          'transition-all duration-200 hover:border-[var(--border-hover)] hover:shadow-md cursor-pointer'
        )}
      >
        {/* Preview */}
        <div className="relative h-40 overflow-hidden border-b border-[var(--border-subtle)]">
          {blobSrc ? (
            <img src={blobSrc} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
          ) : textPreview ? (
            <div className="w-full h-full px-4 pt-8 pb-2 overflow-hidden select-none pointer-events-none">
              <div className="text-[9px] leading-[1.5] text-[var(--text-secondary)] whitespace-pre-wrap break-words">
                {textPreview.slice(0, 700)}
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[var(--text-tertiary)] opacity-60">
              {PLACEHOLDER_ICON[label] ?? <FileIcon size={28} />}
              <span className="text-[10px] uppercase tracking-wider">{label}</span>
            </div>
          )}

          {/* Kind tag */}
          <span className="absolute top-2.5 left-2.5 inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--bg-tertiary)] text-[11px] font-medium text-[var(--text-secondary)] capitalize">
            {item.kind}
          </span>

          {/* Folded page corner */}
          {!blobSrc && (
            <div
              className="absolute top-0 right-0 w-0 h-0"
              style={{
                borderTop: '14px solid var(--bg-elevated)',
                borderLeft: '14px solid transparent',
                filter: 'drop-shadow(-1px 1px 1px var(--border-default))',
              }}
            />
          )}
        </div>

        {/* Meta */}
        <div className="flex flex-col gap-1 p-4">
          <span className="text-[15px] font-medium text-[var(--text-primary)] leading-snug line-clamp-2">
            {item.title}
          </span>
          <span className="text-[13px] text-[var(--text-tertiary)]">
            Edited {relativeTime(item.created_at)}
          </span>
        </div>
      </button>
    </ErrorBoundary>
  );
}

export default LibraryView;
