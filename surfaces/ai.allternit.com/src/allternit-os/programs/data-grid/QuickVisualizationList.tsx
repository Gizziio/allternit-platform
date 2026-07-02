import React from "react";

"use client";
import { usePythonExecution } from '../../services/PythonExecutionService';
import type { DataGridColumn, DataGridRow, DataGridVisualization } from '../../types/programs';
import { QuickChart } from './QuickChart';

interface VisualizationPanelProps {
  visualizations: DataGridVisualization[];
  columns: DataGridColumn[];
  rows: DataGridRow[];
  programId: string;
}

export const VisualizationPanel: React.FC<VisualizationPanelProps> = ({ 
  visualizations, 
  columns, 
  rows,
  programId 
}) => {
  const isExecuting = false;

  return (
    <div className="space-y-6">
      {visualizations.map((viz) => (
        <div key={viz.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span className="p-1 rounded bg-blue-500/10 text-blue-500">📊</span>
              {viz.title}
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
              {viz.type}
            </span>
          </div>
          
          <QuickChart 
            viz={viz}
            columns={columns}
            rows={rows}
          />
        </div>
      ))}

      {visualizations.length === 0 && !isExecuting && (
        <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
          <div className="text-3xl mb-3 opacity-50">📈</div>
          <p className="text-sm text-zinc-500">No visualizations generated yet.</p>
          <p className="text-xs text-zinc-400 mt-1">Ask the agent to analyze the data or create a chart.</p>
        </div>
      )}

      {isExecuting && (
        <div className="flex items-center justify-center py-12 gap-3 text-blue-500">
          <div className="size-4  border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Python engine executing analysis…</span>
        </div>
      )}
    </div>
  );
};
