'use client';

import React, { useReducer, useMemo } from 'react';
import { useIsClient } from '@/lib/hooks/use-is-client';

export interface BoardItem {
  id: string;
  title: string;
  status: 'todo' | 'in-progress' | 'review' | 'done';
  priority: number;
  estimatedMinutes?: number;
  assigneeName?: string;
  deadline?: string;
}

export interface WorkspaceBoardViewProps {
  initialItems?: BoardItem[];
}

interface State {
  items: BoardItem[];
  draggedId: string | null;
  draggedOverColumn: string | null;
}

type Action = 
  | { type: 'SET_DRAGGED'; id: string | null }
  | { type: 'SET_DRAGGED_OVER'; column: string | null }
  | { type: 'MOVE_ITEM'; itemId: string; targetColumn: string };

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_DRAGGED': return { ...state, draggedId: action.id };
    case 'SET_DRAGGED_OVER': return { ...state, draggedOverColumn: action.column };
    case 'MOVE_ITEM':
      return {
        ...state,
        items: state.items.map(item => 
          item.id === action.itemId ? { ...item, status: action.targetColumn as any } : item
        )
      };
    default: return state;
  }
};

export const WorkspaceBoardView: React.FC<WorkspaceBoardViewProps> = ({ 
  initialItems = [] 
}) => {
  const isClient = useIsClient();
  const [state, dispatch] = useReducer(reducer, {
    items: initialItems,
    draggedId: null,
    draggedOverColumn: null,
  });

  const { items, draggedId, draggedOverColumn } = state;

  const columns = useMemo(() => [
    { id: 'todo', label: 'To Do' },
    { id: 'in-progress', label: 'In Progress' },
    { id: 'review', label: 'Review' },
    { id: 'done', label: 'Done' },
  ], []);

  return (
    <div className="flex gap-4 h-full p-4 overflow-x-auto bg-zinc-900/50">
      {columns.map(col => {
        const colItems = items.filter(i => i.status === col.id);
        const isTarget = draggedOverColumn === col.id;

        return (
          <div 
            key={col.id}
            onDragOver={(e) => { e.preventDefault(); dispatch({ type: 'SET_DRAGGED_OVER', column: col.id }); }}
            onDrop={() => {
              if (draggedId) dispatch({ type: 'MOVE_ITEM', itemId: draggedId, targetColumn: col.id });
              dispatch({ type: 'SET_DRAGGED_OVER', column: null });
              dispatch({ type: 'SET_DRAGGED', id: null });
            }}
            className={`flex-1 min-w-[280px] flex flex-col gap-3 p-3 rounded-xl transition-colors ${
              isTarget ? 'bg-white/5 border border-dashed border-blue-500/50' : 'bg-transparent border border-transparent'
            }`}
          >
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">{col.label}</h3>
              <span className="text-[11px] font-mono bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">{colItems.length}</span>
            </div>

            <div className="flex-1 flex flex-col gap-2.5">
              {colItems.map(item => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => dispatch({ type: 'SET_DRAGGED', id: item.id })}
                  className={`bg-zinc-800 border border-zinc-700 p-3.5 rounded-lg cursor-grab active:cursor-grabbing transition-all hover:border-zinc-500 ${
                    draggedId === item.id ? 'opacity-40 grayscale scale-[0.98]' : 'opacity-100'
                  }`}
                >
                  <div className="text-sm font-medium text-zinc-100 mb-2 leading-snug">{item.title}</div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {item.priority > 50 && (
                      <span className="text-[11px] font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-md uppercase tracking-wider border border-orange-500/20">High</span>
                    )}
                    {item.estimatedMinutes && (
                      <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                         {item.estimatedMinutes}m
                      </span>
                    )}
                    {item.assigneeName && (
                      <span className="text-[11px] font-semibold text-blue-400">@{item.assigneeName}</span>
                    )}
                    {item.deadline && (
                      <span className={`text-[11px] font-medium ${(isClient && new Date(item.deadline) < new Date()) ? 'text-red-400' : 'text-zinc-500'}`}>
                        {isClient ? new Date(item.deadline).toLocaleDateString() : '...'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default WorkspaceBoardView;
