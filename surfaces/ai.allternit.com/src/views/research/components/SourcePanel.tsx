'use client';

import React, { useCallback, useRef, useEffect, useState } from 'react';
import { FileText, Link, Mail, MessageSquare, Upload, Plus, X, Loader2, Search } from 'lucide-react';
import { notebookApi } from '../hooks/useNotebookApi';
import type { Source } from '../hooks/useNotebookApi';

interface SearchResult {
  source_id: string;
  excerpt: string;
  score: number;
}

interface SourcePanelProps {
  sources: Source[];
  onAddSource: (source: Partial<Source>) => void;
  onRemoveSource: (sourceId: string) => void;
  isUploading?: boolean;
  highlightedSourceId?: string | null;
  notebookId?: string;
  onSearchResultClick?: (sourceId: string) => void;
}

function SourceIcon({ type }: { type: Source['type'] }) {
  const props = { size: 14, color: 'var(--text-muted, #a1a1aa)' };
  switch (type) {
    case 'url': return <Link {...props} />;
    case 'gmail': return <Mail {...props} />;
    case 'slack': return <MessageSquare {...props} />;
    case 'upload': return <FileText {...props} />;
    default: return <FileText {...props} />;
  }
}

export function SourcePanel({
  sources,
  onAddSource,
  onRemoveSource,
  isUploading,
  highlightedSourceId,
  notebookId,
  onSearchResultClick,
}: SourcePanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
      onAddSource({
        type: 'upload',
        title: file.name,
        status: 'pending',
      });
    });
  }, [onAddSource]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim() || !notebookId) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await notebookApi.search(notebookId, query, 8);
      setSearchResults(res.results);
    } catch (err) {
      console.error('Semantic search failed:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [notebookId]);

  const onSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 400);
  }, [performSearch]);

  const handleResultClick = useCallback((sourceId: string) => {
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    onSearchResultClick?.(sourceId);
  }, [onSearchResultClick]);

  const totalTokens = sources.reduce((sum, s) => sum + (s.token_count || 0), 0);

  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  useEffect(() => {
    if (highlightedSourceId && itemRefs.current.has(highlightedSourceId)) {
      const el = itemRefs.current.get(highlightedSourceId);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedSourceId]);

  const sourceMap = new Map(sources.map(s => [s.id, s]));

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="research-panel"
      style={{ width: 260, minWidth: 200, maxWidth: 400, borderRightWidth: 1 }}
    >
      {/* Header */}
      <div className="research-panel-header">
        <div className="flex items-center justify-between">
          <span>Sources</span>
          <button
            onClick={() => setShowSearch(s => !s)}
            className={`bg-transparent border-none cursor-pointer p-1 rounded ${showSearch ? 'text-purple-400' : 'text-[var(--text-muted,#a1a1aa)]'} hover:text-purple-400`}
            title="Semantic search"
          >
            <Search size={14} />
          </button>
        </div>
        <p className="text-[11px] text-[var(--text-muted,#a1a1aa)] mt-1 font-normal">
          {sources.length} sources • {totalTokens.toLocaleString()} tokens
        </p>
      </div>

      {/* Search Input */}
      {showSearch && (
        <div className="px-2.5 pb-2 border-b border-[var(--border-subtle,#27272a)]">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted,#a1a1aa)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Semantic search..."
              className="w-full bg-[var(--bg-tertiary,#18181b)] border border-[var(--border-subtle,#27272a)] rounded-md pl-7 pr-6 py-1.5 text-xs text-[var(--text-primary,#e5e5e5)] placeholder:text-[var(--text-muted,#a1a1aa)] focus:outline-none focus:border-purple-500/50"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-transparent border-none p-0 text-[var(--text-muted,#a1a1aa)] cursor-pointer hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>
          {isSearching && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <Loader2 size={10} className="animate-spin text-purple-400" />
              <span className="text-[10px] text-[var(--text-muted,#a1a1aa)]">Searching...</span>
            </div>
          )}
          {/* Search Results */}
          {!isSearching && searchResults.length > 0 && (
            <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
              {searchResults.map((result, idx) => {
                const source = sourceMap.get(result.source_id);
                return (
                  <button
                    key={`${result.source_id}-${idx}`}
                    onClick={() => handleResultClick(result.source_id)}
                    className="w-full text-left bg-[var(--bg-tertiary,#18181b)] hover:bg-purple-500/10 border border-[var(--border-subtle,#27272a)] rounded-md p-2 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <SourceIcon type={source?.type || 'url'} />
                      <span className="text-[10px] font-medium text-[var(--text-primary,#e5e5e5)] truncate">
                        {source?.title || 'Unknown source'}
                      </span>
                      <span className="text-[9px] text-purple-400/70 ml-auto">
                        {(result.score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--text-muted,#a1a1aa)] line-clamp-2 m-0 leading-relaxed">
                      {result.excerpt}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
          {!isSearching && searchQuery && searchResults.length === 0 && (
            <p className="text-[10px] text-[var(--text-muted,#a1a1aa)] mt-1.5">No matches found</p>
          )}
        </div>
      )}

      {/* Source List */}
      <div className="flex-1 overflow-y-auto px-2.5 py-2">
        {sources.length === 0 ? (
          <div className="text-center p-6 text-[var(--text-muted,#a1a1aa)]">
            <FileText size={24} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs m-0">No sources yet</p>
            <p className="text-[11px] mt-1 opacity-70">Drop files or paste a URL</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {sources.map(source => {
              const isHighlighted = highlightedSourceId === source.id;
              return (
                <div
                  key={source.id}
                  ref={el => {
                    if (el) itemRefs.current.set(source.id, el);
                    else itemRefs.current.delete(source.id);
                  }}
                  className={`research-source-item ${isHighlighted ? 'highlighted' : ''}`}
                >
                  <SourceIcon type={source.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium m-0 text-[var(--text-primary,#e5e5e5)] truncate">
                      {source.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {source.status === 'pending' && (
                        <Loader2 size={10} className="animate-spin text-purple-400" />
                      )}
                      {source.status === 'extracted' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      )}
                      <span className="text-[10px] text-[var(--text-muted,#a1a1aa)]">
                        {source.token_count?.toLocaleString() || '...'} tokens
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveSource(source.id)}
                    className="bg-transparent border-none text-[var(--text-muted,#a1a1aa)] cursor-pointer p-0.5 opacity-50 hover:opacity-100"
                    title="Remove source"
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {isUploading && (
          <div className="flex items-center gap-2 px-2.5 py-2 mt-1">
            <Loader2 size={14} className="animate-spin text-purple-400" />
            <span className="text-[11px] text-[var(--text-muted,#a1a1aa)]">Processing...</span>
          </div>
        )}
      </div>

      {/* Add Source */}
      <div className="px-3 py-2.5 border-t border-[var(--border-subtle,#27272a)]">
        <div className="border border-dashed border-[var(--border-subtle,#27272a)] rounded-md p-2.5 text-center text-[var(--text-muted,#a1a1aa)] text-[11px] mb-2">
          <Upload size={14} className="mx-auto mb-1" />
          Drop files or paste URL
        </div>
        <button
          onClick={() => {
            const url = prompt('Enter URL to add as source:');
            if (url) onAddSource({ type: 'url', title: url, url, status: 'pending' });
          }}
          className="research-btn-secondary w-full"
        >
          <Plus size={12} />
          Add from URL
        </button>
      </div>
    </div>
  );
}
