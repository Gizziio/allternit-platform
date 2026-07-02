'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CaretUp, CaretDown, X, MagnifyingGlass } from '@phosphor-icons/react';

interface FindInPageOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function FindInPageOverlay({ open, onClose }: FindInPageOverlayProps): React.ReactNode | null {
  const [text, setText] = useState('');
  const [result, setResult] = useState<{ activeMatchOrdinal: number; matches: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when overlay opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      // Stop search and clear selection when closed
      if (window.allternit?.findInPage) {
        window.allternit.findInPage.stop(false).catch(() => {});
      }
      setText('');
      setResult(null);
    }
  }, [open]);

  // Subscribe to find results from Electron main process
  useEffect(() => {
    if (!open || !window.allternit?.findInPage) return;
    
    const unsubscribe = window.allternit.findInPage.onResult((res: { activeMatchOrdinal: number; matches: number }) => {
      setResult({
        activeMatchOrdinal: res.activeMatchOrdinal,
        matches: res.matches,
      });
    });

    return () => {
      unsubscribe();
    };
  }, [open]);

  // Perform search when text changes
  const handleSearch = (val: string) => {
    setText(val);
    if (!window.allternit?.findInPage) return;
    if (val.trim()) {
      window.allternit.findInPage.search(val).catch(() => {});
    } else {
      window.allternit.findInPage.stop(false).catch(() => {});
      setResult(null);
    }
  };

  const handleNext = () => {
    if (window.allternit?.findInPage && text) {
      window.allternit.findInPage.next().catch(() => {});
    }
  };

  const handlePrevious = () => {
    if (window.allternit?.findInPage && text) {
      window.allternit.findInPage.previous().catch(() => {});
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        handlePrevious();
      } else {
        handleNext();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed top-16 right-6 z-[600] flex items-center gap-2 p-[6px_10px] rounded-lg bg-[var(--shell-menu-bg,#1a1a1a)] border border-solid border-[var(--shell-menu-border,rgba(255,255,255,0.1))] shadow-[0_12px_32px_rgba(0,0,0,0.4)] animate-in fade-in slide-in-from-top-2 duration-150">
      <MagnifyingGlass size={14} className="text-[var(--text-tertiary)] shrink-0 ml-1" />
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => handleSearch(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find in page..."
        className="w-48 bg-transparent border-none outline-none text-[13px] text-[var(--text-primary)] font-inherit placeholder-[var(--text-tertiary)]"
      />
      {text && result && (
        <span className="text-[11px] text-[var(--text-tertiary)] font-medium select-none shrink-0 px-1">
          {result.matches > 0
            ? `${result.activeMatchOrdinal} of ${result.matches}`
            : '0 of 0'}
        </span>
      )}
      <div className="w-[1px] h-4 bg-[var(--shell-menu-border,rgba(255,255,255,0.08))]" />
      <button
        type="button"
        disabled={!text}
        onClick={handlePrevious}
        className="p-1 rounded bg-transparent border-none text-[var(--text-secondary)] hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer shrink-0 transition-colors"
        title="Previous match (Shift+Enter)"
      >
        <CaretUp size={14} weight="bold" />
      </button>
      <button
        type="button"
        disabled={!text}
        onClick={handleNext}
        className="p-1 rounded bg-transparent border-none text-[var(--text-secondary)] hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer shrink-0 transition-colors"
        title="Next match (Enter)"
      >
        <CaretDown size={14} weight="bold" />
      </button>
      <button
        type="button"
        onClick={onClose}
        className="p-1 rounded bg-transparent border-none text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-white/5 cursor-pointer shrink-0 transition-colors"
        title="Close (Esc)"
      >
        <X size={14} weight="bold" />
      </button>
    </div>
  );
}
