/**
 * DataCard.tsx
 * 
 * Compact A2R Data card for chat thread.
 * Shows preview of rows/columns with "Open Full" option.
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Table as Table2,
  ArrowsOut,
  DownloadSimple,
  ChartBar,
  Rows as Rows3,
  Columns as Columns3,
  TrendUp,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DataColumn {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'currency' | 'percent' | 'date';
}

interface DataRow {
  [key: string]: any;
}

interface DataCardProps {
  id: string;
  title: string;
  columns: DataColumn[];
  data: DataRow[];
  metadata?: {
    rowCount: number;
    columnCount: number;
    lastModified?: Date;
    source?: string;
  };
  visualization?: {
    type: 'bar' | 'line' | 'pie' | 'summary';
    title?: string;
    data?: any;
  };
  isLoading?: boolean;
  progress?: number;
  onOpenFull?: () => void;
  onExport?: () => void;
  className?: string;
}

/**
 * A2R Data Card
 * 
 * Inline preview of an A2R Data spreadsheet in the chat thread.
 * Shows table preview with header and first few rows.
 * "Open Full" expands to full AG-Grid editor in sidecar.
 */
export function DataCard({
  id,
  title,
  columns,
  data,
  metadata,
  visualization,
  isLoading = false,
  progress = 100,
  onOpenFull,
  onExport,
  className,
}: DataCardProps) {
  // Preview only first 4 columns and 4 rows
  const previewColumns = useMemo(() => columns.slice(0, 4), [columns]);
  const previewData = useMemo(() => data.slice(0, 4), [data]);
  const hasMoreColumns = columns.length > 4;
  const hasMoreRows = data.length > 4;

  // Calculate summary stats
  const numericColumn = columns.find(col => col.type === 'number' || col.type === 'currency');
  const summaryStat = useMemo(() => {
    if (!numericColumn) return null;
    const values = data.map(row => parseFloat(row[numericColumn.key]) || 0);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    return {
      label: numericColumn.type === 'currency' ? 'Total' : 'Average',
      value: numericColumn.type === 'currency' 
        ? formatCurrency(sum)
        : avg.toFixed(1),
    };
  }, [data, numericColumn]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "w-full max-w-[680px] rounded-xl overflow-hidden border border-[#333] bg-[#1a1a1a]",
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#333] bg-[#1e1e1e] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#D4956A]/10 flex items-center justify-center">
            <Table2 className="w-4 h-4 text-[#D4956A]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#ECECEC]">
              A2R Data
            </h3>
            <div className="flex items-center gap-2 text-xs text-[#666]">
              <span className="flex items-center gap-1">
                <Rows3 size={12} />
                {metadata?.rowCount || data.length} rows
              </span>
              <span className="flex items-center gap-1">
                <Columns3 size={12} />
                {metadata?.columnCount || columns.length} cols
              </span>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-[#333] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#D4956A]"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <span className="text-xs text-[#666]">{Math.round(progress)}%</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {onExport && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onExport}
                className="h-7 text-[#888] hover:text-[#ECECEC] hover:bg-[#333]"
              >
                <DownloadSimple className="w-3.5 h-3.5 mr-1" />
                <span className="text-xs">Export</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenFull}
              className="h-7 text-[#888] hover:text-[#ECECEC] hover:bg-[#333]"
            >
              <ArrowsOut className="w-3.5 h-3.5 mr-1" />
              <span className="text-xs">Open Full</span>
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <h2 className="text-lg font-semibold text-[#ECECEC] mb-3">
          {title}
        </h2>

        {/* Data Table Preview */}
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#333]">
                {previewColumns.map(col => (
                  <th 
                    key={col.key}
                    className="text-left py-2 px-3 text-[#888] font-medium bg-[#1e1e1e]"
                  >
                    {col.label}
                  </th>
                ))}
                {hasMoreColumns && (
                  <th className="py-2 px-3 text-[#666] text-center bg-[#1e1e1e]">
                    +{columns.length - 4}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {previewData.map((row, idx) => (
                <tr 
                  key={idx}
                  className="border-b border-[#2a2a2a] hover:bg-[#1e1e1e]/50"
                >
                  {previewColumns.map(col => (
                    <td 
                      key={col.key}
                      className="py-2 px-3 text-[#b8b8b8]"
                    >
                      {formatCell(row[col.key], col.type)}
                    </td>
                  ))}
                  {hasMoreColumns && <td className="py-2 px-3" />}
                </tr>
              ))}
              {hasMoreRows && (
                <tr>
                  <td 
                    colSpan={previewColumns.length + (hasMoreColumns ? 1 : 0)}
                    className="py-2 px-3 text-center text-[#666] italic"
                  >
                    ...and {data.length - 4} more rows
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Stats */}
        {summaryStat && (
          <div className="flex items-center gap-4 p-3 rounded-lg bg-[#1e1e1e] border border-[#333] mb-4">
            <div className="w-10 h-10 rounded-lg bg-[#D4956A]/10 flex items-center justify-center">
              <TrendUp className="w-5 h-5 text-[#D4956A]" />
            </div>
            <div>
              <p className="text-xs text-[#666] uppercase tracking-wide">
                {summaryStat.label}
              </p>
              <p className="text-lg font-semibold text-[#ECECEC]">
                {summaryStat.value}
              </p>
            </div>
          </div>
        )}

        {/* Visualization Preview */}
        {visualization && (
          <div className="p-3 rounded-lg bg-[#1e1e1e] border border-[#333] mb-4">
            <div className="flex items-center gap-2 mb-2">
              <ChartBar className="w-4 h-4 text-[#D4956A]" />
              <span className="text-xs font-medium text-[#888]">
                {visualization.title || 'Visualization Preview'}
              </span>
            </div>
            <div className="h-24 flex items-end justify-around gap-1">
              {/* Simple bar chart preview */}
              {data.slice(0, 8).map((row, i) => {
                const value = numericColumn ? parseFloat(row[numericColumn.key]) || 0 : 0;
                const max = numericColumn 
                  ? Math.max(...data.map(r => parseFloat(r[numericColumn.key]) || 0))
                  : 1;
                const height = max > 0 ? (value / max) * 100 : 0;
                return (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <div
                      className="w-full max-w-[20px] bg-[#D4956A]/30 rounded-t"
                      style={{ height: `${height}%`, minHeight: '4px' }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-[#333]">
          <div className="text-xs text-[#666]">
            {metadata?.source && (
              <span>Source: {metadata.source}</span>
            )}
          </div>
          <span className="text-xs text-[#666]">
            {isLoading ? 'Processing...' : 'Ready for analysis'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function formatCell(value: any, type?: string): string {
  if (value == null) return '-';
  
  switch (type) {
    case 'currency':
      return formatCurrency(parseFloat(value) || 0);
    case 'percent':
      return `${(parseFloat(value) * 100).toFixed(1)}%`;
    case 'date':
      return new Date(value).toLocaleDateString();
    default:
      return String(value).slice(0, 30);
  }
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

export default DataCard;
