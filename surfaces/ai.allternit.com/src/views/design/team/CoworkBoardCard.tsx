import React, { useState } from 'react';
import { Robot, User, ChatCircle, ArrowRight, TreeStructure, Spinner } from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';
import { useBoardStore, type BoardItem } from '@/stores/board.store';
import { expandBoardItem, bulkCreateFromPRD } from '@/lib/cowork-team/coworkTeamBridge';
import { usePlatformAuth } from '@/lib/platform-auth-client';

type BoardItemStatus = BoardItem['status'];

interface Props {
  item: BoardItem;
  onAssign?: (itemId: string) => void;
  onMove?: (itemId: string, status: BoardItemStatus) => void;
}

const STATUS_ORDER: BoardItemStatus[] = [
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'done',
];

const STATUS_COLORS: Record<string, string> = {
  backlog: 'var(--ui-text-muted)',
  todo: 'var(--status-info)',
  in_progress: 'var(--accent-cowork)',
  in_review: 'var(--status-warning)',
  done: 'var(--status-success)',
  blocked: 'var(--status-error)',
};

function priorityColor(priority: number): string {
  if (priority >= 76) return 'var(--status-error)';
  if (priority >= 51) return 'var(--status-warning)';
  if (priority >= 26) return 'var(--status-warning)';
  return 'var(--status-success)';
}

function nextStatus(current: BoardItemStatus): BoardItemStatus | null {
  const idx = STATUS_ORDER.indexOf(current);
  if (idx === -1 || idx >= STATUS_ORDER.length - 1) return null;
  return STATUS_ORDER[idx + 1];
}

export const CoworkBoardCard: React.FC<Props> = ({ item, onAssign, onMove }) => {
  const { moveItem, assignItem, createItem, updateItem } = useBoardStore();
  const { userId } = usePlatformAuth();
  const [expanding, setExpanding] = useState(false);

  const next = nextStatus(item.status);
  const accentColor = STATUS_COLORS[item.status] ?? 'var(--ui-text-muted)';
  const pColor = priorityColor(item.priority ?? 50);
  const commentCount = item.comments?.length ?? 0;

  const handleMove = () => {
    if (!next) return;
    moveItem(item.id, next);
    onMove?.(item.id, next);
  };

  const handleAssign = () => {
    assignItem(item.id, 'human', userId ?? 'me');
    onAssign?.(item.id);
  };

  const handleExpand = async () => {
    if (expanding) return;
    setExpanding(true);
    try {
      const result = await expandBoardItem(item);
      await bulkCreateFromPRD(item.workspaceId, result.items, createItem, updateItem);
    } finally {
      setExpanding(false);
    }
  };

  return (
    <GlassSurface
      style={{
        borderRadius: '8px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        cursor: 'default',
        borderLeft: `3px solid ${accentColor}`,
      }}
    >
      {/* Title row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <span
          style={{
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--text-primary)',
            lineHeight: 1.4,
            flex: 1,
          }}
        >
          {item.title}
        </span>
        <span
          title={`Priority ${item.priority ?? 50}`}
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: pColor,
            flexShrink: 0,
            marginTop: '4px',
          }}
        />
      </div>

      {/* Status badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span
          style={{
            display: 'inline-block',
            padding: '2px 7px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600,
            background: `${accentColor}22`,
            color: accentColor,
            textTransform: 'capitalize',
          }}
        >
          {item.status.replace('_', ' ')}
        </span>

        {item.labels?.map((lbl) => (
          <span
            key={lbl}
            style={{
              display: 'inline-block',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 500,
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {lbl}
          </span>
        ))}
      </div>

      {/* Footer row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '2px',
        }}
      >
        <button
          onClick={handleAssign}
          title={item.assigneeId ?? 'Unassigned — click to assign'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: item.assigneeId ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontSize: '12px',
            padding: 0,
          }}
        >
          {item.assigneeType === 'agent' ? (
            <Robot size={14} color="#af52de" />
          ) : (
            <User size={14} />
          )}
          <span style={{ fontSize: '12px', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.assigneeName ?? item.assigneeId ?? 'Unassigned'}
          </span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {commentCount > 0 && (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
              }}
            >
              <ChatCircle size={13} />
              {commentCount}
            </span>
          )}

          {next && (
            <button
              onClick={handleMove}
              title={`Move to ${next.replace('_', ' ')}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                padding: '3px 8px',
                borderRadius: '4px',
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                cursor: 'pointer',
                transition: 'color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.color = 'var(--text-primary)';
                el.style.borderColor = accentColor;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.color = 'var(--text-secondary)';
                el.style.borderColor = 'var(--border-subtle)';
              }}
            >
              Move
              <ArrowRight size={11} />
            </button>
          )}

          <button
            onClick={handleExpand}
            disabled={expanding}
            title="Break down into subtasks with AI"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              padding: '3px 8px',
              borderRadius: '4px',
              background: expanding ? 'color-mix(in srgb, var(--accent-cowork) 9%, transparent)' : 'transparent',
              border: '1px solid var(--border-subtle)',
              color: expanding ? 'var(--accent-cowork)' : 'var(--text-secondary)',
              fontSize: '11px',
              cursor: expanding ? 'default' : 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              if (expanding) return;
              const el = e.currentTarget as HTMLButtonElement;
              el.style.color = 'var(--accent-cowork)';
              el.style.borderColor = 'color-mix(in srgb, var(--accent-cowork) 33%, transparent)';
            }}
            onMouseLeave={(e) => {
              if (expanding) return;
              const el = e.currentTarget as HTMLButtonElement;
              el.style.color = 'var(--text-secondary)';
              el.style.borderColor = 'var(--border-subtle)';
            }}
          >
            {expanding
              ? <Spinner size={11} style={{ animation: 'spin 1s linear infinite' }} />
              : <TreeStructure size={11} />
            }
            {expanding ? 'Breaking down…' : 'Break Down'}
          </button>
        </div>
      </div>
    </GlassSurface>
  );
};

export default CoworkBoardCard;
