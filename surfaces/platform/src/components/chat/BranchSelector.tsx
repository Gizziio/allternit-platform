"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GitBranch, ChevronDown, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BranchOption {
  id: string;
  label: string;
  preview: string;
  timestamp: number;
  isActive?: boolean;
}

interface BranchSelectorProps {
  branches: BranchOption[];
  currentBranchId: string;
  onBranchSelect: (branchId: string) => void;
  className?: string;
}

const THEME = {
  textPrimary: '#ECECEC',
  textSecondary: '#9B9B9B',
  textMuted: '#6B6B6B',
  accent: '#D4956A',
  bg: '#2B2520',
  menuBg: '#332D27',
  hoverBg: 'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.08)',
};

/**
 * Dropdown selector for switching between conversation branches
 */
export function BranchSelector({
  branches,
  currentBranchId,
  onBranchSelect,
  className,
}: BranchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentBranch = branches.find((b) => b.id === currentBranchId);

  const close = useCallback(() => setIsOpen(false), []);

  // Close on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        close();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [close]);

  if (branches.length <= 1) return null;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderRadius: 8,
          border: `1px solid ${THEME.border}`,
          background: THEME.menuBg,
          color: THEME.textSecondary,
          fontSize: 13,
          cursor: 'pointer',
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = THEME.border;
        }}
      >
        <GitBranch size={14} style={{ color: THEME.accent }} aria-hidden="true" />
        <span>
          {branches.length} {branches.length === 1 ? 'branch' : 'branches'}
        </span>
        <ChevronDown
          size={14}
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
          }}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 320,
            maxHeight: 400,
            overflow: 'auto',
            background: THEME.menuBg,
            border: `1px solid ${THEME.border}`,
            borderRadius: 12,
            boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
            zIndex: 100,
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${THEME.border}`,
            }}
          >
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: THEME.textSecondary,
                textTransform: 'uppercase',
                margin: 0,
              }}
            >
              Conversation Branches
            </p>
          </div>

          {/* Branch list */}
          <div style={{ padding: '8px' }}>
            {branches.map((branch, index) => (
              <button
                key={branch.id}
                onClick={() => {
                  onBranchSelect(branch.id);
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: branch.id === currentBranchId 
                    ? 'rgba(212,149,106,0.1)' 
                    : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (branch.id !== currentBranchId) {
                    e.currentTarget.style.background = THEME.hoverBg;
                  }
                }}
                onMouseLeave={(e) => {
                  if (branch.id !== currentBranchId) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: branch.id === currentBranchId
                      ? 'rgba(212,149,106,0.2)'
                      : 'rgba(255,255,255,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  <MessageCircle
                    size={12}
                    aria-hidden="true"
                    style={{
                      color: branch.id === currentBranchId
                        ? THEME.accent
                        : THEME.textMuted,
                    }}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 2,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: branch.id === currentBranchId
                          ? THEME.textPrimary
                          : THEME.textSecondary,
                      }}
                    >
                      {branch.label || `Branch ${index + 1}`}
                    </span>
                    {branch.id === currentBranchId && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: 'rgba(212,149,106,0.15)',
                          color: THEME.accent,
                        }}
                      >
                        Active
                      </span>
                    )}
                  </div>
                  <p
                    style={{
                      fontSize: 12,
                      color: THEME.textMuted,
                      margin: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {branch.preview}
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      color: THEME.textMuted,
                      margin: '4px 0 0',
                    }}
                  >
                    {new Date(branch.timestamp).toLocaleString()}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
