/**
 * A2rchitect Super-Agent OS - Data Grid Program
 * 
 * Production-ready data grid with:
 * - Real Python-powered visualization (Matplotlib/Plotly/Seaborn)
 * - CSV import/export
 * - Formula support
 * - Integration with PythonExecutionService
 */

import * as React from 'react';
const { useState, useCallback, useRef, useEffect } = React;
import { useSidecarStore } from '../stores/useSidecarStore';
import { usePythonExecution, VisualizationLibrary } from '../services/PythonExecutionService';
import { useFileSystem } from '../services/FileSystemService';
import type { A2rProgram, DataGridState, DataGridColumn, DataGridRow, DataGridVisualization } from '../types/programs';

interface DataGridProgramProps {
  program: A2rProgram;
}

// ============================================================================
// CSV Parser
// ============================================================================

function parseCSV(csvText: string): { headers: string[]; rows: string[][] } {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) return { headers: [], rows: [] };
  
  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map(line => parseCSVLine(line));
  
  return { headers, rows };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function generateCSV(headers: string[], rows: Record<string, string>[]): string {
  const escapeValue = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };
  
  const lines = [
    headers.map(escapeValue).join(','),
    ...rows.map(row => headers.map(h => escapeValue(String(row[h] ?? ''))).join(','))
  ];
  
  return lines.join('\n');
}

// ============================================================================
// Cell Renderer
// ============================================================================

const Cell: React.FC<{
  value: unknown;
  column: DataGridColumn;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (value: string) => void;
  onCancel: () => void;
}> = ({ value, column, isEditing, onEdit, onSave, onCancel }) => {
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
      <input
        type={column.type === 'number' ? 'number' : 'text'}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => onSave(editValue)}
        className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        autoFocus
      />
    );
  }

  const displayValue = value === null || value === undefined ? '' : String(value);
  
  return (
    <div
      onClick={onEdit}
      className="px-2 py-1 text-sm truncate cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
    >
      {column.type === 'boolean' ? (
        <span className={value ? 'text-green-600' : 'text-gray-400'}>
          {value ? '✓' : '○'}
        </span>
      ) : (
        displayValue
      )}
    </div>
  );
};

// ============================================================================
// Quick Chart — Chart.js in sandboxed iframe (no Python required)
// ============================================================================

function buildChartJsHtml(
  type: string,
  xColId: string,
  yColId: string,
  columns: DataGridColumn[],
  rows: DataGridRow[],
  title: string,
): string {
  const xCol = columns.find(c => c.id === xColId);
  const yCol = columns.find(c => c.id === yColId);
  if (!xCol || !yCol) return '<html><body><p style="color:#aaa;font-family:sans-serif;padding:16px">No numeric column found for chart</p></body></html>';

  const labels = rows.map(r => String(r.cells[xColId] ?? ''));
  const values = rows.map(r => {
    const v = r.cells[yColId];
    return typeof v === 'number' ? v : parseFloat(String(v ?? '0')) || 0;
  });

  const chartType = type === 'line' ? 'line' : type === 'pie' ? 'pie' : 'bar';
  const colors = values.map((_, i) => `hsl(${(i * 47 + 210) % 360},65%,55%)`);

  const datasetConfig = chartType === 'pie'
    ? `{
        data: ${JSON.stringify(values)},
        backgroundColor: ${JSON.stringify(colors)},
      }`
    : `{
        label: '${yCol.header}',
        data: ${JSON.stringify(values)},
        backgroundColor: 'rgba(59,130,246,0.7)',
        borderColor: 'rgba(59,130,246,1)',
        borderWidth: 1,
        borderRadius: 4,
      }`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<style>
  body { margin:0; padding:12px; background:#0f172a; font-family:system-ui,sans-serif; }
  h3 { color:#f1f5f9; font-size:13px; margin:0 0 10px; font-weight:500; }
  canvas { max-height:280px; }
</style>
</head>
<body>
<h3>${title}</h3>
<canvas id="chart"></canvas>
<script>
  new Chart(document.getElementById('chart'), {
    type: '${chartType}',
    data: {
      labels: ${JSON.stringify(labels)},
      datasets: [${datasetConfig}],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 11 } } },
      },
      scales: ${chartType === 'pie' ? '{}' : `{
        x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.07)' } },
      }`},
    },
  });
</script>
</body>
</html>`;
}

const QuickChartPanel: React.FC<{
  viz: DataGridVisualization;
  columns: DataGridColumn[];
  rows: DataGridRow[];
  onClose: () => void;
}> = ({ viz, columns, rows, onClose }) => {
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>(
    (viz.type as 'bar' | 'line' | 'pie') ?? 'bar'
  );
  const xColId = (viz.config?.xAxis as string) || columns[0]?.id || '';
  const yColId = (viz.config?.yAxis as string) || columns.find(c => c.type === 'number')?.id || columns[1]?.id || '';

  const iframeSrc = React.useMemo(() => {
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
        <span className="text-xs font-medium text-slate-300">{viz.title}</span>
        <div className="flex items-center gap-2">
          <select
            value={chartType}
            onChange={e => setChartType(e.target.value as 'bar' | 'line' | 'pie')}
            className="text-xs bg-slate-700 border border-white/10 rounded px-2 py-0.5 text-slate-200"
          >
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="pie">Pie</option>
          </select>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-slate-200">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      <div className="flex-1 p-2">
        <iframe
          src={iframeSrc}
          className="w-full h-full rounded border-0"
          sandbox="allow-scripts"
          title="Chart Preview"
        />
      </div>
    </div>
  );
};

// ============================================================================
// Visualization Panel (Real)
// ============================================================================

const VisualizationPanel: React.FC<{
  programId: string;
  visualizations: DataGridVisualization[];
  data: { columns: DataGridColumn[]; rows: DataGridRow[] };
  onClose: () => void;
}> = ({ programId, visualizations, data, onClose }) => {
  const [activeVizId, setActiveVizId] = useState<string>(visualizations[0]?.id);
  const [selectedLibrary, setSelectedLibrary] = useState<VisualizationLibrary>('matplotlib');
  const { executeViz, generateCode } = usePythonExecution();
  
  const activeViz = visualizations.find(v => v.id === activeVizId);

  const handleRender = useCallback(async () => {
    if (!activeViz) return;
    await executeViz(programId, activeViz.id, selectedLibrary);
  }, [activeViz, executeViz, programId, selectedLibrary]);

  const handlePreviewCode = useCallback(() => {
    if (!activeViz) return;
    const columns = activeViz.config?.columns as string[] || data.columns.map(c => c.id);
    const rowData = data.rows.map(row => row.cells as Record<string, unknown>);
    return generateCode(activeViz.type, columns, rowData, selectedLibrary);
  }, [activeViz, data, generateCode, selectedLibrary]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Visualization
          </span>
          {visualizations.length > 1 && (
            <select
              value={activeVizId}
              onChange={(e) => setActiveVizId(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800"
            >
              {visualizations.map(v => (
                <option key={v.id} value={v.id}>{v.title}</option>
              ))}
            </select>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Controls */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Library:</label>
          <select
            value={selectedLibrary}
            onChange={(e) => setSelectedLibrary(e.target.value as VisualizationLibrary)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800"
          >
            <option value="matplotlib">Matplotlib</option>
            <option value="plotly">Plotly</option>
            <option value="seaborn">Seaborn</option>
          </select>
          <button
            onClick={handleRender}
            disabled={activeViz?.status === 'rendering'}
            className="ml-auto flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {activeViz?.status === 'rendering' ? (
              <>
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Rendering...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Render
              </>
            )}
          </button>
        </div>
      </div>

      {/* Chart area */}
      <div className="flex-1 p-4 bg-gray-50 dark:bg-gray-900 overflow-auto">
        {activeViz?.status === 'complete' && activeViz.resultUrl ? (
          <div className="h-full flex flex-col">
            <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              {activeViz.resultUrl.startsWith('data:image') ? (
                <img 
                  src={activeViz.resultUrl} 
                  alt={activeViz.title}
                  className="w-full h-full object-contain"
                />
              ) : activeViz.resultUrl.endsWith('.html') || activeViz.resultUrl.startsWith('data:text/html') ? (
                <iframe
                  src={activeViz.resultUrl}
                  title={activeViz.title}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts allow-same-origin"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <a 
                    href={activeViz.resultUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View Output
                  </a>
                </div>
              )}
            </div>
          </div>
        ) : activeViz?.status === 'error' ? (
          <div className="h-full flex flex-col items-center justify-center text-red-500 p-4">
            <svg className="w-12 h-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm font-medium">Rendering failed</p>
            <p className="text-xs mt-1 max-w-xs text-center">{activeViz.errorMessage}</p>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-sm">Click "Render" to generate visualization</p>
              <p className="text-xs mt-1">{activeViz?.type} chart with {selectedLibrary}</p>
            </div>
          </div>
        )}
      </div>

      {/* Python code preview */}
      {activeViz && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 max-h-48 overflow-auto">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Python Code</div>
          <pre className="text-xs bg-gray-900 text-gray-300 p-3 rounded overflow-x-auto">
            <code>{handlePreviewCode()}</code>
          </pre>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Toolbar Component
// ============================================================================

const Toolbar: React.FC<{
  onAddRow: () => void;
  onAddColumn: () => void;
  onDeleteSelected: () => void;
  onExport: (format: 'csv' | 'json') => void;
  onImport: () => void;
  onToggleViz: () => void;
  onSaveToDrive: () => void;
  hasViz: boolean;
  selectedCount: number;
}> = ({ 
  onAddRow, 
  onAddColumn, 
  onDeleteSelected, 
  onExport, 
  onImport,
  onToggleViz,
  onSaveToDrive,
  hasViz,
  selectedCount 
}) => {
  return (
    <div className="flex items-center gap-2 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-wrap">
      <button
        onClick={onAddRow}
        className="flex items-center gap-1 px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Row
      </button>
      
      <button
        onClick={onAddColumn}
        className="flex items-center gap-1 px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Column
      </button>

      {selectedCount > 0 && (
        <button
          onClick={onDeleteSelected}
          className="flex items-center gap-1 px-2 py-1 text-sm text-red-600 bg-white dark:bg-gray-800 border border-red-300 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900/30"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete ({selectedCount})
        </button>
      )}

      <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1" />

      <button
        onClick={onImport}
        className="flex items-center gap-1 px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        Import CSV
      </button>

      <select
        onChange={(e) => e.target.value && onExport(e.target.value as 'csv' | 'json')}
        className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800"
        defaultValue=""
      >
        <option value="" disabled>Export...</option>
        <option value="csv">Export CSV</option>
        <option value="json">Export JSON</option>
      </select>

      <button
        onClick={onSaveToDrive}
        className="flex items-center gap-1 px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Save to Drive
      </button>

      <div className="flex-1" />

      <button
        onClick={onToggleViz}
        disabled={!hasViz}
        className={`
          flex items-center gap-1 px-2 py-1 text-sm rounded
          ${hasViz 
            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50' 
            : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
          }
        `}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Visualize
      </button>
    </div>
  );
};

// ============================================================================
// Main DataGrid Program
// ============================================================================

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

  // Auto-show chart panel when agent populates the grid with Chart.js visualization
  useEffect(() => {
    const hasChartJsViz = visualizations.some(v => v.config?.chartEngine === 'chartjs');
    if (hasChartJsViz && rows.length > 0 && !isGenerating) {
      setShowViz(true);
    }
  }, [visualizations.length, rows.length, isGenerating]);

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
  }, [state, columns, rows, title]);

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
    const file = new File([blob], `${title}.a2rgrid.json`, { type: 'application/json' });
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
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Hidden file input for CSV import */}
      <input
        ref={fileInputRef}
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-xl">📊</span>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          {isGenerating && (
            <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              Generating...
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
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
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6">
              <span className="text-4xl mb-2">📊</span>
              {isGenerating && liveAgentText ? (
                <div className="w-full max-w-sm text-left mt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">Generating data</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                    {liveAgentText.split('<launch_utility')[0].trim().slice(0, 300)}<span className="animate-pulse">▊</span>
                  </p>
                </div>
              ) : (
                <p className="text-sm">Add columns or import CSV to start</p>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
              >
                Import CSV
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
                <tr>
                  <th className="w-8 p-2 border-b border-gray-200 dark:border-gray-700">
                    <input 
                      type="checkbox" 
                      className="rounded"
                      checked={selectedRows.size === rows.length && rows.length > 0}
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
                      className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 min-w-[120px]"
                    >
                      {col.header}
                      <span className="ml-1 text-gray-400 font-normal">
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
                      hover:bg-gray-50 dark:hover:bg-gray-800/50
                      ${selectedRows.has(row.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                    `}
                  >
                    <td className="p-2 border-b border-gray-100 dark:border-gray-800">
                      <input 
                        type="checkbox" 
                        className="rounded"
                        checked={selectedRows.has(row.id)}
                        onChange={() => toggleRowSelection(row.id)}
                      />
                    </td>
                    {columns.map(col => (
                      <td 
                        key={col.id}
                        className="border-b border-gray-100 dark:border-gray-800"
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
              <div className="w-80 border-l border-white/10">
                <QuickChartPanel
                  viz={chartJsViz}
                  columns={columns}
                  rows={rows}
                  onClose={() => setShowViz(false)}
                />
              </div>
            );
          }
          return (
            <div className="w-96 border-l border-gray-200 dark:border-gray-700">
              <VisualizationPanel
                programId={program.id}
                visualizations={visualizations}
                data={{ columns, rows }}
                onClose={() => setShowViz(false)}
              />
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default DataGridProgram;
