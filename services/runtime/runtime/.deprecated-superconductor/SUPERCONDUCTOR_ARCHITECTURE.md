# Allternitchitech Superconductor Integration Architecture

## Overview

This document outlines the integration of Superconductor as both a capability specification and an optional backend provider for Allternitchitech. This integration enables parallel agent execution with live previews while maintaining Allternitchitech's sovereign agent core and canvas philosophy.

## Architecture Components

### 1. Parallel Execution Backend Configuration

Allternitchitech now supports multiple parallel execution backends:

```typescript
type ParallelExecutionBackend = 'local' | 'selfhosted' | 'superconductor';

interface ParallelExecutionConfig {
  backend: ParallelExecutionBackend;
  // Backend-specific configuration
  superconductor?: {
    apiKey?: string;
    endpoint?: string;
    pollingInterval?: number;
  };
  selfhosted?: {
    clusterEndpoint?: string;
    resourceLimits?: ResourceLimits;
  };
  local?: {
    maxConcurrency?: number;
    resourceLimits?: ResourceLimits;
  };
}
```

### 2. Normalized Job Contract (Stable Internal API)

```typescript
interface ParallelRun {
  runId: string;
  goal: string;
  snapshotId?: string; // Optional depending on backend
  variants: Variant[];
  verificationProfile?: VerificationProfile;
  createdAt: string;
  backend: ParallelExecutionBackend;
}

interface Variant {
  variantId: string;
  model: string; // e.g., 'claude-sonnet', 'gpt-4', 'gemini-pro', etc.
  agentType: string; // e.g., 'code', 'research', 'analysis'
  params: Record<string, any>;
  priority?: number;
}

interface VerificationProfile {
  tests?: boolean;
  linting?: boolean;
  typechecking?: boolean;
  customChecks?: string[];
}
```

### 3. Executor Interface

```typescript
interface Executor {
  execute(run: ParallelRun): Promise<ExecutionResult>;
  pollStatus(runId: string): Promise<ExecutionStatus>;
  cancel(runId: string): Promise<void>;
  streamUpdates?(runId: string): AsyncIterable<ExecutionUpdate>;
}

interface ExecutionResult {
  runId: string;
  status: 'completed' | 'failed' | 'cancelled' | 'partial';
  results: VariantResult[];
  createdAt: string;
  completedAt?: string;
}

interface VariantResult {
  variantId: string;
  status: 'completed' | 'failed' | 'timeout';
  output?: string;
  previewUrl?: string;
  diff?: string;
  verificationResults?: VerificationResult[];
  error?: string;
}

interface ExecutionUpdate {
  runId: string;
  variantId?: string;
  eventType: 'started' | 'progress' | 'preview-ready' | 'diff-ready' | 'verification-result' | 'completed' | 'error';
  payload: any;
  timestamp: string;
}
```

### 4. Canvas Event Protocol Mapping

Superconductor outputs are translated into Allternitchitech's CanvasEvent protocol:

```typescript
type CanvasEventType = 
  | 'run.parallel.launch'      // Launch Implementations GenTab
  | 'render.preview.url'       // Live Preview GenTab
  | 'render.diff.patch'        // Diff Viewer GenTab
  | 'render.verification.summary' // Test/Lint/Typecheck GenTab
  | 'status.run';              // Progress + degraded states

interface CanvasEvent {
  type: CanvasEventType;
  topic: string;
  payload: any;
  ts: number;
  runId: string;
  variantId?: string;
}
```

## Package Structure

```
/packages
  /executor-superconductor     # NEW: SuperconductorExecutor implementation
  /parallel-run               # NEW: ParallelRun contract and utilities
  /executor-core             # Existing: Executor interface and base classes
  /canvas-protocol          # Existing: CanvasEvent protocol
  /cli                      # Updated: CLI with new parallel commands
```

## Executor Implementations

### LocalExecutor
- Runs parallel variants locally
- Limited by local resources
- Suitable for development and small runs

### BackgroundExecutor
- Runs parallel variants on Allternitchitech infrastructure
- Self-hosted solution
- Scalable resource allocation

### SuperconductorExecutor (NEW)
- Delegates runs to Superconductor service
- Provides immediate access to high-performance parallel execution
- Includes live browser previews
- Handles multiple agent stacks (Claude, GPT, Gemini, etc.)

## CLI Commands

```bash
# Use Superconductor backend for immediate parallel execution
allternit bg parallel --backend superconductor "implement responsive navbar"

# Use self-hosted backend
allternit bg parallel --backend selfhosted "implement responsive navbar"

# Use local backend (default)
allternit bg parallel --backend local "implement responsive navbar"

# Generic command that respects config default
allternit bg parallel "implement responsive navbar"
```

## Event Flow

1. **Parallel Run Initiation**
   - `run.parallel.launch` → CanvasEvent stream
   - Creates "Launch Implementations" GenTab

2. **Preview Generation**
   - `render.preview.url` → CanvasEvent stream
   - Creates "Live Preview" GenTab with URLs per variant

3. **Diff Generation**
   - `render.diff.patch` → CanvasEvent stream
   - Creates "Diff Viewer" GenTab comparing variants

4. **Verification Results**
   - `render.verification.summary` → CanvasEvent stream
   - Creates "Test/Lint/Typecheck" GenTab

5. **Status Updates**
   - `status.run` → CanvasEvent stream
   - Updates progress and handles degraded states

## Canvas Integration

The Canvas remains optional and empty by default. When parallel runs are initiated, appropriate GenTabs are created based on the CanvasEvent stream:

- **GenTab Creation**: Each event type creates a corresponding GenTab
- **Live Updates**: Canvas updates in real-time as events stream in
- **Variant Comparison**: Diffs and previews enable easy variant comparison
- **Verification Tracking**: Test results and verification status displayed

## Benefits

1. **Immediate Capability**: Access to Superconductor's performance without waiting for self-hosted infrastructure
2. **A/B Testing**: Compare Superconductor vs self-hosted vs local execution
3. **Cost Optimization**: Choose backend based on cost/performance requirements
4. **Sovereign Core**: Maintain Allternitchitech's agent core and canvas philosophy
5. **Scalable Architecture**: Backend-agnostic design allows for future providers

## Migration Path

1. **Phase 1**: Implement SuperconductorExecutor and parallel-run contracts
2. **Phase 2**: Update CLI to support backend selection
3. **Phase 3**: Integrate Canvas event mapping for previews/diffs
4. **Phase 4**: Add configuration options and A/B testing capabilities
5. **Phase 5**: Optimize and iterate based on usage patterns

This architecture maintains Allternitchitech's core philosophy while providing immediate access to state-of-the-art parallel execution capabilities.