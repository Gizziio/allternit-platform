"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  Images,
  Image as ImageIcon,
  FileText,
  Code as CodeIcon,
  File as FileIcon,
  MagnifyingGlass,
  SquaresFour,
  ArrowsClockwise,
  ArrowsDownUp,
} from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBoundary } from '@/components/error-boundary';
import { cn } from '@/lib/utils';
import type { ViewType } from '@/nav/nav.types';
import { fetchLibraryItems, useAuthBlobUrl, type LibraryItem } from '@/services/library-api';
import { LibraryItemDialog } from './LibraryItemDialog';

type TabId = 'all' | 'image' | 'artifact' | 'document' | 'file';

const TABS: { id: TabId; label: string; kind?: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All', icon: <SquaresFour size={14} /> },
  { id: 'image', label: 'Images', kind: 'image', icon: <ImageIcon size={14} /> },
  { id: 'artifact', label: 'Artifacts', kind: 'artifact', icon: <SquaresFour size={14} /> },
  { id: 'document', label: 'Documents', kind: 'document', icon: <FileText size={14} /> },
  { id: 'file', label: 'Files', kind: 'file', icon: <FileIcon size={14} /> },
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
  return new Date(iso).toLocaleDateString();
}

function shortId(id: string): string {
  if (!id) return '';
  return id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

const KIND_ICON: Record<string, React.ReactNode> = {
  image: <ImageIcon size={28} />,
  document: <FileText size={28} />,
  code: <CodeIcon size={28} />,
  artifact: <FileIcon size={28} />,
};

export function LibraryView({ openView }: LibraryViewProps) {
  const [tab, setTab] = useState<TabId>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('newest');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const activeKind = TABS.find((t) => t.id === tab)?.kind;

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
  const total = data?.pages?.[0]?.total ?? 0;

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
    <div className="h-full w-full flex flex-col bg-[var(--bg-primary)] text-white">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/[0.08] px-6 py-5">
        <div className="flex items-center gap-3">
          <Images size={24} className="text-[var(--accent-primary)]" />
          <h1 className="text-xl font-semibold text-white/90">Library</h1>
          {!isLoading && (
            <span className="text-sm text-white/40">{total} {total === 1 ? 'item' : 'items'}</span>
          )}
        </div>
        <p className="text-xs text-white/40 mt-1">
          Generated images, documents and files from your sessions, in one place.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1.5 flex-wrap">
            {TABS.map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-150',
                  tab === t.id
                    ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]/30'
                    : 'text-white/45 hover:text-white/75 hover:bg-white/[0.05]'
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="inline-flex items-center gap-0.5 rounded-full border border-white/[0.08] bg-white/[0.03] p-0.5 flex-shrink-0">
              <ArrowsDownUp size={14} className="text-white/40 ml-1.5 mr-0.5" />
              {SORT_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setSort(opt.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150',
                    sort === opt.id
                      ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]/30'
                      : 'text-white/45 hover:text-white/75 hover:bg-white/[0.05]'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 sm:flex-none sm:w-72">
              <MagnifyingGlass
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search library…"
                className="pl-8 h-9"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-5">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
                <Skeleton variant="rounded" width="100%" height={140} />
                <div className="p-3 flex flex-col gap-2">
                  <Skeleton variant="text" width="70%" height={14} />
                  <Skeleton variant="text" width="40%" height={10} />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-white/50">
            <p className="text-sm">Failed to load your library.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <ArrowsClockwise size={14} />
              Retry
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-white/40">
            <Images size={48} className="text-white/15" />
            <div className="text-sm text-white/60">
              {debouncedSearch ? 'No items match your search.' : 'Your library is empty.'}
            </div>
            <div className="text-xs text-white/35 max-w-sm text-center">
              Generated images, documents and files from your agent sessions will appear here.
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {sortedItems.map((item, i) => (
                <LibraryCard key={item.id} item={item} onClick={() => openItem(i)} />
              ))}
            </div>

            <div ref={sentinelRef} className="h-8" />

            <div className="flex justify-center py-6">
              {isFetchingNextPage ? (
                <span className="text-xs text-white/40 inline-flex items-center gap-2">
                  <ArrowsClockwise size={14} className="animate-spin" /> Loading more…
                </span>
              ) : hasNextPage ? (
                <Button variant="outline" size="sm" onClick={() => fetchNextPage()}>
                  Load more
                </Button>
              ) : items.length > 0 ? (
                <span className="text-xs text-white/25">You’ve reached the end.</span>
              ) : null}
            </div>
          </>
        )}
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

function LibraryCard({ item, onClick }: { item: LibraryItem; onClick: () => void }) {
  const src = item.kind === 'image' ? imageSrc(item) : undefined;
  const blobSrc = useAuthBlobUrl(src);
  return (
    <ErrorBoundary fallback={null}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'group text-left flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden',
          'transition-all duration-200 hover:border-white/[0.14] hover:bg-white/[0.05] cursor-pointer'
        )}
      >
        <div className="relative h-36 bg-zinc-900/60 overflow-hidden flex items-center justify-center">
          {blobSrc ? (
            <img src={blobSrc} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="text-white/15">{KIND_ICON[item.kind] ?? <FileIcon size={28} />}</div>
          )}
          <span className="absolute top-2 right-2">
            <Badge variant="secondary">{item.kind}</Badge>
          </span>
        </div>
        <div className="flex flex-col gap-1.5 p-3">
          <span className="text-sm font-medium text-white/85 leading-tight line-clamp-2">
            {item.title}
          </span>
          <div className="flex items-center justify-between gap-2 text-[11px] text-white/35">
            <span>{relativeTime(item.created_at)}</span>
            <span className="font-mono truncate" title={item.session_id}>
              {shortId(item.session_id)}
            </span>
          </div>
        </div>
      </button>
    </ErrorBoundary>
  );
}

export default LibraryView;
