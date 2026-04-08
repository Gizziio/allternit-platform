/**
 * AgentationContextMenu - Context menu for browser agent actions
 * 
 * Right-click context menu in BrowserView for quick agent actions:
 * - "Annotate with Agentation"
 * - "Extract this element"
 * - "Screenshot this area"
 * - "Run agent from here"
 * 
 * Dev mode only - not shown in production.
 */

"use client";

import React, { useEffect, useCallback } from 'react';
import {
  Sparkle,
  Eye,
  Camera,
  Play,
} from '@phosphor-icons/react';
import { GlassSurface } from '@/design/GlassSurface';

// ============================================================================
// Props
// ============================================================================

export interface AgentationContextMenuProps {
  // Position
  x: number;
  y: number;
  
  // Callbacks
  onClose: () => void;
  onAnnotate?: () => void;
  onExtract?: () => void;
  onScreenshot?: () => void;
  onRunAgent?: () => void;
  
  // Dev mode flag
  isDevMode?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function AgentationContextMenu({
  x,
  y,
  onClose,
  onAnnotate,
  onExtract,
  onScreenshot,
  onRunAgent,
  isDevMode = false,
}: AgentationContextMenuProps) {
  // Close on escape or click outside
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-agentation-context-menu]')) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Don't show in production
  if (!isDevMode) {
    return null;
  }

  return (
    <div
      data-agentation-context-menu
      className="fixed z-[1000]"
      style={{
        left: x,
        top: y,
      }}
    >
      <GlassSurface
        intensity="thick"
        className="min-w-[200px] rounded-xl overflow-hidden shadow-2xl"
        style={{
          background: 'var(--glass-bg-thick)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {/* Header */}
        <div className="px-3 py-2 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-2">
            <Sparkle className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-semibold">Agentation</span>
          </div>
        </div>

        {/* Menu Items */}
        <div className="py-1">
          <MenuItem
            icon={Sparkle}
            label="Annotate Element"
            description="Add notes for AI agents"
            onClick={() => {
              onAnnotate?.();
              onClose();
            }}
          />
          <MenuItem
            icon={Eye}
            label="Extract Data"
            description="Extract structured data"
            onClick={() => {
              onExtract?.();
              onClose();
            }}
          />
          <MenuItem
            icon={Camera}
            label="Screenshot"
            description="Capture this area"
            onClick={() => {
              onScreenshot?.();
              onClose();
            }}
          />
          <MenuItem
            icon={Play}
            label="Run Agent From Here"
            description="Start agent automation"
            onClick={() => {
              onRunAgent?.();
              onClose();
            }}
          />
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-border bg-secondary/30">
          <p className="text-[10px] text-muted-foreground">
            Press ESC to close
          </p>
        </div>
      </GlassSurface>
    </div>
  );
}

// ============================================================================
// Menu Item Component
// ============================================================================

interface MenuItemProps {
  icon: any;
  label: string;
  description: string;
  onClick: () => void;
}

function MenuItem({ icon: Icon, label, description, onClick }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full px-3 py-2 flex items-start gap-3 hover:bg-accent/10 transition-colors text-left"
    >
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

export default AgentationContextMenu;
