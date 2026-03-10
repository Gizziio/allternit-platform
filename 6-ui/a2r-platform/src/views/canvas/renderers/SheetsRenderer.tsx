/**
 * SheetsRenderer.tsx
 * 
 * Renders interactive data grids (AI Sheets).
 * Excel-like interface with sorting, filtering, and charts.
 */

import React, { useState, useMemo } from 'react';
import { 
  Table, 
  SortAsc, 
  SortDesc, 
  Filter, 
  Plus, 
  Download, 
  Share2,
  MoreHorizontal,
  BarChart3,
  Grid3x3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ArtifactUIPart } from '@/lib/ai/rust-stream-adapter';
import { cn } from '@/lib/utils';

interface SheetsRendererProps {
  artifact: ArtifactUIPart;
  sessionId?: string;
  onMoATaskUpdate?: (tasks: any[]) => void;
}

interface DataRow {
  id: string;
  [key: string]: string | number;
}

interface Column {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date';
}

export function SheetsRenderer({
  artifact,
  sessionId,
  onMoATaskUpdate,
}: SheetsRendererProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedRow, setSelectedRow] = useState<string | null>(null);

  // Parse data from content (mock for now)
  const { columns, rows } = useMemo<{ columns: Column[]; rows: DataRow[] }>(() => {
    if (!artifact.content) {
      // Default demo data
      return {
        columns: [
          { key: 'name', label: 'Name', type: 'text' },
          { key: 'type', label: 'Type', type: 'text' },
          { key: 'status', label: 'Status', type: 'text' },
          { key: 'value', label: 'Value', type: 'number' },
          { key: 'change', label: 'Change %', type: 'number' },
        ],
        rows: [
          { id: '1', name: 'Bitcoin', type: 'Crypto', status: 'Active', value: 67234, change: 2.4 },
          { id: '2', name: 'Ethereum', type: 'Crypto', status: 'Active', value: 3456, change: -1.2 },
          { id: '3', name: 'Apple', type: 'Stock', status: 'Active', value: 178, change: 0.8 },
          { id: '4', name: 'Tesla', type: 'Stock', status: 'Active', value: 245, change: 3.2 },
          { id: '5', name: 'Gold', type: 'Commodity', status: 'Active', value: 2034, change: 0.3 },
        ],
      };
    }

    // Parse CSV-like content
    const lines = artifact.content.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    return {
      columns: headers.map((header, i) => ({
        key: `col-${i}`,
        label: header,
        type: 'text' as const,
      })),
      rows: lines.slice(1).map((line, index) => {
        const values = line.split(',').map(v => v.trim());
        const row: DataRow = { id: `row-${index}` };
        headers.forEach((header, i) => {
          row[header.toLowerCase().replace(/\s+/g, '_')] = values[i] || '';
        });
        return row;
      }),
    };
  }, [artifact.content]);

  // Sort data
  const sortedRows = useMemo(() => {
    if (!sortColumn) return rows;

    return [...rows].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDirection === 'asc' 
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [rows, sortColumn, sortDirection]);

  // Handle column sort
  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  // Format cell value
  const formatCell = (value: string | number, type: string) => {
    if (typeof value === 'number') {
      if (type === 'change') {
        const numValue = value as number;
        const color = numValue >= 0 ? 'text-green-500' : 'text-red-500';
        return <span className={color}>{numValue >= 0 ? '+' : ''}{numValue.toFixed(2)}%</span>;
      }
      if (value > 1000) {
        return value.toLocaleString();
      }
      return String(value);
    }
    return String(value);
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)]">
      {/* Toolbar */}
      <div className="h-12 border-b border-[var(--border-subtle)] flex items-center justify-between px-4 bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-3">
          <Grid3x3 className="w-4 h-4 text-[var(--accent-primary)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {artifact.title}
          </span>
          <span className="text-xs text-[var(--text-tertiary)]">
            {rows.length} rows × {columns.length} columns
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-[var(--text-tertiary)]">
            <BarChart3 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-[var(--text-tertiary)]">
            <Download className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-[var(--text-tertiary)]">
            <Share2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-[var(--text-tertiary)]">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-[var(--bg-secondary)] z-10">
            <tr>
              <th className="w-10 border-b border-r border-[var(--border-subtle)] p-2 text-center text-xs text-[var(--text-tertiary)]">
                #
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="border-b border-r border-[var(--border-subtle)] p-2 text-left cursor-pointer hover:bg-[var(--bg-primary)] transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                      {col.label}
                    </span>
                    {sortColumn === col.key && (
                      sortDirection === 'asc' ? (
                        <SortAsc className="w-3 h-3 text-[var(--accent-primary)]" />
                      ) : (
                        <SortDesc className="w-3 h-3 text-[var(--accent-primary)]" />
                      )
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, rowIndex) => (
              <tr
                key={row.id}
                onClick={() => setSelectedRow(row.id)}
                className={cn(
                  "cursor-pointer transition-colors",
                  selectedRow === row.id
                    ? "bg-[var(--accent-primary)]/10"
                    : "hover:bg-[var(--bg-secondary)]"
                )}
              >
                <td className="border-b border-r border-[var(--border-subtle)] p-2 text-center text-xs text-[var(--text-tertiary)]">
                  {rowIndex + 1}
                </td>
                {columns.map((col) => (
                  <td
                    key={`${row.id}-${col.key}`}
                    className="border-b border-r border-[var(--border-subtle)] p-2 text-sm text-[var(--text-secondary)]"
                  >
                    {formatCell(row[col.key] || row[col.label] || '', col.type)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Status bar */}
      <div className="h-8 border-t border-[var(--border-subtle)] flex items-center justify-between px-4 text-xs text-[var(--text-tertiary)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-4">
          <span>{rows.length} rows</span>
          <span>{columns.length} columns</span>
          {selectedRow && (
            <span>Selected: Row {parseInt(selectedRow) + 1}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-6 text-xs">
            <Filter className="w-3 h-3 mr-1" />
            Filter
          </Button>
          <Button variant="ghost" size="sm" className="h-6 text-xs">
            <Plus className="w-3 h-3 mr-1" />
            Add Row
          </Button>
        </div>
      </div>
    </div>
  );
}
