"use client";

import React, { useState } from 'react';
import { MagnifyingGlass, X, ArrowSquareOut } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export interface ImageSearchResult {
  url: string;
  thumbnailUrl: string;
  title: string;
  source?: string;
}

export interface ImageSearchToolProps {
  query: string;
  results: ImageSearchResult[];
  className?: string;
}

export function ImageSearchTool({ query, results, className }: ImageSearchToolProps) {
  const [lightbox, setLightbox] = useState<ImageSearchResult | null>(null);

  return (
    <>
      <div className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3 bg-muted/30">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
            <MagnifyingGlass className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium">Image Search</span>
            <span className="ml-2 text-xs text-muted-foreground">"{query}"</span>
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums">{results.length} results</span>
        </div>

        {/* Grid */}
        <div className="p-3 grid grid-cols-3 gap-2">
          {results.map((result, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setLightbox(result)}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border hover:border-primary/40 transition-all"
            >
              <img
                src={result.thumbnailUrl}
                alt={result.title}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end">
                <div className="translate-y-full group-hover:translate-y-0 transition-transform w-full p-1.5 bg-black/60">
                  <p className="text-[9px] text-white line-clamp-1">{result.title}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-w-2xl w-full"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={lightbox.url}
              alt={lightbox.title}
              className="w-full rounded-lg max-h-[70vh] object-contain bg-black"
            />
            <div className="flex items-center justify-between mt-2">
              <div>
                <p className="text-sm text-white font-medium">{lightbox.title}</p>
                {lightbox.source && <p className="text-xs text-white/60">{lightbox.source}</p>}
              </div>
              <a
                href={lightbox.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition-colors"
              >
                <ArrowSquareOut className="h-3 w-3" />
                Open
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
