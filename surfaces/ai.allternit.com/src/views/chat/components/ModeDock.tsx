
import React, { useEffect } from 'react';
import {
  Image,
  VideoCamera,
  PresentationChart,
  Globe,
  BookOpen,
  Database,
  FileText,
  UsersThree,
} from '@phosphor-icons/react';
import { useAgentStreamingStatus } from '@/hooks/useAgentStreamingStatus';
import { TextShimmer } from '@/components/agent-elements/text-shimmer';
import type { AgentModeSurface } from '@/stores/agent-surface-mode.store';
import { cn } from '@/lib/utils';
import { FormatPicker } from '@/views/create/FormatPicker';
import { isCreationMode, type FormatSelection } from '@/views/create/presets';

interface ModeDockProps {
  selectedMode: string | null;
  onSelectMode: (modeId: string) => void;
  agentModeSurface: AgentModeSurface;
  isLoading?: boolean;
  selectedSurfaceAgent?: { name: string } | null;
  formatSelection?: FormatSelection | null;
  onFormatChange?: (selection: FormatSelection) => void;
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

export const SURFACE_MODES: Record<AgentModeSurface, string[]> = {
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
  formatSelection,
  onFormatChange,
}: ModeDockProps) {
  const allowedModes = agentModeSurface ? SURFACE_MODES[agentModeSurface] : MODE_TABS.map((m) => m.id);
  const visibleTabs = MODE_TABS.filter((tab) => allowedModes.includes(tab.id));

  // Default invalid persisted legacy modes (Flow, Computer) to the first
  // retained mode so the selector and its page templates never land empty.
  useEffect(() => {
    if ((!selectedMode || !visibleTabs.some((mode) => mode.id === selectedMode)) && visibleTabs.length > 0) {
      onSelectMode(visibleTabs[0].id);
    }
  }, [selectedMode, visibleTabs, onSelectMode]);

  const agentStatus = useAgentStreamingStatus(
    !!(isLoading && selectedSurfaceAgent),
    1500
  );
  const creationMode = isCreationMode(selectedMode);
  const selectedModeData = MODE_TABS.find((mode) => mode.id === selectedMode);

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

      {/* Horizontal mode tabs separated by pipes */}
      <div className="flex items-center gap-2 flex-wrap">
        {visibleTabs.map((mode, index) => {
          const isSelected = selectedMode === mode.id;
          const ModeIcon = mode.icon;
          return (
            <React.Fragment key={mode.id}>
              <button
                type="button"
                onClick={() => onSelectMode(mode.id)}
                aria-label={`Mode: ${mode.label}`}
                aria-pressed={isSelected}
                className={cn(
                  'inline-flex items-center gap-1.5 text-[11px] font-bold transition-colors',
                  isSelected ? 'text-primary' : 'text-[var(--chat-composer-muted)] hover:text-primary'
                )}
                style={isSelected ? { color: mode.color } : undefined}
              >
                <ModeIcon size={12} weight={isSelected ? 'fill' : 'bold'} />
                <span>{mode.label}</span>
              </button>
              {index < visibleTabs.length - 1 && (
                <span className="text-[var(--chat-composer-muted)] opacity-40 text-[11px] select-none">|</span>
              )}
            </React.Fragment>
          );
        })}
      </div>
      {creationMode && selectedMode && onFormatChange && (
        <FormatPicker
          modeId={selectedMode}
          value={formatSelection}
          onChange={onFormatChange}
          color={selectedModeData?.color}
        />
      )}
    </div>
  );
}
