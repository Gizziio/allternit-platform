
import React, { useState } from 'react';
import {
  Image,
  VideoCamera,
  PresentationChart,
  Globe,
  BookOpen,
  Database,
  Code,
  UsersThree,
  FlowArrow,
  Desktop,
} from '@phosphor-icons/react';
import { useAgentStreamingStatus } from '@/hooks/useAgentStreamingStatus';
import { TextShimmer } from '@/components/agent-elements/text-shimmer';
import { ALL_TEMPLATES } from '@/components/chat/TemplatePreviewCards';
import type { AgentModeSurface } from '@/stores/agent-surface-mode.store';
import { cn } from '@/lib/utils';

const THEME = {
  accent: 'var(--accent-chat)',
  inputBg: 'var(--chat-composer-bg)',
  inputBorder: 'var(--chat-composer-border)',
  textPrimary: 'var(--ui-text-primary)',
  textSecondary: 'var(--chat-composer-muted)',
  textMuted: 'var(--ui-text-muted)',
};

interface ModeDockProps {
  selectedMode: string | null;
  onSelectMode: (modeId: string) => void;
  agentModeSurface: AgentModeSurface;
  onSelectTemplate?: (prompt: string) => void;
  isLoading?: boolean;
  selectedSurfaceAgent?: { name: string } | null;
}

interface ModeTemplate {
  title: string;
  description: string;
  prompt: string;
  previewImage: string;
}

const getModeTemplates = (modeId: string): ModeTemplate[] => {
  const templates = ALL_TEMPLATES[modeId];
  if (!templates) return [];
  return templates.map((t) => ({
    title: t.name,
    description: t.description,
    prompt: t.prompt,
    previewImage: t.previewImage,
  }));
};

const MODE_TABS = [
    { id: 'image', label: 'Image', color: '#8b5cf6', icon: Image },
    { id: 'video', label: 'Video', color: '#ec4899', icon: VideoCamera },
    { id: 'slides', label: 'Slides', color: 'var(--status-warning)', icon: PresentationChart },
    { id: 'website', label: 'Web', color: '#6366f1', icon: Globe },
    { id: 'research', label: 'Research', color: 'var(--status-info)', icon: BookOpen },
    { id: 'data', label: 'Data', color: 'var(--status-success)', icon: Database },
    { id: 'code', label: 'Code', color: 'var(--status-warning)', icon: Code },
    { id: 'swarms', label: 'Swarms', color: '#14b8a6', icon: UsersThree },
    { id: 'flow', label: 'Flow', color: 'var(--status-info)', icon: FlowArrow },
    { id: 'computer-use', label: 'Computer', color: '#a855f7', icon: Desktop },
] as const;

const SURFACE_MODES: Record<AgentModeSurface, string[]> = {
  chat: ['image', 'video', 'slides', 'website', 'research', 'data', 'code', 'swarms', 'flow', 'computer-use'],
  cowork: ['image', 'video', 'slides', 'website', 'research', 'data', 'code', 'swarms', 'flow', 'computer-use'],
  code: ['code', 'website', 'swarms', 'flow'],
  browser: ['website', 'research', 'data', 'computer-use'],
  design: ['image', 'video', 'slides', 'assets'],
};

function TemplateCard({
  title,
  description,
  prompt,
  previewImage,
  color,
  onClick,
}: {
  title: string;
  description: string;
  prompt: string;
  previewImage: string;
  color: string;
  onClick?: (prompt: string) => void;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <button type="button"
      onClick={() => onClick?.(prompt)}
      className="flex flex-col p-3 bg-input border border-input-border rounded-xl cursor-pointer text-left transition-all ease hover:-translate-y-0.5"
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = color)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = THEME.inputBorder)}
    >
      <div
        className="h-20 rounded-lg mb-2.5 relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${color}20 0%, ${color}05 100%)`,
        }}
      >
        <img
          src={previewImage}
          alt={title}
          className={`w-full h-full object-cover transition-opacity duration-300 ease ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageLoaded(false)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
      </div>
      <div className="text-sm font-semibold text-primary mb-1">{title}</div>
      <div className="text-xs text-muted leading-snug">{description}</div>
    </button>
  );
}

export function ModeDock({
  selectedMode,
  onSelectMode,
  agentModeSurface,
  onSelectTemplate,
  isLoading,
  selectedSurfaceAgent,
}: ModeDockProps) {
  const allowedModes = agentModeSurface ? SURFACE_MODES[agentModeSurface] : MODE_TABS.map((m) => m.id);
  const visibleTabs = MODE_TABS.filter((tab) => allowedModes.includes(tab.id));

  const modeData = selectedMode ? getModeTemplates(selectedMode) : null;
  const modeColors = selectedMode ? MODE_TABS.find((m) => m.id === selectedMode) : null;

  const agentStatus = useAgentStreamingStatus(
    !!(isLoading && selectedSurfaceAgent),
    1500
  );

  return (
    <div className="w-full mt-2 flex flex-col items-center gap-2 z-9">
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
      <div className="flex items-center w-full gap-1.5 justify-center flex-wrap p-1.5 rounded-2xl bg-[var(--surface-panel)]/60 border border-[var(--ui-border-muted)] backdrop-blur-sm">
        {visibleTabs.map((mode) => {
          const isSelected = selectedMode === mode.id;
          const isActiveTab = isSelected && isLoading;
          const ModeIcon = mode.icon;
          return (
            <button type="button"
              key={mode.id}
              onClick={() => onSelectMode(mode.id)}
              className={cn(
                "relative inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] cursor-pointer transition-all duration-200 whitespace-nowrap border border-transparent",
                isActiveTab && "animate-pulse",
                isSelected
                  ? "font-bold"
                  : "text-[var(--chat-composer-muted)] font-semibold hover:text-[var(--ui-text-secondary)] hover:bg-[var(--surface-hover)]"
              )}
              style={isSelected ? {
                background: mode.color,
                color: '#ffffff',
                boxShadow: `0 2px 8px ${mode.color}40`,
              } : undefined}
            >
              <ModeIcon size={14} weight={isSelected ? 'fill' : 'bold'} />
              <span>{mode.label}</span>
            </button>
          );
        })}
      </div>
      {selectedMode && modeData && (
        <div className="w-full flex flex-col gap-2.5 mt-2 max-h-80 overflow-y-auto pr-1">
          <div className="flex items-center justify-between px-1 flex-shrink-0">
            <span className="text-[11px] font-bold text-[var(--ui-text-secondary)] uppercase tracking-wider">
              Featured {modeColors?.label} Cases
            </span>
            <span className="text-[11px] text-[var(--ui-text-muted)]">{modeData.length} templates</span>
          </div>
          <div className="grid grid-cols-3 gap-2.5 flex-shrink-0">
            {modeData.map((template) => (
              <TemplateCard
                key={template.title}
                title={template.title}
                description={template.description}
                prompt={template.prompt}
                previewImage={template.previewImage}
                color={modeColors?.color || 'var(--accent-chat)'}
                onClick={onSelectTemplate}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
