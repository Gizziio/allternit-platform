/**
 * BatchToolbar - Batch operations toolbar
 */

import React from 'react';
import { CheckSquare, ArrowsClockwise, Stop, X } from '@phosphor-icons/react';
import { TEXT, BACKGROUND, BORDER, STATUS } from '@/design/allternit.tokens';
import { useBatchSelection, useAgents } from '../SwarmMonitor.store';

interface BatchToolbarProps {
  modeColors: { accent: string };
}

export function BatchToolbar({ modeColors }: BatchToolbarProps) {
  const { isBatchMode, selectedCount, toggleBatchMode, selectAll, deselectAll, batchRestart, batchStop } =
    useBatchSelection();
  const agents = useAgents();

  if (!isBatchMode) {
    return (
      <div
        className="px-6 py-2 border-b flex items-center justify-between"
        style={{ borderColor: BORDER.subtle }}
      >
        <span className="text-xs" style={{ color: TEXT.tertiary }}>
          {agents.length} agents
        </span>
        <button
          onClick={toggleBatchMode}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-opacity hover:opacity-70"
          style={{ background: BACKGROUND.tertiary, color: TEXT.secondary }}
        >
          <CheckSquare size={12} weight="regular" />
          Batch Select
        </button>
      </div>
    );
  }

  return (
    <div
      className="px-6 py-3 border-b flex items-center justify-between"
      style={{
        background: `${modeColors.accent}10`,
        borderColor: `${modeColors.accent}30`,
      }}
    >
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium" style={{ color: modeColors.accent }}>
          {selectedCount} selected
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={selectAll}
            className="px-2.5 py-1 rounded text-xs transition-opacity hover:opacity-70"
            style={{ color: TEXT.secondary }}
          >
            Select All
          </button>
          <button
            onClick={deselectAll}
            className="px-2.5 py-1 rounded text-xs transition-opacity hover:opacity-70"
            style={{ color: TEXT.secondary }}
          >
            Deselect All
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={batchRestart}
          disabled={selectedCount === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-opacity disabled:opacity-40"
          style={{ background: `${modeColors.accent}20`, color: modeColors.accent }}
        >
          <ArrowsClockwise size={11} weight="bold" />
          Restart
        </button>
        <button
          onClick={batchStop}
          disabled={selectedCount === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-opacity disabled:opacity-40"
          style={{ background: rgba(239,68,68,0.18), color: STATUS.error }}
        >
          <Stop size={11} weight="fill" />
          Stop
        </button>
        <button
          onClick={toggleBatchMode}
          className="flex items-center justify-center w-7 h-7 rounded-md transition-opacity hover:opacity-70 ml-2"
          style={{ color: TEXT.tertiary }}
        >
          <X size={12} weight="bold" />
        </button>
      </div>
    </div>
  );
}
