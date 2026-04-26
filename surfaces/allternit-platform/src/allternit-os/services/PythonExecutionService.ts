/**
 * allternit Super-Agent OS - Python Execution Bridge
 * 
 * Connects DataGrid visualizations to Python kernel execution.
 * Supports matplotlib, plotly, seaborn, and pandas operations.
 */

import { useSidecarStore } from '../stores/useSidecarStore';
import type { DataGridState, DataGridVisualization } from '../types/programs';

// ============================================================================
// Types
// ============================================================================

export interface PythonExecutionRequest {
  vizId: string;
  programId: string;
  code: string;
  libraries: string[];
  timeout?: number;
}

export interface PythonExecutionResult {
  success: boolean;
  outputUrl?: string;
  error?: string;
  logs: string[];
  executionTime: number;
}

export type VisualizationLibrary = 'matplotlib' | 'plotly' | 'seaborn' | 'pandas';

// ============================================================================
// Code Generators
// ============================================================================

export function generateVisualizationCode(
  type: DataGridVisualization['type'],
  columns: string[],
  data: Record<string, unknown>[],
  library: VisualizationLibrary = 'matplotlib'
): string {
  const dfCode = generateDataFrameCode(data);
  
  switch (library) {
    case 'matplotlib':
      return generateMatplotlibCode(type, columns, dfCode);
    case 'plotly':
      return generatePlotlyCode(type, columns, dfCode);
    case 'seaborn':
      return generateSeabornCode(type, columns, dfCode);
    default:
      return generateMatplotlibCode(type, columns, dfCode);
  }
}

function generateDataFrameCode(data: Record<string, unknown>[]): string {
  return `
import pandas as pd
import json

# Data from allternit DataGrid
data = json.loads('${JSON.stringify(data).replace(/'/g, "\\'")}')
df = pd.DataFrame(data)
print(f"DataFrame shape: {df.shape}")
print(f"Columns: {list(df.columns)}")
`;
}

function generateMatplotlibCode(
  type: DataGridVisualization['type'],
  columns: string[],
  dfCode: string
): string {
  const xCol = columns[0] || 'index';
  const yCol = columns[1] || columns[0];
  
  let plotCode = '';
  
  switch (type) {
    case 'bar':
      plotCode = `df.plot.bar(x='${xCol}', y='${yCol}', figsize=(10, 6))`;
      break;
    case 'line':
      plotCode = `df.plot.line(x='${xCol}', y='${yCol}', figsize=(10, 6), marker='o')`;
      break;
    case 'scatter':
      plotCode = `df.plot.scatter(x='${xCol}', y='${yCol}', figsize=(10, 6), alpha=0.6)`;
      break;
    case 'pie':
      plotCode = `df.set_index('${xCol}')['${yCol}'].plot.pie(figsize=(8, 8), autopct='%1.1f%%')`;
      break;
    case 'heatmap':
      plotCode = `sns.heatmap(df.corr(), annot=True, cmap='coolwarm', figsize=(10, 8))`;
      break;
    default:
      plotCode = `df.plot(figsize=(10, 6))`;
  }

  return `${dfCode}
import matplotlib.pyplot as plt
import seaborn as sns

# Create visualization
plt.figure(figsize=(10, 6))
${plotCode}
plt.title('${type.charAt(0).toUpperCase() + type.slice(1)} Chart')
plt.xlabel('${xCol}')
plt.ylabel('${yCol}')
plt.tight_layout()

# Save to file
output_path = '/tmp/allternit_viz_${Date.now()}.png'
plt.savefig(output_path, dpi=150, bbox_inches='tight')
print(f"SAVED:{output_path}")
plt.close()
`;
}

function generatePlotlyCode(
  type: DataGridVisualization['type'],
  columns: string[],
  dfCode: string
): string {
  const xCol = columns[0] || 'index';
  const yCol = columns[1] || columns[0];
  
  let plotCode = '';
  
  switch (type) {
    case 'bar':
      plotCode = `fig = px.bar(df, x='${xCol}', y='${yCol}', title='${type.charAt(0).toUpperCase() + type.slice(1)} Chart')`;
      break;
    case 'line':
      plotCode = `fig = px.line(df, x='${xCol}', y='${yCol}', title='${type.charAt(0).toUpperCase() + type.slice(1)} Chart', markers=True)`;
      break;
    case 'scatter':
      plotCode = `fig = px.scatter(df, x='${xCol}', y='${yCol}', title='${type.charAt(0).toUpperCase() + type.slice(1)} Chart', opacity=0.6)`;
      break;
    case 'pie':
      plotCode = `fig = px.pie(df, names='${xCol}', values='${yCol}', title='${type.charAt(0).toUpperCase() + type.slice(1)} Chart')`;
      break;
    default:
      plotCode = `fig = px.line(df, title='Chart')`;
  }

  return `${dfCode}
import plotly.express as px
import plotly.io as pio

# Create visualization
${plotCode}

# Save to HTML
output_path = '/tmp/allternit_viz_${Date.now()}.html'
fig.write_html(output_path)
print(f"SAVED:{output_path}")
`;
}

function generateSeabornCode(
  type: DataGridVisualization['type'],
  columns: string[],
  dfCode: string
): string {
  const xCol = columns[0] || 'index';
  const yCol = columns[1] || columns[0];
  
  let plotCode = '';
  
  switch (type) {
    case 'bar':
      plotCode = `sns.barplot(data=df, x='${xCol}', y='${yCol}')`;
      break;
    case 'line':
      plotCode = `sns.lineplot(data=df, x='${xCol}', y='${yCol}', marker='o')`;
      break;
    case 'scatter':
      plotCode = `sns.scatterplot(data=df, x='${xCol}', y='${yCol}', alpha=0.6)`;
      break;
    case 'heatmap':
      plotCode = `sns.heatmap(df.corr(), annot=True, cmap='coolwarm')`;
      break;
    default:
      plotCode = `sns.lineplot(data=df, x='${xCol}', y='${yCol}')`;
  }

  return `${dfCode}
import matplotlib.pyplot as plt
import seaborn as sns

# Set style
sns.set_style("whitegrid")

# Create visualization
plt.figure(figsize=(10, 6))
${plotCode}
plt.title('${type.charAt(0).toUpperCase() + type.slice(1)} Chart')
plt.tight_layout()

# Save to file
output_path = '/tmp/allternit_viz_${Date.now()}.png'
plt.savefig(output_path, dpi=150, bbox_inches='tight')
print(f"SAVED:{output_path}")
plt.close()
`;
}

// ============================================================================
// Execution Bridge
// ============================================================================

export class PythonExecutionBridge {
  private kernelEndpoint: string;
  private activeExecutions: Map<string, AbortController> = new Map();

  constructor(kernelEndpoint: string = 'http://localhost:8080/kernel/python') {
    this.kernelEndpoint = kernelEndpoint;
  }

  /**
   * Execute Python code for visualization
   */
  async execute(request: PythonExecutionRequest): Promise<PythonExecutionResult> {
    const { vizId, programId, code, timeout = 30000 } = request;
    
    // Update visualization status to rendering
    this.updateVizStatus(programId, vizId, 'rendering');
    
    const startTime = Date.now();
    const abortController = new AbortController();
    this.activeExecutions.set(vizId, abortController);

    try {
      const response = await fetch(this.kernelEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          timeout,
          context: {
            vizId,
            programId,
          },
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Parse output to find saved file path
      const outputUrl = this.parseOutputUrl(result.output);
      
      this.activeExecutions.delete(vizId);
      
      return {
        success: true,
        outputUrl,
        logs: result.logs || [],
        executionTime: Date.now() - startTime,
      };

    } catch (error) {
      this.activeExecutions.delete(vizId);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        success: false,
        error: errorMessage,
        logs: [],
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Cancel an ongoing execution
   */
  cancel(vizId: string): void {
    const controller = this.activeExecutions.get(vizId);
    if (controller) {
      controller.abort();
      this.activeExecutions.delete(vizId);
    }
  }

  /**
   * Generate and execute visualization for DataGrid
   */
  async executeVisualization(
    programId: string,
    vizId: string,
    library: VisualizationLibrary = 'matplotlib'
  ): Promise<void> {
    const store = useSidecarStore.getState();
    const state = store.getProgramState<DataGridState>(programId);
    
    if (!state) return;

    const viz = state.visualizations.find(v => v.id === vizId);
    if (!viz) return;

    // Extract columns to visualize
    const columns = viz.config.columns as string[] || state.columns.map(c => c.id);
    
    // Convert rows to data
    const data = state.rows.map(row => row.cells);

    // Generate Python code
    const code = generateVisualizationCode(viz.type, columns, data, library);

    // Update viz with code
    store.updateProgramState<DataGridState>(programId, (prev) => ({
      ...prev,
      visualizations: prev.visualizations.map(v => 
        v.id === vizId ? { ...v, pythonCode: code } : v
      ),
    }));

    // Execute
    const result = await this.execute({
      vizId,
      programId,
      code,
      libraries: this.getRequiredLibraries(library),
    });

    // Update with result
    if (result.success) {
      this.updateVizComplete(programId, vizId, result.outputUrl!);
    } else {
      this.updateVizError(programId, vizId, result.error!);
    }
  }

  private parseOutputUrl(output: string): string | undefined {
    const match = output.match(/SAVED:(.+)/);
    return match ? match[1] : undefined;
  }

  private getRequiredLibraries(library: VisualizationLibrary): string[] {
    const libs: Record<VisualizationLibrary, string[]> = {
      matplotlib: ['matplotlib', 'pandas', 'numpy'],
      plotly: ['plotly', 'pandas'],
      seaborn: ['seaborn', 'matplotlib', 'pandas'],
      pandas: ['pandas'],
    };
    return libs[library];
  }

  private updateVizStatus(
    programId: string,
    vizId: string,
    status: DataGridVisualization['status']
  ): void {
    const store = useSidecarStore.getState();
    store.updateProgramState<DataGridState>(programId, (prev) => ({
      ...prev,
      visualizations: prev.visualizations.map(v => 
        v.id === vizId ? { ...v, status } : v
      ),
    }));
  }

  private updateVizComplete(programId: string, vizId: string, resultUrl: string): void {
    const store = useSidecarStore.getState();
    store.updateProgramState<DataGridState>(programId, (prev) => ({
      ...prev,
      visualizations: prev.visualizations.map(v => 
        v.id === vizId ? { ...v, status: 'complete', resultUrl } : v
      ),
    }));
  }

  private updateVizError(programId: string, vizId: string, errorMessage: string): void {
    const store = useSidecarStore.getState();
    store.updateProgramState<DataGridState>(programId, (prev) => ({
      ...prev,
      visualizations: prev.visualizations.map(v => 
        v.id === vizId ? { ...v, status: 'error', errorMessage } : v
      ),
    }));
  }
}

// ============================================================================
// React Hook
// ============================================================================

import { useCallback, useRef } from 'react';

export function usePythonExecution(endpoint?: string) {
  const bridgeRef = useRef(new PythonExecutionBridge(endpoint));

  const executeViz = useCallback(async (
    programId: string,
    vizId: string,
    library: VisualizationLibrary = 'matplotlib'
  ) => {
    return bridgeRef.current.executeVisualization(programId, vizId, library);
  }, []);

  const cancelExecution = useCallback((vizId: string) => {
    bridgeRef.current.cancel(vizId);
  }, []);

  const generateCode = useCallback((
    type: DataGridVisualization['type'],
    columns: string[],
    data: Record<string, unknown>[],
    library: VisualizationLibrary
  ) => {
    return generateVisualizationCode(type, columns, data, library);
  }, []);

  return {
    executeViz,
    cancelExecution,
    generateCode,
    bridge: bridgeRef.current,
  };
}
