"use client";

import React, { useState } from 'react';
import { SquaresFour, Sparkle } from '@phosphor-icons/react';
import { useBoardStore, type BoardItem } from '@/stores/board.store';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { CoworkBoardColumn } from './CoworkBoardColumn';
import { ParsePRDModal } from './ParsePRDModal';

type BoardItemStatus = BoardItem['status'];

interface ColumnDef {
  status: BoardItemStatus;
  label: string;
  accent: string;
}

const COLUMNS: ColumnDef[] = [
  { status: 'backlog',     label: 'Backlog',      accent: 'var(--ui-text-muted)' },
  { status: 'todo',        label: 'To Do',        accent: 'var(--status-info)' },
  { status: 'in_progress', label: 'In Progress',  accent: 'var(--accent-primary)' },
  { status: 'in_review',   label: 'In Review',    accent: 'var(--status-warning)' },
  { status: 'done',        label: 'Done',         accent: 'var(--status-success)' },
  { status: 'blocked',     label: 'Blocked',      accent: 'var(--status-error)' },
];

export const DesignBoardView: React.FC = () => {
  const { items, createItem } = useBoardStore();
  const { workspaces, activeWorkspaceId } = useWorkspaceStore();
  const [prdModalOpen, setPrdModalOpen] = useState(false);

  const workspaceId = activeWorkspaceId ?? workspaces[0]?.id ?? 'default';

  const handleAddItem = () => {
    createItem(workspaceId, { title: 'New Task', status: 'backlog', priority: 50 });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)', padding: 'var(--spacing-xl)', color: 'var(--text-primary)', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <SquaresFour size={28} color="var(--accent-primary)" weight="duotone" />
          <h1 style={{ fontSize: '24px', fontWeight: 600, margin: 0 }}>Design Board</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setPrdModalOpen(true)}
            style={{ padding: '8px 16px', borderRadius: '8px', background: 'color-mix(in srgb, var(--accent-primary) 13%, transparent)', color: 'var(--accent-primary)', border: '1px solid color-mix(in srgb, var(--accent-primary) 33%, transparent)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Sparkle size={15} weight="duotone" />
            Generate from PRD
          </button>
          <button
            onClick={handleAddItem}
            style={{ padding: '8px 18px', borderRadius: '8px', background: 'var(--accent-primary)', color: '#fff', border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
          >
            + New Item
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--spacing-md)', overflowX: 'auto', flex: 1, alignItems: 'flex-start', paddingBottom: '8px' }}>
        {COLUMNS.map(({ status, label, accent }) => {
          const columnItems = items.filter((i) => i.status === status);
          return (
            <CoworkBoardColumn
              key={status}
              status={status}
              label={label}
              accent={accent}
              items={columnItems}
              onAddItem={status === 'backlog' ? handleAddItem : undefined}
            />
          );
        })}
      </div>

      {prdModalOpen && (
        <ParsePRDModal
          workspaceId={workspaceId}
          onClose={() => setPrdModalOpen(false)}
          onCreated={() => setPrdModalOpen(false)}
        />
      )}
    </div>
  );
};

export default DesignBoardView;
