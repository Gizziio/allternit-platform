"use client";

import React from 'react';
import { GitBranch, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BranchIndicatorProps {
  siblingCount: number;
  currentIndex: number;
  onNavigate: (direction: 'prev' | 'next') => void;
  className?: string;
}

const THEME = {
  textMuted: '#6B6B6B',
  textSecondary: '#9B9B9B',
  accent: '#D4956A',
  hoverBg: 'rgba(255,255,255,0.05)',
};

/**
 * Shows branch navigation when a message has multiple alternatives
 * Displays "3 alternatives" and prev/next buttons
 */
export function BranchIndicator({
  siblingCount,
  currentIndex,
  onNavigate,
  className,
}: BranchIndicatorProps) {
  if (siblingCount <= 1) return null;

  return (
    <div
      className={cn("flex items-center gap-1", className)}
      style={{
        padding: '2px 8px',
        borderRadius: 6,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <GitBranch size={12} style={{ color: THEME.accent }} />
      
      <span
        style={{
          fontSize: 11,
          color: THEME.textSecondary,
          marginLeft: 4,
          marginRight: 8,
        }}
      >
        {siblingCount} {siblingCount === 1 ? 'alternative' : 'alternatives'}
      </span>

      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate('prev');
          }}
          disabled={currentIndex === 0}
          style={{
            width: 20,
            height: 20,
            borderRadius: 4,
            border: 'none',
            background: 'transparent',
            cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: currentIndex === 0 ? 0.3 : 1,
            color: THEME.textSecondary,
          }}
          onMouseEnter={(e) => {
            if (currentIndex > 0) {
              e.currentTarget.style.background = THEME.hoverBg;
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <ChevronLeft size={14} />
        </button>

        <span
          style={{
            fontSize: 11,
            color: THEME.textMuted,
            minWidth: 30,
            textAlign: 'center',
          }}
        >
          {currentIndex + 1} / {siblingCount}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate('next');
          }}
          disabled={currentIndex === siblingCount - 1}
          style={{
            width: 20,
            height: 20,
            borderRadius: 4,
            border: 'none',
            background: 'transparent',
            cursor: currentIndex === siblingCount - 1 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: currentIndex === siblingCount - 1 ? 0.3 : 1,
            color: THEME.textSecondary,
          }}
          onMouseEnter={(e) => {
            if (currentIndex < siblingCount - 1) {
              e.currentTarget.style.background = THEME.hoverBg;
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
