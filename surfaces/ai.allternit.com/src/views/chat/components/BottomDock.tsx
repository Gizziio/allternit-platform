
import React from 'react';
import { Robot, CaretDown } from '@phosphor-icons/react';
import { useViewMode, type ViewMode } from '@/hooks/useViewMode';

const THEME = {
  inputBg: 'var(--chat-composer-bg)',
  inputBorder: 'var(--chat-composer-border)',
  textSecondary: 'var(--chat-composer-muted)',
  textMuted: 'var(--ui-text-muted)',
  hoverBg: 'var(--chat-composer-hover)',
};

const VIEW_MODE_SEGMENTS: { id: ViewMode; label: string; title: string }[] = [
  { id: 'verbose', label: 'V', title: 'Verbose — show all thinking and tool details' },
  { id: 'normal', label: 'N', title: 'Normal — collapsed thinking, compact tool chips' },
  { id: 'summary', label: 'S', title: 'Summary — final text only' },
];

function ViewModeToggle() {
  const { viewMode, setViewMode } = useViewMode();
  return (
    <div
      role="group"
      aria-label="View mode"
      title="View mode (⌘+Shift+V to cycle)"
      className="flex items-center rounded-md overflow-hidden border border-composer-border bg-composer-soft h-7 flex-shrink-0"
    >
      {VIEW_MODE_SEGMENTS.map((seg, i) => {
        const isActive = viewMode === seg.id;
        return (
          <button
            key={seg.id}
            type="button"
            onClick={() => setViewMode(seg.id)}
            title={seg.title}
            aria-pressed={isActive}
            className={`px-2 h-full border-none transition-all duration-100 ease-in-out text-xs leading-none ${
              i > 0 ? 'border-l border-composer-border' : ''
            } ${
              isActive
                ? 'bg-composer-hover text-primary font-bold tracking-wider'
                : 'bg-transparent text-muted font-medium'
            }`}
          >
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}

interface BottomDockProps {
  selectedModeId: string | null;
  agentModeEnabled: boolean;
  agentModeTheme: { glow: string; soft: string; accent: string };
  setShowAgentMenu: (show: boolean) => void;
  showAgentMenu: boolean;
  selectedSurfaceAgent: { name: string } | null;
  customLeftContent?: React.ReactNode;
}

export function BottomDock({
  selectedModeId,
  agentModeEnabled,
  agentModeTheme,
  setShowAgentMenu,
  showAgentMenu,
  selectedSurfaceAgent,
  customLeftContent,
}: BottomDockProps) {
  const borderColor = agentModeEnabled ? agentModeTheme.glow : THEME.inputBorder;

  return (
    <div
      className="w-full box-border mt-0 flex items-center justify-between py-2 px-4 bg-input-bg rounded-b-2xl z-11 relative"
      style={{
        borderTop: `1px solid ${borderColor}`,
        borderRight: `1px solid ${borderColor}`,
        borderBottom: `1px solid ${borderColor}`,
        borderLeft: `1px solid ${borderColor}`,
      }}
    >
      {customLeftContent ? (
        <div className="flex items-center">{customLeftContent}</div>
      ) : (
        <button
          onClick={() => agentModeEnabled && setShowAgentMenu(!showAgentMenu)}
          title={agentModeEnabled ? undefined : 'Enable Agent mode to choose an agent'}
          className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-transparent border-none text-sm font-medium transition-all ${
            agentModeEnabled ? 'cursor-pointer' : 'cursor-default opacity-45'
          }`}
          style={{
            color: agentModeEnabled ? THEME.textSecondary : THEME.textMuted,
          }}
          onMouseEnter={(e) => {
            if (agentModeEnabled) e.currentTarget.style.background = THEME.hoverBg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <Robot size={16} />
          <span>{selectedSurfaceAgent ? selectedSurfaceAgent.name : 'Choose Agent'}</span>
          {agentModeEnabled && (
            <CaretDown
              size={14}
              className={`opacity-60 transition-transform ${
                showAgentMenu ? 'rotate-180' : ''
              }`}
            />
          )}
        </button>
      )}
      <div className="flex items-center gap-2">
        <ViewModeToggle />
      </div>
    </div>
  );
}
