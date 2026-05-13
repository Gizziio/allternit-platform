
import React, { useState } from 'react';
import { useAgentStreamingStatus } from '@/hooks/useAgentStreamingStatus';
import { TextShimmer } from '@/components/agent-elements/text-shimmer';
import { ALL_TEMPLATES } from '@/components/chat/TemplatePreviewCards';
import type { AgentModeSurface } from '@/stores/agent-surface-mode.store';

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
    { id: 'image', label: 'Image', color: '#8b5cf6' },
    { id: 'video', label: 'Video', color: '#ec4899' },
    { id: 'slides', label: 'Slides', color: 'var(--status-warning)' },
    { id: 'website', label: 'Web', color: '#6366f1' },
    { id: 'research', label: 'Research', color: 'var(--status-info)' },
    { id: 'data', label: 'Data', color: 'var(--status-success)' },
    { id: 'code', label: 'Code', color: 'var(--status-warning)' },
    { id: 'swarms', label: 'Swarms', color: '#14b8a6' },
    { id: 'flow', label: 'Flow', color: 'var(--status-info)' },
    { id: 'computer-use', label: 'Computer', color: '#a855f7' },
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
    <button
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
            className="size-1.5 rounded-full animate-pulse"
            style={{ background: 'var(--accent-chat, #D4B08C)' }}
          />
          <TextShimmer as="span" className="text-xs font-medium">
            {agentStatus}
          </TextShimmer>
        </div>
      )}
      <div className="flex items-center w-full gap-2 justify-center flex-wrap">
        {visibleTabs.map((mode) => {
          const isSelected = selectedMode === mode.id;
          const isActiveTab = isSelected && isLoading;
          return (
            <button
              key={mode.id}
              onClick={() => onSelectMode(mode.id)}
              className={`flex items-center justify-center py-2 px-4 rounded-full text-xs cursor-pointer transition-all ease whitespace-nowrap ${
                isActiveTab ? 'animate-pulse' : ''
              }`}
              style={{
                background: isSelected ? `${mode.color}20` : 'var(--surface-hover)',
                border: `1px solid ${isSelected ? mode.color : 'var(--ui-border-muted)'}`,
                color: isSelected ? mode.color : THEME.textSecondary,
                fontWeight: isSelected ? 600 : 500,
                boxShadow: isActiveTab
                  ? `0 0 12px ${mode.color}60, 0 0 0 1px ${mode.color}40`
                  : isSelected
                  ? `0 0 0 1px ${mode.color}40`
                  : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'var(--surface-active)';
                  e.currentTarget.style.borderColor = 'var(--ui-border-default)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'var(--surface-hover)';
                  e.currentTarget.style.borderColor = 'var(--ui-border-muted)';
                }
              }}
            >
              <span>{mode.label}</span>
            </button>
          );
        })}
      </div>
      {selectedMode && modeData && (
        <div className="w-full flex flex-col gap-2.5 mt-2 max-h-80 overflow-y-auto pr-1">
          <div className="flex items-center justify-between px-1 flex-shrink-0">
            <span className="text-xs font-semibold text-secondary uppercase tracking-wider">
              Featured {modeColors?.label} Cases
            </span>
            <span className="text-xs text-muted">{modeData.length} templates</span>
          </div>
          <div className="grid grid-cols-3 gap-2.5 flex-shrink-0">
            {modeData.map((template, index) => (
              <TemplateCard
                key={index}
                title={template.title}
                description={template.description}
                prompt={template.prompt}
                previewImage={template.previewImage}
                color={modeColors?.color || THEME.accent}
                onClick={onSelectTemplate}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
