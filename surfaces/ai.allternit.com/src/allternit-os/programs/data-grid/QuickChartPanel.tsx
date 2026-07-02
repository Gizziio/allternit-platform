"use client";

import React, { useState, useEffect, useMemo } from 'react';
import type { DataGridColumn, DataGridRow, DataGridVisualization } from '../../types/programs';
import { buildChartJsHtml } from './chartUtils';

interface QuickChartPanelProps {
  viz: DataGridVisualization;
  columns: DataGridColumn[];
  rows: DataGridRow[];
  onClose: () => void;
}

export const QuickChartPanel: React.FC<QuickChartPanelProps> = ({ viz, columns, rows, onClose }) => {
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>(
    (viz.type as 'bar' | 'line' | 'pie') ?? 'bar'
  );
  const xColId = (viz.config?.xAxis as string) || columns[0]?.id || '';
  const yColId = (viz.config?.yAxis as string) || columns.find(c => c.type === 'number')?.id || columns[1]?.id || '';

  const iframeSrc = useMemo(() => {
    const html = buildChartJsHtml(chartType, xColId, yColId, columns, rows, viz.title);
    const blob = new Blob([html], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }, [chartType, xColId, yColId, columns, rows, viz.title]);

  useEffect(() => {
    return () => { if (iframeSrc.startsWith('blob:')) URL.revokeObjectURL(iframeSrc); };
  }, [iframeSrc]);

  return (
    <div className="flex flex-col h-full bg-[#0f172a]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-xs font-medium text-zinc-300 truncate pr-2">{viz.title}</span>
        <div className="flex items-center gap-2 shrink-0">
          <select value={chartType}
            onChange={e => setChartType(e.target.value as 'bar' | 'line' | 'pie')}
            aria-label="Select chart type"
            className="text-xs bg-zinc-700 border border-white/10 rounded px-2 py-0.5 text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="pie">Pie</option>
          </select>
          <button type="button" 
            onClick={onClose} 
            aria-label="Close chart panel"
            className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
          >            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      <div className="flex-1 p-2">
        <iframe
          src={iframeSrc}
          className="w-full h-full rounded border-0 bg-transparent"
          sandbox="allow-scripts"
          title="Chart Preview"
        />
      </div>
    </div>
  );
};
