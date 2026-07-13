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
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[var(--text-primary)] text-[var(--bg-elevated)] text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  New artifact
                  <CaretDown size={12} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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

function LibraryCard({ item, onClick }: { item: LibraryItem; onClick: () => void }) {
  const src = item.kind === 'image' ? imageSrc(item) : undefined;
  const blobSrc = useAuthBlobUrl(src);
  const textPreview =
    item.kind !== 'image' && item.content && !item.content.startsWith('data:')
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
            <div className="w-full h-full flex items-center justify-center text-[var(--text-tertiary)] opacity-50">
              {KIND_ICON[item.kind] ?? <FileIcon size={28} />}
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
