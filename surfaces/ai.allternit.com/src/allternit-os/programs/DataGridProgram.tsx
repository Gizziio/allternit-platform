"use client";

import * as React from 'react';
const { useState, useCallback, useRef, useEffect } = React;
import { useSidecarStore } from '../stores/useSidecarStore';
import { useFileSystem } from '../services/FileSystemService';
import type { AllternitProgram, DataGridState, DataGridColumn, DataGridRow } from '../types/programs';

// Modular components and utils
import { ProgramErrorBoundary } from '../components/ProgramErrorBoundary';
import { Cell } from './data-grid/Cell';
import { Toolbar } from './data-grid/Toolbar';
import { VisualizationPanel } from './data-grid/VisualizationPanel';
import { QuickChartPanel } from './data-grid/QuickChartPanel';
import { parseCSV, generateCSV } from './data-grid/csvUtils';

interface DataGridProgramProps {
  program: AllternitProgram;
}

export const DataGridProgram: React.FC<DataGridProgramProps> = ({ program }) => {
  const { updateProgramState } = useSidecarStore();
  const liveAgentText = useSidecarStore(s => s.liveAgentTexts[program.sourceThreadId] ?? '');
  const { uploadFile } = useFileSystem();
  const state = program.state as DataGridState;
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showViz, setShowViz] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Default state
  const title = state?.title ?? 'Untitled Spreadsheet';
  const columns = state?.columns ?? [];
  const rows = state?.rows ?? [];
  const visualizations = state?.visualizations ?? [];
  const isGenerating = state?.isGenerating ?? false;

  const [prevVizLength, setPrevVizLength] = useState(visualizations.length);
  const [prevRowsLength, setPrevRowsLength] = useState(rows.length);
  const [prevIsGenerating, setPrevIsGenerating] = useState(isGenerating);

  if (visualizations.length !== prevVizLength || rows.length !== prevRowsLength || isGenerating !== prevIsGenerating) {
    setPrevVizLength(visualizations.length);
    setPrevRowsLength(rows.length);
    setPrevIsGenerating(isGenerating);

    const hasChartJsViz = visualizations.some(v => v.config?.chartEngine === 'chartjs');
    if (hasChartJsViz && rows.length > 0 && !isGenerating) {
      setShowViz(true);
    }
  }

  // Handlers
  const handleAddRow = useCallback(() => {
    updateProgramState<DataGridState>(program.id, (prev) => {
      const newRow: DataGridRow = {
        id: `row_${Date.now()}`,
        cells: {},
      };
      return { ...prev, rows: [...prev.rows, newRow] };
    });
  }, [program.id, updateProgramState]);

  const handleAddColumn = useCallback(() => {
    updateProgramState<DataGridState>(program.id, (prev) => {
      const newCol: DataGridColumn = {
        id: `col_${Date.now()}`,
        header: `Column ${prev.columns.length + 1}`,
        type: 'text',
      };
      return { ...prev, columns: [...prev.columns, newCol] };
    });
  }, [program.id, updateProgramState]);

  const handleCellEdit = useCallback((rowId: string, colId: string, value: string) => {
    updateProgramState<DataGridState>(program.id, (prev) => {
      const newRows = prev.rows.map(row => {
        if (row.id !== rowId) return row;
        return {
          ...row,
          cells: { ...row.cells, [colId]: value },
        };
      });
      return { ...prev, rows: newRows };
    });
    setEditingCell(null);
  }, [program.id, updateProgramState]);

  const handleExport = useCallback((format: 'csv' | 'json') => {
    if (!state) return;
    
    const columnIds = columns.map(c => c.id);
    const rowData = rows.map(row => {
      const cells: Record<string, string> = {};
      columnIds.forEach(colId => {
        cells[colId] = String(row.cells[colId] ?? '');
      });
      return cells;
    });
    
    switch (format) {
      case 'csv': {
        const csv = generateCSV(columns.map(c => c.header), rowData);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        break;
      }
      case 'json': {
        const json = JSON.stringify({ columns, rows: rowData }, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.json`;
        a.click();
        URL.revokeObjectURL(url);
        break;
      }
    }
  }, [state, columns, rows, title, generateCSV]);

  const handleImportCSV = useCallback(async (file: File) => {
    setImportError(null);
    try {
      const text = await file.text();
      const { headers, rows: csvRows } = parseCSV(text);
      
      if (headers.length === 0) {
        setImportError('No columns found in CSV');
        return;
      }

      // Create columns from headers
      const newColumns: DataGridColumn[] = headers.map((h, i) => ({
        id: `col_${Date.now()}_${i}`,
        header: h,
        type: 'text',
      }));

      // Create rows from CSV data
      const newRows: DataGridRow[] = csvRows.map((rowData, i) => ({
        id: `row_${Date.now()}_${i}`,
        cells: rowData.reduce((acc, cell, idx) => {
          acc[newColumns[idx]?.id || `col_${idx}`] = cell;
          return acc;
        }, {} as Record<string, unknown>),
      }));

      updateProgramState<DataGridState>(program.id, (prev) => ({
        ...prev,
        columns: newColumns,
        rows: newRows,
      }));
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import CSV');
    }
  }, [program.id, updateProgramState]);

  const handleSaveToDrive = useCallback(async () => {
    const json = JSON.stringify({ columns, rows, title }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const file = new File([blob], `${title}.allternitgrid.json`, { type: 'application/json' });
    await uploadFile(file);
  }, [columns, rows, title, uploadFile]);

  const toggleRowSelection = (rowId: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-900">
      {/* Hidden file input for CSV import */}
      <input aria-label="File upload" ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImportCSV(file);
          e.target.value = '';
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <span className="text-xl">📊</span>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {title}
          </h2>
          {isGenerating && (
            <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
              <span className="size-2  bg-blue-500 rounded-full animate-pulse" />
              Generating...
            </span>
          )}
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {rows.length} rows × {columns.length} columns
        </div>
      </div>

      {/* Import error */}
      {importError && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          Import error: {importError}
        </div>
      )}

      {/* Toolbar */}
      <Toolbar
        onAddRow={handleAddRow}
        onAddColumn={handleAddColumn}
        onDeleteSelected={() => {
          updateProgramState<DataGridState>(program.id, (prev) => ({
            ...prev,
            rows: prev.rows.filter(r => !selectedRows.has(r.id)),
          }));
          setSelectedRows(new Set());
        }}
        onExport={handleExport}
        onImport={() => fileInputRef.current?.click()}
        onToggleViz={() => setShowViz(!showViz)}
        onSaveToDrive={handleSaveToDrive}
        hasViz={visualizations.length > 0}
        selectedCount={selectedRows.size}
      />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Data grid */}
        <div className="flex-1 overflow-auto">
          {columns.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-400 p-6">
              <span className="text-4xl mb-2">📊</span>
              {isGenerating && liveAgentText ? (
                <div className="w-full max-w-sm text-left mt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="size-2  bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">Generating data</span>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap">
                    {liveAgentText.split('<launch_utility')[0].trim().slice(0, 300)}<span className="animate-pulse">▊</span>
                  </p>
                </div>
              ) : (
                <p className="text-sm">Add columns or import CSV to start</p>
              )}
              <button type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
              >
                Import CSV
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-800 z-10">
                <tr>
                  <th className="w-8 p-2 border-b border-zinc-200 dark:border-zinc-700">
                    <input aria-label="Checkbox" type="checkbox" 
                      className="rounded"
                      checked={selectedRows.size === rows.length && rows.length> 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRows(new Set(rows.map(r => r.id)));
                        } else {
                          setSelectedRows(new Set());
                        }
                      }}
                    />
                  </th>
                  {columns.map(col => (
                    <th 
                      key={col.id}
                      className="px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-700 min-w-[120px]"
                    >
                      {col.header}
                      <span className="ml-1 text-zinc-400 font-normal">
                        {col.type === 'number' ? '#' : col.type === 'formula' ? 'ƒ' : 'T'}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr 
                    key={row.id}
                    className={`
                      hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors
                      ${selectedRows.has(row.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                    `}
                  >
                    <td className="p-2 border-b border-zinc-100 dark:border-zinc-800">
                      <input aria-label="Checkbox" type="checkbox" 
                        className="rounded"
                        checked={selectedRows.has(row.id)}
                        onChange={() => toggleRowSelection(row.id)}
                      />
                    </td>
                    {columns.map(col => (
                      <td 
                        key={col.id}
                        className="border-b border-zinc-100 dark:border-zinc-800"
                      >
                        <Cell
                          value={row.cells[col.id]}
                          column={col}
                          isEditing={editingCell?.rowId === row.id && editingCell?.colId === col.id}
                          onEdit={() => setEditingCell({ rowId: row.id, colId: col.id })}
                          onSave={(value) => handleCellEdit(row.id, col.id, value)}
                          onCancel={() => setEditingCell(null)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Visualization panel */}
        {showViz && visualizations.length > 0 && (() => {
          const chartJsViz = visualizations.find(v => v.config?.chartEngine === 'chartjs');
          if (chartJsViz) {
            return (
              <div className="w-80 border-l border-zinc-200 dark:border-zinc-700 shadow-xl z-10 bg-[#0f172a] animate-in slide-in-from-right duration-300">
                <ProgramErrorBoundary programName="Quick Chart">
                  <QuickChartPanel
                    viz={chartJsViz}
                    columns={columns}
                    rows={rows}
                    onClose={() => setShowViz(false)}
                  />
                </ProgramErrorBoundary>
              </div>
            );
          }
          return (
            <div className="w-96 border-l border-zinc-200 dark:border-zinc-700 shadow-xl z-10 bg-white dark:bg-zinc-900 animate-in slide-in-from-right duration-300">
              <ProgramErrorBoundary programName="Data Visualization">
                <VisualizationPanel
                  programId={program.id}
                  visualizations={visualizations}
                  data={{ columns, rows }}
                  onClose={() => setShowViz(false)}
                />
              </ProgramErrorBoundary>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default DataGridProgram;
