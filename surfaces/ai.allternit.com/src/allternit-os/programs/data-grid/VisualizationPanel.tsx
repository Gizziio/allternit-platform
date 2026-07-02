import React, { useCallback, useState } from "react";

"use client";
import { usePythonExecution, VisualizationLibrary } from '../../services/PythonExecutionService';
import type { DataGridColumn, DataGridRow, DataGridVisualization } from '../../types/programs';

interface VisualizationPanelProps {
  programId: string;
  visualizations: DataGridVisualization[];
  data: { columns: DataGridColumn[]; rows: DataGridRow[] };
  onClose: () => void;
}

export const VisualizationPanel: React.FC<VisualizationPanelProps> = ({ programId, visualizations, data, onClose }) => {
  const [activeVizId, setActiveVizId] = useState<string>(visualizations[0]?.id);
  const [selectedLibrary, setSelectedLibrary] = useState<VisualizationLibrary>('matplotlib');
  const { executeViz, generateCode } = usePythonExecution();
  
  const activeViz = visualizations.find(v => v.id === activeVizId);

  const handleRender = useCallback(async () => {
    if (!activeViz) return;
    await executeViz(programId, activeViz.id, selectedLibrary);
  }, [activeViz, executeViz, programId, selectedLibrary]);

  const handlePreviewCode = useCallback(() => {
    if (!activeViz) return '';
    const columns = activeViz.config?.columns as string[] || data.columns.map(c => c.id);
    const rowData = data.rows.map(row => row.cells as Record<string, unknown>);
    return generateCode(activeViz.type, columns, rowData, selectedLibrary);
  }, [activeViz, data, generateCode, selectedLibrary]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Visualization
          </span>
          {visualizations.length > 1 && (
            <select aria-label="Selection" value={activeVizId}
              onChange={(e) => setActiveVizId(e.target.value)}
              className="text-sm border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 bg-white dark:bg-zinc-800 focus:ring-1 focus:ring-blue-500 outline-none"
            >
              {visualizations.map(v => (
                <option key={v.id} value={v.id}>{v.title}</option>
              ))}
            </select>
          )}
        </div>
        <button type="button"
          onClick={onClose}
          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Controls */}
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-700 space-y-2">
        <div className="flex items-center gap-2">
          <label htmlFor="viz-library" className="text-xs text-zinc-500 font-medium">Library:</label>
          <select
            id="viz-library"
            value={selectedLibrary}            onChange={(e) => setSelectedLibrary(e.target.value as VisualizationLibrary)}
            className="text-sm border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 bg-white dark:bg-zinc-800 focus:ring-1 focus:ring-blue-500 outline-none"
          >
            <option value="matplotlib">Matplotlib</option>
            <option value="plotly">Plotly</option>
            <option value="seaborn">Seaborn</option>
          </select>
          <button type="button"
            onClick={handleRender}
            disabled={activeViz?.status === 'rendering'}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {activeViz?.status === 'rendering' ? (
              <>
                <span className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Rendering...
              </>
            ) : (
              <>
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      <div className="flex-1 p-4 bg-zinc-50 dark:bg-zinc-950 overflow-auto">
        {activeViz?.status === 'complete' && activeViz.resultUrl ? (
          <div className="h-full flex flex-col">
            <div className="flex-1 bg-white dark:bg-zinc-900 rounded-lg shadow-md border border-zinc-200 dark:border-zinc-800 overflow-hidden">
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
                <div className="flex items-center justify-center h-full text-zinc-400">
                  <a 
                    href={activeViz.resultUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1.5"
                  >
                    View Output
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              )}
            </div>
          </div>
        ) : activeViz?.status === 'error' ? (
          <div className="h-full flex flex-col items-center justify-center text-red-500 p-6 text-center">
            <div className="size-14 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
              <svg className="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-sm font-bold uppercase tracking-wider mb-1">Rendering failed</p>
            <p className="text-xs text-zinc-500 max-w-xs">{activeViz.errorMessage}</p>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-zinc-400">
            <div className="text-center">
              <div className="size-20 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="size-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-zinc-500">Ready to Visualize</p>
              <p className="text-xs mt-1 text-zinc-400">Click "Render" to execute analysis</p>
            </div>
          </div>
        )}
      </div>

      {/* Python code preview */}
      {activeViz && (
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black/30 max-h-48 overflow-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Python Preview</span>
            <button type="button" className="text-[10px] text-blue-500 hover:text-blue-400 font-bold uppercase">Copy</button>
          </div>
          <pre className="text-[12px] font-mono text-zinc-400 leading-relaxed overflow-x-auto">
            <code>{handlePreviewCode()}</code>
          </pre>
        </div>
      )}
    </div>
  );
};
