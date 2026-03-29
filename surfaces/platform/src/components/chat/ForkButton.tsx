"use client";

import React, { useState } from 'react';
import { GitBranch, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ForkButtonProps {
  onFork: () => Promise<void> | void;
  className?: string;
  showLabel?: boolean;
  disabled?: boolean;
}

const THEME = {
  textMuted: '#6B6B6B',
  textSecondary: '#9B9B9B',
  accent: '#D4956A',
  hoverBg: 'rgba(255,255,255,0.08)',
  success: '#22c55e',
};

/**
 * Fork button for creating conversation branches
 * Shows on message hover
 */
export function ForkButton({
  onFork,
  className,
  showLabel = false,
  disabled = false,
}: ForkButtonProps) {
  const [isForking, setIsForking] = useState(false);
  const [isForked, setIsForked] = useState(false);

  const handleFork = async () => {
    if (isForking || isForked) return;

    setIsForking(true);
    try {
      await onFork();
      setIsForked(true);
      setTimeout(() => setIsForked(false), 2000);
    } finally {
      setIsForking(false);
    }
  };

  return (
    <button
      onClick={handleFork}
      disabled={disabled || isForking || isForked}
      aria-label={isForking ? 'Forking conversation...' : isForked ? 'Forked!' : 'Fork conversation from here'}
      aria-busy={isForking}
      className={cn(
        "flex items-center gap-1.5 transition-colors duration-200",
        className
      )}
      style={{
        padding: showLabel ? '4px 10px' : '6px',
        borderRadius: 6,
        border: 'none',
        background: isForked 
          ? 'rgba(34,197,94,0.1)' 
          : 'transparent',
        cursor: isForking || isForked ? 'default' : 'pointer',
        color: isForked 
          ? THEME.success 
          : isForking 
            ? THEME.accent 
            : THEME.textMuted,
        fontSize: 12,
      }}
      onMouseEnter={(e) => {
        if (!isForking && !isForked) {
          e.currentTarget.style.background = THEME.hoverBg;
          e.currentTarget.style.color = THEME.accent;
        }
      }}
      onMouseLeave={(e) => {
        if (!isForked) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = THEME.textMuted;
        }
      }}
      title="Fork conversation from here"
    >
      {isForking ? (
        <Loader2 size={14} className="motion-safe:animate-spin" aria-hidden="true" />
      ) : isForked ? (
        <Check size={14} aria-hidden="true" />
      ) : (
        <GitBranch size={14} aria-hidden="true" />
      )}
      
      {showLabel && (
        <span>
          {isForking ? 'Forking...' : isForked ? 'Forked!' : 'Fork'}
        </span>
      )}
    </button>
  );
}

interface MessageActionsProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Container for message action buttons (fork, edit, delete, etc.)
 * Shows on message hover
 */
export function MessageActions({ children, className }: MessageActionsProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        borderRadius: 8,
        background: 'rgba(43,37,32,0.95)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}
    >
      {children}
    </div>
  );
}
