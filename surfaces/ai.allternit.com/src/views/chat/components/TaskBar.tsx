
import React from 'react';
import { Lightning, CaretDown } from '@phosphor-icons/react';

const THEME = {
  bg: 'var(--surface-canvas)',
  inputBg: 'var(--chat-composer-bg)',
  inputBorder: 'var(--chat-composer-border)',
  textPrimary: 'var(--ui-text-primary)',
  textSecondary: 'var(--chat-composer-muted)',
  textMuted: 'var(--ui-text-muted)',
  accent: 'var(--accent-chat)',
  hoverBg: 'var(--chat-composer-hover)',
  menuBg: 'var(--chat-composer-menu-bg)',
  menuBorder: 'var(--chat-composer-menu-border)',
};

interface TaskBarProps {
  wihs: Array<{
    wih_id: string;
    node_id: string;
    dag_id?: string;
    status: string;
    title?: string;
    description?: string;
    assignee?: string;
    blocked_by?: string[];
  }>;
  selectedWihId: string | null;
  onSelectWih: (wihId: string | null) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}

function WihItem({
  wih,
  isSelected,
  onClick,
}: {
  wih: {
    wih_id: string;
    node_id: string;
    dag_id?: string;
    status: string;
    title?: string;
    description?: string;
    blocked_by?: string[];
  };
  isSelected: boolean;
  onClick: () => void;
}) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'var(--status-success)';
      case 'in_progress':
        return 'var(--status-info)';
      case 'blocked':
        return 'var(--status-error)';
      case 'ready':
        return 'var(--status-warning)';
      case 'open':
        return 'var(--ui-text-muted)';
      case 'signed':
        return 'var(--accent-cowork)';
      default:
        return 'var(--ui-text-muted)';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
        case 'completed': return 'Done';
        case 'in_progress': return 'Running';
        case 'blocked': return 'Blocked';
        case 'ready': return 'Ready';
        case 'open': return 'Open';
        case 'signed': return 'Signed';
        default: return status;
    }
  };

  const statusColor = getStatusColor(wih.status);

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer text-left w-full transition-all ${
        isSelected ? 'bg-accent-15 border-accent-40' : 'bg-surface-hover border-surface-hover'
      }`}
    >
      <div
        className={`w-2 h-2 rounded-full flex-shrink-0 ${
          wih.status === 'in_progress' ? 'animate-pulse' : ''
        }`}
        style={{ backgroundColor: statusColor }}
      />
      <div className="flex-1 min-w-0">
        <div
          className={`text-sm font-medium truncate ${
            isSelected ? 'text-accent' : 'text-primary'
          }`}
        >
          {wih.title || wih.node_id}
        </div>
        {wih.description && (
          <div className="text-xs text-muted truncate mt-0.5">
            {wih.description}
          </div>
        )}
      </div>
      <span
        className="text-xs py-0.5 px-1.5 rounded"
        style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
      >
        {getStatusLabel(wih.status)}
      </span>
    </button>
  );
}

export function TaskBar({ wihs, selectedWihId, onSelectWih, expanded, onToggleExpand }: TaskBarProps) {
  const activeWihs = wihs.filter(
    (w) => w.status !== 'closed' && w.status !== 'archived'
  );

  if (activeWihs.length === 0) return null;

  const completedCount = activeWihs.filter((w) => w.status === 'completed').length;
  const inProgressCount = activeWihs.filter((w) => w.status === 'in_progress').length;
  const blockedCount = activeWihs.filter((w) => w.status === 'blocked').length;
  const readyCount = activeWihs.filter(
    (w) => w.status === 'ready' || w.status === 'open'
  ).length;

  const progress =
    activeWihs.length > 0
      ? Math.round((completedCount / activeWihs.length) * 100)
      : 0;

  return (
    <div className="w-full mb-[-1px] z-15">
      <button
        onClick={onToggleExpand}
        className={`w-full flex items-center justify-between p-4 bg-input text-secondary text-sm cursor-pointer transition-all ${
          expanded ? 'rounded-t-2xl border-b' : 'rounded-2xl'
        }`}
        style={{
          borderColor: THEME.inputBorder,
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <Lightning size={14} className="text-accent" />
            <span className="font-medium">
              {activeWihs.length} Active Task{activeWihs.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {inProgressCount > 0 && (
              <span className="text-xs py-0.5 px-1.5 rounded-full bg-info-bg text-info">
                {inProgressCount} running
              </span>
            )}
            {blockedCount > 0 && (
              <span className="text-xs py-0.5 px-1.5 rounded-full bg-error-bg text-error">
                {blockedCount} blocked
              </span>
            )}
            {readyCount > 0 && (
              <span className="text-xs py-0.5 px-1.5 rounded-full bg-success-bg text-success">
                {readyCount} ready
              </span>
            )}
          </div>
          <div className="w-15 h-1 bg-border-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-width duration-300 ease"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <CaretDown
          size={16}
          className={`transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>
      {expanded && (
        <div
          className="bg-input border rounded-b-2xl p-4 max-h-64 overflow-auto"
          style={{ borderColor: THEME.inputBorder, marginTop: -1 }}
        >
          <div className="flex flex-col gap-2">
            {activeWihs.map((wih) => (
              <WihItem
                key={wih.wih_id}
                wih={wih}
                isSelected={selectedWihId === wih.wih_id}
                onClick={() => onSelectWih(wih.wih_id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
