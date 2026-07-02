"use client";

import React, { useState } from 'react';
import type { DataGridColumn } from '../../types/programs';

interface CellProps {
  value: unknown;
  column: DataGridColumn;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (value: string) => void;
  onCancel: () => void;
}

export const Cell: React.FC<CellProps> = ({ value, column, isEditing, onEdit, onSave, onCancel }) => {
  const [editValue, setEditValue] = useState(String(value ?? ''));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSave(editValue);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (isEditing) {
    return (
      <input type={column.type === 'number' ? 'number' : 'text'}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => onSave(editValue)}
        aria-label={`Edit ${column.header}`}
        className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        autoFocus
      />
    );
  }

  const displayValue = value === null || value === undefined ? '' : String(value);
  
  return (
    <div role="button" tabIndex={0}
      onClick={onEdit}
      className="px-2 py-1 text-sm truncate cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800"
    >
      {column.type === 'boolean' ? (
        <span className={value ? 'text-green-600' : 'text-zinc-400'}>
          {value ? '✓' : '○'}
        </span>
      ) : (
        displayValue
      )}
    </div>
  );
};
