import React from 'react';
import type { BoardItem } from '@/stores/board.store';
import { CoworkBoardCard } from './CoworkBoardCard';

type BoardItemStatus = BoardItem['status'];

interface Props {
  status: BoardItemStatus;
  label: string;
  accent: string;
  items: BoardItem[];
  onAddItem?: () => void;
}

export const CoworkBoardColumn: React.FC<Props> = ({
  status,
  label,
  accent,
  items,
  onAddItem,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minWidth: '240px',
        maxWidth: '280px',
        flex: '0 0 260px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        padding: '12px',
      }}
    >
      {/* Column Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: accent,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {label}
          </span>
        </div>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: accent,
            background: `${accent}22`,
            padding: '2px 7px',
            borderRadius: '4px',
            minWidth: '22px',
            textAlign: 'center',
          }}
        >
          {items.length}
        </span>
      </div>

      {/* Cards */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          minHeight: '40px',
        }}
      >
        {items.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              padding: '16px 0',
              borderRadius: '8px',
              border: '1px dashed var(--border-subtle)',
            }}
          >
            Empty
          </div>
        ) : (
          items.map((item) => (
            <CoworkBoardCard key={item.id} item={item} />
          ))
        )}
      </div>

      {/* Add button */}
      {onAddItem && (
        <button
          onClick={onAddItem}
          style={{
            marginTop: '4px',
            padding: '7px',
            borderRadius: '8px',
            border: '1px dashed var(--border-subtle)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            cursor: 'pointer',
            width: '100%',
            textAlign: 'center',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color =
              'var(--text-primary)')
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color =
              'var(--text-secondary)')
          }
        >
          + Add item
        </button>
      )}
    </div>
  );
};

export default CoworkBoardColumn;
