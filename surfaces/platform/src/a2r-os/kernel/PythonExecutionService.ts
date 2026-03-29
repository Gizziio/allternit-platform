/**
 * A2rchitect Super-Agent OS - Python Execution Service
 * 
 * Production-ready Python execution with multiple backend support:
 * - Mock mode: Browser-based simulation for development
 * - Kernel mode: Connect to 1-kernel a2r-daemon via Electron IPC
 * - HTTP mode: Connect to workspace service HTTP API
 * 
 * This replaces the stub PythonExecutionBridge with real execution capabilities.
 */

import { useSidecarStore } from '../stores/useSidecarStore';
import type { DataGridState, DataGridVisualization } from '../types/programs';

// ============================================================================
// Configuration Types
// ============================================================================

export type ExecutionBackend = 'mock' | 'kernel' | 'http';

export interface PythonExecutionConfig {
  backend: ExecutionBackend;
  /** HTTP endpoint for workspace service (HTTP mode) */
  httpEndpoint?: string;
  /** Unix socket path for kernel daemon (Kernel mode - used via Electron IPC) */
  kernelSocketPath?: string;
  /** Default timeout in milliseconds */
  defaultTimeout: number;
  /** Enable debug logging */
  debug: boolean;
}

// ============================================================================
// Execution Types
// ============================================================================

export interface PythonExecutionRequest {
  /** Unique execution ID */
  executionId: string;
  /** Python code to execute */
  code: string;
  /** Required Python packages */
  libraries: string[];
  /** Execution timeout in milliseconds */
  timeout?: number;
  /** Additional context */
  context?: {
    programId?: string;
    vizId?: string;
    sessionId?: string;
  };
  /** Working directory for execution */
  workingDir?: string;
  /** Environment variables */
  env?: Record<string, string>;
}

export interface PythonExecutionResult {
  success: boolean;
  /** Output file URL (for visualizations) */
  outputUrl?: string;
  /** Console stdout */
  stdout: string;
  /** Console stderr */
  stderr: string;
  /** Execution error message */
  error?: string;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Exit code */
  exitCode?: number;
  /** Resource usage */
  resources?: {
    cpuPercent: number;
    memoryMb: number;
  };
}

export interface ExecutionSession {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'error' | 'cancelled';
  request: PythonExecutionRequest;
  result?: PythonExecutionResult;
  startTime: number;
  endTime?: number;
  progress?: number;
}

export type VisualizationLibrary = 'matplotlib' | 'plotly' | 'seaborn' | 'pandas';

// ============================================================================
// Code Generators (Production-Ready)
// ============================================================================

export function generateVisualizationCode(
  type: DataGridVisualization['type'],
  columns: string[],
  data: Record<string, unknown>[],
  library: VisualizationLibrary = 'matplotlib'
): string {
  const sanitizedData = sanitizeForPython(data);
  const dfCode = generateDataFrameCode(sanitizedData);
  
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

function sanitizeForPython(data: Record<string, unknown>[]): Record<string, unknown>[] {
  // Sanitize data for safe Python string interpolation
  return data.map(row => {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'string') {
        // Escape single quotes and backslashes
        sanitized[key] = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  });
}

function generateDataFrameCode(data: Record<string, unknown>[]): string {
  return `
import pandas as pd
import json

# Data from A2rchitect DataGrid
data_json = '''${JSON.stringify(data)}'''
data = json.loads(data_json)
df = pd.DataFrame(data)
print(f"DataFrame: {df.shape[0]} rows × {df.shape[1]} columns")
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
      plotCode = `df.plot.bar(x='${xCol}', y='${yCol}', figsize=(10, 6), color='steelblue')`;
      break;
    case 'line':
      plotCode = `df.plot.line(x='${xCol}', y='${yCol}', figsize=(10, 6), marker='o', linewidth=2)`;
      break;
    case 'scatter':
      plotCode = `df.plot.scatter(x='${xCol}', y='${yCol}', figsize=(10, 6), alpha=0.6, c='steelblue')`;
      break;
    case 'pie':
      plotCode = `df.set_index('${xCol}')['${yCol}'].plot.pie(figsize=(8, 8), autopct='%1.1f%%')`;
      break;
    case 'heatmap':
      plotCode = `sns.heatmap(df.corr(), annot=True, cmap='coolwarm', fmt='.2f', square=True)`;
      break;
    default:
      plotCode = `df.plot(figsize=(10, 6))`;
  }

  return `${dfCode}
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
import seaborn as sns
import os

# Create visualization
plt.figure(figsize=(10, 6))
${plotCode}
plt.title('${type.charAt(0).toUpperCase() + type.slice(1)} Chart', fontsize=14, pad=20)
plt.xlabel('${xCol}', fontsize=12)
plt.ylabel('${yCol}', fontsize=12)
plt.tight_layout()

# Save to output directory
output_dir = os.environ.get('A2R_OUTPUT_DIR', '/tmp/a2r-output')
os.makedirs(output_dir, exist_ok=True)
output_path = os.path.join(output_dir, 'viz_${Date.now()}.png')
plt.savefig(output_path, dpi=150, bbox_inches='tight', facecolor='white')
plt.close()

print(f"A2R_OUTPUT:{output_path}")
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
      plotCode = `fig = px.bar(df, x='${xCol}', y='${yCol}', title='${type.charAt(0).toUpperCase() + type.slice(1)} Chart', color='${yCol}')`;
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
import os

# Create visualization
${plotCode}

# Save to output directory
output_dir = os.environ.get('A2R_OUTPUT_DIR', '/tmp/a2r-output')
os.makedirs(output_dir, exist_ok=True)
output_path = os.path.join(output_dir, 'viz_${Date.now()}.html')
fig.write_html(output_path, include_plotlyjs='cdn')

print(f"A2R_OUTPUT:{output_path}")
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
      plotCode = `sns.barplot(data=df, x='${xCol}', y='${yCol}', palette='viridis')`;
      break;
    case 'line':
      plotCode = `sns.lineplot(data=df, x='${xCol}', y='${yCol}', marker='o')`;
      break;
    case 'scatter':
      plotCode = `sns.scatterplot(data=df, x='${xCol}', y='${yCol}', alpha=0.6)`;
      break;
    case 'heatmap':
      plotCode = `sns.heatmap(df.corr(), annot=True, cmap='coolwarm', fmt='.2f', square=True)`;
      break;
    default:
      plotCode = `sns.lineplot(data=df, x='${xCol}', y='${yCol}')`;
  }

  return `${dfCode}
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
import seaborn as sns
import os

# Set style
sns.set_style("whitegrid")
sns.set_palette("husl")

# Create visualization
plt.figure(figsize=(10, 6))
${plotCode}
plt.title('${type.charAt(0).toUpperCase() + type.slice(1)} Chart', fontsize=14, pad=20)
plt.tight_layout()

# Save to output directory
output_dir = os.environ.get('A2R_OUTPUT_DIR', '/tmp/a2r-output')
os.makedirs(output_dir, exist_ok=True)
output_path = os.path.join(output_dir, 'viz_${Date.now()}.png')
plt.savefig(output_path, dpi=150, bbox_inches='tight', facecolor='white')
plt.close()

print(f"A2R_OUTPUT:{output_path}")
`;
}

// ============================================================================
// Execution Service
// ============================================================================

export class PythonExecutionService {
  private config: PythonExecutionConfig;
  private sessions: Map<string, ExecutionSession> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();

  constructor(config: Partial<PythonExecutionConfig> = {}) {
    this.config = {
      backend: config.backend ?? this.detectBackend(),
      httpEndpoint: config.httpEndpoint ?? 'http://127.0.0.1:3021/execute',
      kernelSocketPath: config.kernelSocketPath ?? '/var/run/a2r/daemon.sock',
      defaultTimeout: config.defaultTimeout ?? 30000,
      debug: config.debug ?? false,
    };

    this.log('Initialized with backend:', this.config.backend);
  }

  private detectBackend(): ExecutionBackend {
    // Auto-detect best available backend
    if (typeof window !== 'undefined' && window.electron?.kernel) {
      return 'kernel';
    }
    return 'mock';
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[PythonExecutionService]', ...args);
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Execute Python code
   */
  async execute(request: PythonExecutionRequest): Promise<PythonExecutionResult> {
    const session: ExecutionSession = {
      id: request.executionId,
      status: 'pending',
      request,
      startTime: Date.now(),
    };

    this.sessions.set(session.id, session);

    try {
      session.status = 'running';
      
      let result: PythonExecutionResult;

      switch (this.config.backend) {
        case 'kernel':
          result = await this.executeViaKernel(request);
          break;
        case 'http':
          result = await this.executeViaHttp(request);
          break;
        case 'mock':
          result = await this.executeViaMock(request);
          break;
        default:
          throw new Error(`Unknown Python execution backend: ${this.config.backend}`);
      }

      session.status = result.success ? 'completed' : 'error';
      session.result = result;
      session.endTime = Date.now();

      return result;
    } catch (error) {
      const errorResult: PythonExecutionResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stdout: '',
        stderr: '',
        executionTime: Date.now() - session.startTime,
      };

      session.status = 'error';
      session.result = errorResult;
      session.endTime = Date.now();

      return errorResult;
    }
  }

  /**
   * Cancel an ongoing execution
   */
  cancel(executionId: string): void {
    const controller = this.abortControllers.get(executionId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(executionId);
    }

    const session = this.sessions.get(executionId);
    if (session && session.status === 'running') {
      session.status = 'cancelled';
      session.endTime = Date.now();
    }
  }

  /**
   * Get session status
   */
  getSession(executionId: string): ExecutionSession | undefined {
    return this.sessions.get(executionId);
  }

  /**
   * Get all sessions
   */
  getAllSessions(): ExecutionSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Clean up old sessions
   */
  cleanup(maxAgeMs: number = 3600000): void {
    const now = Date.now();
    this.sessions.forEach((session, id) => {
      if (session.endTime && (now - session.endTime) > maxAgeMs) {
        this.sessions.delete(id);
        this.abortControllers.delete(id);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Backend Implementations
  // -------------------------------------------------------------------------

  private async executeViaKernel(request: PythonExecutionRequest): Promise<PythonExecutionResult> {
    // Kernel execution via Electron IPC
    if (typeof window === 'undefined' || !window.electron?.kernel) {
      throw new Error('Electron kernel IPC not available');
    }

    const abortController = new AbortController();
    this.abortControllers.set(request.executionId, abortController);

    try {
      if (!window.electron?.kernel?.execute) {
        throw new Error('Electron kernel not available');
      }
      const result = await window.electron.kernel.execute({
        code: request.code,
        timeout: request.timeout ?? this.config.defaultTimeout,
        libraries: request.libraries,
        env: request.env,
        workingDir: request.workingDir,
      });

      return {
        success: result.success,
        stdout: result.stdout,
        stderr: result.stderr,
        error: result.error,
        outputUrl: result.outputPath ? `file://${result.outputPath}` : undefined,
        executionTime: result.executionTime,
        exitCode: result.exitCode,
      };
    } finally {
      this.abortControllers.delete(request.executionId);
    }
  }

  private async executeViaHttp(request: PythonExecutionRequest): Promise<PythonExecutionResult> {
    const abortController = new AbortController();
    this.abortControllers.set(request.executionId, abortController);

    const timeoutId = setTimeout(
      () => abortController.abort(),
      request.timeout ?? this.config.defaultTimeout
    );

    try {
      const response = await fetch(this.config.httpEndpoint!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: request.code,
          libraries: request.libraries,
          timeout: request.timeout ?? this.config.defaultTimeout,
          context: request.context,
          env: request.env,
        }),
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: data.success,
        stdout: data.stdout || '',
        stderr: data.stderr || '',
        error: data.error,
        outputUrl: data.outputUrl,
        executionTime: data.executionTime,
        exitCode: data.exitCode,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: 'Execution cancelled or timed out',
          stdout: '',
          stderr: '',
          executionTime: request.timeout ?? this.config.defaultTimeout,
        };
      }

      throw error;
    } finally {
      this.abortControllers.delete(request.executionId);
    }
  }

  private async executeViaMock(_request: PythonExecutionRequest): Promise<PythonExecutionResult> {
    return {
      success: false,
      stdout: '',
      stderr: 'Python runtime unavailable',
      executionTime: 0,
      exitCode: 1,
      error: 'No Python execution backend is connected',
    };
  }

  // -------------------------------------------------------------------------
  // DataGrid Integration
  // -------------------------------------------------------------------------

  async executeVisualization(
    programId: string,
    vizId: string,
    library: VisualizationLibrary = 'matplotlib'
  ): Promise<void> {
    const store = useSidecarStore.getState();
    const state = store.getProgramState<DataGridState>(programId);
    
    if (!state) {
      throw new Error(`Program ${programId} not found`);
    }

    const viz = state.visualizations.find(v => v.id === vizId);
    if (!viz) {
      throw new Error(`Visualization ${vizId} not found`);
    }

    // Update status to rendering
    this.updateVizStatus(programId, vizId, 'rendering');

    try {
      // Extract columns and data
      const columns = viz.config.columns as string[] || state.columns.map(c => c.id);
      const data = state.rows.map(row => row.cells);

      // Generate Python code
      const code = generateVisualizationCode(viz.type, columns, data, library);

      // Save code to state
      store.updateProgramState<DataGridState>(programId, (prev) => ({
        ...prev,
        visualizations: prev.visualizations.map(v => 
          v.id === vizId ? { ...v, pythonCode: code } : v
        ),
      }));

      // Execute
      const result = await this.execute({
        executionId: `viz-${programId}-${vizId}`,
        code,
        libraries: this.getRequiredLibraries(library),
        timeout: 60000,
        context: { programId, vizId },
      });

      // Update with result
      if (result.success && result.outputUrl) {
        this.updateVizComplete(programId, vizId, result.outputUrl);
      } else {
        this.updateVizError(programId, vizId, result.error || 'Unknown error');
      }
    } catch (error) {
      this.updateVizError(programId, vizId, error instanceof Error ? error.message : String(error));
    }
  }

  private getRequiredLibraries(library: VisualizationLibrary): string[] {
    const libs: Record<VisualizationLibrary, string[]> = {
      matplotlib: ['matplotlib', 'pandas', 'numpy', 'seaborn'],
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

import { useCallback, useRef, useEffect } from 'react';

export interface UsePythonExecutionOptions {
  backend?: ExecutionBackend;
  httpEndpoint?: string;
  debug?: boolean;
}

export function usePythonExecution(options: UsePythonExecutionOptions = {}) {
  const serviceRef = useRef(new PythonExecutionService({
    backend: options.backend,
    httpEndpoint: options.httpEndpoint,
    debug: options.debug,
  }));

  // Cleanup old sessions periodically
  useEffect(() => {
    const interval = setInterval(() => {
      serviceRef.current.cleanup();
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, []);

  const execute = useCallback(async (request: PythonExecutionRequest) => {
    return serviceRef.current.execute(request);
  }, []);

  const cancel = useCallback((executionId: string) => {
    serviceRef.current.cancel(executionId);
  }, []);

  const executeViz = useCallback(async (
    programId: string,
    vizId: string,
    library: VisualizationLibrary = 'matplotlib'
  ) => {
    return serviceRef.current.executeVisualization(programId, vizId, library);
  }, []);

  const generateCode = useCallback((
    type: DataGridVisualization['type'],
    columns: string[],
    data: Record<string, unknown>[],
    library: VisualizationLibrary
  ) => {
    return generateVisualizationCode(type, columns, data, library);
  }, []);

  const getSession = useCallback((executionId: string) => {
    return serviceRef.current.getSession(executionId);
  }, []);

  return {
    execute,
    cancel,
    executeViz,
    generateCode,
    getSession,
    service: serviceRef.current,
  };
}

// ============================================================================
// Singleton Export
// ============================================================================

export const pythonExecutionService = new PythonExecutionService();
export default PythonExecutionService;
