import React, { useMemo } from "react";

"use client";
import type { DataGridColumn, DataGridRow, DataGridVisualization } from '../../types/programs';
import { buildChartJsHtml } from './chartUtils';

interface QuickChartProps {
  viz: DataGridVisualization;
  columns: DataGridColumn[];
  rows: DataGridRow[];
}

export const QuickChart: React.FC<QuickChartProps> = ({ viz, columns, rows }) => {
  const chartHtml = useMemo(() => {
    return buildChartJsHtml(
      viz.type,
      (viz.config.xColumn as string) ?? '',
      (viz.config.yColumn as string) ?? '',
      columns,
      rows,
      viz.title
    );
  }, [viz, columns, rows]);

  return (
    <div className="w-full bg-slate-900 rounded-lg overflow-hidden border border-slate-800 shadow-lg">
      <iframe
        srcDoc={chartHtml}
        className="w-full h-80 border-none"
        title={viz.title}
        sandbox="allow-scripts"
      />
    </div>
  );
};
