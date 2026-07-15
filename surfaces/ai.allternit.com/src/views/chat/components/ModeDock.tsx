
import React, { useEffect, useState } from 'react';
import {
  Image,
  VideoCamera,
  PresentationChart,
  Globe,
  BookOpen,
  Database,
  FileText,
  UsersThree,
  CaretDown,
  Check,
} from '@phosphor-icons/react';
import { useAgentStreamingStatus } from '@/hooks/useAgentStreamingStatus';
import { TextShimmer } from '@/components/agent-elements/text-shimmer';
import type { AgentModeSurface } from '@/stores/agent-surface-mode.store';
import { cn } from '@/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

interface ModeDockProps {
  selectedMode: string | null;
  onSelectMode: (modeId: string) => void;
  agentModeSurface: AgentModeSurface;
  isLoading?: boolean;
  selectedSurfaceAgent?: { name: string } | null;
}

export const MODE_TABS = [
  { id: 'swarms', label: 'Agent Swarm', color: '#14b8a6', icon: UsersThree },
  { id: 'research', label: 'Deep Research', color: 'var(--status-info)', icon: BookOpen },
  { id: 'website', label: 'Websites', color: '#6366f1', icon: Globe },
  { id: 'docs', label: 'Docs', color: '#3b82f6', icon: FileText },
  { id: 'data', label: 'Sheets', color: 'var(--status-success)', icon: Database },
  { id: 'slides', label: 'Slides', color: 'var(--status-warning)', icon: PresentationChart },
  { id: 'image', label: 'Image', color: '#8b5cf6', icon: Image },
  { id: 'video', label: 'Video', color: '#ec4899', icon: VideoCamera },
] as const;

const SURFACE_MODES: Record<AgentModeSurface, string[]> = {
  chat: ['swarms', 'research', 'website', 'docs', 'data', 'slides', 'image', 'video'],
  cowork: ['swarms', 'research', 'website', 'docs', 'data', 'slides', 'image', 'video'],
  code: ['swarms', 'website', 'docs'],
  browser: ['research', 'website', 'docs', 'data'],
  design: ['website', 'slides', 'image', 'video'],
};

export function ModeDock({
  selectedMode,
  onSelectMode,
  agentModeSurface,
  isLoading,
  selectedSurfaceAgent,
}: ModeDockProps) {
  const [open, setOpen] = useState(false);
  const allowedModes = agentModeSurface ? SURFACE_MODES[agentModeSurface] : MODE_TABS.map((m) => m.id);
  const visibleTabs = MODE_TABS.filter((tab) => allowedModes.includes(tab.id));

  // Default invalid persisted legacy modes (Code, Flow, Computer) to the first
  // retained mode so the selector and its page templates never land empty.
  useEffect(() => {
    if ((!selectedMode || !visibleTabs.some((mode) => mode.id === selectedMode)) && visibleTabs.length > 0) {
      onSelectMode(visibleTabs[0].id);
    }
  }, [selectedMode, visibleTabs, onSelectMode]);

  const selectedModeData = visibleTabs.find((m) => m.id === selectedMode) ?? visibleTabs[0] ?? null;

  const agentStatus = useAgentStreamingStatus(
    !!(isLoading && selectedSurfaceAgent),
    1500
  );

  const SelectedIcon = selectedModeData?.icon ?? null;

  return (
    <div className="w-full flex flex-col items-start gap-3">
      {agentStatus && (
        <div className="flex items-center gap-2 py-1" aria-label="Agent status">
          <div
            className="size-1.5 rounded-full animate-pulse bg-[var(--accent-chat,#D4B08C)]"
          />
          <TextShimmer as="span" className="text-xs font-medium">
            {agentStatus}
          </TextShimmer>
        </div>
      )}

      {/* Compact mode selector — pinned to the left of the deck */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={selectedModeData ? `Mode: ${selectedModeData.label}` : 'Select mode'}
            className={cn(
              'inline-flex items-center gap-2 h-8 pl-3 pr-2 rounded-full text-xs font-bold transition-all border',
              selectedModeData
                ? 'border-transparent text-white'
                : 'bg-composer-soft border-composer-border text-secondary hover:text-primary hover:bg-composer-hover'
            )}
            style={
              selectedModeData
                ? {
                    background: selectedModeData.color,
                    boxShadow: `0 2px 10px ${selectedModeData.color}40`,
                  }
                : undefined
            }
          >
            {SelectedIcon && <SelectedIcon size={14} weight="fill" />}
            <span>{selectedModeData?.label ?? 'Select mode'}</span>
            <CaretDown
              size={12}
              className={cn('transition-transform opacity-80', open && 'rotate-180')}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          sideOffset={6}
          className="w-[340px] p-3 bg-menu-bg backdrop-blur-[20px] rounded-2xl border border-menu-border shadow-xl"
          style={{ boxShadow: '0 10px 40px var(--shell-overlay-backdrop)' }}
        >
          <div className="mb-2">
            <div className="text-xs font-extrabold text-muted tracking-wider uppercase">
              Agent mode
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {visibleTabs.map((mode) => {
              const isSelected = selectedMode === mode.id;
              const ModeIcon = mode.icon;
              return (
                <button
                  type="button"
                  key={mode.id}
                  onClick={() => {
                    onSelectMode(mode.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'group relative flex flex-col items-center gap-1 p-1.5 rounded-xl text-center transition-all',
                    isSelected
                      ? 'bg-composer-hover'
                      : 'hover:bg-hover'
                  )}
                  style={isSelected ? { boxShadow: `inset 0 0 0 1.5px ${mode.color}50` } : undefined}
                >
                  <div
                    className="flex items-center justify-center size-9 rounded-lg transition-transform group-hover:scale-105"
                    style={{
                      background: `${mode.color}18`,
                      color: mode.color,
                    }}
                  >
                    <ModeIcon size={16} weight={isSelected ? 'fill' : 'bold'} />
                  </div>
                  <span
                    className={cn(
                      'text-[10px] leading-tight',
                      isSelected ? 'font-bold text-primary' : 'font-medium text-secondary'
                    )}
                  >
                    {mode.label}
                  </span>
                  {isSelected && (
                    <div
                      className="absolute top-1 right-1 size-3 rounded-full flex items-center justify-center"
                      style={{ background: mode.color }}
                    >
                      <Check size={7} weight="bold" className="text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
