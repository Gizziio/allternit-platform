/**
 * Visual Artifact Types for Agent Verification
 * 
 * These types represent visual evidence that helps an AI agent
 * verify code correctness beyond what can be understood from text alone.
 */

export type VisualArtifactType = 
  | "ui-state"           // Rendered UI component/state
  | "visual-diff"        // Before/after comparison
  | "coverage-map"       // Code coverage heatmap
  | "performance-chart"  // Performance visualization
  | "error-state"        // Error/crash visualization
  | "structure-diagram"  // Code structure visualization
  | "console-output"     // Terminal/CLI output capture
  | "network-trace";     // Network request visualization

export interface VisualArtifact {
  /** Unique identifier */
  id: string;
  
  /** Type of visual artifact */
  type: VisualArtifactType;
  
  /** Human-readable description for the LLM */
  description: string;
  
  /** Timestamp of capture */
  timestamp: string;
  
  /** What this artifact proves/disproves */
  verificationClaim: string;
  
  /** Confidence this artifact supports the claim (0-1) */
  confidence: number;
  
  /** Image data (PNG/JPG/SVG) */
  image?: ImageData;
  
  /** Structured data representation */
  data?: Record<string, unknown>;
  
  /** Annotations on the visual */
  annotations: VisualAnnotation[];
  
  /** Related code locations */
  sourceRefs?: SourceReference[];
  
  /** How to interpret this for the LLM */
  llmContext: string;
}

export interface ImageData {
  /** Path to the image file */
  path: string;
  
  /** Image format */
  format: "png" | "jpg" | "svg" | "webp";
  
  /** Dimensions */
  width: number;
  height: number;
  
  /** Base64 data for embedding in prompts */
  base64?: string;
  
  /** Size in bytes */
  sizeBytes?: number;
}

export interface VisualAnnotation {
  /** Label text */
  label: string;
  
  /** Region coordinates (if applicable) */
  region?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  
  /** Color for highlighting */
  color?: "red" | "green" | "blue" | "yellow" | "orange";
  
  /** Severity/importance */
  severity?: "info" | "warning" | "error" | "critical";
  
  /** What the agent should notice */
  note: string;
}

export interface SourceReference {
  /** File path */
  file: string;
  
  /** Line numbers */
  lines?: { start: number; end: number };
  
  /** Function/component name */
  symbol?: string;
}

// ============================================================================
// Specific Artifact Types
// ============================================================================

/** UI State: What a component/page looks like when rendered */
export interface UIStateArtifact extends VisualArtifact {
  type: "ui-state";
  
  data: {
    /** Component name */
    componentName?: string;
    
    /** URL if web page */
    url?: string;
    
    /** Viewport size */
    viewport: { width: number; height: number };
    
    /** Computed styles of key elements */
    computedStyles?: ComputedStyle[];
    
    /** Accessibility tree snapshot */
    a11yTree?: string;
    
    /** DOM structure (simplified) */
    domSnapshot?: string;
  };
}

export interface ComputedStyle {
  /** CSS selector */
  selector: string;
  
  /** Relevant computed properties */
  properties: Record<string, string>;
}

/** Visual Diff: Before/after comparison */
export interface VisualDiffArtifact extends VisualArtifact {
  type: "visual-diff";
  
  data: {
    /** Before state */
    before: {
      image: ImageData;
      description: string;
      commit?: string;
    };
    
    /** After state */
    after: {
      image: ImageData;
      description: string;
      commit?: string;
    };
    
    /** Difference visualization */
    diff: {
      image: ImageData;
      pixelDifference: number;
      changedRegions: Array<{
        x: number;
        y: number;
        width: number;
        height: number;
        changeType: "added" | "removed" | "modified";
      }>;
    };
  };
}

/** Coverage Map: Visual representation of test coverage */
export interface CoverageMapArtifact extends VisualArtifact {
  type: "coverage-map";
  
  data: {
    /** File being analyzed */
    file: string;
    
    /** Coverage metrics */
    metrics: {
      lines: { total: number; covered: number; percentage: number };
      functions: { total: number; covered: number; percentage: number };
      branches: { total: number; covered: number; percentage: number };
    };
    
    /** Line-by-line coverage */
    lineCoverage: Array<{
      line: number;
      status: "covered" | "uncovered" | "partial";
      hits: number;
      code: string;
    }>;
    
    /** Coverage image with highlighting */
    coverageImage?: ImageData;
  };
}

/** Performance Chart: Performance visualization */
export interface PerformanceChartArtifact extends VisualArtifact {
  type: "performance-chart";
  
  data: {
    chartType: "flamegraph" | "timeline" | "memory" | "bundle-size" | "metric";
    
    /** Chart data */
    values: Array<{
      name: string;
      value: number;
      unit: string;
      threshold?: number;
    }>;
    
    /** Performance metrics */
    metrics: {
      duration?: number;
      memoryUsed?: number;
      cpuTime?: number;
      [key: string]: number | undefined;
    };
    
    /** Comparison to baseline */
    baseline?: {
      duration: number;
      delta: number;
      deltaPercentage: number;
    };
  };
}

/** Error State: Visual representation of failures */
export interface ErrorStateArtifact extends VisualArtifact {
  type: "error-state";
  
  data: {
    /** Error type */
    errorType: "runtime" | "compile" | "test-failure" | "assertion" | "crash";
    
    /** Error message */
    message: string;
    
    /** Stack trace */
    stackTrace?: string;
    
    /** Code context around error */
    codeContext?: {
      file: string;
      line: number;
      column: number;
      lines: Array<{ number: number; code: string; isErrorLine: boolean }>;
    };
    
    /** Screenshot of error state */
    screenshot?: ImageData;
    
    /** Console output */
    consoleOutput?: string;
  };
}

/** Structure Diagram: Code structure visualization */
export interface StructureDiagramArtifact extends VisualArtifact {
  type: "structure-diagram";
  
  data: {
    diagramType: "dependency-graph" | "component-tree" | "class-diagram" | "data-flow";
    
    /** Nodes in the diagram */
    nodes: Array<{
      id: string;
      label: string;
      type: string;
      file?: string;
    }>;
    
    /** Edges between nodes */
    edges: Array<{
      from: string;
      to: string;
      label?: string;
      type: "import" | "extend" | "implement" | "call" | "data";
    }>;
    
    /** Diagram image */
    diagramImage?: ImageData;
    
    /** Mermaid/DOT source for regeneration */
    source?: string;
  };
}

/** Console Output: Terminal/CLI capture */
export interface ConsoleOutputArtifact extends VisualArtifact {
  type: "console-output";
  
  data: {
    /** Command that was run */
    command: string;
    
    /** Exit code */
    exitCode: number;
    
    /** Standard output */
    stdout: string;
    
    /** Standard error */
    stderr: string;
    
    /** Duration */
    durationMs: number;
    
    /** Parsed test results (if applicable) */
    testResults?: {
      passed: number;
      failed: number;
      skipped: number;
      total: number;
      failures: Array<{
        name: string;
        message: string;
        stack?: string;
      }>;
    };
  };
}
