/**
 * CanvasToolbar.tsx
 * 
 * Top toolbar for A2r-Canvas with layout controls and actions.
 */

import React from 'react';
import {
  Columns,
  Rows,
  ArrowsOut,
  ArrowsIn,
  MonitorPlay,
  DownloadSimple,
  ShareNetwork,
  DotsThreeOutline,
  ArrowCounterClockwise,
  ArrowClockwise,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CanvasToolbarProps {
  layoutMode: 'horizontal' | 'vertical';
  showChat: boolean;
  showDrive: boolean;
  fullscreen: boolean;
  activeRenderer: string | null;
  artifactCount: number;
  onToggleLayout: () => void;
  onToggleChat: () => void;
  onToggleDrive: () => void;
  onFullscreen: () => void;
}

export function CanvasToolbar({
  layoutMode,
  showChat,
  showDrive,
  fullscreen,
  activeRenderer,
  artifactCount,
  onToggleLayout,
  onToggleChat,
  onToggleDrive,
  onFullscreen,
}: CanvasToolbarProps) {
  return (
    <div className="h-12 border-b border-[var(--border-subtle)] flex items-center justify-between px-4 bg-[var(--bg-secondary)]">
      {/* Left: Layout controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleLayout}
          className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          title={layoutMode === 'horizontal' ? 'Switch to vertical layout' : 'Switch to horizontal layout'}
        >
          {layoutMode === 'horizontal' ? (
            <Rows size={16} />
          ) : (
            <Columns size={16} />
          )}
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleChat}
          className={cn(
            "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]",
            !showChat && "text-[var(--accent-primary)]"
          )}
          title={showChat ? 'Hide chat' : 'Show chat'}
        >
          <Columns size={16} />
          <span className="ml-2 text-xs">{showChat ? 'Hide Chat' : 'Show Chat'}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleDrive}
          className={cn(
            "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]",
            showDrive && "text-[var(--accent-primary)]"
          )}
          title="Toggle asset drive"
        >
          <MonitorPlay size={16} />
          <span className="ml-2 text-xs">Drive</span>
        </Button>
      </div>

      {/* Center: Renderer info */}
      <div className="flex items-center gap-3">
        {activeRenderer && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
            <span className="text-xs font-medium text-[var(--text-secondary)] capitalize">
              {activeRenderer}
            </span>
            <span className="text-xs text-[var(--text-tertiary)]">
              {artifactCount} artifact{artifactCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          title="Undo"
        >
          <ArrowCounterClockwise size={16} />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          title="Redo"
        >
          <ArrowClockwise size={16} />
        </Button>

        <div className="w-px h-4 bg-[var(--border-subtle)]" />

        <Button
          variant="ghost"
          size="sm"
          className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          title="Zoom out"
        >
          <MagnifyingGlassMinus size={16} />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          title="Zoom in"
        >
          <MagnifyingGlassPlus size={16} />
        </Button>

        <div className="w-px h-4 bg-[var(--border-subtle)]" />

        <Button
          variant="ghost"
          size="sm"
          className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          title="Download"
        >
          <DownloadSimple size={16} />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          title="Share"
        >
          <ShareNetwork size={16} />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onFullscreen}
          className={cn(
            "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]",
            fullscreen && "text-[var(--accent-primary)]"
          )}
          title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {fullscreen ? (
            <ArrowsIn size={16} />
          ) : (
            <ArrowsOut size={16} />
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
        >
          <DotsThreeOutline size={16} />
        </Button>
      </div>
    </div>
  );
}
